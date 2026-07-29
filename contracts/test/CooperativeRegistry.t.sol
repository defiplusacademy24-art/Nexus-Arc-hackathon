// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CooperativeRegistry} from "../src/CooperativeRegistry.sol";
import {RotationManager} from "../src/RotationManager.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

/// @dev Minimal vault stub that RotationManager can call.
contract MockTreasuryVault {
    address public organizer;
    uint32 public currentCycle = 1;
    uint32 public currentRecipientPosition = 1;
    uint256 public rotationFund;
    bool public ready = true;
    address public payoutRecipient;
    address public nextRecipient;
    mapping(address => bool) public members;
    mapping(address => uint32) public positions;
    bool public shouldRevertPayout;

    constructor(address organizer_) {
        organizer = organizer_;
    }

    function setReady(bool r) external {
        ready = r;
    }

    function setRecipients(address cur, address next_) external {
        payoutRecipient = cur;
        nextRecipient = next_;
    }

    function setRotationFund(uint256 amt) external {
        rotationFund = amt;
    }

    function setMember(address a, uint32 pos) external {
        members[a] = true;
        positions[a] = pos;
    }

    function canTriggerPayout() external view returns (bool, uint32, uint32) {
        return (ready, 1, ready ? 1 : 0);
    }

    function getCurrentPayoutRecipient() external view returns (address, uint32) {
        return (payoutRecipient, currentRecipientPosition);
    }

    function getNextPayoutRecipient() external view returns (address, uint32) {
        return (nextRecipient, currentRecipientPosition + 1);
    }

    function isMember(address a) external view returns (bool) {
        return members[a];
    }

    function getMemberRotationPosition(address a) external view returns (uint32) {
        return positions[a];
    }

    function triggerPayout() external {
        if (shouldRevertPayout) revert("fail");
        if (!ready) revert("not ready");
        // simulate payout consuming rotation fund
        rotationFund = 0;
        unchecked {
            currentCycle += 1;
            currentRecipientPosition += 1;
        }
        ready = false;
    }
}

