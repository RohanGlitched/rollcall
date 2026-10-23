// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title Roll Call
/// @notice School internet paid by the day it actually works.
///
/// A funder (a government fund, a donor, a school board) locks a term's money up front. The
/// internet provider posts a bond and is paid for each school day the school's own probe found
/// the connection working, measured from inside the school with an M-Lab speed test. Days the
/// connection failed are refunded to the funder, never paid.
///
/// Two independent parties have to agree before a reading counts:
///   - the probe (a key that lives on the school's device) signs what it measured;
///   - the attester signs which network the test ran over (the autonomous system number
///     behind the client address M-Lab saw), so a test over a phone hotspot or another
///     provider's line cannot earn the contracted provider anything.
/// Each reading carries the M-Lab test id, so anyone can check it against M-Lab's public
/// archive and challenge the day before it settles.
contract RollCall is EIP712 {
    using SafeERC20 for IERC20;

    // ------------------------------------------------------------------ types

    enum Mark {
        Open, //       day not settled yet
        Present, //    enough passing readings: paid in full
        Partial, //    some passing readings: paid pro rata
        Absent, //     readings, none passing: refunded
        Silent, //     no reading at all: refunded (an offline link cannot report)
        Closed, //     school declared the day closed (holiday, power cut): refunded, no strike
        Voided //      challenge upheld: refunded, provider bond slashed
    }

    struct Terms {
        address funder;
        address provider; //    receives payouts and the bond back
        address probe; //       school device key that signs readings and closures
        address arbiter; //     decides challenges (an auditor or regulator)
        uint32 asn; //          contracted provider's network
        uint32 minDownKbps;
        uint32 minUpKbps;
        uint32 maxRttMs;
        uint64 start; //        unix time the first school day starts
        uint32 dayLength; //    seconds per school day (86400 on a real term)
        uint32 lateWindow; //   seconds after a day ends that its readings may still arrive
        uint32 challengeWindow; // seconds after the late window before the day can settle
        uint16 numDays;
        uint8 required; //      passing readings for a full day
        uint8 strikeLimit; //   consecutive absent/silent days before the funder may end the term
        uint128 ratePerDay; //  token units paid for one present day
        uint128 bond; //        provider bond posted on accept
        uint128 slash; //       bond taken per upheld challenge or early termination
    }

    struct State {
        uint128 escrow; //      funder money not yet paid or refunded
        uint128 bondHeld;
        uint128 paid; //        total paid to the provider
        uint128 refunded; //    total returned to the funder
        uint16 settledDays;
        uint16 nextToSettle; // days settle in order so strikes are counted honestly
        uint8 strikes; //       current run of absent/silent days
        bool accepted;
        bool ended;
    }

    struct Day {
        uint8 readings;
        uint8 passes;
        Mark mark;
        bool closed;
        bool challenged;
        bool voided;
    }

    /// @notice What the probe measured. Signed by the probe key (EIP-712).
    struct Reading {
        uint256 termId;
        uint64 takenAt;
        uint32 downKbps;
        uint32 upKbps;
        uint32 rttMs;
        bytes32 testId; //      keccak256 of the M-Lab test UUID (emitted in full below)
        bytes32 clientHash; //  keccak256 of the client address, so the address never goes on chain
    }

    // ---------------------------------------------------------------- storage

    bytes32 private constant READING_TYPEHASH = keccak256(
        "Reading(uint256 termId,uint64 takenAt,uint32 downKbps,uint32 upKbps,uint32 rttMs,bytes32 testId,bytes32 clientHash)"
    );
    bytes32 private constant CLOSURE_TYPEHASH = keccak256("Closure(uint256 termId,uint16 day,string reason)");

    uint8 public constant MAX_READINGS_PER_DAY = 24;

    IERC20 public immutable token;
    address public immutable attester;

    uint256 public termCount;
    mapping(uint256 => Terms) internal _terms;
    mapping(uint256 => State) internal _state;
    mapping(uint256 => mapping(uint16 => Day)) internal _days;
    mapping(bytes32 => bool) public testUsed;

    // ----------------------------------------------------------------- events

    event TermOpened(uint256 indexed termId, address indexed funder, address indexed provider, address probe, uint32 asn, string school);
    event TermAccepted(uint256 indexed termId, uint128 bond);
    event ReadingRecorded(
        uint256 indexed termId,
        uint16 indexed day,
        uint64 takenAt,
        uint32 downKbps,
        uint32 upKbps,
        uint32 rttMs,
        uint32 asn,
        bool pass,
        string mlabTestId
    );
    event DayClosed(uint256 indexed termId, uint16 indexed day, string reason);
    event DayChallenged(uint256 indexed termId, uint16 indexed day, address indexed by, string evidence);
    event ChallengeResolved(uint256 indexed termId, uint16 indexed day, bool upheld);
    event DaySettled(uint256 indexed termId, uint16 indexed day, Mark mark, uint8 passes, uint128 paid, uint128 refunded);
    event TermEnded(uint256 indexed termId, bool early, uint128 bondReturned, uint128 escrowReturned);

    // ----------------------------------------------------------------- errors

    error NotAttester();
    error NotFunder();
    error NotProvider();
    error NotArbiter();
    error BadTerms(string why);
    error AlreadyAccepted();
    error NotAccepted();
    error TermIsOver();
    error BadSignature();
    error OutsideTerm();
    error FromTheFuture();
    error TooLate();
    error TestAlreadyUsed();
    error DayFull();
    error DayAlreadyStarted();
    error NotSettleable();
    error AlreadySettled();
    error ChallengeClosed();
    error NoChallenge();
    error NotEnoughStrikes();
    error DaysRemain();

    constructor(IERC20 token_, address attester_) EIP712("Roll Call", "1") {
        token = token_;
        attester = attester_;
    }

    // ------------------------------------------------------------ term set-up

    /// @notice Funder opens a term and locks ratePerDay x numDays.
    function open(Terms calldata t, string calldata school) external returns (uint256 termId) {
        if (t.provider == address(0) || t.probe == address(0) || t.arbiter == address(0)) revert BadTerms("zero address");
        if (t.numDays == 0 || t.numDays > 400) revert BadTerms("days");
        if (t.dayLength < 60) revert BadTerms("day length");
        if (t.required == 0 || t.required > MAX_READINGS_PER_DAY) revert BadTerms("required readings");
        if (t.ratePerDay == 0) revert BadTerms("rate");
        if (t.slash > t.bond) revert BadTerms("slash above bond");
        if (t.lateWindow > t.dayLength) revert BadTerms("late window");
        termId = ++termCount;
        Terms storage s = _terms[termId];
        s.funder = msg.sender;
        s.provider = t.provider;
        s.probe = t.probe;
        s.arbiter = t.arbiter;
        s.asn = t.asn;
        s.minDownKbps = t.minDownKbps;
        s.minUpKbps = t.minUpKbps;
        s.maxRttMs = t.maxRttMs;
        s.start = t.start;
        s.dayLength = t.dayLength;
        s.lateWindow = t.lateWindow;
        s.challengeWindow = t.challengeWindow;
        s.numDays = t.numDays;
        s.required = t.required;
        s.strikeLimit = t.strikeLimit;
        s.ratePerDay = t.ratePerDay;
        s.bond = t.bond;
        s.slash = t.slash;
        uint128 total = t.ratePerDay * t.numDays;
        _state[termId].escrow = total;
        token.safeTransferFrom(msg.sender, address(this), total);
        emit TermOpened(termId, msg.sender, t.provider, t.probe, t.asn, school);
    }

    /// @notice Provider accepts the terms and posts its bond before the first day starts.
    function accept(uint256 termId) external {
        Terms storage t = _terms[termId];
        State storage st = _state[termId];
        if (msg.sender != t.provider) revert NotProvider();
        if (st.accepted) revert AlreadyAccepted();
        if (st.ended) revert TermIsOver();
        if (block.timestamp >= t.start) revert DayAlreadyStarted();
        st.accepted = true;
        st.bondHeld = t.bond;
        if (t.bond > 0) token.safeTransferFrom(msg.sender, address(this), t.bond);
        emit TermAccepted(termId, t.bond);
    }

    /// @notice Funder takes the money back from a term the provider never accepted.
    function withdrawUnaccepted(uint256 termId) external {
        Terms storage t = _terms[termId];
        State storage st = _state[termId];
        if (msg.sender != t.funder) revert NotFunder();
        if (st.accepted) revert AlreadyAccepted();
        if (st.ended) revert TermIsOver();
        st.ended = true;
        uint128 back = st.escrow;
        st.escrow = 0;
        st.refunded += back;
        token.safeTransfer(t.funder, back);
        emit TermEnded(termId, true, 0, back);
    }

    // --------------------------------------------------------------- readings

    /// @notice Attester records probe-signed readings with the network each test ran over.
    /// @dev A batch so one transaction can carry a school's whole day (or many schools).
    function record(
        Reading[] calldata rs,
        bytes[] calldata probeSigs,
        uint32[] calldata asns,
        string[] calldata mlabTestIds
    ) external {
        if (msg.sender != attester) revert NotAttester();
        uint256 n = rs.length;
        if (probeSigs.length != n || asns.length != n || mlabTestIds.length != n) revert BadTerms("lengths");
        for (uint256 i; i < n; ++i) {
            _record(rs[i], probeSigs[i], asns[i], mlabTestIds[i]);
        }
    }

    function _record(Reading calldata r, bytes calldata sig, uint32 asn, string calldata mlabTestId) internal {
        Terms storage t = _terms[r.termId];
        State storage st = _state[r.termId];
        if (!st.accepted) revert NotAccepted();
        if (st.ended) revert TermIsOver();
        if (keccak256(bytes(mlabTestId)) != r.testId) revert BadTerms("test id");
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(READING_TYPEHASH, r.termId, r.takenAt, r.downKbps, r.upKbps, r.rttMs, r.testId, r.clientHash)
            )
        );
        if (ECDSA.recover(digest, sig) != t.probe) revert BadSignature();
        if (r.takenAt > block.timestamp + 300) revert FromTheFuture();
        uint16 day = _dayOf(t, r.takenAt);
        if (block.timestamp > _dayEnd(t, day) + t.lateWindow) revert TooLate();
        if (testUsed[r.testId]) revert TestAlreadyUsed();
        testUsed[r.testId] = true;
        Day storage d = _days[r.termId][day];
        if (d.readings >= MAX_READINGS_PER_DAY) revert DayFull();
        bool pass = asn == t.asn && r.downKbps >= t.minDownKbps && r.upKbps >= t.minUpKbps && r.rttMs <= t.maxRttMs;
        d.readings += 1;
        if (pass) d.passes += 1;
        emit ReadingRecorded(r.termId, day, r.takenAt, r.downKbps, r.upKbps, r.rttMs, asn, pass, mlabTestId);
    }

    /// @notice The school marks a day closed (holiday, exam day, power cut). Signed by the probe key,
    /// relayed by anyone, and only before the day ends so it cannot erase a failure after the fact.
    function closeDay(uint256 termId, uint16 day, string calldata reason, bytes calldata probeSig) external {
        Terms storage t = _terms[termId];
        if (_state[termId].ended) revert TermIsOver();
        if (day >= t.numDays) revert OutsideTerm();
        if (block.timestamp >= _dayEnd(t, day)) revert TooLate();
        bytes32 digest =
            _hashTypedDataV4(keccak256(abi.encode(CLOSURE_TYPEHASH, termId, day, keccak256(bytes(reason)))));
        if (ECDSA.recover(digest, probeSig) != t.probe) revert BadSignature();
        _days[termId][day].closed = true;
        emit DayClosed(termId, day, reason);
    }

    // ------------------------------------------------------------- challenges

    /// @notice Funder flags a day before it settles, e.g. a test id missing from M-Lab's archive.
    function challenge(uint256 termId, uint16 day, string calldata evidence) external {
        Terms storage t = _terms[termId];
        if (msg.sender != t.funder) revert NotFunder();
        if (day >= t.numDays) revert OutsideTerm();
        Day storage d = _days[termId][day];
        if (d.mark != Mark.Open) revert AlreadySettled();
        if (block.timestamp >= _settleableAt(t, day)) revert ChallengeClosed();
        d.challenged = true;
        emit DayChallenged(termId, day, msg.sender, evidence);
    }

    /// @notice Arbiter decides a challenge. Upheld: the day is void and part of the bond goes to the funder.
    function resolve(uint256 termId, uint16 day, bool upheld) external {
        Terms storage t = _terms[termId];
        if (msg.sender != t.arbiter) revert NotArbiter();
        Day storage d = _days[termId][day];
        if (!d.challenged) revert NoChallenge();
        if (d.mark != Mark.Open) revert AlreadySettled();
        d.challenged = false;
        emit ChallengeResolved(termId, day, upheld);
        if (upheld) {
            d.voided = true; // settles as Voided in its turn
            _slash(termId);
        }
    }

    // -------------------------------------------------------------- settling

    /// @notice Anyone settles finished days in order: pays the provider for what worked, refunds the rest.
    function settle(uint256 termId, uint16 upTo) external {
        Terms storage t = _terms[termId];
        State storage st = _state[termId];
        if (!st.accepted) revert NotAccepted();
        if (st.ended) revert TermIsOver();
        if (upTo >= t.numDays) upTo = t.numDays - 1;
        uint16 day = st.nextToSettle;
        if (day > upTo || block.timestamp < _settleableAt(t, day)) revert NotSettleable();
        while (day <= upTo && block.timestamp >= _settleableAt(t, day)) {
            Day storage d = _days[termId][day];
            if (d.challenged) break; // waits for the arbiter
            if (d.voided) {
                _settleAs(termId, day, Mark.Voided, 0);
            } else if (d.closed) {
                _settleAs(termId, day, Mark.Closed, 0);
            } else if (d.readings == 0) {
                _settleAs(termId, day, Mark.Silent, 0);
            } else {
                uint8 counted = d.passes > t.required ? t.required : d.passes;
                Mark m = counted == t.required ? Mark.Present : counted == 0 ? Mark.Absent : Mark.Partial;
                _settleAs(termId, day, m, uint128((uint256(t.ratePerDay) * counted) / t.required));
            }
            day = st.nextToSettle;
            if (st.ended) break;
        }
    }

    function _settleAs(uint256 termId, uint16 day, Mark m, uint128 pay) internal {
        Terms storage t = _terms[termId];
        State storage st = _state[termId];
        Day storage d = _days[termId][day];
        if (d.mark != Mark.Open) revert AlreadySettled();
        d.mark = m;
        uint128 refund = t.ratePerDay - pay;
        st.escrow -= t.ratePerDay;
        st.paid += pay;
        st.refunded += refund;
        st.settledDays += 1;
        st.nextToSettle = day + 1;
        if (m == Mark.Absent || m == Mark.Silent || m == Mark.Voided) {
            if (st.strikes < type(uint8).max) st.strikes += 1;
        } else if (m != Mark.Closed) {
            st.strikes = 0;
        }
        if (pay > 0) token.safeTransfer(t.provider, pay);
        if (refund > 0) token.safeTransfer(t.funder, refund);
        emit DaySettled(termId, day, m, d.passes, pay, refund);
        if (st.settledDays == t.numDays) _end(termId, false);
    }

    function _slash(uint256 termId) internal {
        Terms storage t = _terms[termId];
        State storage st = _state[termId];
        uint128 cut = t.slash < st.bondHeld ? t.slash : st.bondHeld;
        if (cut == 0) return;
        st.bondHeld -= cut;
        st.refunded += cut;
        token.safeTransfer(t.funder, cut);
    }

    /// @notice After strikeLimit absent days in a row, the funder may end the term: the days not yet
    /// served come back, and part of the provider's bond with them.
    function terminate(uint256 termId) external {
        Terms storage t = _terms[termId];
        State storage st = _state[termId];
        if (msg.sender != t.funder) revert NotFunder();
        if (st.ended) revert TermIsOver();
        if (t.strikeLimit == 0 || st.strikes < t.strikeLimit) revert NotEnoughStrikes();
        _slash(termId);
        _end(termId, true);
    }

    function _end(uint256 termId, bool early) internal {
        Terms storage t = _terms[termId];
        State storage st = _state[termId];
        st.ended = true;
        uint128 bond = st.bondHeld;
        uint128 escrow = st.escrow;
        st.bondHeld = 0;
        st.escrow = 0;
        st.refunded += escrow;
        if (bond > 0) token.safeTransfer(t.provider, bond);
        if (escrow > 0) token.safeTransfer(t.funder, escrow);
        emit TermEnded(termId, early, bond, escrow);
    }

    // ------------------------------------------------------------------ views

    function terms(uint256 termId) external view returns (Terms memory) {
        return _terms[termId];
    }

    function state(uint256 termId) external view returns (State memory) {
        return _state[termId];
    }

    function dayOf(uint256 termId, uint16 day) external view returns (Day memory) {
        return _days[termId][day];
    }

    /// @notice The whole register for a term in one call: one entry per school day.
    function register(uint256 termId) external view returns (Day[] memory out) {
        uint16 n = _terms[termId].numDays;
        out = new Day[](n);
        for (uint16 i; i < n; ++i) {
            out[i] = _days[termId][i];
        }
    }

    function currentDay(uint256 termId) external view returns (uint16) {
        Terms storage t = _terms[termId];
        if (block.timestamp < t.start) return 0;
        uint256 d = (block.timestamp - t.start) / t.dayLength;
        return d >= t.numDays ? t.numDays : uint16(d);
    }

    function readingDigest(Reading calldata r) external view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(abi.encode(READING_TYPEHASH, r.termId, r.takenAt, r.downKbps, r.upKbps, r.rttMs, r.testId, r.clientHash))
        );
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // -------------------------------------------------------------- internals

    function _dayOf(Terms storage t, uint64 ts) internal view returns (uint16) {
        if (ts < t.start) revert OutsideTerm();
        uint256 d = (ts - t.start) / t.dayLength;
        if (d >= t.numDays) revert OutsideTerm();
        return uint16(d);
    }

    function _dayEnd(Terms storage t, uint16 day) internal view returns (uint256) {
        return uint256(t.start) + uint256(day + 1) * t.dayLength;
    }

    function _settleableAt(Terms storage t, uint16 day) internal view returns (uint256) {
        return _dayEnd(t, day) + t.lateWindow + t.challengeWindow;
    }
}
