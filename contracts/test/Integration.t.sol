// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CooperativeTreasuryVault} from "../src/CooperativeTreasuryVault.sol";
import {CooperativeLoanPool} from "../src/CooperativeLoanPool.sol";
import {CooperativeRegistry} from "../src/CooperativeRegistry.sol";
import {RotationManager} from "../src/RotationManager.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

/**
 * @notice End-to-end: Treasury + Loan + Registry + Rotation as the UI will use them.
 */
contract IntegrationTest is Test {
    MockUSDC usdc;
    CooperativeTreasuryVault vault;
    CooperativeLoanPool pool;
    CooperativeRegistry registry;
    RotationManager rotation;

    address admin = makeAddr("admin");
    address organizer = makeAddr("organizer");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant CONTRIB = 50e6;

    function setUp() public {
        usdc = new MockUSDC();

        CooperativeTreasuryVault.AllocationConfig memory alloc = CooperativeTreasuryVault
            .AllocationConfig({
            rotationBps: 6000,
            loanPoolBps: 3000,
            emergencyBps: 500,
            savingsBps: 500
        });

        vault = new CooperativeTreasuryVault(
            address(usdc),
            organizer,
            "Integration Coop",
            CONTRIB,
            CooperativeTreasuryVault.ContributionFrequency.BiWeekly,
            CooperativeTreasuryVault.PayoutStrategy.JoinOrder,
            alloc
        );

        // Loan pool membership = vault members; interest → vault
        pool = new CooperativeLoanPool(address(usdc), organizer, address(vault));
        vm.prank(organizer);
        pool.setProfitRecipient(address(vault));

        registry = new CooperativeRegistry(admin);
        rotation = new RotationManager(admin, address(registry));
        vm.prank(admin);
        registry.setRotationManager(address(rotation));

        // Fund members
        usdc.mint(organizer, 10_000e6);
        usdc.mint(alice, 10_000e6);
        usdc.mint(bob, 10_000e6);

        // Register vault members (same wallets UI will use)
        vm.startPrank(organizer);
        vault.registerMember(organizer);
        vault.registerMember(alice);
        vault.registerMember(bob);
        // Seed loan pool liquidity
        usdc.approve(address(pool), 5_000e6);
        pool.fundPool(5_000e6);
        vm.stopPrank();
    }

    function test_FullContributionPayoutFlow() public {
        // Exact deposit only — matches UI depositToVault
        _deposit(organizer);
        _deposit(alice);
        _deposit(bob);

        assertEq(vault.getTreasuryBalance(), CONTRIB * 3);
        CooperativeTreasuryVault.TreasuryBreakdown memory b = vault.getTreasuryAllocationBreakdown();
        assertEq(b.rotationFund, (CONTRIB * 3 * 6000) / 10_000);
        assertEq(b.loanPool, (CONTRIB * 3 * 3000) / 10_000);

        // Rotation via RotationManager → vault.triggerPayout
        uint256 coopId = _registerCoopOnChain();
        uint256 orgBefore = usdc.balanceOf(organizer);

        (address paid, uint256 amount) = rotation.executeRotation(coopId);
        assertEq(paid, organizer); // join position #1
        assertEq(amount, (CONTRIB * 3 * 6000) / 10_000);
        assertEq(usdc.balanceOf(organizer) - orgBefore, amount);
        assertEq(vault.currentCycle(), 2);
    }

    function test_ExactContributionEnforced() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), CONTRIB - 1);
        vm.expectRevert();
        vault.deposit();
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit();
        vm.stopPrank();
        assertEq(usdc.balanceOf(address(vault)), CONTRIB);
    }

    function test_LoanOnlyVaultMembersCanApply() public {
        address stranger = makeAddr("stranger");
        usdc.mint(stranger, 1_000e6);

        vm.prank(stranger);
        vm.expectRevert(CooperativeLoanPool.NotEligibleBorrower.selector);
        pool.applyForLoan(100e6, 1, "Business");

        // Alice is vault member → can apply
        vm.prank(alice);
        uint256 loanId = pool.applyForLoan(100e6, 1, "Business");
        assertEq(loanId, 1);

        // One open loan
        vm.prank(alice);
        vm.expectRevert(CooperativeLoanPool.HasOpenLoan.selector);
        pool.applyForLoan(50e6, 1, "Other");

        // Approve + disburse
        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(organizer);
        pool.approveLoan(loanId);
        assertEq(usdc.balanceOf(alice) - aliceBefore, 100e6);

        // Repay interest first then principal
        vm.startPrank(alice);
        usdc.approve(address(pool), 105e6);
        pool.repay(loanId, 105e6);
        vm.stopPrank();

        assertEq(uint8(pool.getLoan(loanId).status), uint8(CooperativeLoanPool.LoanStatus.Completed));
        // Interest forwarded to treasury (profitRecipient)
        assertEq(pool.interestEarned(), 0);
    }

    function test_FrequencyBlocksEarlySecondDeposit() public {
        _deposit(alice);
        _deposit(bob);
        _deposit(organizer);
        vault.triggerPayout();

        // Next cycle open but bi-weekly blocks
        vm.startPrank(alice);
        usdc.approve(address(vault), CONTRIB);
        vm.expectRevert(CooperativeTreasuryVault.ContributionTooEarly.selector);
        vault.deposit();
        vm.stopPrank();

        vm.warp(block.timestamp + 14 days);
        _deposit(alice);
        assertEq(uint8(vault.getContributionStatus(alice)), uint8(CooperativeTreasuryVault.ContributionStatus.Paid));
    }

    function test_RegistryJoinOrderMatchesVaultPositions() public {
        uint256 coopId = _registerCoopOnChain();
        vm.prank(alice);
        registry.joinCooperative(coopId, "Alice");
        vm.prank(bob);
        registry.joinCooperative(coopId, "Bob");

        assertEq(registry.getMemberPosition(coopId, organizer), 1);
        assertEq(registry.getMemberPosition(coopId, alice), 2);
        assertEq(registry.getMemberPosition(coopId, bob), 3);
        assertEq(vault.getMemberRotationPosition(organizer), 1);
        assertEq(vault.getMemberRotationPosition(alice), 2);
        assertEq(vault.getMemberRotationPosition(bob), 3);

        (address cur,) = registry.getCurrentRecipient(coopId);
        (address vaultCur,) = vault.getCurrentPayoutRecipient();
        assertEq(cur, organizer);
        assertEq(vaultCur, organizer);
    }

    function test_MaxLoanCapAndLiquidity() public {
        // 25% of 5000 = 1250
        vm.prank(alice);
        uint256 id = pool.applyForLoan(2_000e6, 3, "Business");
        vm.prank(organizer);
        vm.expectRevert(CooperativeLoanPool.ExceedsMaxLoan.selector);
        pool.approveLoan(id);

        vm.prank(bob);
        uint256 id2 = pool.applyForLoan(1_000e6, 3, "Business");
        vm.prank(organizer);
        pool.approveLoan(id2);
        assertEq(uint8(pool.getLoan(id2).status), uint8(CooperativeLoanPool.LoanStatus.Active));
    }

    function test_CannotDepositMoreThanFounderAmount() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), type(uint256).max);
        uint256 before = usdc.balanceOf(alice);
        vault.deposit();
        vm.stopPrank();
        assertEq(before - usdc.balanceOf(alice), CONTRIB);
        assertEq(vault.requiredContribution(), CONTRIB);
    }

    function _deposit(address who) internal {
        vm.startPrank(who);
        usdc.approve(address(vault), CONTRIB);
        vault.deposit();
        vm.stopPrank();
    }

    function _registerCoopOnChain() internal returns (uint256 coopId) {
        vm.prank(organizer);
        coopId = registry.createCooperative(
            "Integration Coop",
            "E2E",
            address(vault),
            address(pool),
            CONTRIB,
            CooperativeRegistry.ContributionFrequency.BiWeekly,
            10,
            CooperativeRegistry.PayoutStrategy.JoinOrder,
            "Organizer"
        );
        // Note: createCooperative already joins organizer as #1 in registry.
        // Vault already has organizer registered in setUp.
    }
}
