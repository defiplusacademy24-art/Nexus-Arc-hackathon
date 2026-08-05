// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CooperativeTreasuryVault} from "../src/CooperativeTreasuryVault.sol";
import {CooperativeTreasuryVaultFactory} from "../src/CooperativeTreasuryVaultFactory.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

/**
 * @notice Proves each cooperative workspace has an isolated vault:
 *         balances, membership, cycle contributions, and deposit cooldowns
 *         do not leak across workspaces.
 */
contract MultiWorkspaceIsolationTest is Test {
    MockUSDC usdc;
    CooperativeTreasuryVaultFactory factory;

    address operator = makeAddr("operator");
    address alice = makeAddr("alice");

    uint256 constant CONTRIB_A = 50e6; // $50
    uint256 constant CONTRIB_B = 100e6; // $100

    function setUp() public {
        usdc = new MockUSDC();
        factory = new CooperativeTreasuryVaultFactory(address(usdc));
        usdc.mint(alice, 1_000e6);
    }

    function _createVault(
        string memory name,
        uint256 amount,
        uint8 freq,
        bytes32 coopHash
    ) internal returns (CooperativeTreasuryVault) {
        address vaultAddr = factory.createVault(operator, name, amount, freq, coopHash);
        return CooperativeTreasuryVault(vaultAddr);
    }

    function test_FactoryCreatesDistinctVaults() public {
        CooperativeTreasuryVault vaultA =
            _createVault("Coop A", CONTRIB_A, 2, keccak256("coop-a"));
        CooperativeTreasuryVault vaultB =
            _createVault("Coop B", CONTRIB_B, 0, keccak256("coop-b"));

        assertTrue(address(vaultA) != address(vaultB));
        assertEq(vaultA.contributionAmount(), CONTRIB_A);
        assertEq(vaultB.contributionAmount(), CONTRIB_B);
        assertEq(uint8(vaultA.contributionFrequency()), 2); // monthly
        assertEq(uint8(vaultB.contributionFrequency()), 0); // weekly
        assertEq(factory.vaultCount(), 2);
        assertEq(factory.vaultByAppCoopId(keccak256("coop-a")), address(vaultA));
        assertEq(factory.vaultByAppCoopId(keccak256("coop-b")), address(vaultB));
    }

    function test_DepositInADoesNotShowInB() public {
        CooperativeTreasuryVault vaultA =
            _createVault("Coop A", CONTRIB_A, 2, keccak256("coop-a"));
        CooperativeTreasuryVault vaultB =
            _createVault("Coop B", CONTRIB_B, 2, keccak256("coop-b"));

        // Alice deposits only into workspace A
        vm.startPrank(alice);
        usdc.approve(address(vaultA), CONTRIB_A);
        vaultA.deposit();
        vm.stopPrank();

        assertEq(vaultA.getTreasuryBalance(), CONTRIB_A);
        assertEq(vaultB.getTreasuryBalance(), 0);
        assertTrue(vaultA.isMember(alice));
        // Auto-join only on deposit — B still empty membership for alice
        assertFalse(vaultB.isMember(alice));
        assertEq(uint8(vaultA.getContributionStatus(alice)), uint8(CooperativeTreasuryVault.ContributionStatus.Paid));
    }

    function test_UserCanDepositInSecondWorkspaceAfterFirst() public {
        CooperativeTreasuryVault vaultA =
            _createVault("Coop A", CONTRIB_A, 2, keccak256("coop-a"));
        CooperativeTreasuryVault vaultB =
            _createVault("Coop B", CONTRIB_B, 2, keccak256("coop-b"));

        // Deposit in A first (would block re-deposit on shared vault)
        vm.startPrank(alice);
        usdc.approve(address(vaultA), CONTRIB_A);
        vaultA.deposit();

        // Same user can still deposit in B — independent cycle + membership
        usdc.approve(address(vaultB), CONTRIB_B);
        vaultB.deposit();
        vm.stopPrank();

        assertEq(vaultA.getTreasuryBalance(), CONTRIB_A);
        assertEq(vaultB.getTreasuryBalance(), CONTRIB_B);
        assertEq(vaultA.getMember(alice).totalContributed, CONTRIB_A);
        assertEq(vaultB.getMember(alice).totalContributed, CONTRIB_B);

        (bool canA,) = vaultA.canDeposit(alice);
        (bool canB,) = vaultB.canDeposit(alice);
        // Both already contributed this cycle on their own vaults
        assertFalse(canA);
        assertFalse(canB);
    }

    function test_AnalyticsHistoryIsPerVault() public {
        CooperativeTreasuryVault vaultA =
            _createVault("Coop A", CONTRIB_A, 2, keccak256("coop-a"));
        CooperativeTreasuryVault vaultB =
            _createVault("Coop B", CONTRIB_B, 2, keccak256("coop-b"));

        vm.startPrank(alice);
        usdc.approve(address(vaultA), CONTRIB_A);
        vaultA.deposit();
        usdc.approve(address(vaultB), CONTRIB_B);
        vaultB.deposit();
        vm.stopPrank();

        CooperativeTreasuryVault.ContributionRecord[] memory histA =
            vaultA.getMemberContributionHistory(alice);
        CooperativeTreasuryVault.ContributionRecord[] memory histB =
            vaultB.getMemberContributionHistory(alice);
        CooperativeTreasuryVault.ContributionRecord[] memory allA = vaultA.getAllContributions();
        CooperativeTreasuryVault.ContributionRecord[] memory allB = vaultB.getAllContributions();

        assertEq(histA.length, 1);
        assertEq(histB.length, 1);
        assertEq(histA[0].amount, CONTRIB_A);
        assertEq(histB[0].amount, CONTRIB_B);
        assertEq(allA.length, 1);
        assertEq(allB.length, 1);
    }

    function test_DuplicateAppCoopIdReverts() public {
        bytes32 id = keccak256("same-coop");
        factory.createVault(operator, "A", CONTRIB_A, 2, id);
        vm.expectRevert(CooperativeTreasuryVaultFactory.CoopIdAlreadyHasVault.selector);
        factory.createVault(operator, "A again", CONTRIB_A, 2, id);
    }
}
