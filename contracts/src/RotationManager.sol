// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {ICooperativeTreasuryVault} from "./interfaces/ICooperativeTreasuryVault.sol";
import {CooperativeRegistry} from "./CooperativeRegistry.sol";

/**
 * @title RotationManager
 * @notice Orchestrates cooperative rotation payouts against the deployed Treasury Vault.
 * @dev Does not hold USDC. `executeRotation` calls `CooperativeTreasuryVault.triggerPayout()`
 *      then advances registry join-order state and records history.
 *
 * Join Order (default):
 *  Position #1 → #2 → … → last → wrap to #1
 *
 * Organizer may skip a recipient in the registry queue (skipped member is moved
 * past for registry planning; vault payout still uses vault-native rules).
 */
contract RotationManager is Ownable, ReentrancyGuard, Pausable {
    // ── Types ────────────────────────────────────────────────────────────────

    struct RotationState {
        address currentRecipient;
        address nextRecipient;
        address previousRecipient;
        uint32 currentRotationNumber; // 1-based payout sequence for this coop
        uint32 totalRotationsCompleted;
        uint64 lastPayoutTimestamp;
        uint64 nextPayoutTimestamp;
        bool initialized;
    }

    struct PayoutHistoryEntry {
        address recipient;
        uint256 amount;
        uint64 timestamp;
        uint32 rotationNumber;
        bytes32 txHash; // filled as blockhash(block.number-1) marker (actual tx is the call)
        uint256 coopId;
    }

    // ── Storage ──────────────────────────────────────────────────────────────

    CooperativeRegistry public immutable registry;

    /// @dev Default period used for nextPayoutTimestamp hints (30 days).
    uint64 public defaultPeriodSeconds = 30 days;

    mapping(uint256 => RotationState) private _state;
    mapping(uint256 => PayoutHistoryEntry[]) private _history;
    /// @dev Members skipped in the current cycle (registry-side), cleared on full cycle.
    mapping(uint256 => mapping(address => bool)) public skippedThisCycle;
    mapping(uint256 => address[]) private _skippedList;

    // ── Events ───────────────────────────────────────────────────────────────

    event RotationExecuted(
        uint256 indexed coopId,
        address indexed recipient,
        uint256 amount,
        uint32 rotationNumber,
        address nextRecipient,
        uint64 timestamp
    );
    event RecipientSkipped(
        uint256 indexed coopId,
        address indexed member,
        uint32 fromPosition,
        address nextRecipient
    );
    event CycleCompleted(
        uint256 indexed coopId,
        uint32 rotationsCompleted,
        uint32 nextRotationNumber
    );
    event ManualAdvance(
        uint256 indexed coopId,
        address previousRecipient,
        address currentRecipient,
        address nextRecipient
    );
    event DefaultPeriodUpdated(uint64 seconds_);
    event RotationStateSynced(
        uint256 indexed coopId,
        address currentRecipient,
        address nextRecipient
    );

    // ── Errors ───────────────────────────────────────────────────────────────

    error ZeroAddress();
    error CoopNotFound();
    error CoopNotActive();
    error NotOrganizer();
    error NotMember();
    error AlreadySkipped();
    error VaultNotReady();
    error PayoutFailed();
    error InvalidCoop();

    // ── Constructor ──────────────────────────────────────────────────────────

    /**
     * @param admin Ownable owner
     * @param registry_ CooperativeRegistry address
     */
    constructor(address admin, address registry_) Ownable(admin) {
        if (admin == address(0) || registry_ == address(0)) revert ZeroAddress();
        registry = CooperativeRegistry(registry_);
    }

    // ── Admin ────────────────────────────────────────────────────────────────

    function setDefaultPeriodSeconds(uint64 seconds_) external onlyOwner {
        if (seconds_ == 0) revert VaultNotReady();
        defaultPeriodSeconds = seconds_;
        emit DefaultPeriodUpdated(seconds_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ── Payout execution ─────────────────────────────────────────────────────

    /**
     * @notice Execute rotation payout via the cooperative's Treasury Vault.
     * @dev Calls `triggerPayout()` on the vault (permissionless when contributions complete),
     *      then syncs registry join-order index and stores payout history.
     * @param coopId Cooperative id in the registry
     * @return recipient Address paid
     * @return amount Rotation USDC amount transferred by the vault
     */
    function executeRotation(uint256 coopId)
        external
        whenNotPaused
        nonReentrant
        returns (address recipient, uint256 amount)
    {
        CooperativeRegistry.Cooperative memory coop = _requireActiveCoop(coopId);
        address vault = coop.treasuryVault;
        if (vault == address(0)) revert ZeroAddress();

        ICooperativeTreasuryVault tv = ICooperativeTreasuryVault(vault);

        (bool ready,,) = tv.canTriggerPayout();
        if (!ready) revert VaultNotReady();

        // Snapshot recipient the vault intends to pay (before state advances)
        (address vaultRecipient,) = tv.getCurrentPayoutRecipient();
        if (vaultRecipient == address(0)) revert VaultNotReady();

        uint256 rotationBefore = tv.rotationFund();
        uint32 cycleBefore = tv.currentCycle();

        // Execute on-chain USDC payout from treasury rotation fund
        tv.triggerPayout();

        // Infer amount from rotation fund delta (vault decreases rotationFund)
        uint256 rotationAfter = tv.rotationFund();
        amount = rotationBefore > rotationAfter ? rotationBefore - rotationAfter : 0;

        recipient = vaultRecipient;
        _recordAndAdvance(coopId, coop, recipient, amount, cycleBefore);
    }

    /**
     * @notice Organizer skips the current registry recipient (moves to end of planning queue).
     * @dev Does not transfer funds. Skipped member is flagged for this cycle; index advances.
     */
    function skipRecipient(uint256 coopId) external whenNotPaused nonReentrant {
        CooperativeRegistry.Cooperative memory coop = _requireActiveCoop(coopId);
        if (msg.sender != coop.organizer) revert NotOrganizer();

        (address current, uint32 pos) = registry.getCurrentRecipient(coopId);
        if (current == address(0)) revert NotMember();
        if (skippedThisCycle[coopId][current]) revert AlreadySkipped();

        skippedThisCycle[coopId][current] = true;
        _skippedList[coopId].push(current);

        registry.markMemberSkipped(coopId, current);

        (address next,) = registry.getCurrentRecipient(coopId);
        _syncStateFromRegistry(coopId, current, next);

        emit RecipientSkipped(coopId, current, pos, next);
    }

    /**
     * @notice Organizer-only: advance registry rotation without calling the vault.
     * @dev Use after a direct vault `triggerPayout` or to repair sync.
     */
    function manualAdvance(uint256 coopId) external whenNotPaused nonReentrant {
        CooperativeRegistry.Cooperative memory coop = _requireActiveCoop(coopId);
        if (msg.sender != coop.organizer) revert NotOrganizer();

        (address prev,) = registry.getCurrentRecipient(coopId);
        (address nextAfterPrev, uint32 nextPos) = registry.getNextRecipient(coopId);

        registry.advanceRotationIndex(coopId, nextPos);
        registry.setCurrentRecipientFlags(coopId, prev, nextAfterPrev);

        RotationState storage st = _ensureState(coopId);
        st.previousRecipient = prev;
        st.currentRecipient = nextAfterPrev;
        (address following,) = registry.getNextRecipient(coopId);
        st.nextRecipient = following;

        emit ManualAdvance(coopId, prev, nextAfterPrev, following);
    }

    /**
     * @notice Mark a full member-cycle complete (clears skip list, bumps completed counter).
     */
    function completeCycle(uint256 coopId) external whenNotPaused {
        CooperativeRegistry.Cooperative memory coop = _requireActiveCoop(coopId);
        if (msg.sender != coop.organizer && msg.sender != owner()) revert NotOrganizer();

        _clearSkips(coopId);
        RotationState storage st = _ensureState(coopId);
        unchecked {
            st.totalRotationsCompleted += 1;
        }
        emit CycleCompleted(coopId, st.totalRotationsCompleted, st.currentRotationNumber);
    }

    /**
     * @notice Pull current/next recipients from registry + vault views into storage.
     */
    function syncFromVault(uint256 coopId) external {
        CooperativeRegistry.Cooperative memory coop = registry.getCooperative(coopId);
        if (!coop.exists) revert CoopNotFound();

        address vault = coop.treasuryVault;
        (address regCurrent,) = registry.getCurrentRecipient(coopId);
        (address regNext,) = registry.getNextRecipient(coopId);

        // Prefer vault view when available
        try ICooperativeTreasuryVault(vault).getCurrentPayoutRecipient() returns (
            address vCur,
            uint32
        ) {
            if (vCur != address(0)) regCurrent = vCur;
        } catch {}

        try ICooperativeTreasuryVault(vault).getNextPayoutRecipient() returns (
            address vNext,
            uint32
        ) {
            if (vNext != address(0)) regNext = vNext;
        } catch {}

        RotationState storage st = _ensureState(coopId);
        st.currentRecipient = regCurrent;
        st.nextRecipient = regNext;
        emit RotationStateSynced(coopId, regCurrent, regNext);
    }

    // ── Views ────────────────────────────────────────────────────────────────

    function getRotationState(uint256 coopId) external view returns (RotationState memory) {
        return _state[coopId];
    }

    function getCurrentRecipient(uint256 coopId)
        external
        view
        returns (address recipient, uint32 position)
    {
        return registry.getCurrentRecipient(coopId);
    }

    function getNextRecipient(uint256 coopId)
        external
        view
        returns (address recipient, uint32 position)
    {
        return registry.getNextRecipient(coopId);
    }

    function getPayoutHistory(uint256 coopId)
        external
        view
        returns (PayoutHistoryEntry[] memory)
    {
        return _history[coopId];
    }

    function getPayoutHistoryLength(uint256 coopId) external view returns (uint256) {
        return _history[coopId].length;
    }

    function getSkippedThisCycle(uint256 coopId) external view returns (address[] memory) {
        return _skippedList[coopId];
    }

    /**
     * @notice Whether the linked treasury reports payout readiness.
     */
    function canExecute(uint256 coopId)
        external
        view
        returns (bool ready, uint32 required, uint32 paid, address vault)
    {
        CooperativeRegistry.Cooperative memory coop = registry.getCooperative(coopId);
        vault = coop.treasuryVault;
        if (vault == address(0) || coop.status != CooperativeRegistry.CoopStatus.Active) {
            return (false, 0, 0, vault);
        }
        try ICooperativeTreasuryVault(vault).canTriggerPayout() returns (
            bool r,
            uint32 req,
            uint32 p
        ) {
            return (r, req, p, vault);
        } catch {
            return (false, 0, 0, vault);
        }
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    function _requireActiveCoop(uint256 coopId)
        internal
        view
        returns (CooperativeRegistry.Cooperative memory coop)
    {
        coop = registry.getCooperative(coopId);
        if (!coop.exists) revert CoopNotFound();
        if (coop.status != CooperativeRegistry.CoopStatus.Active) revert CoopNotActive();
    }

    function _ensureState(uint256 coopId) internal returns (RotationState storage st) {
        st = _state[coopId];
        if (!st.initialized) {
            st.initialized = true;
            st.currentRotationNumber = 1;
        }
    }

    function _recordAndAdvance(
        uint256 coopId,
        CooperativeRegistry.Cooperative memory coop,
        address recipient,
        uint256 amount,
        uint32 /* cycleBefore */
    ) internal {
        RotationState storage st = _ensureState(coopId);

        address previous = st.currentRecipient;
        st.previousRecipient = previous == address(0) ? recipient : previous;
        // After vault payout, vault has advanced; align registry to next join-order slot
        (address regCurrent, uint32 regPos) = registry.getCurrentRecipient(coopId);
        // Advance registry past the member who was paid (join-order model)
        if (registry.isMember(coopId, recipient)) {
            uint32 paidPos = registry.getMemberPosition(coopId, recipient);
            uint32 nextPos;
            (, nextPos) = registry.getNextRecipient(coopId);
            // getNextRecipient relative to current index — force advance from paid position
            nextPos = _nextPosAfter(coopId, paidPos);
            registry.advanceRotationIndex(coopId, nextPos);
            registry.setCurrentRecipientFlags(coopId, recipient, memberAt(coopId, nextPos));
        } else if (regCurrent != address(0)) {
            uint32 nextPos = _nextPosAfter(coopId, regPos);
            registry.advanceRotationIndex(coopId, nextPos);
        }

        (address newCurrent,) = registry.getCurrentRecipient(coopId);
        (address newNext,) = registry.getNextRecipient(coopId);

        st.currentRecipient = newCurrent;
        st.nextRecipient = newNext;
        st.lastPayoutTimestamp = uint64(block.timestamp);
        st.nextPayoutTimestamp = uint64(block.timestamp) + _periodFor(coop);
        unchecked {
            st.currentRotationNumber += 1;
            st.totalRotationsCompleted += 1;
        }

        // Full cycle heuristic: active members all paid once ≈ memberCount rotations
        if (
            coop.memberCount > 0
                && st.totalRotationsCompleted % coop.memberCount == 0
        ) {
            _clearSkips(coopId);
            emit CycleCompleted(coopId, st.totalRotationsCompleted, st.currentRotationNumber);
        }

        bytes32 marker = block.number > 0 ? blockhash(block.number - 1) : bytes32(0);
        if (marker == bytes32(0)) {
            marker = keccak256(abi.encodePacked(block.number, coopId, recipient, amount));
        }

        _history[coopId].push(
            PayoutHistoryEntry({
                recipient: recipient,
                amount: amount,
                timestamp: uint64(block.timestamp),
                rotationNumber: st.totalRotationsCompleted,
                txHash: marker,
                coopId: coopId
            })
        );

        emit RotationExecuted(
            coopId,
            recipient,
            amount,
            st.totalRotationsCompleted,
            newNext,
            uint64(block.timestamp)
        );
    }

    function memberAt(uint256 coopId, uint32 pos) internal view returns (address) {
        return registry.memberByPosition(coopId, pos);
    }

    function _nextPosAfter(uint256 coopId, uint32 position) internal view returns (uint32) {
        (, uint32 nextPos) = registry.getNextRecipient(coopId);
        // Prefer computing from paid position via temporary: use nextJoinPosition bound
        uint32 last = registry.nextJoinPosition(coopId);
        if (last <= 1) return 1;
        uint32 count = last - 1;
        uint32 pos = position >= count ? 1 : position + 1;
        for (uint32 i = 0; i < count; ) {
            address m = registry.memberByPosition(coopId, pos);
            if (m != address(0) && registry.isMember(coopId, m)) {
                // isMember checks active
                return pos;
            }
            unchecked {
                pos = pos >= count ? 1 : pos + 1;
                ++i;
            }
        }
        return nextPos == 0 ? 1 : nextPos;
    }

    function _periodFor(CooperativeRegistry.Cooperative memory coop)
        internal
        view
        returns (uint64)
    {
        if (coop.contributionFrequency == CooperativeRegistry.ContributionFrequency.Weekly) {
            return 7 days;
        }
        if (coop.contributionFrequency == CooperativeRegistry.ContributionFrequency.BiWeekly) {
            return 14 days;
        }
        if (coop.contributionFrequency == CooperativeRegistry.ContributionFrequency.Monthly) {
            return 30 days;
        }
        return defaultPeriodSeconds;
    }

    function _syncStateFromRegistry(uint256 coopId, address previous, address current) internal {
        RotationState storage st = _ensureState(coopId);
        st.previousRecipient = previous;
        st.currentRecipient = current;
        (address next,) = registry.getNextRecipient(coopId);
        st.nextRecipient = next;
    }

    function _clearSkips(uint256 coopId) internal {
        address[] storage list = _skippedList[coopId];
        for (uint256 i = 0; i < list.length; ) {
            skippedThisCycle[coopId][list[i]] = false;
            unchecked {
                ++i;
            }
        }
        delete _skippedList[coopId];
    }
}
