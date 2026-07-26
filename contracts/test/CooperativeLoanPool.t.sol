// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CooperativeLoanPool} from "../src/CooperativeLoanPool.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

contract CooperativeLoanPoolTest is Test {
    MockUSDC usdc;
    CooperativeLoanPool pool;

    address organizer = makeAddr("organizer");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant FUND = 10_000e6; // 10,000 USDC

    function setUp() public {
        usdc = new MockUSDC();
        pool = new CooperativeLoanPool(address(usdc), organizer);

        usdc.mint(organizer, FUND);
        usdc.mint(alice, 5_000e6);
        usdc.mint(bob, 5_000e6);

        vm.startPrank(organizer);
        usdc.approve(address(pool), FUND);
        pool.fundPool(FUND);
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
        // Principal still outstanding
        assertEq(pool.totalOutstandingPrincipal(), 1_000e6);
    }

    function test_RejectLoan() public {
        vm.prank(alice);
        uint256 loanId = pool.applyForLoan(500e6, 2, "Personal");

        vm.prank(organizer);
        pool.rejectLoan(loanId);

        CooperativeLoanPool.Loan memory l = pool.getLoan(loanId);
        assertEq(uint8(l.status), uint8(CooperativeLoanPool.LoanStatus.Rejected));
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

        // Interest auto-forwarded
        assertEq(usdc.balanceOf(treasury), 50e6);
        assertEq(pool.interestEarned(), 0);
    }
}
