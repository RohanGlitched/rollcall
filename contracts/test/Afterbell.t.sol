// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {Afterbell} from "../src/Afterbell.sol";
import {TestDollar} from "../src/TestDollar.sol";

contract AfterbellTest is Test {
    uint256 constant NOW = 1_795_066_240;
    TestDollar usd;
    Afterbell ab;
    address partner = address(0xBA);
    address school = address(0x5C);
    address operator = address(0x0B);
    address provider = address(0x9B);
    address m1 = address(0x101);
    address m2 = address(0x102);
    address m3 = address(0x103);

    function setUp() public {
        usd = new TestDollar(address(this));
        address[] memory ms = new address[](3);
        ms[0] = m1;
        ms[1] = m2;
        ms[2] = m3;
        ab = new Afterbell(usd, partner, 19800, ms, 2, Afterbell.Terms(school, operator, provider, 5000, 3000, 2000, 16, 22));
        usd.mint(partner, 1_000e6);
        vm.prank(partner);
        usd.approve(address(ab), type(uint256).max);
        vm.warp(NOW); // 2026-11-19 11:00 IST, school hours
    }

    function test_splitsASale() public {
        uint64 started = uint64(NOW - 16 hours); // 19:00 IST the previous evening
        assertTrue(ab.isPublicHour(started));
        vm.prank(partner);
        ab.recordSale(keccak256("v1"), started, 60, 10e6);
        assertEq(usd.balanceOf(school), 5e6);
        assertEq(usd.balanceOf(operator), 3e6);
        assertEq(usd.balanceOf(provider), 2e6);
        assertEq(ab.minutesSold(), 60);
    }

    function test_schoolHoursWin() public {
        vm.prank(partner);
        vm.expectRevert(Afterbell.SchoolHours.selector);
        ab.recordSale(keccak256("v2"), uint64(block.timestamp), 60, 10e6);
    }

    function test_voucherOnce() public {
        uint64 started = uint64(NOW - 16 hours);
        vm.startPrank(partner);
        ab.recordSale(keccak256("v3"), started, 60, 10e6);
        vm.expectRevert(Afterbell.AlreadySettled.selector);
        ab.recordSale(keccak256("v3"), started, 60, 10e6);
        vm.stopPrank();
    }

    function test_changeNeedsCommittee() public {
        Afterbell.Terms memory t = Afterbell.Terms(school, operator, provider, 6000, 2500, 1500, 16, 22);
        vm.prank(m1);
        uint256 id = ab.propose(t);
        (, , , uint16 sBps, , , , ) = ab.terms();
        assertEq(sBps, 5000); // one signature is not enough
        vm.prank(m2);
        ab.approve(id);
        (, , , sBps, , , , ) = ab.terms();
        assertEq(sBps, 6000);
    }

    function test_outsiderCannotChange() public {
        vm.expectRevert(Afterbell.NotMember.selector);
        ab.propose(Afterbell.Terms(school, operator, provider, 9000, 500, 500, 16, 22));
    }

    function test_oneMemberPausesThresholdUnpauses() public {
        vm.prank(m3);
        ab.pause();
        uint64 started = uint64(NOW - 16 hours);
        vm.prank(partner);
        vm.expectRevert(Afterbell.IsPaused.selector);
        ab.recordSale(keccak256("v4"), started, 60, 10e6);
        vm.prank(m1);
        ab.approveUnpause();
        assertTrue(ab.paused());
        vm.prank(m2);
        ab.approveUnpause();
        assertFalse(ab.paused());
    }
}
