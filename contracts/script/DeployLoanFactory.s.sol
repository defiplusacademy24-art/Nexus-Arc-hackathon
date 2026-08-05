// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CooperativeLoanPoolFactory} from "../src/CooperativeLoanPoolFactory.sol";

/**
 * @notice Deploy CooperativeLoanPoolFactory on Arc Testnet.
 *
 * Usage:
 *   export PRIVATE_KEY=0x...
 *   forge script script/DeployLoanFactory.s.sol:DeployLoanFactory \
 *     --rpc-url https://rpc.testnet.arc.network \
 *     --broadcast \
 *     --legacy
 *
 * Then set:
 *   VITE_LOAN_POOL_FACTORY_ADDRESS=...
 *   LOAN_POOL_FACTORY_ADDRESS=...
 */
contract DeployLoanFactory is Script {
    address constant ARC_USDC = 0x3600000000000000000000000000000000000000;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address usdc = vm.envOr("USDC_ADDRESS", ARC_USDC);

        console2.log("Deployer:", deployer);
        console2.log("USDC:", usdc);

        vm.startBroadcast(pk);
        CooperativeLoanPoolFactory factory = new CooperativeLoanPoolFactory(usdc);
        vm.stopBroadcast();

        console2.log("CooperativeLoanPoolFactory:", address(factory));
        console2.log("Explorer: https://testnet.arcscan.app/address/%s", address(factory));
        console2.log("VITE_LOAN_POOL_FACTORY_ADDRESS=%s", address(factory));
        console2.log("LOAN_POOL_FACTORY_ADDRESS=%s", address(factory));
    }
}
