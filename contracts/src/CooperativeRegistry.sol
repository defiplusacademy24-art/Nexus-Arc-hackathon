// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CooperativeRegistry
 * @notice On-chain registry of Nexusu cooperatives, members, and rotation indices.
 * @dev Does not hold funds. Points each cooperative at its deployed Treasury Vault
 *      and Loan Pool. RotationManager is authorized to advance rotation state.
 *
 * Allocation policy (documented for integrators; enforced in Treasury Vault):
 *  60% Rotation · 30% Loan Pool · 5% Emergency · 5% Savings
 */
contract CooperativeRegistry is Ownable, AccessControl, Pausable, ReentrancyGuard {
    // ── Roles ────────────────────────────────────────────────────────────────

    bytes32 public constant PLATFORM_ADMIN_ROLE = keccak256("PLATFORM_ADMIN_ROLE");

    // ── Enums ────────────────────────────────────────────────────────────────

    enum PayoutStrategy {
        JoinOrder, // 0 — default
        RandomDraw, // 1
        OrganizerAssigned, // 2
        GovernanceVote // 3
    }

    enum CoopStatus {
        Active,
        Paused,
        Closed
    }

    enum ContributionStatus {
        Waiting,
        Paid,
        Exempt
    }

    enum ContributionFrequency {
        Weekly,
        BiWeekly,
        Monthly
    }

    // ── Types ────────────────────────────────────────────────────────────────

    struct Cooperative {
        uint256 id;
        string name;
        string description;
        address organizer;
        address treasuryVault;
        address loanPool;
        uint256 contributionAmount; // USDC 6 decimals
        ContributionFrequency contributionFrequency;
        uint32 maxMembers; // 0 = unlimited
        uint32 memberCount; // active members
        PayoutStrategy payoutStrategy;
        uint32 currentRotationIndex; // 1-based position of current recipient
        CoopStatus status;
        uint64 createdAt;
        bool exists;
    }

    struct Member {
        address wallet;
        string displayName;
        uint64 joinedAt;
        uint32 joinPosition; // permanent 1-based
        ContributionStatus contributionStatus;
        bool isCurrentRecipient;
        bool loanEligible;
        uint16 governanceScore; // 0–1000 scale
        uint16 creditScore; // 0–1000 scale
        bool active;
        bool exists;
    }

    // ── Constants ────────────────────────────────────────────────────────────

    uint256 public constant MIN_CONTRIBUTION = 10e6; // $10 USDC
    uint16 public constant MAX_SCORE = 1000;

    // ── Storage ──────────────────────────────────────────────────────────────

    uint256 public nextCooperativeId = 1;
    address public rotationManager;

    mapping(uint256 => Cooperative) private _coops;
    mapping(uint256 => mapping(address => Member)) private _members;
    mapping(uint256 => address[]) private _memberList;
    /// @dev coopId => joinPosition (1-based) => wallet
    mapping(uint256 => mapping(uint32 => address)) public memberByPosition;
    /// @dev coopId => next position to assign
    mapping(uint256 => uint32) public nextJoinPosition;
    /// @dev wallet => list of coop ids
    mapping(address => uint256[]) private _coopsByMember;

    // ── Events ───────────────────────────────────────────────────────────────

    event CooperativeCreated(
        uint256 indexed coopId,
        address indexed organizer,
        string name,
        address treasuryVault,
        address loanPool,
        uint256 contributionAmount,
        ContributionFrequency frequency,
        PayoutStrategy strategy
    );
    event MemberJoined(
        uint256 indexed coopId,
        address indexed member,
        uint32 joinPosition,
        string displayName
    );
    event MemberLeft(uint256 indexed coopId, address indexed member, uint32 joinPosition);
    event ContributionUpdated(
        uint256 indexed coopId,
        uint256 amount,
        ContributionFrequency frequency
    );
    event StrategyChanged(uint256 indexed coopId, PayoutStrategy strategy);
    event CooperativeActivated(uint256 indexed coopId);
    event CooperativePaused(uint256 indexed coopId);
    event CooperativeClosed(uint256 indexed coopId);
    event RotationManagerUpdated(address indexed previous, address indexed next);
    event MemberScoresUpdated(
        uint256 indexed coopId,
        address indexed member,
        uint16 governanceScore,
        uint16 creditScore
    );
    event MemberContributionStatusUpdated(
        uint256 indexed coopId,
        address indexed member,
        ContributionStatus status
    );
    event RotationIndexAdvanced(
        uint256 indexed coopId,
        uint32 previousIndex,
        uint32 newIndex,
        address previousRecipient,
        address newRecipient
    );
    event RecipientSkippedInRegistry(
        uint256 indexed coopId,
        address indexed member,
        uint32 fromPosition,
        uint32 toIndex
    );

    // ── Errors ───────────────────────────────────────────────────────────────

    error ZeroAddress();
    error InvalidAmount();
    error InvalidName();
    error CoopNotFound();
    error CoopNotActive();
    error CoopClosed();
    error NotOrganizer();
    error NotRotationManager();
    error AlreadyMember();
    error NotMember();
    error MemberInactive();
    error CoopFull();
    error InvalidMaxMembers();
    error InvalidScore();
    error InvalidPosition();

    // ── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOrganizer(uint256 coopId) {
        if (!_coops[coopId].exists) revert CoopNotFound();
        if (msg.sender != _coops[coopId].organizer) revert NotOrganizer();
        _;
    }

    modifier onlyRotationManager() {
        if (msg.sender != rotationManager) revert NotRotationManager();
        _;
    }

    modifier coopExists(uint256 coopId) {
        if (!_coops[coopId].exists) revert CoopNotFound();
        _;
    }

    // ── Constructor ──────────────────────────────────────────────────────────

    /**
     * @param admin Platform admin / deployer (Ownable owner + PLATFORM_ADMIN_ROLE)
     */
    constructor(address admin) Ownable(admin) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PLATFORM_ADMIN_ROLE, admin);
    }

    // ── Platform admin ───────────────────────────────────────────────────────

    /**
     * @notice Wire RotationManager (authorized to advance rotation indices).
     */
    function setRotationManager(address manager) external onlyOwner {
        address prev = rotationManager;
        rotationManager = manager;
        emit RotationManagerUpdated(prev, manager);
    }

    function pause() external onlyRole(PLATFORM_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PLATFORM_ADMIN_ROLE) {
        _unpause();
    }

    // ── Create / lifecycle ───────────────────────────────────────────────────

    /**
     * @notice Create a cooperative and auto-join the organizer as position #1.
     * @param name_ Human-readable name
     * @param description_ Short description
     * @param treasuryVault_ Deployed CooperativeTreasuryVault for this coop
     * @param loanPool_ Deployed CooperativeLoanPool (may be shared)
     * @param contributionAmount_ Exact USDC amount (6 decimals), ≥ $10
     * @param frequency_ Weekly / BiWeekly / Monthly
     * @param maxMembers_ Cap (0 = unlimited)
     * @param strategy_ Initial payout strategy (default JoinOrder = 0)
     * @param organizerDisplayName_ Display name for founder
     */
    function createCooperative(
        string calldata name_,
        string calldata description_,
        address treasuryVault_,
        address loanPool_,
        uint256 contributionAmount_,
        ContributionFrequency frequency_,
        uint32 maxMembers_,
        PayoutStrategy strategy_,
        string calldata organizerDisplayName_
    ) external whenNotPaused nonReentrant returns (uint256 coopId) {
        if (bytes(name_).length == 0) revert InvalidName();
        if (treasuryVault_ == address(0) || loanPool_ == address(0)) revert ZeroAddress();
        if (contributionAmount_ < MIN_CONTRIBUTION) revert InvalidAmount();
        if (maxMembers_ == 1) revert InvalidMaxMembers(); // need at least room for organizer + others or 0 unlimited

        coopId = nextCooperativeId;
        unchecked {
            nextCooperativeId = coopId + 1;
        }

        _coops[coopId] = Cooperative({
            id: coopId,
            name: name_,
            description: description_,
            organizer: msg.sender,
            treasuryVault: treasuryVault_,
            loanPool: loanPool_,
            contributionAmount: contributionAmount_,
            contributionFrequency: frequency_,
            maxMembers: maxMembers_,
            memberCount: 0,
            payoutStrategy: strategy_,
            currentRotationIndex: 1,
            status: CoopStatus.Active,
            createdAt: uint64(block.timestamp),
            exists: true
        });
        nextJoinPosition[coopId] = 1;

        emit CooperativeCreated(
            coopId,
            msg.sender,
            name_,
            treasuryVault_,
            loanPool_,
            contributionAmount_,
            frequency_,
            strategy_
        );

        _join(coopId, msg.sender, organizerDisplayName_, true);
    }

    function activateCooperative(uint256 coopId) external onlyOrganizer(coopId) {
        Cooperative storage c = _coops[coopId];
        if (c.status == CoopStatus.Closed) revert CoopClosed();
        c.status = CoopStatus.Active;
        emit CooperativeActivated(coopId);
    }

    function pauseCooperative(uint256 coopId) external onlyOrganizer(coopId) {
        Cooperative storage c = _coops[coopId];
        if (c.status == CoopStatus.Closed) revert CoopClosed();
        c.status = CoopStatus.Paused;
        emit CooperativePaused(coopId);
    }

    function closeCooperative(uint256 coopId) external onlyOrganizer(coopId) {
        _coops[coopId].status = CoopStatus.Closed;
        emit CooperativeClosed(coopId);
    }

    // ── Membership ───────────────────────────────────────────────────────────

    /**
     * @notice Join an active cooperative. Assigns the next permanent join position.
     */
    function joinCooperative(uint256 coopId, string calldata displayName)
        external
        whenNotPaused
        nonReentrant
        coopExists(coopId)
    {
        if (_coops[coopId].status != CoopStatus.Active) revert CoopNotActive();
        _join(coopId, msg.sender, displayName, false);
    }

    /**
     * @notice Leave a cooperative (marks inactive; join position remains reserved).
     */
    function leaveCooperative(uint256 coopId) external nonReentrant coopExists(coopId) {
        Member storage m = _members[coopId][msg.sender];
        if (!m.exists || !m.active) revert NotMember();

        m.active = false;
        m.isCurrentRecipient = false;
        unchecked {
            if (_coops[coopId].memberCount > 0) {
                _coops[coopId].memberCount -= 1;
            }
        }

        // If leaver was current recipient index, advance to next active
        if (_coops[coopId].currentRotationIndex == m.joinPosition) {
            uint32 nextIdx = _nextActivePosition(coopId, m.joinPosition);
            _setRotationIndex(coopId, nextIdx);
        }

        emit MemberLeft(coopId, msg.sender, m.joinPosition);
    }

    // ── Organizer settings ───────────────────────────────────────────────────

    function updateContributionAmount(uint256 coopId, uint256 amount)
        external
        onlyOrganizer(coopId)
    {
        if (amount < MIN_CONTRIBUTION) revert InvalidAmount();
        Cooperative storage c = _coops[coopId];
        if (c.status == CoopStatus.Closed) revert CoopClosed();
        c.contributionAmount = amount;
        emit ContributionUpdated(coopId, amount, c.contributionFrequency);
    }

    function updateContributionFrequency(uint256 coopId, ContributionFrequency frequency)
        external
        onlyOrganizer(coopId)
    {
        Cooperative storage c = _coops[coopId];
        if (c.status == CoopStatus.Closed) revert CoopClosed();
        c.contributionFrequency = frequency;
        emit ContributionUpdated(coopId, c.contributionAmount, frequency);
    }

    function changePayoutStrategy(uint256 coopId, PayoutStrategy strategy)
        external
        onlyOrganizer(coopId)
    {
        Cooperative storage c = _coops[coopId];
        if (c.status == CoopStatus.Closed) revert CoopClosed();
        c.payoutStrategy = strategy;
        emit StrategyChanged(coopId, strategy);
    }

    /**
     * @notice OrganizerAssigned strategy: re-order permanent positions.
     * @param orderedMembers Full list of active member addresses in desired order.
     */
    function setOrganizerPositions(uint256 coopId, address[] calldata orderedMembers)
        external
        onlyOrganizer(coopId)
    {
        Cooperative storage c = _coops[coopId];
        if (c.payoutStrategy != PayoutStrategy.OrganizerAssigned) revert InvalidPosition();
        uint256 len = orderedMembers.length;
        if (len != c.memberCount) revert InvalidPosition();

        for (uint256 i = 0; i < len; ) {
            address w = orderedMembers[i];
            Member storage m = _members[coopId][w];
            if (!m.exists || !m.active) revert NotMember();
            uint32 pos = uint32(i + 1);
            m.joinPosition = pos;
            memberByPosition[coopId][pos] = w;
            unchecked {
                ++i;
            }
        }
        c.currentRotationIndex = 1;
        _clearRecipientFlags(coopId);
        address first = memberByPosition[coopId][1];
        if (first != address(0)) {
            _members[coopId][first].isCurrentRecipient = true;
        }
    }

    function setMemberContributionStatus(
        uint256 coopId,
        address member,
        ContributionStatus status
    ) external onlyOrganizer(coopId) {
        Member storage m = _members[coopId][member];
        if (!m.exists) revert NotMember();
        m.contributionStatus = status;
        emit MemberContributionStatusUpdated(coopId, member, status);
    }

    function setMemberScores(
        uint256 coopId,
        address member,
        uint16 governanceScore,
        uint16 creditScore
    ) external onlyOrganizer(coopId) {
        if (governanceScore > MAX_SCORE || creditScore > MAX_SCORE) revert InvalidScore();
        Member storage m = _members[coopId][member];
        if (!m.exists) revert NotMember();
        m.governanceScore = governanceScore;
        m.creditScore = creditScore;
        m.loanEligible = creditScore >= 500 && governanceScore >= 400;
        emit MemberScoresUpdated(coopId, member, governanceScore, creditScore);
    }

    function setLoanEligibility(uint256 coopId, address member, bool eligible)
        external
        onlyOrganizer(coopId)
    {
        Member storage m = _members[coopId][member];
        if (!m.exists) revert NotMember();
        m.loanEligible = eligible;
    }

    function transferOrganizer(uint256 coopId, address newOrganizer)
        external
        onlyOrganizer(coopId)
    {
        if (newOrganizer == address(0)) revert ZeroAddress();
        if (!_members[coopId][newOrganizer].exists || !_members[coopId][newOrganizer].active) {
            revert NotMember();
        }
        _coops[coopId].organizer = newOrganizer;
    }

    // ── RotationManager-only hooks ───────────────────────────────────────────

    function advanceRotationIndex(uint256 coopId, uint32 newIndex)
        external
        onlyRotationManager
        coopExists(coopId)
    {
        _setRotationIndex(coopId, newIndex);
    }

    function setCurrentRecipientFlags(uint256 coopId, address previous, address current)
        external
        onlyRotationManager
        coopExists(coopId)
    {
        if (previous != address(0) && _members[coopId][previous].exists) {
            _members[coopId][previous].isCurrentRecipient = false;
        }
        if (current != address(0) && _members[coopId][current].exists) {
            _members[coopId][current].isCurrentRecipient = true;
        }
    }

    /**
     * @notice Skip current recipient in registry rotation (moves index to next active).
     * @dev Does not move funds; treasury payout order is independent until next execute.
     */
    function markMemberSkipped(uint256 coopId, address member)
        external
        onlyRotationManager
        coopExists(coopId)
    {
        Member storage m = _members[coopId][member];
        if (!m.exists) revert NotMember();
        uint32 from = m.joinPosition;
        uint32 nextIdx = _nextActivePosition(coopId, from);
        _setRotationIndex(coopId, nextIdx);
        emit RecipientSkippedInRegistry(coopId, member, from, nextIdx);
    }

    // ── Views ────────────────────────────────────────────────────────────────

    function getCooperative(uint256 coopId)
        external
        view
        coopExists(coopId)
        returns (Cooperative memory)
    {
        return _coops[coopId];
    }

    function getMembers(uint256 coopId)
        external
        view
        coopExists(coopId)
        returns (address[] memory)
    {
        return _memberList[coopId];
    }

    function getActiveMembers(uint256 coopId)
        external
        view
        coopExists(coopId)
        returns (address[] memory activeList)
    {
        address[] storage all = _memberList[coopId];
        uint256 n = _coops[coopId].memberCount;
        activeList = new address[](n);
        uint256 j;
        for (uint256 i = 0; i < all.length; ) {
            if (_members[coopId][all[i]].active) {
                activeList[j] = all[i];
                unchecked {
                    ++j;
                }
            }
            unchecked {
                ++i;
            }
        }
    }

    function getMember(uint256 coopId, address account)
        external
        view
        coopExists(coopId)
        returns (Member memory)
    {
        return _members[coopId][account];
    }

    function getMemberPosition(uint256 coopId, address account)
        external
        view
        coopExists(coopId)
        returns (uint32)
    {
        if (!_members[coopId][account].exists) revert NotMember();
        return _members[coopId][account].joinPosition;
    }

    function isMember(uint256 coopId, address account) external view returns (bool) {
        return _members[coopId][account].exists && _members[coopId][account].active;
    }

    function getCoopsByMember(address account) external view returns (uint256[] memory) {
        return _coopsByMember[account];
    }

    function getCurrentRecipient(uint256 coopId)
        external
        view
        coopExists(coopId)
        returns (address recipient, uint32 position)
    {
        position = _coops[coopId].currentRotationIndex;
        recipient = _firstActiveFrom(coopId, position);
        if (recipient != address(0)) {
            position = _members[coopId][recipient].joinPosition;
        }
    }

    function getNextRecipient(uint256 coopId)
        external
        view
        coopExists(coopId)
        returns (address recipient, uint32 position)
    {
        uint32 cur = _coops[coopId].currentRotationIndex;
        address current = _firstActiveFrom(coopId, cur);
        uint32 from = current == address(0) ? cur : _members[coopId][current].joinPosition;
        position = _nextActivePosition(coopId, from);
        recipient = memberByPosition[coopId][position];
        if (recipient != address(0) && !_members[coopId][recipient].active) {
            recipient = _firstActiveFrom(coopId, position);
            if (recipient != address(0)) {
                position = _members[coopId][recipient].joinPosition;
            }
        }
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    function _join(
        uint256 coopId,
        address account,
        string memory displayName,
        bool asOrganizer
    ) internal {
        Cooperative storage c = _coops[coopId];
        if (_members[coopId][account].exists) {
            // Re-activate if previously left
            Member storage existing = _members[coopId][account];
            if (existing.active) revert AlreadyMember();
            existing.active = true;
            existing.displayName = displayName;
            unchecked {
                c.memberCount += 1;
            }
            emit MemberJoined(coopId, account, existing.joinPosition, displayName);
            return;
        }

        if (c.maxMembers > 0 && c.memberCount >= c.maxMembers) revert CoopFull();

        uint32 pos = nextJoinPosition[coopId];
        _members[coopId][account] = Member({
            wallet: account,
            displayName: displayName,
            joinedAt: uint64(block.timestamp),
            joinPosition: pos,
            contributionStatus: ContributionStatus.Waiting,
            isCurrentRecipient: pos == c.currentRotationIndex,
            loanEligible: asOrganizer,
            governanceScore: asOrganizer ? 700 : 500,
            creditScore: asOrganizer ? 700 : 600,
            active: true,
            exists: true
        });
        memberByPosition[coopId][pos] = account;
        _memberList[coopId].push(account);
        _coopsByMember[account].push(coopId);
        unchecked {
            nextJoinPosition[coopId] = pos + 1;
            c.memberCount += 1;
        }

        emit MemberJoined(coopId, account, pos, displayName);
    }

    function _setRotationIndex(uint256 coopId, uint32 newIndex) internal {
        Cooperative storage c = _coops[coopId];
        uint32 prevIdx = c.currentRotationIndex;
        address prev = _firstActiveFrom(coopId, prevIdx);
        c.currentRotationIndex = newIndex == 0 ? 1 : newIndex;
        address next = _firstActiveFrom(coopId, c.currentRotationIndex);
        if (prev != address(0) && _members[coopId][prev].exists) {
            _members[coopId][prev].isCurrentRecipient = false;
        }
        if (next != address(0) && _members[coopId][next].exists) {
            _members[coopId][next].isCurrentRecipient = true;
            c.currentRotationIndex = _members[coopId][next].joinPosition;
        }
        emit RotationIndexAdvanced(coopId, prevIdx, c.currentRotationIndex, prev, next);
    }

    function _clearRecipientFlags(uint256 coopId) internal {
        address[] storage list = _memberList[coopId];
        for (uint256 i = 0; i < list.length; ) {
            _members[coopId][list[i]].isCurrentRecipient = false;
            unchecked {
                ++i;
            }
        }
    }

    function _firstActiveFrom(uint256 coopId, uint32 startPos) internal view returns (address) {
        uint32 last = nextJoinPosition[coopId];
        if (last <= 1) return address(0);
        uint32 count = last - 1;
        uint32 pos = startPos == 0 || startPos > count ? 1 : startPos;
        for (uint32 i = 0; i < count; ) {
            address m = memberByPosition[coopId][pos];
            if (m != address(0) && _members[coopId][m].active) return m;
            unchecked {
                pos = pos >= count ? 1 : pos + 1;
                ++i;
            }
        }
        return address(0);
    }

    function _nextActivePosition(uint256 coopId, uint32 position) internal view returns (uint32) {
        uint32 last = nextJoinPosition[coopId];
        if (last <= 1) return 1;
        uint32 count = last - 1;
        uint32 pos = position >= count ? 1 : position + 1;
        for (uint32 i = 0; i < count; ) {
            address m = memberByPosition[coopId][pos];
            if (m != address(0) && _members[coopId][m].active) return pos;
            unchecked {
                pos = pos >= count ? 1 : pos + 1;
                ++i;
            }
        }
        return 1;
    }
}
