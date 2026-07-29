// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ICooperativeTreasuryVault
 * @notice Minimal surface used by RotationManager against the already-deployed vault.
 * @dev Must match `CooperativeTreasuryVault` selectors — do not redeploy the vault.
 */
interface ICooperativeTreasuryVault {
    function organizer() external view returns (address);

    function triggerPayout() external;

    function getCurrentPayoutRecipient()
        external
        view
        returns (address recipient, uint32 position);

    function getNextPayoutRecipient()
        external
        view
        returns (address recipient, uint32 position);

    function canTriggerPayout()
        external
        view
        returns (bool ready, uint32 required, uint32 paid);

    function canClaimPayout(address account)
        external
        view
        returns (bool canClaim, uint32 required, uint32 paid, address recipient);

    function currentCycle() external view returns (uint32);

    function currentRecipientPosition() external view returns (uint32);

    function rotationFund() external view returns (uint256);

    function isMember(address account) external view returns (bool);

    function getMemberRotationPosition(address account) external view returns (uint32);
}
