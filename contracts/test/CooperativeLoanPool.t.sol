// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CooperativeLoanPool} from "../src/CooperativeLoanPool.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

/// @dev Minimal stand-in for CooperativeTreasuryVault.isMember
contract MockMembershipVault {
    mapping(address => bool) public members;

    function setMember(address a, bool ok) external {
        members[a] = ok;
    }

    function isMember(address a) external view returns (bool) {
        return members[a];
    }
}

contract CooperativeLoanPoolTest is Test {
    MockUSDC usdc;
    CooperativeLoanPool pool;

    address organizer = makeAddr("organizer");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant FUND = 10_000e6; // 10,000 USDC

    function setUp() public {
        usdc = new MockUSDC();
        // No membership vault — use local borrower registry
        pool = new CooperativeLoanPool(address(usdc), organizer, address(0));

        usdc.mint(organizer, FUND);
        usdc.mint(alice, 5_000e6);
        usdc.mint(bob, 5_000e6);

        vm.startPrank(organizer);
        usdc.approve(address(pool), FUND);
        pool.fundPool(FUND);
        pool.registerBorrower(alice);
        pool.registerBorrower(bob);
        vm.stopPrank();
    }

    function test_QuoteMatchesInterestTable() public view {
        (uint16 bps1, uint256 interest1, uint256 due1,) = pool.quoteLoan(1_000e6, 1);
        assertEq(bps1, 500);
        assertEq(interest1, 50e6);
        assertEq(due1, 1_050e6);

        (uint16 bps6, uint256 interest6, uint256 due6,) = pool.quoteLoan(1_000e6, 6);
        assertEq(bps6, 1000);
        assertEq(interest6, 100e6);
        assertEq(due6, 1_100e6);
    }

    function test_ApplyApproveDisburseAndRepay() public {
        vm.prank(alice);
        uint256 loanId = pool.applyForLoan(1_000e6, 3, "Business");

        CooperativeLoanPool.Loan memory pending = pool.getLoan(loanId);
        assertEq(uint8(pending.status), uint8(CooperativeLoanPool.LoanStatus.Pending));
        assertEq(pending.interestBps, 700);
        assertEq(pending.totalInterest, 70e6);
        assertEq(pending.totalDue, 1_070e6);
        assertEq(pool.openLoanId(alice), loanId);

        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(organizer);
        pool.approveLoan(loanId);

        assertEq(usdc.balanceOf(alice), aliceBefore + 1_000e6);
        assertEq(pool.totalOutstandingPrincipal(), 1_000e6);

        // Alice repays in full (interest + principal)
        vm.startPrank(alice);
        usdc.approve(address(pool), 1_070e6);
        pool.repay(loanId, 1_070e6);
        vm.stopPrank();

        CooperativeLoanPool.Loan memory done = pool.getLoan(loanId);
        assertEq(uint8(done.status), uint8(CooperativeLoanPool.LoanStatus.Completed));
        assertEq(pool.remainingBalance(loanId), 0);
        assertEq(pool.totalOutstandingPrincipal(), 0);
        assertEq(pool.interestEarned(), 70e6);
        assertEq(pool.openLoanId(alice), 0);
    }

    function test_InterestFirstOnPartialRepay() public {
        vm.prank(alice);
        uint256 loanId = pool.applyForLoan(1_000e6, 1, "Emergency"); // 5% → 50 interest

        vm.prank(organizer);
        pool.approveLoan(loanId);

        // Pay only interest portion first
        vm.startPrank(alice);
        usdc.approve(address(pool), 50e6);
        pool.repay(loanId, 50e6);
        vm.stopPrank();

        CooperativeLoanPool.Loan memory mid = pool.getLoan(loanId);
        assertEq(mid.interestPaid, 50e6);
        assertEq(mid.amountPaid, 50e6);
        assertEq(pool.remainingPrincipal(loanId), 1_000e6);
        assertEq(pool.interestEarned(), 50e6);
        assertEq(pool.totalOutstandingPrincipal(), 1_000e6);
    }

    function test_RejectLoan() public {
        vm.prank(alice);
        uint256 loanId = pool.applyForLoan(500e6, 2, "Personal");

        vm.prank(organizer);
        pool.rejectLoan(loanId);

        CooperativeLoanPool.Loan memory l = pool.getLoan(loanId);
        assertEq(uint8(l.status), uint8(CooperativeLoanPool.LoanStatus.Rejected));
        assertEq(pool.openLoanId(alice), 0);

        // Can apply again after reject
        vm.prank(alice);
        uint256 loanId2 = pool.applyForLoan(200e6, 1, "Other");
        assertEq(loanId2, 2);
    }

    function test_ExceedsMaxLoanReverts() public {
        // max 25% of 10k = 2500
        vm.prank(alice);
        uint256 loanId = pool.applyForLoan(3_000e6, 3, "Business");

        vm.prank(organizer);
        vm.expectRevert(CooperativeLoanPool.ExceedsMaxLoan.selector);
        pool.approveLoan(loanId);
    }

    function test_OnlyApproverCanApprove() public {
        vm.prank(alice);
        uint256 loanId = pool.applyForLoan(100e6, 1, "Other");

        vm.prank(bob);
        vm.expectRevert(CooperativeLoanPool.NotApprover.selector);
        pool.approveLoan(loanId);
    }

    function test_LendingAgentCanApprove() public {
        address agent = makeAddr("agent");
        vm.prank(organizer);
        pool.setLendingAgent(agent);

        vm.prank(alice);
        uint256 loanId = pool.applyForLoan(100e6, 1, "Other");

        vm.prank(agent);
        pool.approveLoan(loanId);

        assertEq(uint8(pool.getLoan(loanId).status), uint8(CooperativeLoanPool.LoanStatus.Active));
    }

    function test_ProfitRecipientReceivesInterest() public {
        address treasury = makeAddr("treasury");
        vm.prank(organizer);
        pool.setProfitRecipient(treasury);

        vm.prank(alice);
        uint256 loanId = pool.applyForLoan(1_000e6, 1, "Business");

        vm.prank(organizer);
        pool.approveLoan(loanId);

        vm.startPrank(alice);
        usdc.approve(address(pool), 1_050e6);
        pool.repay(loanId, 1_050e6);
        vm.stopPrank();

        assertEq(usdc.balanceOf(treasury), 50e6);
        assertEq(pool.interestEarned(), 0);
    }

    function test_UnregisteredBorrowerCannotApply() public {
        address stranger = makeAddr("stranger");
        usdc.mint(stranger, 1_000e6);
        vm.prank(stranger);
        vm.expectRevert(CooperativeLoanPool.NotEligibleBorrower.selector);
        pool.applyForLoan(100e6, 1, "Other");
    }

    function test_OneOpenLoanOnly() public {
        vm.prank(alice);
        pool.applyForLoan(100e6, 1, "Business");

        vm.prank(alice);
        vm.expectRevert(CooperativeLoanPool.HasOpenLoan.selector);
        pool.applyForLoan(50e6, 1, "Other");
    }

    function test_MembershipVaultGate() public {
        MockMembershipVault vault = new MockMembershipVault();
        CooperativeLoanPool gated = new CooperativeLoanPool(address(usdc), organizer, address(vault));

        usdc.mint(organizer, 1_000e6);
        vm.startPrank(organizer);
        usdc.approve(address(gated), 1_000e6);
        gated.fundPool(1_000e6);
        vm.stopPrank();

        // Not a vault member
        vm.prank(alice);
        vm.expectRevert(CooperativeLoanPool.NotEligibleBorrower.selector);
        gated.applyForLoan(100e6, 1, "Business");

        vault.setMember(alice, true);
        vm.prank(alice);
        uint256 id = gated.applyForLoan(100e6, 1, "Business");
        assertEq(id, 1);
        assertTrue(gated.isEligibleBorrower(alice));
    }

    function test_InsufficientLiquidity() public {
        // Drain almost all liquidity with a max loan for alice
        vm.prank(alice);
        uint256 id1 = pool.applyForLoan(2_500e6, 1, "Business");
        vm.prank(organizer);
        pool.approveLoan(id1);

        // Bob applies for more than remaining available (~7500, max 25% = 1875)
        // Request more than full remaining balance
        vm.prank(bob);
        uint256 id2 = pool.applyForLoan(8_000e6, 1, "Emergency");
        vm.prank(organizer);
        vm.expectRevert(CooperativeLoanPool.InsufficientLiquidity.selector);
        pool.approveLoan(id2);
    }
}
