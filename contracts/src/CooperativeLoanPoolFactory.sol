// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CooperativeLoanPool} from "./CooperativeLoanPool.sol";

/**
 * @title CooperativeLoanPoolFactory
 * @notice Deploys an isolated CooperativeLoanPool per cooperative workspace.
 * @dev Each pool has its own USDC liquidity, applications, and membership check.
 *      Wire the matching treasury vault via vault.setLendingPool(pool) so the
 *      30% deposit share auto-funds THIS pool only.
 *
 * Standard provision order (off-chain operator):
 *  1. Deploy vault for the coop
 *  2. createPool(operator, vault, vault, appCoopIdHash)
 *  3. vault.setLendingPool(pool)  // 30% auto-forward on deposits
 */
contract CooperativeLoanPoolFactory {
    address public immutable usdc;

    address[] public allPools;
    /// @dev app coop id hash → pool (optional index; zero hash skips)
    mapping(bytes32 => address) public poolByAppCoopId;
    /// @dev membership vault → pool (one pool per vault)
    mapping(address => address) public poolByMembershipVault;

    event PoolCreated(
        address indexed pool,
        address indexed organizer,
        address indexed membershipVault,
        address profitRecipient,
        bytes32 appCoopIdHash
    );

    error ZeroAddress();
    error CoopIdAlreadyHasPool();
    error VaultAlreadyHasPool();

    constructor(address usdc_) {
        if (usdc_ == address(0)) revert ZeroAddress();
        usdc = usdc_;
    }

    /**
     * @notice Deploy a new loan pool bound to a cooperative treasury vault.
     * @param organizer_ Platform operator / approver (usually deploy key).
     * @param membershipVault_ CooperativeTreasuryVault for isMember checks.
     * @param profitRecipient_ Interest recipient (typically same as membershipVault_).
     * @param appCoopIdHash_ keccak256 of app coop id (or bytes32(0) to skip index).
     * @return pool Address of the new CooperativeLoanPool.
     */
    function createPool(
        address organizer_,
        address membershipVault_,
        address profitRecipient_,
        bytes32 appCoopIdHash_
    ) external returns (address pool) {
        if (organizer_ == address(0) || membershipVault_ == address(0)) {
            revert ZeroAddress();
        }
        if (appCoopIdHash_ != bytes32(0) && poolByAppCoopId[appCoopIdHash_] != address(0)) {
            revert CoopIdAlreadyHasPool();
        }
        if (poolByMembershipVault[membershipVault_] != address(0)) {
            revert VaultAlreadyHasPool();
        }

        // Factory is temporary organizer so it can set profit recipient, then hands off.
        CooperativeLoanPool deployed = new CooperativeLoanPool(
            usdc,
            address(this),
            membershipVault_
        );

        if (profitRecipient_ != address(0)) {
            deployed.setProfitRecipient(profitRecipient_);
        }
        deployed.transferOrganizer(organizer_);

        pool = address(deployed);
        allPools.push(pool);
        poolByMembershipVault[membershipVault_] = pool;
        if (appCoopIdHash_ != bytes32(0)) {
            poolByAppCoopId[appCoopIdHash_] = pool;
        }

        emit PoolCreated(pool, organizer_, membershipVault_, profitRecipient_, appCoopIdHash_);
    }

    function poolCount() external view returns (uint256) {
        return allPools.length;
    }

    function getPools(uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory page)
    {
        uint256 total = allPools.length;
        if (offset >= total) {
            return new address[](0);
        }
        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 n = end - offset;
        page = new address[](n);
        for (uint256 i = 0; i < n; ) {
            page[i] = allPools[offset + i];
            unchecked {
                ++i;
            }
        }
    }
}
