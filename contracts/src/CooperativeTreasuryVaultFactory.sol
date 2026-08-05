// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CooperativeTreasuryVault} from "./CooperativeTreasuryVault.sol";

/**
 * @title CooperativeTreasuryVaultFactory
 * @notice Deploys an isolated CooperativeTreasuryVault per cooperative workspace.
 * @dev Each vault has its own USDC balance, members, cycles, and contribution rules.
 *      The app must store the returned vault address on the cooperative record and
 *      never reuse a single global vault for multiple workspaces.
 *
 * Product policy default allocation (60/30/5/5) is applied at deploy time.
 * `organizer` is typically the platform operator key so server-side membership
 * bootstrap works; founders can still deposit via joinVault / deposit auto-join.
 */
contract CooperativeTreasuryVaultFactory {
    /// @notice Arc USDC (or mock in tests) — fixed for this factory instance.
    address public immutable usdc;

    /// @dev Default product policy: 60% rotation · 30% loan · 5% emergency · 5% savings.
    uint16 public constant DEFAULT_ROTATION_BPS = 6000;
    uint16 public constant DEFAULT_LOAN_POOL_BPS = 3000;
    uint16 public constant DEFAULT_EMERGENCY_BPS = 500;
    uint16 public constant DEFAULT_SAVINGS_BPS = 500;

    uint256 public constant MIN_CONTRIBUTION = 10e6;

    /// @notice All vaults ever created by this factory (audit / indexing).
    address[] public allVaults;

    /// @dev app coop id hash → vault (optional; zero hash skips index).
    mapping(bytes32 => address) public vaultByAppCoopId;

    event VaultCreated(
        address indexed vault,
        address indexed organizer,
        string name,
        uint256 contributionAmount,
        uint8 frequency,
        bytes32 indexed appCoopIdHash
    );

    error ZeroAddress();
    error InvalidAmount();
    error InvalidFrequency();
    error CoopIdAlreadyHasVault();

    constructor(address usdc_) {
        if (usdc_ == address(0)) revert ZeroAddress();
        usdc = usdc_;
    }

    /**
     * @notice Deploy a new isolated treasury vault for one cooperative.
     * @param organizer_ On-chain organizer (usually platform operator for bootstrap).
     * @param name_ Human-readable cooperative name (stored on vault).
     * @param contributionAmount_ Exact USDC per cycle (6 decimals, ≥ $10).
     * @param frequency_ 0=Weekly, 1=BiWeekly, 2=Monthly.
     * @param appCoopIdHash_ keccak256 of app coop id (or bytes32(0) to skip index).
     * @return vault Address of the new CooperativeTreasuryVault.
     */
    function createVault(
        address organizer_,
        string calldata name_,
        uint256 contributionAmount_,
        uint8 frequency_,
        bytes32 appCoopIdHash_
    ) external returns (address vault) {
        if (organizer_ == address(0)) revert ZeroAddress();
        if (contributionAmount_ < MIN_CONTRIBUTION) revert InvalidAmount();
        if (frequency_ > 2) revert InvalidFrequency();
        if (appCoopIdHash_ != bytes32(0) && vaultByAppCoopId[appCoopIdHash_] != address(0)) {
            revert CoopIdAlreadyHasVault();
        }

        CooperativeTreasuryVault.AllocationConfig memory alloc = CooperativeTreasuryVault
            .AllocationConfig({
            rotationBps: DEFAULT_ROTATION_BPS,
            loanPoolBps: DEFAULT_LOAN_POOL_BPS,
            emergencyBps: DEFAULT_EMERGENCY_BPS,
            savingsBps: DEFAULT_SAVINGS_BPS
        });

        CooperativeTreasuryVault.ContributionFrequency freq = CooperativeTreasuryVault
            .ContributionFrequency(frequency_);

        CooperativeTreasuryVault deployed = new CooperativeTreasuryVault(
            usdc,
            organizer_,
            name_,
            contributionAmount_,
            freq,
            CooperativeTreasuryVault.PayoutStrategy.JoinOrder,
            alloc
        );

        vault = address(deployed);
        allVaults.push(vault);
        if (appCoopIdHash_ != bytes32(0)) {
            vaultByAppCoopId[appCoopIdHash_] = vault;
        }

        emit VaultCreated(
            vault,
            organizer_,
            name_,
            contributionAmount_,
            frequency_,
            appCoopIdHash_
        );
    }

    function vaultCount() external view returns (uint256) {
        return allVaults.length;
    }

    function getVaults(uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory page)
    {
        uint256 total = allVaults.length;
        if (offset >= total) {
            return new address[](0);
        }
        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 n = end - offset;
        page = new address[](n);
        for (uint256 i = 0; i < n; ) {
            page[i] = allVaults[offset + i];
            unchecked {
                ++i;
            }
        }
    }
}
