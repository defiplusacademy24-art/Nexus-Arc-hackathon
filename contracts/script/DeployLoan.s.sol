// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CooperativeLoanPool} from "../src/CooperativeLoanPool.sol";

/**
 * @notice Deploy CooperativeLoanPool to Arc Testnet.
 *
 * Usage:
 *   source .env
 *   forge script script/DeployLoan.s.sol:DeployLoan \
 *     --rpc-url https://rpc.testnet.arc.network \
 *     --broadcast \
 *     --legacy
 *
 * Optional env:
 *   ORGANIZER=0x...
 *   TREASURY_VAULT=0x...   # sets profitRecipient for interest forwarding
 *   FUND_AMOUNT=0          # optional USDC to seed (requires deployer balance + approve)
 */
contract DeployLoan is Script {
    address constant ARC_USDC = 0x3600000000000000000000000000000000000000;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address organizer = vm.envOr("ORGANIZER", deployer);
        address treasury = vm.envOr("TREASURY_VAULT", address(0));

        console2.log("Deployer:", deployer);
        console2.log("Organizer:", organizer);
        console2.log("USDC:", ARC_USDC);
        console2.log("Treasury vault (profit):", treasury);

        vm.startBroadcast(pk);

        CooperativeLoanPool pool = new CooperativeLoanPool(ARC_USDC, organizer);

        if (treasury != address(0)) {
            pool.setProfitRecipient(treasury);
        }

        vm.stopBroadcast();

        console2.log("CooperativeLoanPool deployed at:", address(pool));
        console2.log("Explorer: https://testnet.arcscan.app/address/%s", address(pool));
    }
}
