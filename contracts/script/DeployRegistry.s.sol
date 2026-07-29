// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {CooperativeRegistry} from "../src/CooperativeRegistry.sol";
import {RotationManager} from "../src/RotationManager.sol";

/**
 * @notice Deploy CooperativeRegistry + RotationManager on Arc Testnet.
 *         Does NOT redeploy Treasury Vault or Loan Pool.
 *
 * Required env:
 *   PRIVATE_KEY
 *   ARC_RPC_URL (for forge --rpc-url)
 *
 * Optional env:
 *   ORGANIZER / ADMIN          — defaults to deployer
 *   TREASURY_VAULT_ADDRESS     — existing vault (for summary only)
 *   LOAN_POOL_ADDRESS          — existing loan pool (for summary only)
 *   USDC_ADDRESS               — Arc USDC (for summary only)
 *
 * Usage:
 *   source .env
 *   forge script script/DeployRegistry.s.sol:DeployRegistry \
 *     --rpc-url "$ARC_RPC_URL" \
 *     --broadcast \
 *     --legacy
 */
contract DeployRegistry is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address admin = vm.envOr("ADMIN", vm.envOr("ORGANIZER", deployer));

        address treasury = vm.envOr("TREASURY_VAULT_ADDRESS", address(0));
        address loanPool = vm.envOr("LOAN_POOL_ADDRESS", address(0));
        address usdc = vm.envOr(
            "USDC_ADDRESS", address(0x3600000000000000000000000000000000000000)
        );

        console2.log("=== Nexusu Registry + Rotation deploy ===");
        console2.log("Deployer:", deployer);
        console2.log("Admin:", admin);
        console2.log("Existing TREASURY_VAULT_ADDRESS:", treasury);
        console2.log("Existing LOAN_POOL_ADDRESS:", loanPool);
        console2.log("USDC_ADDRESS:", usdc);

        vm.startBroadcast(pk);

        // 1. Registry
        CooperativeRegistry registry = new CooperativeRegistry(admin);
        console2.log("CooperativeRegistry:", address(registry));

        // 2. RotationManager
        RotationManager rotation = new RotationManager(admin, address(registry));
        console2.log("RotationManager:", address(rotation));

        // 3. Wire manager into registry
        if (admin == deployer) {
            registry.setRotationManager(address(rotation));
        } else {
            // If admin != deployer, deployer is Ownable only if admin was deployer.
            // Ownable is set to admin in constructor — must be admin to set manager.
            // Broadcast as admin only works when admin == deployer.
            console2.log("WARN: admin != deployer; setRotationManager must be called by admin");
        }

        // When admin is deployer (default), wire now
        if (admin == deployer) {
            // already set above
        }

        vm.stopBroadcast();

        // Verify wiring
        address linked = registry.rotationManager();
        bool ok = linked == address(rotation);
        console2.log("rotationManager linked:", linked);
        console2.log("link ok:", ok);
        console2.log("registry.owner:", registry.owner());
        console2.log("rotation.owner:", rotation.owner());
        console2.log("rotation.registry:", address(rotation.registry()));

        console2.log("");
        console2.log("=== Frontend env ===");
        console2.log("VITE_COOPERATIVE_REGISTRY_ADDRESS=%s", address(registry));
        console2.log("VITE_ROTATION_MANAGER_ADDRESS=%s", address(rotation));
        if (treasury != address(0)) {
            console2.log("VITE_TREASURY_VAULT_ADDRESS=%s", treasury);
        }
        if (loanPool != address(0)) {
            console2.log("VITE_LOAN_POOL_ADDRESS=%s", loanPool);
        }
        console2.log("Explorer registry: https://testnet.arcscan.app/address/%s", address(registry));
        console2.log("Explorer rotation: https://testnet.arcscan.app/address/%s", address(rotation));
    }
}
