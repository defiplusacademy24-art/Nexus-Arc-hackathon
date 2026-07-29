// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CooperativeTreasuryVault} from "../src/CooperativeTreasuryVault.sol";

/**
 * @notice Deploy CooperativeTreasuryVault to Arc Testnet.
 *
 * Usage:
 *   export PRIVATE_KEY=0x...
 *   export ORGANIZER=0x...          # optional; defaults to deployer
 *   export CONTRIBUTION_AMOUNT=50000000  # $50 USDC (6 decimals), min 10e6
 *   export CONTRIBUTION_FREQUENCY=1        # 0=weekly 1=biweekly 2=monthly
 *   forge script script/Deploy.s.sol:Deploy \
 *     --rpc-url https://rpc.testnet.arc.network \
 *     --broadcast \
 *     --legacy
 *
 * Arc Testnet USDC ERC-20: 0x3600000000000000000000000000000000000000
 */
contract Deploy is Script {
    /// @dev Arc Testnet USDC (ERC-20 interface, 6 decimals)
    address constant ARC_USDC = 0x3600000000000000000000000000000000000000;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address organizer = vm.envOr("ORGANIZER", deployer);

        string memory name = vm.envOr("COOP_NAME", string("Nexusu Cooperative Treasury"));
        // Default 50 USDC (6 decimals) — founders may set any amount ≥ $10
        uint256 contributionAmount = vm.envOr("CONTRIBUTION_AMOUNT", uint256(50e6));
        require(
            contributionAmount >= 10e6,
            "CONTRIBUTION_AMOUNT must be >= 10e6 ($10 USDC, 6 decimals)"
        );
        // 0=Weekly, 1=BiWeekly, 2=Monthly (matches CreateWizard)
        uint256 freqRaw = vm.envOr("CONTRIBUTION_FREQUENCY", uint256(1));
        require(freqRaw <= 2, "CONTRIBUTION_FREQUENCY must be 0, 1, or 2");
        CooperativeTreasuryVault.ContributionFrequency frequency = CooperativeTreasuryVault
            .ContributionFrequency(uint8(freqRaw));

        // Product policy default: 60% rotation · 30% loan · 5% emergency · 5% savings
        CooperativeTreasuryVault.AllocationConfig memory alloc = CooperativeTreasuryVault
            .AllocationConfig({
            rotationBps: uint16(vm.envOr("ROTATION_BPS", uint256(6000))),
            loanPoolBps: uint16(vm.envOr("LOAN_POOL_BPS", uint256(3000))),
            emergencyBps: uint16(vm.envOr("EMERGENCY_BPS", uint256(500))),
            savingsBps: uint16(vm.envOr("SAVINGS_BPS", uint256(500)))
        });

        console2.log("Deployer:", deployer);
        console2.log("Organizer:", organizer);
        console2.log("USDC:", ARC_USDC);
        console2.log("Contribution:", contributionAmount);
        console2.log("Frequency (0=W 1=BW 2=M):", freqRaw);
        console2.log("rotationBps:", uint256(alloc.rotationBps));
        console2.log("loanPoolBps:", uint256(alloc.loanPoolBps));
        console2.log("emergencyBps:", uint256(alloc.emergencyBps));
        console2.log("savingsBps:", uint256(alloc.savingsBps));

        vm.startBroadcast(pk);

        CooperativeTreasuryVault vault = new CooperativeTreasuryVault(
            ARC_USDC,
            organizer,
            name,
            contributionAmount,
            frequency,
            CooperativeTreasuryVault.PayoutStrategy.JoinOrder,
            alloc
        );

        // Optionally register the organizer as member #1
        if (vm.envOr("REGISTER_ORGANIZER", true)) {
            vault.registerMember(organizer);
        }

        vm.stopBroadcast();

        console2.log("CooperativeTreasuryVault deployed at:", address(vault));
        console2.log("Explorer: https://testnet.arcscan.app/address/%s", address(vault));
        console2.log("Set frontend: VITE_TREASURY_VAULT_ADDRESS=%s", address(vault));
        console2.log("Next: deploy loan with TREASURY_VAULT_ADDRESS=%s", address(vault));
    }
}
