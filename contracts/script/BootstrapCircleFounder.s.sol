// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CooperativeTreasuryVault} from "../src/CooperativeTreasuryVault.sol";

/**
 * @notice One-time bridge: deploy-key organizer → Circle email wallet.
 *
 * Problem: forge deploy uses PRIVATE_KEY (EOA). The app only logs in with Circle
 * user-controlled wallets (different addresses). Circle users cannot deposit until
 * registered, and cannot register themselves unless they are the organizer.
 *
 * Usage (from contracts/):
 *   source .env
 *   export TREASURY_VAULT_ADDRESS=0xe287...   # deployed vault
 *   export CIRCLE_FOUNDER=0xYourCircleWallet  # address shown after Circle login
 *   export CLAIM_ORGANIZER=true               # transfer organizer to Circle wallet
 *   forge script script/BootstrapCircleFounder.s.sol:BootstrapCircleFounder \
 *     --rpc-url https://rpc.testnet.arc.network \
 *     --broadcast \
 *     --legacy
 *
 * PRIVATE_KEY must be the *current* vault organizer (usually the deploy key).
 */
contract BootstrapCircleFounder is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address vaultAddr = vm.envAddress("TREASURY_VAULT_ADDRESS");
        address circleFounder = vm.envAddress("CIRCLE_FOUNDER");
        bool claimOrganizer = vm.envOr("CLAIM_ORGANIZER", true);

        CooperativeTreasuryVault vault = CooperativeTreasuryVault(vaultAddr);
        address organizer = vault.organizer();
        address deployer = vm.addr(pk);

        console2.log("Vault:", vaultAddr);
        console2.log("Current organizer:", organizer);
        console2.log("Operator (PRIVATE_KEY):", deployer);
        console2.log("Circle founder:", circleFounder);
        console2.log("Claim organizer:", claimOrganizer);

        require(deployer == organizer, "PRIVATE_KEY is not the vault organizer");
        require(circleFounder != address(0), "CIRCLE_FOUNDER required");

        vm.startBroadcast(pk);

        if (!vault.isMember(circleFounder)) {
            vault.registerMember(circleFounder);
            console2.log("Registered Circle wallet as member");
        } else {
            console2.log("Circle wallet already a member");
        }

        if (claimOrganizer && organizer != circleFounder) {
            vault.transferOrganizer(circleFounder);
            console2.log("Transferred organizer to Circle wallet");
        }

        vm.stopBroadcast();

        console2.log("Done. Organizer is now:", vault.organizer());
        console2.log("isMember(Circle):", vault.isMember(circleFounder));
        console2.log("Set Vercel VAULT_OPERATOR_PRIVATE_KEY only if you keep operator bootstrap.");
    }
}
