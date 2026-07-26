// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CooperativeTreasuryVault
 * @notice On-chain treasury vault for Nexusu cooperatives on Arc.
 * @dev Holds member USDC contributions, allocates them across configured
 *      buckets, tracks per-cycle contribution status, and pays out according
 *      to the cooperative's selected rotation strategy.
 *
 * Payout strategies:
 *  - JoinOrder (default): permanent join positions; #1 then #2 … then wraps
 *  - RandomDraw: pseudo-random recipient each cycle
 *  - OrganizerAssigned: organizer-defined permanent positions
 *  - GovernanceVote: members vote for the next recipient
 */
contract CooperativeTreasuryVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Enums ────────────────────────────────────────────────────────────────

    enum PayoutStrategy {
        JoinOrder,
        RandomDraw,
        OrganizerAssigned,
        GovernanceVote
    }

    enum ContributionStatus {
        Waiting,
        Paid,
        Exempt
    }

    // ── Types ────────────────────────────────────────────────────────────────

    /// @notice Basis-point allocation of every deposit (must sum to 10_000).
    struct AllocationConfig {
        uint16 rotationBps; // ROSCA / rotation fund (used for member payouts)
        uint16 loanPoolBps;
        uint16 emergencyBps;
        uint16 savingsBps; // savings / investment
    }

    struct Member {
        address wallet;
        uint32 joinPosition; // 1-based permanent position
        uint64 registeredAt;
        uint256 totalContributed;
        bool active;
        bool exists;
    }

    struct ContributionRecord {
        address member;
        uint256 amount;
        uint64 timestamp;
        uint32 cycle;
    }

    struct PayoutRecord {
        address recipient;
        uint256 amount;
        uint64 timestamp;
        uint32 cycle;
        uint32 position;
    }

    struct TreasuryBreakdown {
        uint256 totalBalance;
        uint256 rotationFund;
        uint256 loanPool;
        uint256 emergencyReserve;
        uint256 savingsInvestment;
    }

    // ── Immutable / config ───────────────────────────────────────────────────

    IERC20 public immutable usdc;
    address public organizer;
    string public name;
    uint256 public contributionAmount; // exact USDC amount required per cycle
    PayoutStrategy public payoutStrategy;
    AllocationConfig public allocation;

    // ── Cycle / rotation state ───────────────────────────────────────────────

    uint32 public currentCycle = 1;
    /// @notice 1-based position of the member who is currently eligible for payout.
    uint32 public currentRecipientPosition = 1;
    uint32 public memberCount;
    uint32 public nextJoinPosition = 1;

    uint256 public rotationFund;
    uint256 public loanPool;
    uint256 public emergencyReserve;
    uint256 public savingsInvestment;

    // ── Member registry ──────────────────────────────────────────────────────

    mapping(address => Member) private _members;
    /// @dev position (1-based) → member address
    mapping(uint32 => address) public memberByPosition;
    address[] private _memberList;

    // ── Per-cycle tracking ───────────────────────────────────────────────────

    /// @dev cycle => member => contributed this cycle
    mapping(uint32 => mapping(address => bool)) public hasContributed;
    /// @dev cycle => member => exempt from contribution this cycle
    mapping(uint32 => mapping(address => bool)) public isExempt;
    /// @dev cycle => number of non-exempt members who have paid
    mapping(uint32 => uint32) public cyclePaidCount;
    /// @dev cycle => number of members required (non-exempt) when counting
    mapping(uint32 => uint32) public cycleRequiredCount;
    /// @dev cycle already paid out
    mapping(uint32 => bool) public cyclePayoutCompleted;
    /// @dev rotation fund accumulated during this cycle (for payout sizing)
    mapping(uint32 => uint256) public cycleRotationAccumulated;

    // ── History ──────────────────────────────────────────────────────────────

    ContributionRecord[] private _contributions;
    mapping(address => uint256[]) private _memberContributionIndexes;
    PayoutRecord[] private _payouts;

    // ── Strategy-specific state ──────────────────────────────────────────────

    /// @dev GovernanceVote: cycle => voter => candidate
    mapping(uint32 => mapping(address => address)) public payoutVote;
    /// @dev GovernanceVote: cycle => candidate => vote count
    mapping(uint32 => mapping(address => uint32)) public voteCount;
    /// @dev OrganizerAssigned: optional override for the next payout recipient
    address public organizerNextRecipient;

    // ── Events ───────────────────────────────────────────────────────────────

    event MemberRegistered(
        address indexed member,
        uint32 joinPosition,
        uint64 timestamp
    );
    event ContributionDeposited(
        address indexed member,
        uint256 amount,
        uint32 indexed cycle,
        uint64 timestamp,
        uint256 rotationShare,
        uint256 loanShare,
        uint256 emergencyShare,
        uint256 savingsShare
    );
    event PayoutExecuted(
        address indexed recipient,
        uint256 amount,
        uint32 indexed cycle,
        uint32 position,
        uint64 timestamp
    );
    event CycleCompleted(uint32 indexed cycle, uint32 nextCycle, uint32 nextPosition);
    event MemberExemptSet(address indexed member, uint32 indexed cycle, bool exempt);
    event AllocationUpdated(AllocationConfig allocation);
    event ContributionAmountUpdated(uint256 amount);
    event PayoutStrategyUpdated(PayoutStrategy strategy);
    event OrganizerTransferred(address indexed previous, address indexed next);
    event PayoutVoteCast(address indexed voter, address indexed candidate, uint32 indexed cycle);
    event OrganizerRecipientSet(address indexed recipient);
    event VaultActivated(uint32 memberCount, uint32 cycle);

    // ── Errors ───────────────────────────────────────────────────────────────

    error NotOrganizer();
    error NotMember();
    error MemberAlreadyRegistered();
    error ZeroAddress();
    error InvalidAmount();
    error InvalidAllocation();
    error AlreadyContributed();
    error CycleAlreadyPaid();
    error ContributionsIncomplete();
    error NoEligibleRecipient();
    error VaultNotReady();
    error MemberInactive();
    error NothingToPayout();
    error TransferFailed();

    // ── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOrganizer() {
        if (msg.sender != organizer) revert NotOrganizer();
        _;
    }

    modifier onlyMember() {
        if (!_members[msg.sender].exists || !_members[msg.sender].active) {
            revert NotMember();
        }
        _;
    }

    // ── Constructor ──────────────────────────────────────────────────────────

    /**
     * @param usdc_ Arc USDC ERC-20 (testnet: 0x3600…0000)
     * @param organizer_ Cooperative founder / organizer
     * @param name_ Human-readable cooperative name
     * @param contributionAmount_ Exact USDC (6 decimals) per member per cycle
     * @param strategy_ Initial payout strategy
     * @param allocation_ Bucket split in basis points (sum = 10_000)
     */
    constructor(
        address usdc_,
        address organizer_,
        string memory name_,
        uint256 contributionAmount_,
        PayoutStrategy strategy_,
        AllocationConfig memory allocation_
    ) {
        if (usdc_ == address(0) || organizer_ == address(0)) revert ZeroAddress();
        if (contributionAmount_ == 0) revert InvalidAmount();
        _validateAllocation(allocation_);

        usdc = IERC20(usdc_);
        organizer = organizer_;
        name = name_;
        contributionAmount = contributionAmount_;
        payoutStrategy = strategy_;
        allocation = allocation_;
    }

    // ── Admin / organizer ────────────────────────────────────────────────────

    function transferOrganizer(address newOrganizer) external onlyOrganizer {
        if (newOrganizer == address(0)) revert ZeroAddress();
        address prev = organizer;
        organizer = newOrganizer;
        emit OrganizerTransferred(prev, newOrganizer);
    }

    function setContributionAmount(uint256 amount) external onlyOrganizer {
        if (amount == 0) revert InvalidAmount();
        // Only allow changes between cycles (no partial contributions yet)
        if (cyclePaidCount[currentCycle] > 0) revert AlreadyContributed();
        contributionAmount = amount;
        emit ContributionAmountUpdated(amount);
    }

    function setAllocation(AllocationConfig calldata cfg) external onlyOrganizer {
        _validateAllocation(cfg);
        allocation = cfg;
        emit AllocationUpdated(cfg);
    }

    function setPayoutStrategy(PayoutStrategy strategy) external onlyOrganizer {
        payoutStrategy = strategy;
        emit PayoutStrategyUpdated(strategy);
    }

    /**
     * @notice Register a cooperative member. Assigns the next permanent join position.
     * @dev Organizer may register themselves as the founder (position #1).
     */
    function registerMember(address member) external onlyOrganizer {
        if (member == address(0)) revert ZeroAddress();
        if (_members[member].exists) revert MemberAlreadyRegistered();

        uint32 pos = nextJoinPosition;
        _members[member] = Member({
            wallet: member,
            joinPosition: pos,
            registeredAt: uint64(block.timestamp),
            totalContributed: 0,
            active: true,
            exists: true
        });
        memberByPosition[pos] = member;
        _memberList.push(member);
        unchecked {
            nextJoinPosition = pos + 1;
            memberCount += 1;
        }

        emit MemberRegistered(member, pos, uint64(block.timestamp));
    }

    /**
     * @notice Batch-register members (gas-efficient onboarding).
     */
    function registerMembers(address[] calldata members) external onlyOrganizer {
        uint256 len = members.length;
        for (uint256 i = 0; i < len; ) {
            address member = members[i];
            if (member == address(0)) revert ZeroAddress();
            if (_members[member].exists) revert MemberAlreadyRegistered();

            uint32 pos = nextJoinPosition;
            _members[member] = Member({
                wallet: member,
                joinPosition: pos,
                registeredAt: uint64(block.timestamp),
                totalContributed: 0,
                active: true,
                exists: true
            });
            memberByPosition[pos] = member;
            _memberList.push(member);
            unchecked {
                nextJoinPosition = pos + 1;
                memberCount += 1;
                ++i;
            }
            emit MemberRegistered(member, pos, uint64(block.timestamp));
        }
    }

    function setMemberActive(address member, bool active) external onlyOrganizer {
        if (!_members[member].exists) revert NotMember();
        _members[member].active = active;
    }

    /**
     * @notice Mark a member exempt from the current (or given) cycle contribution.
     *         Exempt members are not required to deposit and do not block payout.
     */
    function setMemberExempt(address member, uint32 cycle, bool exempt) external onlyOrganizer {
        if (!_members[member].exists) revert NotMember();
        if (cycle == 0) cycle = currentCycle;
        if (cyclePayoutCompleted[cycle]) revert CycleAlreadyPaid();
        isExempt[cycle][member] = exempt;
        emit MemberExemptSet(member, cycle, exempt);
    }

    /**
     * @notice OrganizerAssigned strategy: set who receives the next payout.
     */
    function setOrganizerNextRecipient(address recipient) external onlyOrganizer {
        if (recipient != address(0)) {
            if (!_members[recipient].exists || !_members[recipient].active) {
                revert NotMember();
            }
        }
        organizerNextRecipient = recipient;
        emit OrganizerRecipientSet(recipient);
    }

    /**
     * @notice OrganizerAssigned: reassign permanent positions (full re-order).
     * @param orderedMembers Array of member addresses in desired payout order.
     */
    function setOrganizerPositions(address[] calldata orderedMembers) external onlyOrganizer {
        if (payoutStrategy != PayoutStrategy.OrganizerAssigned) {
            // Allow preparing positions before switching strategy
        }
        uint256 len = orderedMembers.length;
        if (len != memberCount) revert VaultNotReady();

        // Clear old position map for listed members and reassign 1..N
        for (uint256 i = 0; i < len; ) {
            address m = orderedMembers[i];
            if (!_members[m].exists || !_members[m].active) revert NotMember();
            uint32 newPos = uint32(i + 1);
            _members[m].joinPosition = newPos;
            memberByPosition[newPos] = m;
            unchecked {
                ++i;
            }
        }
        currentRecipientPosition = 1;
    }

    // ── Contributions ────────────────────────────────────────────────────────

    /**
     * @notice Deposit the fixed cycle contribution in USDC.
     * @dev Caller must be a registered active member, approve this vault first,
     *      and must not have already contributed (or be exempt) for `currentCycle`.
     */
    function deposit() external nonReentrant onlyMember {
        _deposit(msg.sender);
    }

    /**
     * @notice Deposit on behalf of a member (member must have approved the vault).
     *         Useful for paymasters / sponsored flows. Still debits the member's USDC.
     */
    function depositFor(address member) external nonReentrant {
        if (!_members[member].exists || !_members[member].active) revert NotMember();
        _deposit(member);
    }

    function _deposit(address member) internal {
        uint32 cycle = currentCycle;
        if (cyclePayoutCompleted[cycle]) revert CycleAlreadyPaid();
        if (hasContributed[cycle][member]) revert AlreadyContributed();
        if (isExempt[cycle][member]) revert AlreadyContributed(); // treated as non-depositable

        uint256 amount = contributionAmount;
        if (amount == 0) revert InvalidAmount();

        // Pull USDC
        usdc.safeTransferFrom(member, address(this), amount);

        // Allocate across buckets
        AllocationConfig memory cfg = allocation;
        uint256 rotationShare = (amount * cfg.rotationBps) / 10_000;
        uint256 loanShare = (amount * cfg.loanPoolBps) / 10_000;
        uint256 emergencyShare = (amount * cfg.emergencyBps) / 10_000;
        // Remainder to savings to avoid dust loss from rounding
        uint256 savingsShare = amount - rotationShare - loanShare - emergencyShare;

        rotationFund += rotationShare;
        loanPool += loanShare;
        emergencyReserve += emergencyShare;
        savingsInvestment += savingsShare;
        cycleRotationAccumulated[cycle] += rotationShare;

        hasContributed[cycle][member] = true;
        unchecked {
            cyclePaidCount[cycle] += 1;
        }
        _members[member].totalContributed += amount;

        uint256 idx = _contributions.length;
        _contributions.push(
            ContributionRecord({
                member: member,
                amount: amount,
                timestamp: uint64(block.timestamp),
                cycle: cycle
            })
        );
        _memberContributionIndexes[member].push(idx);

        emit ContributionDeposited(
            member,
            amount,
            cycle,
            uint64(block.timestamp),
            rotationShare,
            loanShare,
            emergencyShare,
            savingsShare
        );
    }

    // ── Governance votes (GovernanceVote strategy) ───────────────────────────

    /**
     * @notice Cast / change vote for who should receive the current cycle payout.
     */
    function castPayoutVote(address candidate) external onlyMember {
        if (payoutStrategy != PayoutStrategy.GovernanceVote) revert VaultNotReady();
        if (!_members[candidate].exists || !_members[candidate].active) revert NotMember();

        uint32 cycle = currentCycle;
        if (cyclePayoutCompleted[cycle]) revert CycleAlreadyPaid();

        address previous = payoutVote[cycle][msg.sender];
        if (previous != address(0) && voteCount[cycle][previous] > 0) {
            unchecked {
                voteCount[cycle][previous] -= 1;
            }
        }
        payoutVote[cycle][msg.sender] = candidate;
        unchecked {
            voteCount[cycle][candidate] += 1;
        }
        emit PayoutVoteCast(msg.sender, candidate, cycle);
    }

    // ── Payout ───────────────────────────────────────────────────────────────

    /**
     * @notice Execute the cycle payout when all required members have contributed.
     * @dev Permissionless: anyone may trigger once conditions are met.
     *      Prevents double payouts per cycle.
     */
    function triggerPayout() external nonReentrant {
        uint32 cycle = currentCycle;
        if (cyclePayoutCompleted[cycle]) revert CycleAlreadyPaid();
        if (memberCount == 0) revert VaultNotReady();

        (bool ready, uint32 required, uint32 paid) = _contributionProgress(cycle);
        cycleRequiredCount[cycle] = required;
        if (!ready) revert ContributionsIncomplete();
        if (paid == 0 && required == 0) revert NothingToPayout();

        address recipient = _resolveRecipient(cycle);
        if (recipient == address(0)) revert NoEligibleRecipient();

        uint256 payoutAmount = cycleRotationAccumulated[cycle];
        if (payoutAmount == 0) revert NothingToPayout();
        if (payoutAmount > rotationFund) {
            payoutAmount = rotationFund;
        }
        if (payoutAmount == 0) revert NothingToPayout();

        // Effects before interaction
        cyclePayoutCompleted[cycle] = true;
        rotationFund -= payoutAmount;

        uint32 recipientPos = _members[recipient].joinPosition;

        _payouts.push(
            PayoutRecord({
                recipient: recipient,
                amount: payoutAmount,
                timestamp: uint64(block.timestamp),
                cycle: cycle,
                position: recipientPos
            })
        );

        // Advance rotation for next cycle (skip inactive positions)
        uint32 nextPos = _nextActivePositionAfter(recipientPos);
        uint32 nextCycle;
        unchecked {
            nextCycle = cycle + 1;
        }
        currentCycle = nextCycle;
        currentRecipientPosition = nextPos;
        organizerNextRecipient = address(0);

        emit PayoutExecuted(
            recipient,
            payoutAmount,
            cycle,
            recipientPos,
            uint64(block.timestamp)
        );
        emit CycleCompleted(cycle, nextCycle, nextPos);

        // Interaction
        usdc.safeTransfer(recipient, payoutAmount);
    }

    // ── Views ────────────────────────────────────────────────────────────────

    function getTreasuryBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function getTreasuryAllocationBreakdown() external view returns (TreasuryBreakdown memory) {
        return
            TreasuryBreakdown({
                totalBalance: usdc.balanceOf(address(this)),
                rotationFund: rotationFund,
                loanPool: loanPool,
                emergencyReserve: emergencyReserve,
                savingsInvestment: savingsInvestment
            });
    }

    function getMember(address account) external view returns (Member memory) {
        return _members[account];
    }

    function getMemberRotationPosition(address account) external view returns (uint32) {
        if (!_members[account].exists) revert NotMember();
        return _members[account].joinPosition;
    }

    function getCurrentPayoutRecipient() external view returns (address recipient, uint32 position) {
        position = currentRecipientPosition;
        recipient = _peekRecipient(currentCycle);
    }

    function getNextPayoutRecipient() external view returns (address recipient, uint32 position) {
        // After the current cycle payout, who is next (position-based strategies only).
        uint32 nextPos = _nextActivePositionAfter(currentRecipientPosition);
        position = nextPos;
        if (
            payoutStrategy == PayoutStrategy.JoinOrder ||
            payoutStrategy == PayoutStrategy.OrganizerAssigned
        ) {
            recipient = memberByPosition[nextPos];
            if (recipient != address(0) && !_members[recipient].active) {
                recipient = _firstActiveFromPosition(nextPos);
                if (recipient != address(0)) {
                    position = _members[recipient].joinPosition;
                }
            }
        } else {
            // RandomDraw / GovernanceVote cannot be known until the cycle resolves.
            recipient = address(0);
        }
    }

    function getContributionStatus(
        address member
    ) external view returns (ContributionStatus status) {
        uint32 cycle = currentCycle;
        if (!_members[member].exists) revert NotMember();
        if (isExempt[cycle][member]) return ContributionStatus.Exempt;
        if (hasContributed[cycle][member]) return ContributionStatus.Paid;
        return ContributionStatus.Waiting;
    }

    function getContributionStatusForCycle(
        address member,
        uint32 cycle
    ) external view returns (ContributionStatus status) {
        if (!_members[member].exists) revert NotMember();
        if (isExempt[cycle][member]) return ContributionStatus.Exempt;
        if (hasContributed[cycle][member]) return ContributionStatus.Paid;
        return ContributionStatus.Waiting;
    }

    function getMemberContributionHistory(
        address member
    ) external view returns (ContributionRecord[] memory records) {
        uint256[] storage idxs = _memberContributionIndexes[member];
        uint256 len = idxs.length;
        records = new ContributionRecord[](len);
        for (uint256 i = 0; i < len; ) {
            records[i] = _contributions[idxs[i]];
            unchecked {
                ++i;
            }
        }
    }

    function getAllContributions() external view returns (ContributionRecord[] memory) {
        return _contributions;
    }

    function getPayoutHistory() external view returns (PayoutRecord[] memory) {
        return _payouts;
    }

    function getMembers() external view returns (address[] memory) {
        return _memberList;
    }

    function getActiveMemberCount() public view returns (uint32 count) {
        uint256 len = _memberList.length;
        for (uint256 i = 0; i < len; ) {
            if (_members[_memberList[i]].active) {
                unchecked {
                    ++count;
                }
            }
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Whether the current cycle is ready for payout.
     */
    function canTriggerPayout() external view returns (bool ready, uint32 required, uint32 paid) {
        if (cyclePayoutCompleted[currentCycle] || memberCount == 0) {
            return (false, 0, 0);
        }
        return _contributionProgress(currentCycle);
    }

    function isMember(address account) external view returns (bool) {
        return _members[account].exists && _members[account].active;
    }

    // ── Internal helpers ─────────────────────────────────────────────────────

    function _validateAllocation(AllocationConfig memory cfg) internal pure {
        uint256 sum = uint256(cfg.rotationBps) +
            cfg.loanPoolBps +
            cfg.emergencyBps +
            cfg.savingsBps;
        if (sum != 10_000) revert InvalidAllocation();
    }

    function _contributionProgress(
        uint32 cycle
    ) internal view returns (bool ready, uint32 required, uint32 paid) {
        uint256 len = _memberList.length;
        for (uint256 i = 0; i < len; ) {
            address m = _memberList[i];
            Member storage mem = _members[m];
            if (mem.active) {
                if (isExempt[cycle][m]) {
                    // exempt: not required
                } else {
                    unchecked {
                        ++required;
                    }
                    if (hasContributed[cycle][m]) {
                        unchecked {
                            ++paid;
                        }
                    }
                }
            }
            unchecked {
                ++i;
            }
        }
        ready = required > 0 && paid >= required;
    }

    function _resolveRecipient(uint32 cycle) internal view returns (address) {
        PayoutStrategy strategy = payoutStrategy;

        if (strategy == PayoutStrategy.JoinOrder) {
            // Skip inactive / empty slots so deactivated members never receive payouts.
            return _firstActiveFromPosition(currentRecipientPosition);
        }

        if (strategy == PayoutStrategy.OrganizerAssigned) {
            if (organizerNextRecipient != address(0)) {
                if (
                    _members[organizerNextRecipient].exists
                        && _members[organizerNextRecipient].active
                ) {
                    return organizerNextRecipient;
                }
            }
            return _firstActiveFromPosition(currentRecipientPosition);
        }

        if (strategy == PayoutStrategy.RandomDraw) {
            return _randomActiveMember(cycle);
        }

        if (strategy == PayoutStrategy.GovernanceVote) {
            return _governanceWinner(cycle);
        }

        return address(0);
    }

    /**
     * @dev Walk join positions starting at `startPos` (1-based), wrap once, return first active.
     */
    function _firstActiveFromPosition(uint32 startPos) internal view returns (address) {
        uint32 count = memberCount;
        if (count == 0) return address(0);
        uint32 pos = startPos == 0 || startPos > count ? 1 : startPos;
        for (uint32 i = 0; i < count; ) {
            address m = memberByPosition[pos];
            if (m != address(0) && _members[m].active) return m;
            unchecked {
                pos = pos >= count ? 1 : pos + 1;
                ++i;
            }
        }
        return address(0);
    }

    function _peekRecipient(uint32 cycle) internal view returns (address) {
        return _resolveRecipient(cycle);
    }

    function _randomActiveMember(uint32 cycle) internal view returns (address) {
        uint32 active = getActiveMemberCount();
        if (active == 0) return address(0);

        // Combine prevrandao, timestamp, cycle for entropy (testnet-safe; not VRF)
        uint256 seed = uint256(
            keccak256(abi.encodePacked(block.prevrandao, block.timestamp, cycle, address(this)))
        );
        uint256 pick = seed % active;
        uint256 seen;
        uint256 len = _memberList.length;
        for (uint256 i = 0; i < len; ) {
            address m = _memberList[i];
            if (_members[m].active) {
                if (seen == pick) return m;
                unchecked {
                    ++seen;
                }
            }
            unchecked {
                ++i;
            }
        }
        return address(0);
    }

    function _governanceWinner(uint32 cycle) internal view returns (address winner) {
        uint32 bestVotes;
        uint32 bestPos = type(uint32).max;
        uint256 len = _memberList.length;

        for (uint256 i = 0; i < len; ) {
            address m = _memberList[i];
            if (_members[m].active) {
                uint32 votes = voteCount[cycle][m];
                uint32 pos = _members[m].joinPosition;
                if (votes > bestVotes || (votes == bestVotes && votes > 0 && pos < bestPos)) {
                    bestVotes = votes;
                    bestPos = pos;
                    winner = m;
                }
            }
            unchecked {
                ++i;
            }
        }

        // No votes cast → fall back to join-order position
        if (bestVotes == 0) {
            return memberByPosition[currentRecipientPosition];
        }
    }

    function _nextPositionAfter(uint32 position) internal view returns (uint32) {
        uint32 count = memberCount;
        if (count == 0) return 1;
        // Wrap continuously: after last position → 1
        if (position >= count) return 1;
        unchecked {
            return position + 1;
        }
    }

    /// @dev Next 1-based position that maps to an active member (wraps). Falls back to 1.
    function _nextActivePositionAfter(uint32 position) internal view returns (uint32) {
        uint32 count = memberCount;
        if (count == 0) return 1;
        uint32 pos = position >= count ? 1 : position + 1;
        for (uint32 i = 0; i < count; ) {
            address m = memberByPosition[pos];
            if (m != address(0) && _members[m].active) return pos;
            unchecked {
                pos = pos >= count ? 1 : pos + 1;
                ++i;
            }
        }
        return 1;
    }
}
