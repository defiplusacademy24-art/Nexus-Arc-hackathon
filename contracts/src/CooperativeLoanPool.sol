// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @dev Minimal membership check against CooperativeTreasuryVault.
interface IMembershipVault {
    function isMember(address account) external view returns (bool);
}

/**
 * @title CooperativeLoanPool
 * @notice On-chain member lending for Nexusu cooperatives on Arc.
 * @dev Production flow:
 *      - Organizer funds pool via `fundPool` (USDC)
 *      - Optional membership vault (`CooperativeTreasuryVault.isMember`) or local borrower registry
 *      - One open loan per borrower (Pending / Active / Defaulted)
 *      - Term 1–6 months → simple interest 5%–10% on principal
 *      - Max single loan share of available liquidity (default 25%)
 *      - Organizer or lending agent approves → USDC disbursed
 *      - Repayments: interest first, then principal
 *      - Principal returns to pool liquidity; interest is cooperative profit
 *      - Optional `profitRecipient` (e.g. treasury vault) auto-forwards interest
 */
contract CooperativeLoanPool is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Types ────────────────────────────────────────────────────────────────

    enum LoanStatus {
        Pending,
        Active,
        Completed,
        Rejected,
        Defaulted
    }

    struct Loan {
        address borrower;
        uint256 principal;
        uint16 interestBps; // e.g. 500 = 5%
        uint256 totalInterest;
        uint256 totalDue;
        uint256 amountPaid;
        uint256 interestPaid;
        uint8 termMonths; // 1–6
        uint64 requestedAt;
        uint64 disbursedAt;
        uint64 dueDate;
        LoanStatus status;
        string purpose; // short category label
    }

    // ── Immutables / config ──────────────────────────────────────────────────

    IERC20 public immutable usdc;
    address public organizer;
    /// @notice Optional address that may approve loans (e.g. off-chain AI agent wallet).
    address public lendingAgent;
    /// @notice Optional recipient for interest profit (treasury / savings vault).
    address public profitRecipient;
    /// @notice Optional CooperativeTreasuryVault — when set, only vault members may apply.
    address public membershipVault;

    /// @notice Max principal as bps of availableLiquidity() at approval time (default 2500 = 25%).
    uint16 public maxLoanBps = 2500;
    /// @notice Accounting: interest earned not yet withdrawn / forwarded.
    uint256 public interestEarned;
    /// @notice Accounting: principal still outstanding across active loans.
    uint256 public totalOutstandingPrincipal;

    uint256 public nextLoanId = 1;
    mapping(uint256 => Loan) private _loans;
    mapping(address => uint256[]) private _borrowerLoanIds;
    /// @dev Local allowlist when membershipVault is unset.
    mapping(address => bool) private _registeredBorrowers;
    /// @dev Open loan id per borrower (Pending / Active / Defaulted). 0 = none.
    mapping(address => uint256) public openLoanId;

    /// @dev termMonths (1–6) → interest bps for full term.
    mapping(uint8 => uint16) public interestBpsByTerm;

    // ── Events ───────────────────────────────────────────────────────────────

    event OrganizerTransferred(address indexed previous, address indexed next);
    event LendingAgentUpdated(address indexed agent);
    event ProfitRecipientUpdated(address indexed recipient);
    event MembershipVaultUpdated(address indexed vault);
    event BorrowerRegistered(address indexed borrower);
    event MaxLoanBpsUpdated(uint16 bps);
    event PoolFunded(address indexed from, uint256 amount);
    event LoanApplied(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 principal,
        uint8 termMonths,
        uint16 interestBps,
        uint256 totalDue
    );
    event LoanApproved(uint256 indexed loanId, address indexed borrower, uint256 principal);
    event LoanRejected(uint256 indexed loanId, address indexed borrower);
    event LoanCancelled(uint256 indexed loanId, address indexed borrower);
    event LoanUpdated(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 principal,
        uint8 termMonths,
        uint16 interestBps,
        uint256 totalDue
    );
    event LoanRepaid(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 amount,
        uint256 principalPortion,
        uint256 interestPortion,
        uint256 remaining,
        bool fullyPaid
    );
    event InterestWithdrawn(address indexed to, uint256 amount);
    event LoanDefaulted(uint256 indexed loanId);

    // ── Errors ───────────────────────────────────────────────────────────────

    error NotOrganizer();
    error NotApprover();
    error NotBorrower();
    error NotEligibleBorrower();
    error HasOpenLoan();
    error ZeroAddress();
    error InvalidAmount();
    error InvalidTerm();
    error InvalidBps();
    error LoanNotFound();
    error BadStatus();
    error InsufficientLiquidity();
    error ExceedsMaxLoan();
    error NothingToRepay();
    error TransferFailed();

    // ── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOrganizer() {
        if (msg.sender != organizer) revert NotOrganizer();
        _;
    }

    modifier onlyApprover() {
        if (msg.sender != organizer && msg.sender != lendingAgent) revert NotApprover();
        _;
    }

    // ── Constructor ──────────────────────────────────────────────────────────

    /**
     * @param usdc_ Arc USDC ERC-20 (testnet: 0x3600…0000, 6 decimals)
     * @param organizer_ Cooperative founder / loan approver
     * @param membershipVault_ Optional treasury vault for member checks (address(0) = local registry)
     */
    constructor(address usdc_, address organizer_, address membershipVault_) {
        if (usdc_ == address(0) || organizer_ == address(0)) revert ZeroAddress();
        usdc = IERC20(usdc_);
        organizer = organizer_;
        membershipVault = membershipVault_;

        // Match product interest table (full-term simple interest)
        interestBpsByTerm[1] = 500; // 5%
        interestBpsByTerm[2] = 600; // 6%
        interestBpsByTerm[3] = 700; // 7%
        interestBpsByTerm[4] = 800; // 8%
        interestBpsByTerm[5] = 900; // 9%
        interestBpsByTerm[6] = 1000; // 10%
    }

    // ── Admin ────────────────────────────────────────────────────────────────

    function transferOrganizer(address newOrganizer) external onlyOrganizer {
        if (newOrganizer == address(0)) revert ZeroAddress();
        address prev = organizer;
        organizer = newOrganizer;
        emit OrganizerTransferred(prev, newOrganizer);
    }

    function setLendingAgent(address agent) external onlyOrganizer {
        lendingAgent = agent;
        emit LendingAgentUpdated(agent);
    }

    function setProfitRecipient(address recipient) external onlyOrganizer {
        profitRecipient = recipient;
        emit ProfitRecipientUpdated(recipient);
    }

    /**
     * @notice Point at CooperativeTreasuryVault so only vault members may apply.
     *         address(0) falls back to the local borrower registry.
     */
    function setMembershipVault(address vault) external onlyOrganizer {
        membershipVault = vault;
        emit MembershipVaultUpdated(vault);
    }

    /**
     * @notice Register a borrower when no membership vault is configured.
     *         Also useful to pre-allow wallets before vault registration.
     */
    function registerBorrower(address borrower) external onlyOrganizer {
        if (borrower == address(0)) revert ZeroAddress();
        _registeredBorrowers[borrower] = true;
        emit BorrowerRegistered(borrower);
    }

    function registerBorrowers(address[] calldata borrowers) external onlyOrganizer {
        uint256 len = borrowers.length;
        for (uint256 i = 0; i < len; ) {
            address b = borrowers[i];
            if (b == address(0)) revert ZeroAddress();
            _registeredBorrowers[b] = true;
            emit BorrowerRegistered(b);
            unchecked {
                ++i;
            }
        }
    }

    function setMaxLoanBps(uint16 bps) external onlyOrganizer {
        if (bps == 0 || bps > 10_000) revert InvalidBps();
        maxLoanBps = bps;
        emit MaxLoanBpsUpdated(bps);
    }

    function setInterestBpsForTerm(uint8 termMonths, uint16 bps) external onlyOrganizer {
        if (termMonths < 1 || termMonths > 6) revert InvalidTerm();
        if (bps > 5_000) revert InvalidBps(); // hard cap 50%
        interestBpsByTerm[termMonths] = bps;
    }

    // ── Funding ──────────────────────────────────────────────────────────────

    /**
     * @notice Deposit USDC into the loan pool (requires prior ERC-20 approve).
     * @dev Open to organizer and to the membership vault (so treasury can auto-forward
     *      loan share on each member deposit). Other callers are rejected.
     */
    function fundPool(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (
            msg.sender != organizer &&
            (membershipVault == address(0) || msg.sender != membershipVault)
        ) {
            revert NotOrganizer();
        }
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit PoolFunded(msg.sender, amount);
    }

    /**
     * @notice USDC available for new disbursements (balance − reserved interest profit).
     * @dev Outstanding principal is already outside the contract balance.
     */
    function availableLiquidity() public view returns (uint256) {
        uint256 bal = usdc.balanceOf(address(this));
        uint256 reserved = interestEarned;
        if (bal <= reserved) return 0;
        return bal - reserved;
    }

    // ── Borrow ───────────────────────────────────────────────────────────────

    /**
     * @notice Apply for a cooperative loan. Does not move funds until approved.
     * @param principal Amount in USDC base units (6 decimals)
     * @param termMonths 1–6
     * @param purpose Short purpose label (e.g. "Business")
     */
    function applyForLoan(
        uint256 principal,
        uint8 termMonths,
        string calldata purpose
    ) external nonReentrant returns (uint256 loanId) {
        if (!_isEligibleBorrower(msg.sender)) revert NotEligibleBorrower();
        if (_hasBlockingOpenLoan(msg.sender)) revert HasOpenLoan();
        if (principal == 0) revert InvalidAmount();
        if (termMonths < 1 || termMonths > 6) revert InvalidTerm();

        uint16 bps = interestBpsByTerm[termMonths];
        if (bps == 0) revert InvalidTerm();

        uint256 totalInterest = (principal * uint256(bps)) / 10_000;
        uint256 totalDue = principal + totalInterest;

        loanId = nextLoanId;
        unchecked {
            nextLoanId = loanId + 1;
        }

        _loans[loanId] = Loan({
            borrower: msg.sender,
            principal: principal,
            interestBps: bps,
            totalInterest: totalInterest,
            totalDue: totalDue,
            amountPaid: 0,
            interestPaid: 0,
            termMonths: termMonths,
            requestedAt: uint64(block.timestamp),
            disbursedAt: 0,
            dueDate: 0,
            status: LoanStatus.Pending,
            purpose: purpose
        });
        _borrowerLoanIds[msg.sender].push(loanId);
        openLoanId[msg.sender] = loanId;

        emit LoanApplied(loanId, msg.sender, principal, termMonths, bps, totalDue);
    }

    /**
     * @notice Approve a pending loan and disburse principal to the borrower.
     */
    function approveLoan(uint256 loanId) external nonReentrant onlyApprover {
        Loan storage loan = _loans[loanId];
        if (loan.borrower == address(0)) revert LoanNotFound();
        if (loan.status != LoanStatus.Pending) revert BadStatus();

        uint256 liq = availableLiquidity();
        if (liq < loan.principal) revert InsufficientLiquidity();

        uint256 maxAllowed = (liq * uint256(maxLoanBps)) / 10_000;
        if (loan.principal > maxAllowed) revert ExceedsMaxLoan();

        loan.status = LoanStatus.Active;
        loan.disbursedAt = uint64(block.timestamp);
        // Approximate months as 30 days for due date
        loan.dueDate = uint64(block.timestamp + uint256(loan.termMonths) * 30 days);

        totalOutstandingPrincipal += loan.principal;
        openLoanId[loan.borrower] = loanId;

        emit LoanApproved(loanId, loan.borrower, loan.principal);

        usdc.safeTransfer(loan.borrower, loan.principal);
    }

    /**
     * @notice Reject a pending loan application (no funds moved).
     */
    function rejectLoan(uint256 loanId) external onlyApprover {
        Loan storage loan = _loans[loanId];
        if (loan.borrower == address(0)) revert LoanNotFound();
        if (loan.status != LoanStatus.Pending) revert BadStatus();
        loan.status = LoanStatus.Rejected;
        if (openLoanId[loan.borrower] == loanId) {
            openLoanId[loan.borrower] = 0;
        }
        emit LoanRejected(loanId, loan.borrower);
    }

    /**
     * @notice Borrower cancels their own pending application (no funds moved).
     */
    function cancelApplication(uint256 loanId) external {
        Loan storage loan = _loans[loanId];
        if (loan.borrower == address(0)) revert LoanNotFound();
        if (msg.sender != loan.borrower) revert NotBorrower();
        if (loan.status != LoanStatus.Pending) revert BadStatus();
        loan.status = LoanStatus.Rejected;
        if (openLoanId[msg.sender] == loanId) {
            openLoanId[msg.sender] = 0;
        }
        emit LoanCancelled(loanId, msg.sender);
    }

    /**
     * @notice Borrower updates amount / term / purpose while still pending.
     */
    function updateApplication(
        uint256 loanId,
        uint256 principal,
        uint8 termMonths,
        string calldata purpose
    ) external {
        Loan storage loan = _loans[loanId];
        if (loan.borrower == address(0)) revert LoanNotFound();
        if (msg.sender != loan.borrower) revert NotBorrower();
        if (loan.status != LoanStatus.Pending) revert BadStatus();
        if (principal == 0) revert InvalidAmount();
        if (termMonths < 1 || termMonths > 6) revert InvalidTerm();

        uint16 bps = interestBpsByTerm[termMonths];
        if (bps == 0) revert InvalidTerm();

        uint256 totalInterest = (principal * uint256(bps)) / 10_000;
        loan.principal = principal;
        loan.interestBps = bps;
        loan.totalInterest = totalInterest;
        loan.totalDue = principal + totalInterest;
        loan.termMonths = termMonths;
        loan.purpose = purpose;

        emit LoanUpdated(loanId, msg.sender, principal, termMonths, bps, loan.totalDue);
    }

    /**
     * @notice Mark an overdue active loan as defaulted.
     * @dev Does not seize funds; remaining balance stays outstanding until repaid.
     */
    function markDefaulted(uint256 loanId) external onlyOrganizer {
        Loan storage loan = _loans[loanId];
        if (loan.borrower == address(0)) revert LoanNotFound();
        if (loan.status != LoanStatus.Active) revert BadStatus();
        if (loan.dueDate == 0 || block.timestamp < loan.dueDate) revert BadStatus();
        loan.status = LoanStatus.Defaulted;
        openLoanId[loan.borrower] = loanId;
        emit LoanDefaulted(loanId);
    }

    // ── Repayment ────────────────────────────────────────────────────────────

    /**
     * @notice Repay part or all of an active (or defaulted) loan.
     * @dev Interest first, then principal. Caller must approve USDC first.
     *      Anyone may pay (borrower or sponsor).
     */
    function repay(uint256 loanId, uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();

        Loan storage loan = _loans[loanId];
        if (loan.borrower == address(0)) revert LoanNotFound();
        if (loan.status != LoanStatus.Active && loan.status != LoanStatus.Defaulted) {
            revert BadStatus();
        }

        uint256 remaining = loan.totalDue - loan.amountPaid;
        if (remaining == 0) revert NothingToRepay();

        uint256 pay = amount > remaining ? remaining : amount;

        // Pull USDC from payer (borrower or sponsor)
        usdc.safeTransferFrom(msg.sender, address(this), pay);

        uint256 remInterest = loan.totalInterest - loan.interestPaid;
        uint256 interestPortion = pay > remInterest ? remInterest : pay;
        uint256 principalPortion = pay - interestPortion;

        loan.amountPaid += pay;
        loan.interestPaid += interestPortion;

        if (interestPortion > 0) {
            interestEarned += interestPortion;
        }
        if (principalPortion > 0) {
            if (principalPortion > totalOutstandingPrincipal) {
                totalOutstandingPrincipal = 0;
            } else {
                unchecked {
                    totalOutstandingPrincipal -= principalPortion;
                }
            }
        }

        bool fullyPaid = loan.amountPaid >= loan.totalDue;
        if (fullyPaid) {
            loan.status = LoanStatus.Completed;
            if (openLoanId[loan.borrower] == loanId) {
                openLoanId[loan.borrower] = 0;
            }
        }

        uint256 remainingAfter = loan.totalDue - loan.amountPaid;

        emit LoanRepaid(
            loanId,
            loan.borrower,
            pay,
            principalPortion,
            interestPortion,
            remainingAfter,
            fullyPaid
        );

        // Optionally forward interest immediately to treasury / profit recipient
        if (interestPortion > 0 && profitRecipient != address(0)) {
            uint256 toSend = interestPortion;
            if (toSend > interestEarned) toSend = interestEarned;
            interestEarned -= toSend;
            usdc.safeTransfer(profitRecipient, toSend);
            emit InterestWithdrawn(profitRecipient, toSend);
        }
    }

    /**
     * @notice Organizer withdraws accrued interest profit (when not auto-forwarded).
     */
    function withdrawInterest(address to, uint256 amount) external nonReentrant onlyOrganizer {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0 || amount > interestEarned) revert InvalidAmount();
        interestEarned -= amount;
        usdc.safeTransfer(to, amount);
        emit InterestWithdrawn(to, amount);
    }

    // ── Views ────────────────────────────────────────────────────────────────

    function getLoan(uint256 loanId) external view returns (Loan memory) {
        if (_loans[loanId].borrower == address(0)) revert LoanNotFound();
        return _loans[loanId];
    }

    function remainingBalance(uint256 loanId) external view returns (uint256) {
        Loan storage loan = _loans[loanId];
        if (loan.borrower == address(0)) revert LoanNotFound();
        if (loan.amountPaid >= loan.totalDue) return 0;
        return loan.totalDue - loan.amountPaid;
    }

    function remainingPrincipal(uint256 loanId) external view returns (uint256) {
        Loan storage loan = _loans[loanId];
        if (loan.borrower == address(0)) revert LoanNotFound();
        uint256 remInterest = loan.totalInterest > loan.interestPaid
            ? loan.totalInterest - loan.interestPaid
            : 0;
        uint256 remTotal = loan.totalDue > loan.amountPaid ? loan.totalDue - loan.amountPaid : 0;
        if (remTotal <= remInterest) return 0;
        return remTotal - remInterest;
    }

    function getBorrowerLoans(address borrower) external view returns (uint256[] memory) {
        return _borrowerLoanIds[borrower];
    }

    function isEligibleBorrower(address account) external view returns (bool) {
        return _isEligibleBorrower(account);
    }

    function isRegisteredBorrower(address account) external view returns (bool) {
        return _registeredBorrowers[account];
    }

    function quoteLoan(
        uint256 principal,
        uint8 termMonths
    )
        external
        view
        returns (uint16 interestBps, uint256 totalInterest, uint256 totalDue, uint256 monthlyPayment)
    {
        if (termMonths < 1 || termMonths > 6) revert InvalidTerm();
        interestBps = interestBpsByTerm[termMonths];
        totalInterest = (principal * uint256(interestBps)) / 10_000;
        totalDue = principal + totalInterest;
        monthlyPayment = totalDue / uint256(termMonths);
    }

    function getPoolStats()
        external
        view
        returns (
            uint256 usdcBalance,
            uint256 liquidity,
            uint256 outstandingPrincipal,
            uint256 interestAccrued,
            uint256 loanCount
        )
    {
        usdcBalance = usdc.balanceOf(address(this));
        liquidity = availableLiquidity();
        outstandingPrincipal = totalOutstandingPrincipal;
        interestAccrued = interestEarned;
        loanCount = nextLoanId - 1;
    }

    /**
     * @notice Whether a borrower may apply right now.
     */
    function canApply(address account) external view returns (bool ok, string memory reason) {
        if (!_isEligibleBorrower(account)) {
            return (false, "not_eligible_borrower");
        }
        if (_hasBlockingOpenLoan(account)) {
            return (false, "has_open_loan");
        }
        return (true, "");
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    function _isEligibleBorrower(address account) internal view returns (bool) {
        if (membershipVault != address(0)) {
            return IMembershipVault(membershipVault).isMember(account);
        }
        return _registeredBorrowers[account];
    }

    function _hasBlockingOpenLoan(address account) internal view returns (bool) {
        uint256 id = openLoanId[account];
        if (id == 0) return false;
        LoanStatus s = _loans[id].status;
        return s == LoanStatus.Pending || s == LoanStatus.Active || s == LoanStatus.Defaulted;
    }
}
