// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CooperativeTreasuryVault} from "../src/CooperativeTreasuryVault.sol";
import {CooperativeTreasuryVaultFactory} from "../src/CooperativeTreasuryVaultFactory.sol";
import {CooperativeLoanPool} from "../src/CooperativeLoanPool.sol";
import {CooperativeLoanPoolFactory} from "../src/CooperativeLoanPoolFactory.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

/**
 * @notice Proves each cooperative has an isolated loan pool funded by its own
 *         vault's 30% deposit share — no liquidity or applications leak across workspaces.
 */
contract MultiWorkspaceLoanIsolationTest is Test {
    MockUSDC usdc;
    CooperativeTreasuryVaultFactory vaultFactory;
    CooperativeLoanPoolFactory poolFactory;

    address operator = makeAddr("operator");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    uint256 constant CONTRIB = 100e6; // $100 → $30 loan share

    function setUp() public {
        usdc = new MockUSDC();
        vaultFactory = new CooperativeTreasuryVaultFactory(address(usdc));
        poolFactory = new CooperativeLoanPoolFactory(address(usdc));
        usdc.mint(alice, 10_000e6);
        usdc.mint(bob, 10_000e6);
        usdc.mint(operator, 1_000e6);
    }

    function _provisionCoop(string memory name, bytes32 hash)
        internal
        returns (CooperativeTreasuryVault vault, CooperativeLoanPool pool)
    {
        address vaultAddr = vaultFactory.createVault(operator, name, CONTRIB, 2, hash);
        vault = CooperativeTreasuryVault(vaultAddr);

        address poolAddr = poolFactory.createPool(operator, vaultAddr, vaultAddr, hash);
        pool = CooperativeLoanPool(poolAddr);

        // Wire 30% auto-forward (operator is vault organizer)
        vm.prank(operator);
        vault.setLendingPool(poolAddr);
    }

    function test_FactoriesCreateDistinctPools() public {
        (, CooperativeLoanPool poolA) = _provisionCoop("A", keccak256("coop-a"));
        (, CooperativeLoanPool poolB) = _provisionCoop("B", keccak256("coop-b"));

        assertTrue(address(poolA) != address(poolB));
        assertEq(poolFactory.poolCount(), 2);
        assertEq(poolFactory.poolByAppCoopId(keccak256("coop-a")), address(poolA));
        assertEq(poolFactory.poolByAppCoopId(keccak256("coop-b")), address(poolB));
    }

    function test_Deposit30PercentFundsOnlyThatPool() public {
        (CooperativeTreasuryVault vaultA, CooperativeLoanPool poolA) =
            _provisionCoop("A", keccak256("coop-a"));
        (CooperativeTreasuryVault vaultB, CooperativeLoanPool poolB) =
            _provisionCoop("B", keccak256("coop-b"));

        // Alice deposits only into coop A
        vm.startPrank(alice);
        usdc.approve(address(vaultA), CONTRIB);
        vaultA.deposit();
        vm.stopPrank();

        // 30% of $100 = $30 should be in pool A only
        assertEq(poolA.availableLiquidity(), 30e6);
        assertEq(poolB.availableLiquidity(), 0);
        assertEq(vaultA.loanPoolForwarded(), 30e6);
        assertEq(vaultB.loanPoolForwarded(), 0);
    }

    function test_BorrowerOnACannotUseBLiquidity() public {
        (CooperativeTreasuryVault vaultA, CooperativeLoanPool poolA) =
            _provisionCoop("A", keccak256("coop-a"));
        (CooperativeTreasuryVault vaultB, CooperativeLoanPool poolB) =
            _provisionCoop("B", keccak256("coop-b"));

        // Fund A via deposit
        vm.startPrank(alice);
        usdc.approve(address(vaultA), CONTRIB);
        vaultA.deposit();
        vm.stopPrank();

        // Bob joins only vault B (not A)
        vm.prank(bob);
        vaultB.joinVault();

        // Bob is eligible on B (member) but B has no liquidity
        assertTrue(poolB.isEligibleBorrower(bob));
        assertFalse(poolA.isEligibleBorrower(bob)); // not member of A

        // Alice is member of A and can apply against A's $30 liquidity
        assertTrue(poolA.isEligibleBorrower(alice));
        vm.prank(alice);
        uint256 loanId = poolA.applyForLoan(10e6, 1, "Business");
        assertEq(loanId, 1);

        // Bob cannot apply on A's pool (not a member)
        vm.prank(bob);
        vm.expectRevert(CooperativeLoanPool.NotEligibleBorrower.selector);
        poolA.applyForLoan(10e6, 1, "Business");
    }

    function test_ApplicationsDoNotLeakAcrossPools() public {
        (CooperativeTreasuryVault vaultA, CooperativeLoanPool poolA) =
            _provisionCoop("A", keccak256("coop-a"));
        (CooperativeTreasuryVault vaultB, CooperativeLoanPool poolB) =
            _provisionCoop("B", keccak256("coop-b"));

        // Alice deposits in both so both have liquidity
        vm.startPrank(alice);
        usdc.approve(address(vaultA), CONTRIB);
        vaultA.deposit();
        usdc.approve(address(vaultB), CONTRIB);
        vaultB.deposit();

        uint256 idA = poolA.applyForLoan(10e6, 2, "Education");
        uint256 idB = poolB.applyForLoan(15e6, 3, "Business");
        vm.stopPrank();

        assertEq(poolA.getLoan(idA).principal, 10e6);
        assertEq(poolB.getLoan(idB).principal, 15e6);
        (, , , , uint256 countA) = poolA.getPoolStats();
        (, , , , uint256 countB) = poolB.getPoolStats();
        assertEq(countA, 1);
        assertEq(countB, 1);
        // Loan ids are local to each pool
        assertEq(idA, 1);
        assertEq(idB, 1);
    }

    function test_EditAndCancelStayOnSamePool() public {
        (CooperativeTreasuryVault vaultA, CooperativeLoanPool poolA) =
            _provisionCoop("A", keccak256("coop-a"));

        vm.startPrank(alice);
        usdc.approve(address(vaultA), CONTRIB);
        vaultA.deposit();
        uint256 loanId = poolA.applyForLoan(20e6, 3, "Business");
        poolA.updateApplication(loanId, 12e6, 1, "Health");
        assertEq(poolA.getLoan(loanId).principal, 12e6);
        assertEq(poolA.getLoan(loanId).termMonths, 1);
        poolA.cancelApplication(loanId);
        assertEq(uint8(poolA.getLoan(loanId).status), uint8(CooperativeLoanPool.LoanStatus.Rejected));
        assertEq(poolA.openLoanId(alice), 0);
        vm.stopPrank();
    }

    function test_DuplicateVaultPoolReverts() public {
        (CooperativeTreasuryVault vaultA,) = _provisionCoop("A", keccak256("coop-a"));
        vm.expectRevert(CooperativeLoanPoolFactory.VaultAlreadyHasPool.selector);
        poolFactory.createPool(operator, address(vaultA), address(vaultA), keccak256("other"));
    }
}