contract CooperativeRegistryTest is Test {
    CooperativeRegistry registry;
    RotationManager rotation;
    MockTreasuryVault vault;
    MockUSDC usdc;

    address admin = makeAddr("admin");
    address organizer = makeAddr("organizer");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address loanPool = makeAddr("loanPool");

    uint256 coopId;

    function setUp() public {
        usdc = new MockUSDC();
        vault = new MockTreasuryVault(organizer);

        vm.prank(admin);
        registry = new CooperativeRegistry(admin);

        rotation = new RotationManager(admin, address(registry));

        vm.prank(admin);
        registry.setRotationManager(address(rotation));

        vm.prank(organizer);
        coopId = registry.createCooperative(
            "Sunrise Circle",
            "Test coop",
            address(vault),
            loanPool,
            50e6,
            CooperativeRegistry.ContributionFrequency.Monthly,
            10,
            CooperativeRegistry.PayoutStrategy.JoinOrder,
            "Organizer"
        );

        // Wire mock vault members
        vault.setMember(organizer, 1);
        vault.setRecipients(organizer, address(0));
        vault.setRotationFund(180e6);
    }

    function test_CreateCooperative() public view {
        CooperativeRegistry.Cooperative memory c = registry.getCooperative(coopId);
        assertEq(c.id, coopId);
        assertEq(c.organizer, organizer);
        assertEq(c.treasuryVault, address(vault));
        assertEq(c.loanPool, loanPool);
        assertEq(c.contributionAmount, 50e6);
        assertEq(c.memberCount, 1);
        assertEq(c.currentRotationIndex, 1);
        assertEq(uint8(c.status), uint8(CooperativeRegistry.CoopStatus.Active));
        assertEq(uint8(c.payoutStrategy), uint8(CooperativeRegistry.PayoutStrategy.JoinOrder));
        assertTrue(registry.isMember(coopId, organizer));
        assertEq(registry.getMemberPosition(coopId, organizer), 1);
    }

    function test_JoinCooperativeAssignsPositions() public {
        vm.prank(alice);
        registry.joinCooperative(coopId, "Alice");
        vm.prank(bob);
        registry.joinCooperative(coopId, "Bob");

        assertEq(registry.getMemberPosition(coopId, organizer), 1);
        assertEq(registry.getMemberPosition(coopId, alice), 2);
        assertEq(registry.getMemberPosition(coopId, bob), 3);
        assertEq(registry.getCooperative(coopId).memberCount, 3);
    }

    function test_PreventDuplicateJoins() public {
        vm.prank(alice);
        registry.joinCooperative(coopId, "Alice");
        vm.prank(alice);
        vm.expectRevert(CooperativeRegistry.AlreadyMember.selector);
        registry.joinCooperative(coopId, "Alice");
    }

    function test_LeaveAndRejoinKeepsPosition() public {
        vm.prank(alice);
        registry.joinCooperative(coopId, "Alice");
        uint32 pos = registry.getMemberPosition(coopId, alice);

        vm.prank(alice);
        registry.leaveCooperative(coopId);
        assertFalse(registry.isMember(coopId, alice));

        vm.prank(alice);
        registry.joinCooperative(coopId, "Alice Again");
        assertEq(registry.getMemberPosition(coopId, alice), pos);
        assertTrue(registry.isMember(coopId, alice));
    }

    function test_OnlyOrganizerUpdatesSettings() public {
        vm.prank(alice);
        vm.expectRevert(CooperativeRegistry.NotOrganizer.selector);
        registry.updateContributionAmount(coopId, 75e6);

        vm.prank(organizer);
        registry.updateContributionAmount(coopId, 75e6);
        assertEq(registry.getCooperative(coopId).contributionAmount, 75e6);

        vm.prank(organizer);
        registry.updateContributionFrequency(
            coopId, CooperativeRegistry.ContributionFrequency.Weekly
        );
        assertEq(
            uint8(registry.getCooperative(coopId).contributionFrequency),
            uint8(CooperativeRegistry.ContributionFrequency.Weekly)
        );

        vm.prank(organizer);
        registry.changePayoutStrategy(
            coopId, CooperativeRegistry.PayoutStrategy.RandomDraw
        );
        assertEq(
            uint8(registry.getCooperative(coopId).payoutStrategy),
            uint8(CooperativeRegistry.PayoutStrategy.RandomDraw)
        );
    }

    function test_PauseAndActivate() public {
        vm.prank(organizer);
        registry.pauseCooperative(coopId);
        assertEq(
            uint8(registry.getCooperative(coopId).status),
            uint8(CooperativeRegistry.CoopStatus.Paused)
        );

        vm.prank(alice);
        vm.expectRevert(CooperativeRegistry.CoopNotActive.selector);
        registry.joinCooperative(coopId, "Alice");

        vm.prank(organizer);
        registry.activateCooperative(coopId);
        vm.prank(alice);
        registry.joinCooperative(coopId, "Alice");
        assertTrue(registry.isMember(coopId, alice));
    }

    function test_CloseCooperative() public {
        vm.prank(organizer);
        registry.closeCooperative(coopId);
        assertEq(
            uint8(registry.getCooperative(coopId).status),
            uint8(CooperativeRegistry.CoopStatus.Closed)
        );
        vm.prank(organizer);
        vm.expectRevert(CooperativeRegistry.CoopClosed.selector);
        registry.activateCooperative(coopId);
    }

    function test_RejectLowContribution() public {
        vm.prank(organizer);
        vm.expectRevert(CooperativeRegistry.InvalidAmount.selector);
        registry.createCooperative(
            "Low",
            "x",
            address(vault),
            loanPool,
            5e6,
            CooperativeRegistry.ContributionFrequency.Monthly,
            5,
            CooperativeRegistry.PayoutStrategy.JoinOrder,
            "O"
        );
    }

    function test_MaxMembersEnforced() public {
        vm.prank(organizer);
        uint256 small = registry.createCooperative(
            "Tiny",
            "x",
            address(vault),
            loanPool,
            50e6,
            CooperativeRegistry.ContributionFrequency.Monthly,
            2,
            CooperativeRegistry.PayoutStrategy.JoinOrder,
            "O"
        );
        vm.prank(alice);
        registry.joinCooperative(small, "Alice");
        vm.prank(bob);
        vm.expectRevert(CooperativeRegistry.CoopFull.selector);
        registry.joinCooperative(small, "Bob");
    }

    function test_JoinOrderRecipients() public {
        vm.prank(alice);
        registry.joinCooperative(coopId, "Alice");
        vm.prank(bob);
        registry.joinCooperative(coopId, "Bob");

        (address cur, uint32 pos) = registry.getCurrentRecipient(coopId);
        assertEq(cur, organizer);
        assertEq(pos, 1);

        (address nxt, uint32 npos) = registry.getNextRecipient(coopId);
        assertEq(nxt, alice);
        assertEq(npos, 2);
    }

    function test_SkipRecipient() public {
        vm.prank(alice);
        registry.joinCooperative(coopId, "Alice");
        vm.prank(bob);
        registry.joinCooperative(coopId, "Bob");

        vm.prank(organizer);
        rotation.skipRecipient(coopId);

        (address cur,) = registry.getCurrentRecipient(coopId);
        assertEq(cur, alice);
        assertTrue(rotation.skippedThisCycle(coopId, organizer));
    }

    function test_OnlyOrganizerSkip() public {
        vm.prank(alice);
        registry.joinCooperative(coopId, "Alice");
        vm.prank(alice);
        vm.expectRevert(RotationManager.NotOrganizer.selector);
        rotation.skipRecipient(coopId);
    }

    function test_ExecuteRotation() public {
        vm.prank(alice);
        registry.joinCooperative(coopId, "Alice");
        vault.setMember(alice, 2);
        vault.setRecipients(organizer, alice);
        vault.setRotationFund(180e6);
        vault.setReady(true);

        (address paid, uint256 amount) = rotation.executeRotation(coopId);
        assertEq(paid, organizer);
        assertEq(amount, 180e6);

        RotationManager.RotationState memory st = rotation.getRotationState(coopId);
        assertEq(st.totalRotationsCompleted, 1);
        assertEq(st.previousRecipient, organizer);
        assertGt(st.lastPayoutTimestamp, 0);

        RotationManager.PayoutHistoryEntry[] memory hist = rotation.getPayoutHistory(coopId);
        assertEq(hist.length, 1);
        assertEq(hist[0].recipient, organizer);
        assertEq(hist[0].amount, 180e6);
    }

    function test_ExecuteRotationRequiresReady() public {
        vault.setReady(false);
        vm.expectRevert(RotationManager.VaultNotReady.selector);
        rotation.executeRotation(coopId);
    }

    function test_ManualAdvance() public {
        vm.prank(alice);
        registry.joinCooperative(coopId, "Alice");
        vm.prank(bob);
        registry.joinCooperative(coopId, "Bob");

        vm.prank(organizer);
        rotation.manualAdvance(coopId);

        (address cur,) = registry.getCurrentRecipient(coopId);
        assertEq(cur, alice);
    }

    function test_CompleteCycle() public {
        vm.prank(alice);
        registry.joinCooperative(coopId, "Alice");
        vm.prank(organizer);
        rotation.skipRecipient(coopId);
        assertEq(rotation.getSkippedThisCycle(coopId).length, 1);

        vm.prank(organizer);
        rotation.completeCycle(coopId);
        assertEq(rotation.getSkippedThisCycle(coopId).length, 0);
        assertEq(rotation.getRotationState(coopId).totalRotationsCompleted, 1);
    }

    function test_PayoutOrderJoinOrder() public {
        vm.prank(alice);
        registry.joinCooperative(coopId, "Alice");
        vm.prank(bob);
        registry.joinCooperative(coopId, "Bob");

        // organizer (1) → alice (2) → bob (3) → organizer
        (address a,) = registry.getCurrentRecipient(coopId);
        assertEq(a, organizer);

        vm.prank(organizer);
        rotation.manualAdvance(coopId);
        (address b,) = registry.getCurrentRecipient(coopId);
        assertEq(b, alice);

        vm.prank(organizer);
        rotation.manualAdvance(coopId);
        (address c,) = registry.getCurrentRecipient(coopId);
        assertEq(c, bob);

        vm.prank(organizer);
        rotation.manualAdvance(coopId);
        (address d,) = registry.getCurrentRecipient(coopId);
        assertEq(d, organizer);
    }

    function test_PlatformPauseBlocksJoin() public {
        vm.prank(admin);
        registry.pause();
        vm.prank(alice);
        vm.expectRevert();
        registry.joinCooperative(coopId, "Alice");

        vm.prank(admin);
        registry.unpause();
        vm.prank(alice);
        registry.joinCooperative(coopId, "Alice");
    }

    function test_RotationManagerLinkRequired() public {
        CooperativeRegistry reg2 = new CooperativeRegistry(admin);
        vm.prank(organizer);
        uint256 id2 = reg2.createCooperative(
            "X",
            "y",
            address(vault),
            loanPool,
            50e6,
            CooperativeRegistry.ContributionFrequency.Monthly,
            0,
            CooperativeRegistry.PayoutStrategy.JoinOrder,
            "O"
        );
        // No rotation manager set — advance should fail
        vm.expectRevert(CooperativeRegistry.NotRotationManager.selector);
        reg2.advanceRotationIndex(id2, 2);
    }
}
