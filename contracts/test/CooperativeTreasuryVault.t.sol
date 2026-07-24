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
        CooperativeTreasuryVault.AllocationConfig memory alloc = CooperativeTreasuryVault
            .AllocationConfig({
            rotationBps: 7000,
            loanPoolBps: 1500,
            emergencyBps: 1000,
            savingsBps: 500
        });

        vault = new CooperativeTreasuryVault(
            address(usdc),
            organizer,
            "Sunrise Savings Circle",
            CONTRIB,
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
        assertEq(b.rotationFund, (CONTRIB * 7000) / 10_000);
        assertEq(b.loanPool, (CONTRIB * 1500) / 10_000);
        assertEq(b.emergencyReserve, (CONTRIB * 1000) / 10_000);
        assertEq(b.savingsInvestment, (CONTRIB * 500) / 10_000);

        CooperativeTreasuryVault.ContributionRecord[] memory hist = vault.getMemberContributionHistory(alice);
        assertEq(hist.length, 1);
        assertEq(hist[0].amount, CONTRIB);
        assertEq(hist[0].cycle, 1);
        assertEq(hist[0].member, alice);
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
        uint256 expectedPayout = (CONTRIB * 7000 / 10_000) * 3; // rotation share * 3 members

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
        for (uint256 round = 0; round < 3; round++) {
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
}
