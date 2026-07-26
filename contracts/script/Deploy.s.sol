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
        // Default 100 USDC (6 decimals)
        uint256 contributionAmount = vm.envOr("CONTRIBUTION_AMOUNT", uint256(100e6));

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
    }
}
