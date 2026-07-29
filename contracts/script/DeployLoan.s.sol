// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CooperativeLoanPool} from "../src/CooperativeLoanPool.sol";

/**
 * @notice Deploy CooperativeLoanPool to Arc Testnet.
 *
 * Usage:
 *   source .env
 *   export TREASURY_VAULT=0x...   # recommended: membership + profit recipient
 *   forge script script/DeployLoan.s.sol:DeployLoan \
 *     --rpc-url https://rpc.testnet.arc.network \
 *     --broadcast \
 *     --legacy
 *
 * Optional env:
 *   ORGANIZER=0x...
 *   TREASURY_VAULT=0x...   # membership check + interest profit recipient
 *   MEMBERSHIP_VAULT=0x... # override membership source (defaults to TREASURY_VAULT)
 *   REGISTER_ORGANIZER=true
 */
contract DeployLoan is Script {
    address constant ARC_USDC = 0x3600000000000000000000000000000000000000;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address organizer = vm.envOr("ORGANIZER", deployer);
        // Accept either TREASURY_VAULT or TREASURY_VAULT_ADDRESS (frontend/env naming)
        address treasury = vm.envOr(
            "TREASURY_VAULT", vm.envOr("TREASURY_VAULT_ADDRESS", address(0))
        );
        address membership = vm.envOr("MEMBERSHIP_VAULT", treasury);

        console2.log("Deployer:", deployer);
        console2.log("Organizer:", organizer);
        console2.log("USDC:", ARC_USDC);
        console2.log("Membership vault:", membership);
        console2.log("Profit recipient (treasury):", treasury);

        vm.startBroadcast(pk);

        CooperativeLoanPool pool = new CooperativeLoanPool(ARC_USDC, organizer, membership);

        if (treasury != address(0)) {
            pool.setProfitRecipient(treasury);
        }

        // When no membership vault, register organizer so they can self-test apply
        if (membership == address(0) && vm.envOr("REGISTER_ORGANIZER", true)) {
            pool.registerBorrower(organizer);
        }

        vm.stopBroadcast();

        console2.log("CooperativeLoanPool deployed at:", address(pool));
        console2.log("Explorer: https://testnet.arcscan.app/address/%s", address(pool));
        console2.log("Set frontend: VITE_LOAN_POOL_ADDRESS=%s", address(pool));
    }
}
