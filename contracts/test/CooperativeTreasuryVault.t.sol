// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CooperativeTreasuryVault} from "../src/CooperativeTreasuryVault.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

contract CooperativeTreasuryVaultTest is Test {
    MockUSDC usdc;
    CooperativeTreasuryVault vault;

    address organizer = makeAddr("organizer");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    uint256 constant CONTRIB = 100e6; // 100 USDC (6 decimals)

    function setUp() public {
        usdc = new MockUSDC();
        // Matches product policy: 60% / 30% / 5% / 5%
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
            "Sunrise Savings Circle",
            CONTRIB,
            CooperativeTreasuryVault.ContributionFrequency.Monthly,
            CooperativeTreasuryVault.PayoutStrategy.JoinOrder,
            alloc
        );

        // Fund members
        usdc.mint(alice, 1_000e6);
        usdc.mint(bob, 1_000e6);
        usdc.mint(carol, 1_000e6);
        usdc.mint(organizer, 1_000e6);

        vm.startPrank(organizer);
        vault.registerMember(alice);
        vault.registerMember(bob);
        vault.registerMember(carol);
        vm.stopPrank();
    }

    function _approveAndDeposit(address member) internal {
        vm.startPrank(member);
        usdc.approve(address(vault), CONTRIB);
        vault.deposit();
        vm.stopPrank();
    }

    function test_RegisterAssignsJoinPositions() public view {
        assertEq(vault.getMemberRotationPosition(alice), 1);
        assertEq(vault.getMemberRotationPosition(bob), 2);
        assertEq(vault.getMemberRotationPosition(carol), 3);
        assertEq(vault.memberCount(), 3);
    }

    function test_OnlyMembersCanDeposit() public {
        address stranger = makeAddr("stranger");
        usdc.mint(stranger, CONTRIB);
        vm.startPrank(stranger);
        usdc.approve(address(vault), CONTRIB);
        vm.expectRevert(CooperativeTreasuryVault.NotMember.selector);
        vault.deposit();
        vm.stopPrank();
    }

    function test_DepositRecordsAndAllocates() public {
        _approveAndDeposit(alice);

        assertEq(uint8(vault.getContributionStatus(alice)), uint8(CooperativeTreasuryVault.ContributionStatus.Paid));
        assertEq(vault.getTreasuryBalance(), CONTRIB);

        CooperativeTreasuryVault.TreasuryBreakdown memory b = vault.getTreasuryAllocationBreakdown();
        assertEq(b.rotationFund, (CONTRIB * 6000) / 10_000);
        assertEq(b.loanPool, (CONTRIB * 3000) / 10_000);
        assertEq(b.emergencyReserve, (CONTRIB * 500) / 10_000);
        assertEq(b.savingsInvestment, (CONTRIB * 500) / 10_000);

        CooperativeTreasuryVault.ContributionRecord[] memory hist = vault.getMemberContributionHistory(alice);
        assertEq(hist.length, 1);
        assertEq(hist[0].amount, CONTRIB);
        assertEq(hist[0].cycle, 1);
        assertEq(hist[0].member, alice);
    }

    /// @notice Matches product policy + live Arc deploy ($50 bi-weekly, 60/30/5/5).
    function test_FiftyUsdcBiWeeklyAllocationBuckets() public {
        CooperativeTreasuryVault.AllocationConfig memory alloc = CooperativeTreasuryVault
            .AllocationConfig({
            rotationBps: 6000,
            loanPoolBps: 3000,
            emergencyBps: 500,
            savingsBps: 500
        });
        CooperativeTreasuryVault v = new CooperativeTreasuryVault(
            address(usdc),
            organizer,
            "Nexusu $50 BiWeekly",
            50e6,
            CooperativeTreasuryVault.ContributionFrequency.BiWeekly,
            CooperativeTreasuryVault.PayoutStrategy.JoinOrder,
            alloc
        );
        usdc.mint(alice, 50e6);
        vm.prank(organizer);
        v.registerMember(alice);

        vm.startPrank(alice);
        usdc.approve(address(v), 50e6);
        v.deposit();
        vm.stopPrank();

        CooperativeTreasuryVault.TreasuryBreakdown memory b = v.getTreasuryAllocationBreakdown();
        assertEq(v.contributionAmount(), 50e6);
        assertEq(
            uint8(v.contributionFrequency()),
            uint8(CooperativeTreasuryVault.ContributionFrequency.BiWeekly)
        );
        assertEq(b.totalBalance, 50e6);
        assertEq(b.rotationFund, 30e6); // 60%
        assertEq(b.loanPool, 15e6); // 30%
        assertEq(b.emergencyReserve, 2.5e6); // 5%
        assertEq(b.savingsInvestment, 2.5e6); // 5%
        // Full deposit accounted for (no dust lost)
        assertEq(
            b.rotationFund + b.loanPool + b.emergencyReserve + b.savingsInvestment,
            50e6
        );
    }

    function test_RejectDuplicateContribution() public {
        _approveAndDeposit(alice);
        vm.startPrank(alice);
        usdc.approve(address(vault), CONTRIB);
        vm.expectRevert(CooperativeTreasuryVault.AlreadyContributed.selector);
        vault.deposit();
        vm.stopPrank();
    }

    function test_PayoutRequiresAllMembers() public {
        _approveAndDeposit(alice);
        _approveAndDeposit(bob);
        // carol missing
        vm.expectRevert(CooperativeTreasuryVault.ContributionsIncomplete.selector);
        vault.triggerPayout();
    }

    function test_JoinOrderPayoutAndRotation() public {
        _approveAndDeposit(alice);
        _approveAndDeposit(bob);
        _approveAndDeposit(carol);

        (address current,) = vault.getCurrentPayoutRecipient();
        assertEq(current, alice); // position #1

        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 expectedPayout = (CONTRIB * 6000 / 10_000) * 3; // rotation share * 3 members

        vault.triggerPayout();

        assertEq(usdc.balanceOf(alice) - aliceBefore, expectedPayout);
        assertEq(vault.currentCycle(), 2);
        assertEq(vault.currentRecipientPosition(), 2);

        (address nextCurrent,) = vault.getCurrentPayoutRecipient();
        assertEq(nextCurrent, bob);

        CooperativeTreasuryVault.PayoutRecord[] memory payouts = vault.getPayoutHistory();
        assertEq(payouts.length, 1);
        assertEq(payouts[0].recipient, alice);
        assertEq(payouts[0].amount, expectedPayout);
    }

    function test_PreventDoublePayout() public {
        _approveAndDeposit(alice);
        _approveAndDeposit(bob);
        _approveAndDeposit(carol);
        vault.triggerPayout();

        // cycle advanced; trying to pay cycle 1 again is impossible via trigger
        // (state is cycle 2). Deposit again for cycle 2 incomplete → cannot double-pay.
        vm.expectRevert(CooperativeTreasuryVault.ContributionsIncomplete.selector);
        vault.triggerPayout();
    }

    function test_RotationWrapsAfterLastMember() public {
        // Three full cycles: alice, bob, carol, then alice again
        // Warp past founder frequency between cycles (monthly = 30 days in setUp)
        for (uint256 round = 0; round < 3; round++) {
            if (round > 0) {
                vm.warp(block.timestamp + vault.contributionPeriodSeconds());
            }
            _approveAndDeposit(alice);
            _approveAndDeposit(bob);
            _approveAndDeposit(carol);
            vault.triggerPayout();
        }
        assertEq(vault.currentCycle(), 4);
        assertEq(vault.currentRecipientPosition(), 1);
        (address current,) = vault.getCurrentPayoutRecipient();
        assertEq(current, alice);
    }

    function test_ExemptMemberDoesNotBlockPayout() public {
        vm.prank(organizer);
        vault.setMemberExempt(carol, 1, true);

        _approveAndDeposit(alice);
        _approveAndDeposit(bob);
        // carol exempt — should still be able to pay out
        vault.triggerPayout();
        assertEq(vault.currentCycle(), 2);
    }

    function test_OrganizerAssignedRecipient() public {
        vm.startPrank(organizer);
        vault.setPayoutStrategy(CooperativeTreasuryVault.PayoutStrategy.OrganizerAssigned);
        vault.setOrganizerNextRecipient(carol);
        vm.stopPrank();

        _approveAndDeposit(alice);
        _approveAndDeposit(bob);
        _approveAndDeposit(carol);

        uint256 carolBefore = usdc.balanceOf(carol);
        vault.triggerPayout();
        assertGt(usdc.balanceOf(carol), carolBefore);
    }

    function test_GovernanceVoteWinner() public {
        vm.prank(organizer);
        vault.setPayoutStrategy(CooperativeTreasuryVault.PayoutStrategy.GovernanceVote);

        vm.prank(alice);
        vault.castPayoutVote(bob);
        vm.prank(bob);
        vault.castPayoutVote(bob);
        vm.prank(carol);
        vault.castPayoutVote(alice);

        _approveAndDeposit(alice);
        _approveAndDeposit(bob);
        _approveAndDeposit(carol);

        uint256 bobBefore = usdc.balanceOf(bob);
        vault.triggerPayout();
        assertGt(usdc.balanceOf(bob), bobBefore);
    }

    function test_InvalidDepositAmountRejectedViaFixedContribution() public {
        // Contract only pulls exact contributionAmount — over-approval still pulls exact amount
        vm.startPrank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit();
        vm.stopPrank();
        assertEq(usdc.balanceOf(address(vault)), CONTRIB);
    }

    function test_NextPayoutRecipientPreview() public view {
        (address next, uint32 pos) = vault.getNextPayoutRecipient();
        assertEq(pos, 2);
        assertEq(next, bob);
    }

    function test_SetContributionRulesFromFounder() public {
        vm.prank(organizer);
        vault.setContributionRules(50e6, CooperativeTreasuryVault.ContributionFrequency.BiWeekly);
        assertEq(vault.contributionAmount(), 50e6);
        assertEq(
            uint8(vault.contributionFrequency()),
            uint8(CooperativeTreasuryVault.ContributionFrequency.BiWeekly)
        );
    }

    function test_RejectContributionBelowMinimum() public {
        vm.prank(organizer);
        vm.expectRevert(CooperativeTreasuryVault.AmountBelowMinimum.selector);
        vault.setContributionAmount(5e6); // $5 < $10 min
    }

    function test_ConstructorRejectsBelowMinimum() public {
        CooperativeTreasuryVault.AllocationConfig memory alloc = CooperativeTreasuryVault
            .AllocationConfig({
            rotationBps: 6000,
            loanPoolBps: 3000,
            emergencyBps: 500,
            savingsBps: 500
        });
        vm.expectRevert(CooperativeTreasuryVault.AmountBelowMinimum.selector);
        new CooperativeTreasuryVault(
            address(usdc),
            organizer,
            "Too Low",
            5e6,
            CooperativeTreasuryVault.ContributionFrequency.Weekly,
            CooperativeTreasuryVault.PayoutStrategy.JoinOrder,
            alloc
        );
    }

    function test_CannotChangeRulesMidCycle() public {
        _approveAndDeposit(alice);
        vm.prank(organizer);
        vm.expectRevert(CooperativeTreasuryVault.AlreadyContributed.selector);
        vault.setContributionRules(75e6, CooperativeTreasuryVault.ContributionFrequency.Weekly);
    }

    function test_CannotDepositMoreOftenThanFounderFrequency() public {
        // Bi-weekly vault: second deposit before 14 days must revert
        CooperativeTreasuryVault.AllocationConfig memory alloc = CooperativeTreasuryVault
            .AllocationConfig({
            rotationBps: 6000,
            loanPoolBps: 3000,
            emergencyBps: 500,
            savingsBps: 500
        });
        CooperativeTreasuryVault v = new CooperativeTreasuryVault(
            address(usdc),
            organizer,
            "BiWeekly Cap",
            50e6,
            CooperativeTreasuryVault.ContributionFrequency.BiWeekly,
            CooperativeTreasuryVault.PayoutStrategy.JoinOrder,
            alloc
        );
        usdc.mint(alice, 200e6);
        vm.prank(organizer);
        v.registerMember(alice);
        vm.prank(organizer);
        v.registerMember(bob);
        usdc.mint(bob, 200e6);

        // Cycle 1: both pay, payout
        vm.startPrank(alice);
        usdc.approve(address(v), type(uint256).max);
        v.deposit();
        vm.stopPrank();
        vm.startPrank(bob);
        usdc.approve(address(v), type(uint256).max);
        v.deposit();
        vm.stopPrank();
        v.triggerPayout();

        // Same day — next cycle open but frequency blocks alice
        assertEq(v.currentCycle(), 2);
        (bool ok,) = v.canDeposit(alice);
        assertFalse(ok);

        vm.startPrank(alice);
        vm.expectRevert(CooperativeTreasuryVault.ContributionTooEarly.selector);
        v.deposit();
        vm.stopPrank();

        // After 14 days — allowed, still exact $50 only
        vm.warp(block.timestamp + 14 days);
        (ok,) = v.canDeposit(alice);
        assertTrue(ok);
        assertEq(v.requiredContribution(), 50e6);

        vm.prank(alice);
        v.deposit();
        assertEq(v.getTreasuryAllocationBreakdown().rotationFund, (50e6 * 6000) / 10_000);
    }

    function test_DepositAlwaysExactFounderAmountNeverMore() public {
        // Over-approval still only pulls contributionAmount (cannot deposit more)
        vm.startPrank(alice);
        usdc.approve(address(vault), type(uint256).max);
        uint256 before = usdc.balanceOf(alice);
        vault.deposit();
        vm.stopPrank();
        assertEq(before - usdc.balanceOf(alice), CONTRIB);
        assertEq(vault.getTreasuryBalance(), CONTRIB);
        assertEq(vault.requiredContribution(), CONTRIB);
    }

    function test_CannotDepositLessThanFounderAmount() public {
        // Approve less than founder contribution → transferFrom fails → no deposit recorded
        uint256 shortApprove = CONTRIB - 1;
        vm.startPrank(alice);
        usdc.approve(address(vault), shortApprove);
        vm.expectRevert(); // SafeERC20 / ERC20 insufficient allowance
        vault.deposit();
        vm.stopPrank();
        assertEq(vault.getTreasuryBalance(), 0);
        assertEq(uint8(vault.getContributionStatus(alice)), uint8(CooperativeTreasuryVault.ContributionStatus.Waiting));

        // Balance below founder amount also cannot complete deposit
        address poor = makeAddr("poor");
        usdc.mint(poor, CONTRIB - 1);
        vm.prank(organizer);
        vault.registerMember(poor);
        vm.startPrank(poor);
        usdc.approve(address(vault), type(uint256).max);
        vm.expectRevert(); // insufficient balance
        vault.deposit();
        vm.stopPrank();
        assertEq(vault.getTreasuryBalance(), 0);
    }

    function test_WeeklyAndMonthlyPeriodLengths() public {
        CooperativeTreasuryVault.AllocationConfig memory alloc = CooperativeTreasuryVault
            .AllocationConfig({
            rotationBps: 6000,
            loanPoolBps: 3000,
            emergencyBps: 500,
            savingsBps: 500
        });
        CooperativeTreasuryVault weekly = new CooperativeTreasuryVault(
            address(usdc),
            organizer,
            "W",
            10e6,
            CooperativeTreasuryVault.ContributionFrequency.Weekly,
            CooperativeTreasuryVault.PayoutStrategy.JoinOrder,
            alloc
        );
        CooperativeTreasuryVault monthly = new CooperativeTreasuryVault(
            address(usdc),
            organizer,
            "M",
            10e6,
            CooperativeTreasuryVault.ContributionFrequency.Monthly,
            CooperativeTreasuryVault.PayoutStrategy.JoinOrder,
            alloc
        );
        assertEq(weekly.contributionPeriodSeconds(), 7 days);
        assertEq(monthly.contributionPeriodSeconds(), 30 days);
        assertEq(vault.contributionPeriodSeconds(), 30 days); // setUp monthly
    }

    /// @notice Weekly vault: deposit before 7 days reverts; after 7 days exact $10 only.
    function test_WeeklyFrequencyBlocksEarlyDeposit() public {
        CooperativeTreasuryVault.AllocationConfig memory alloc = CooperativeTreasuryVault
            .AllocationConfig({
            rotationBps: 6000,
            loanPoolBps: 3000,
            emergencyBps: 500,
            savingsBps: 500
        });
        CooperativeTreasuryVault v = new CooperativeTreasuryVault(
            address(usdc),
            organizer,
            "Weekly Cap",
            10e6,
            CooperativeTreasuryVault.ContributionFrequency.Weekly,
            CooperativeTreasuryVault.PayoutStrategy.JoinOrder,
            alloc
        );
        usdc.mint(alice, 100e6);
        usdc.mint(bob, 100e6);
        vm.startPrank(organizer);
        v.registerMember(alice);
        v.registerMember(bob);
        vm.stopPrank();

        vm.startPrank(alice);
        usdc.approve(address(v), type(uint256).max);
        v.deposit();
        vm.stopPrank();
        vm.startPrank(bob);
        usdc.approve(address(v), type(uint256).max);
        v.deposit();
        vm.stopPrank();
        v.triggerPayout();

        // Day 3 of next cycle — still too early for weekly schedule
        vm.warp(block.timestamp + 3 days);
        vm.startPrank(alice);
        vm.expectRevert(CooperativeTreasuryVault.ContributionTooEarly.selector);
        v.deposit();
        vm.stopPrank();

        // After full 7 days — exact $10 pulled (never more)
        vm.warp(block.timestamp + 4 days);
        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        v.deposit();
        assertEq(before - usdc.balanceOf(alice), 10e6);
        assertEq(v.requiredContribution(), 10e6);
    }

    /// @notice Monthly vault: deposit before 30 days reverts; after 30 days exact amount only.
    function test_MonthlyFrequencyBlocksEarlyDeposit() public {
        // setUp vault is monthly at $100
        _approveAndDeposit(alice);
        _approveAndDeposit(bob);
        _approveAndDeposit(carol);
        vault.triggerPayout();

        vm.warp(block.timestamp + 29 days);
        vm.startPrank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vm.expectRevert(CooperativeTreasuryVault.ContributionTooEarly.selector);
        vault.deposit();
        vm.stopPrank();

        vm.warp(block.timestamp + 1 days);
        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 vaultBefore = vault.getTreasuryBalance();
        // Over-approve still only pulls founder amount
        vm.startPrank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vault.deposit();
        vm.stopPrank();
        assertEq(aliceBefore - usdc.balanceOf(alice), CONTRIB);
        assertEq(vault.getTreasuryBalance() - vaultBefore, CONTRIB);
        assertEq(vault.requiredContribution(), CONTRIB);
    }
}
