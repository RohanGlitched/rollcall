// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {RollCall} from "../src/RollCall.sol";
import {TestDollar} from "../src/TestDollar.sol";

contract RollCallTest is Test {
    RollCall rc;
    TestDollar usd;

    address house = makeAddr("house");
    address attester = makeAddr("attester");
    address funder = makeAddr("funder");
    address provider = makeAddr("provider");
    address arbiter = makeAddr("arbiter");
    uint256 probeKey = 0xB0B;
    address probe;

    uint32 constant ASN = 9829; // BSNL
    uint128 constant RATE = 12e6; // 12 tUSD a day
    uint16 constant DAYS = 10;
    uint32 constant DAY = 1 days;
    uint32 constant LATE = 2 hours;
    uint32 constant CHALLENGE = 1 days;
    uint64 start;
    uint256 nonce;

    function setUp() public {
        vm.warp(1_790_000_000);
        probe = vm.addr(probeKey);
        usd = new TestDollar(house);
        rc = new RollCall(usd, attester);
        vm.startPrank(house);
        usd.mint(funder, 1_000_000e6);
        usd.mint(provider, 1_000_000e6);
        vm.stopPrank();
        vm.prank(funder);
        usd.approve(address(rc), type(uint256).max);
        vm.prank(provider);
        usd.approve(address(rc), type(uint256).max);
        start = uint64(block.timestamp + 1 hours);
    }

    // ------------------------------------------------------------ helpers

    function _terms() internal view returns (RollCall.Terms memory t) {
        t.provider = provider;
        t.probe = probe;
        t.arbiter = arbiter;
        t.asn = ASN;
        t.minDownKbps = 10_000;
        t.minUpKbps = 2_000;
        t.maxRttMs = 150;
        t.start = start;
        t.dayLength = DAY;
        t.lateWindow = LATE;
        t.challengeWindow = CHALLENGE;
        t.numDays = DAYS;
        t.required = 3;
        t.strikeLimit = 3;
        t.ratePerDay = RATE;
        t.bond = 50e6;
        t.slash = 20e6;
    }

    function _open() internal returns (uint256 id) {
        vm.prank(funder);
        id = rc.open(_terms(), "Government Primary School, Dhanora");
        vm.prank(provider);
        rc.accept(id);
    }

    function _reading(uint256 id, uint64 at, uint32 down) internal returns (RollCall.Reading memory r, string memory uuid) {
        uuid = string.concat("ndt-test_", vm.toString(++nonce));
        r = RollCall.Reading({
            termId: id,
            takenAt: at,
            downKbps: down,
            upKbps: 5_000,
            rttMs: 40,
            testId: keccak256(bytes(uuid)),
            clientHash: keccak256("client")
        });
    }

    function _sign(uint256 key, RollCall.Reading memory r) internal view returns (bytes memory) {
        (uint8 v, bytes32 rr, bytes32 s) = vm.sign(key, rc.readingDigest(r));
        return abi.encodePacked(rr, s, v);
    }

    function _post(uint256 id, uint64 at, uint32 down, uint32 asn) internal {
        (RollCall.Reading memory r, string memory uuid) = _reading(id, at, down);
        _postOne(r, _sign(probeKey, r), asn, uuid);
    }

    function _postOne(RollCall.Reading memory r, bytes memory sig, uint32 asn, string memory uuid) internal {
        RollCall.Reading[] memory rs = new RollCall.Reading[](1);
        bytes[] memory sigs = new bytes[](1);
        uint32[] memory asns = new uint32[](1);
        string[] memory ids = new string[](1);
        rs[0] = r;
        sigs[0] = sig;
        asns[0] = asn;
        ids[0] = uuid;
        vm.prank(attester);
        rc.record(rs, sigs, asns, ids);
    }

    function _dayStart(uint16 d) internal view returns (uint64) {
        return start + uint64(d) * DAY;
    }

    function _settleTime(uint16 d) internal view returns (uint256) {
        return uint256(start) + uint256(d + 1) * DAY + LATE + CHALLENGE;
    }

    function _closeSig(uint256 id, uint16 day, string memory reason) internal view returns (bytes memory) {
        bytes32 typehash = keccak256("Closure(uint256 termId,uint16 day,string reason)");
        bytes32 structHash = keccak256(abi.encode(typehash, id, day, keccak256(bytes(reason))));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", rc.domainSeparator(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(probeKey, digest);
        return abi.encodePacked(r, s, v);
    }

    // -------------------------------------------------------------- set-up

    function test_open_locks_the_whole_term() public {
        uint256 before = usd.balanceOf(funder);
        uint256 id = _open();
        assertEq(before - usd.balanceOf(funder), uint256(RATE) * DAYS);
        assertEq(rc.state(id).escrow, RATE * DAYS);
        assertEq(rc.state(id).bondHeld, 50e6);
        assertEq(usd.balanceOf(address(rc)), uint256(RATE) * DAYS + 50e6);
    }

    function test_open_rejects_bad_terms() public {
        RollCall.Terms memory t = _terms();
        t.required = 0;
        vm.prank(funder);
        vm.expectRevert(abi.encodeWithSelector(RollCall.BadTerms.selector, "required readings"));
        rc.open(t, "x");
        t = _terms();
        t.slash = t.bond + 1;
        vm.prank(funder);
        vm.expectRevert(abi.encodeWithSelector(RollCall.BadTerms.selector, "slash above bond"));
        rc.open(t, "x");
    }

    function test_accept_only_by_provider_before_start() public {
        vm.prank(funder);
        uint256 id = rc.open(_terms(), "x");
        vm.expectRevert(RollCall.NotProvider.selector);
        rc.accept(id);
        vm.warp(start);
        vm.prank(provider);
        vm.expectRevert(RollCall.DayAlreadyStarted.selector);
        rc.accept(id);
    }

    function test_funder_recovers_unaccepted_term() public {
        vm.prank(funder);
        uint256 id = rc.open(_terms(), "x");
        uint256 before = usd.balanceOf(funder);
        vm.prank(funder);
        rc.withdrawUnaccepted(id);
        assertEq(usd.balanceOf(funder) - before, uint256(RATE) * DAYS);
    }

    // ------------------------------------------------------------ readings

    function test_present_day_pays_provider_in_full() public {
        uint256 id = _open();
        vm.warp(_dayStart(0) + 2 hours);
        for (uint256 i; i < 3; ++i) _post(id, uint64(block.timestamp - i * 60), 25_000, ASN);
        vm.warp(_settleTime(0));
        uint256 p0 = usd.balanceOf(provider);
        rc.settle(id, 0);
        assertEq(usd.balanceOf(provider) - p0, RATE);
        assertEq(uint8(rc.dayOf(id, 0).mark), uint8(RollCall.Mark.Present));
    }

    function test_partial_day_pays_pro_rata_and_refunds_the_rest() public {
        uint256 id = _open();
        vm.warp(_dayStart(0) + 2 hours);
        _post(id, uint64(block.timestamp), 25_000, ASN);
        _post(id, uint64(block.timestamp - 60), 3_000, ASN); // too slow
        vm.warp(_settleTime(0));
        uint256 p0 = usd.balanceOf(provider);
        uint256 f0 = usd.balanceOf(funder);
        rc.settle(id, 0);
        assertEq(usd.balanceOf(provider) - p0, RATE / 3);
        assertEq(usd.balanceOf(funder) - f0, RATE - RATE / 3);
        assertEq(uint8(rc.dayOf(id, 0).mark), uint8(RollCall.Mark.Partial));
    }

    function test_reading_over_another_network_does_not_count() public {
        uint256 id = _open();
        vm.warp(_dayStart(0) + 2 hours);
        for (uint256 i; i < 3; ++i) _post(id, uint64(block.timestamp - i), 90_000, 55836); // a phone hotspot
        vm.warp(_settleTime(0));
        rc.settle(id, 0);
        assertEq(uint8(rc.dayOf(id, 0).mark), uint8(RollCall.Mark.Absent));
        assertEq(rc.state(id).paid, 0);
    }

    function test_slow_latency_fails() public {
        uint256 id = _open();
        vm.warp(_dayStart(0) + 2 hours);
        (RollCall.Reading memory r, string memory uuid) = _reading(id, uint64(block.timestamp), 50_000);
        r.rttMs = 900;
        _postOne(r, _sign(probeKey, r), ASN, uuid);
        assertEq(rc.dayOf(id, 0).passes, 0);
        assertEq(rc.dayOf(id, 0).readings, 1);
    }

    function test_silent_day_is_refunded_and_struck() public {
        uint256 id = _open();
        vm.warp(_settleTime(0));
        uint256 f0 = usd.balanceOf(funder);
        rc.settle(id, 0);
        assertEq(uint8(rc.dayOf(id, 0).mark), uint8(RollCall.Mark.Silent));
        assertEq(usd.balanceOf(funder) - f0, RATE);
        assertEq(rc.state(id).strikes, 1);
    }

    function test_reading_signed_by_another_key_is_rejected() public {
        uint256 id = _open();
        vm.warp(_dayStart(0) + 2 hours);
        (RollCall.Reading memory r, string memory uuid) = _reading(id, uint64(block.timestamp), 50_000);
        bytes memory sig = _sign(0xBAD, r);
        vm.expectRevert(RollCall.BadSignature.selector);
        _postOne(r, sig, ASN, uuid);
    }

    function test_tampered_reading_is_rejected() public {
        uint256 id = _open();
        vm.warp(_dayStart(0) + 2 hours);
        (RollCall.Reading memory r, string memory uuid) = _reading(id, uint64(block.timestamp), 5_000);
        bytes memory sig = _sign(probeKey, r);
        r.downKbps = 50_000; // attester inflates the speed
        vm.expectRevert(RollCall.BadSignature.selector);
        _postOne(r, sig, ASN, uuid);
    }

    function test_test_id_must_match_the_mlab_uuid() public {
        uint256 id = _open();
        vm.warp(_dayStart(0) + 2 hours);
        (RollCall.Reading memory r,) = _reading(id, uint64(block.timestamp), 50_000);
        bytes memory sig = _sign(probeKey, r);
        vm.expectRevert(abi.encodeWithSelector(RollCall.BadTerms.selector, "test id"));
        _postOne(r, sig, ASN, "ndt-someone-else");
    }

    function test_one_test_cannot_be_counted_twice() public {
        uint256 id = _open();
        vm.warp(_dayStart(0) + 2 hours);
        (RollCall.Reading memory r, string memory uuid) = _reading(id, uint64(block.timestamp), 50_000);
        bytes memory sig = _sign(probeKey, r);
        _postOne(r, sig, ASN, uuid);
        vm.expectRevert(RollCall.TestAlreadyUsed.selector);
        _postOne(r, sig, ASN, uuid);
    }

    function test_only_attester_records() public {
        uint256 id = _open();
        vm.warp(_dayStart(0) + 2 hours);
        (RollCall.Reading memory r, string memory uuid) = _reading(id, uint64(block.timestamp), 50_000);
        RollCall.Reading[] memory rs = new RollCall.Reading[](1);
        bytes[] memory sigs = new bytes[](1);
        uint32[] memory asns = new uint32[](1);
        string[] memory ids = new string[](1);
        rs[0] = r;
        sigs[0] = _sign(probeKey, r);
        asns[0] = ASN;
        ids[0] = uuid;
        vm.prank(provider);
        vm.expectRevert(RollCall.NotAttester.selector);
        rc.record(rs, sigs, asns, ids);
    }

    function test_late_reading_is_rejected() public {
        uint256 id = _open();
        uint64 at = _dayStart(0) + 3 hours;
        vm.warp(uint256(_dayStart(1)) + LATE + 1);
        (RollCall.Reading memory r, string memory uuid) = _reading(id, at, 50_000);
        bytes memory sig = _sign(probeKey, r);
        vm.expectRevert(RollCall.TooLate.selector);
        _postOne(r, sig, ASN, uuid);
    }

    function test_reading_inside_late_window_counts_for_its_own_day() public {
        uint256 id = _open();
        uint64 at = _dayStart(0) + 23 hours;
        vm.warp(uint256(_dayStart(1)) + LATE - 1);
        _post(id, at, 50_000, ASN);
        assertEq(rc.dayOf(id, 0).passes, 1);
        assertEq(rc.dayOf(id, 1).readings, 0);
    }

    function test_future_reading_is_rejected() public {
        uint256 id = _open();
        vm.warp(_dayStart(0) + 2 hours);
        (RollCall.Reading memory r, string memory uuid) = _reading(id, uint64(block.timestamp + 1 hours), 50_000);
        bytes memory sig = _sign(probeKey, r);
        vm.expectRevert(RollCall.FromTheFuture.selector);
        _postOne(r, sig, ASN, uuid);
    }

    function test_reading_before_start_is_rejected() public {
        uint256 id = _open();
        (RollCall.Reading memory r, string memory uuid) = _reading(id, uint64(block.timestamp), 50_000);
        bytes memory sig = _sign(probeKey, r);
        vm.expectRevert(RollCall.OutsideTerm.selector);
        _postOne(r, sig, ASN, uuid);
    }

    function test_day_caps_readings() public {
        uint256 id = _open();
        vm.warp(_dayStart(0) + 2 hours);
        for (uint256 i; i < 24; ++i) _post(id, uint64(block.timestamp - i), 50_000, ASN);
        (RollCall.Reading memory r, string memory uuid) = _reading(id, uint64(block.timestamp), 50_000);
        bytes memory sig = _sign(probeKey, r);
        vm.expectRevert(RollCall.DayFull.selector);
        _postOne(r, sig, ASN, uuid);
    }

    // ------------------------------------------------------------ settling

    function test_settle_waits_for_late_and_challenge_windows() public {
        uint256 id = _open();
        vm.warp(_settleTime(0) - 1);
        vm.expectRevert(RollCall.NotSettleable.selector);
        rc.settle(id, 0);
    }

    function test_settle_runs_in_order_and_stops_at_unfinished_days() public {
        uint256 id = _open();
        vm.warp(_settleTime(2));
        rc.settle(id, 9);
        assertEq(rc.state(id).settledDays, 3);
        assertEq(rc.state(id).nextToSettle, 3);
    }

    function test_closed_day_refunds_without_a_strike() public {
        uint256 id = _open();
        vm.warp(_dayStart(0) + 1 hours);
        rc.closeDay(id, 0, "Power cut", _closeSig(id, 0, "Power cut"));
        vm.warp(_settleTime(0));
        rc.settle(id, 0);
        assertEq(uint8(rc.dayOf(id, 0).mark), uint8(RollCall.Mark.Closed));
        assertEq(rc.state(id).strikes, 0);
    }

    function test_day_cannot_be_closed_after_it_ends() public {
        uint256 id = _open();
        vm.warp(_dayStart(1));
        bytes memory sig = _closeSig(id, 0, "Holiday");
        vm.expectRevert(RollCall.TooLate.selector);
        rc.closeDay(id, 0, "Holiday", sig);
    }

    function test_closure_needs_the_probe_signature() public {
        uint256 id = _open();
        vm.warp(_dayStart(0) + 1 hours);
        bytes memory sig = _closeSig(id, 0, "Holiday");
        vm.expectRevert(RollCall.BadSignature.selector);
        rc.closeDay(id, 0, "Exams", sig);
    }

    function test_full_term_returns_bond_and_conserves_money() public {
        uint256 id = _open();
        uint256 total = uint256(RATE) * DAYS + 50e6;
        uint256 f0 = usd.balanceOf(funder);
        uint256 p0 = usd.balanceOf(provider);
        for (uint16 d; d < DAYS; ++d) {
            vm.warp(_dayStart(d) + 3 hours);
            uint256 n = d % 4; // 0..3 passing readings
            for (uint256 i; i < n; ++i) _post(id, uint64(block.timestamp - i), 30_000, ASN);
        }
        vm.warp(_settleTime(DAYS - 1));
        rc.settle(id, DAYS - 1);
        RollCall.State memory st = rc.state(id);
        assertTrue(st.ended);
        assertEq(usd.balanceOf(address(rc)), 0);
        assertEq((usd.balanceOf(funder) - f0) + (usd.balanceOf(provider) - p0), total);
        assertEq(uint256(st.paid) + st.refunded, uint256(RATE) * DAYS);
    }

    // ---------------------------------------------------------- challenges

    function test_upheld_challenge_voids_the_day_and_slashes() public {
        uint256 id = _open();
        vm.warp(_dayStart(0) + 2 hours);
        for (uint256 i; i < 3; ++i) _post(id, uint64(block.timestamp - i), 30_000, ASN);
        vm.warp(_dayStart(1) + 1 hours);
        vm.prank(funder);
        rc.challenge(id, 0, "Test ids not in the M-Lab archive");
        vm.warp(_settleTime(0));
        rc.settle(id, 0); // challenged: waits
        assertEq(rc.state(id).settledDays, 0);
        uint256 f0 = usd.balanceOf(funder);
        vm.prank(arbiter);
        rc.resolve(id, 0, true);
        rc.settle(id, 0);
        assertEq(uint8(rc.dayOf(id, 0).mark), uint8(RollCall.Mark.Voided));
        assertEq(usd.balanceOf(funder) - f0, RATE + 20e6);
        assertEq(rc.state(id).bondHeld, 30e6);
    }

    function test_rejected_challenge_pays_as_measured() public {
        uint256 id = _open();
        vm.warp(_dayStart(0) + 2 hours);
        for (uint256 i; i < 3; ++i) _post(id, uint64(block.timestamp - i), 30_000, ASN);
        vm.prank(funder);
        rc.challenge(id, 0, "Looks too fast");
        vm.prank(arbiter);
        rc.resolve(id, 0, false);
        vm.warp(_settleTime(0));
        rc.settle(id, 0);
        assertEq(uint8(rc.dayOf(id, 0).mark), uint8(RollCall.Mark.Present));
        assertEq(rc.state(id).bondHeld, 50e6);
    }

    function test_challenge_window_closes() public {
        uint256 id = _open();
        vm.warp(_settleTime(0));
        vm.prank(funder);
        vm.expectRevert(RollCall.ChallengeClosed.selector);
        rc.challenge(id, 0, "late");
    }

    function test_only_funder_challenges_and_only_arbiter_resolves() public {
        uint256 id = _open();
        vm.expectRevert(RollCall.NotFunder.selector);
        rc.challenge(id, 0, "x");
        vm.prank(funder);
        rc.challenge(id, 0, "x");
        vm.prank(funder);
        vm.expectRevert(RollCall.NotArbiter.selector);
        rc.resolve(id, 0, true);
    }

    // --------------------------------------------------------- termination

    function test_terminate_after_strike_limit_returns_unserved_days() public {
        uint256 id = _open();
        vm.warp(_settleTime(2)); // three silent days
        rc.settle(id, 2);
        assertEq(rc.state(id).strikes, 3);
        uint256 f0 = usd.balanceOf(funder);
        uint256 p0 = usd.balanceOf(provider);
        vm.prank(funder);
        rc.terminate(id);
        assertEq(usd.balanceOf(funder) - f0, uint256(RATE) * 7 + 20e6);
        assertEq(usd.balanceOf(provider) - p0, 30e6);
        assertEq(usd.balanceOf(address(rc)), 0);
    }

    function test_terminate_needs_strikes() public {
        uint256 id = _open();
        vm.warp(_settleTime(1));
        rc.settle(id, 1);
        vm.prank(funder);
        vm.expectRevert(RollCall.NotEnoughStrikes.selector);
        rc.terminate(id);
    }

    function test_a_working_day_resets_strikes() public {
        uint256 id = _open();
        vm.warp(_dayStart(2) + 2 hours);
        _post(id, uint64(block.timestamp), 30_000, ASN);
        vm.warp(_settleTime(2));
        rc.settle(id, 2);
        assertEq(rc.state(id).strikes, 0);
    }

    // ----------------------------------------------------------------- fuzz

    /// Any mix of readings, closures and challenges: money is neither created nor lost, and the
    /// provider is never paid more than the rate for any day.
    function testFuzz_money_is_conserved(uint256 seed) public {
        uint256 id = _open();
        uint256 f0 = usd.balanceOf(funder);
        uint256 p0 = usd.balanceOf(provider);
        for (uint16 d; d < DAYS; ++d) {
            uint256 x = uint256(keccak256(abi.encode(seed, d)));
            vm.warp(_dayStart(d) + 1 hours);
            if (x % 7 == 0) rc.closeDay(id, d, "Holiday", _closeSig(id, d, "Holiday"));
            uint256 n = (x >> 8) % 6;
            for (uint256 i; i < n; ++i) {
                uint32 down = uint32(((x >> (16 + i * 8)) % 40) * 1_000);
                uint32 asn = (x >> (64 + i)) % 5 == 0 ? 55836 : ASN;
                _post(id, uint64(block.timestamp - i), down, asn);
            }
            if ((x >> 120) % 9 == 0) {
                vm.prank(funder);
                rc.challenge(id, d, "spot check");
                vm.prank(arbiter);
                rc.resolve(id, d, (x >> 130) % 2 == 0);
            }
        }
        vm.warp(_settleTime(DAYS - 1));
        rc.settle(id, DAYS - 1);
        RollCall.State memory st = rc.state(id);
        assertTrue(st.ended);
        assertEq(usd.balanceOf(address(rc)), 0);
        assertEq((usd.balanceOf(funder) - f0) + (usd.balanceOf(provider) - p0), uint256(RATE) * DAYS + 50e6);
        assertLe(st.paid, uint256(RATE) * DAYS);
    }
}
