// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title Roll Call
/// @notice School internet paid by the day it works.
///
/// A funder (a donor, a CSR programme, a school board, a universal service fund) locks a term's money
/// up front. The internet provider posts a bond and is paid for each school day the school's own probe
/// found the connection working, measured from inside the school with M-Lab speed tests. A day's
/// money goes back to the funder when the line failed.
///
/// Four separate keys have to play their part, and no key may hold two roles in a term:
///   - the probe (on the school's device) signs what it measured, or that it could not get online;
///   - the attester records signed readings with the network each test ran over (the autonomous system
///     number behind the client address M-Lab saw), so a test over a phone hotspot earns nothing;
///   - the funder may challenge a finished day, with a deposit it loses if the challenge fails;
///   - the arbiter decides challenges; if it stays silent the challenge lapses.
/// Each reading names its M-Lab tests, so anyone can check it against M-Lab's public archive.
///
/// A school day is split into `required` equal slots. A day is paid in full only when a test passed in
/// every slot, so a line that works for half an hour cannot earn a whole day by retrying.
contract RollCall is EIP712 {
    using SafeERC20 for IERC20;

    // ------------------------------------------------------------------ types

    enum Mark {
        Open, //       not settled yet
        Present, //    a passing test in every slot: paid in full
        Partial, //    passing tests in some slots: paid that share
        Absent, //     the probe reported, nothing passed: refunded, strike
        Silent, //     nothing reported at all (device off, power cut): refunded, no strike
        Closed, //     the school declared the day closed before it began testing: refunded, no strike
        Voided //      challenge upheld: refunded, strike, provider bond cut
    }

    struct Terms {
        address funder;
        address provider; //    receives payouts and the bond back
        address probe; //       school device key that signs readings and closures
        address attester; //    records readings and vouches for the network
        address arbiter; //     decides challenges
        uint32 asn; //          contracted provider's network
        uint32 minDownKbps;
        uint32 minUpKbps;
        uint32 maxRttMs;
        uint64 start; //        unix time the first school day starts
        uint32 dayLength; //    seconds per school day (86400 on a real term)
        uint32 lateWindow; //   seconds after a day ends that its readings may still arrive
        uint32 challengeWindow; // seconds after the late window before the day can settle
        uint16 numDays;
        uint8 required; //      slots per day; a passing test in each pays the day in full
        uint8 strikeLimit; //   consecutive absent days before the funder may end the term
        uint128 ratePerDay; //  token units paid for one present day
        uint128 bond; //        provider bond posted on accept
        uint128 slash; //       bond taken per upheld challenge or early termination
        uint128 challengeDeposit; // funder's stake per challenge, paid to the provider if it fails
    }

    struct State {
        uint128 escrow; //      day money not yet paid or refunded
        uint128 bondHeld;
        uint128 paid; //        paid to the provider for working days
        uint128 refunded; //    day money returned to the funder (failed, closed, voided or unserved days)
        uint128 slashed; //     bond taken from the provider and paid to the funder
        uint16 settledDays;
        uint16 nextToSettle; // days settle in order so strikes are counted honestly
        uint8 strikes; //       current run of absent or voided days
        bool accepted;
        bool ended;
    }

    struct Day {
        uint8 readings; //      readings recorded (passing or not, including "offline" reports)
        uint8 passes; //        slots with at least one passing test
        uint32 slotMask; //     which slots have a passing test
        Mark mark;
        bool closed;
        bool challenged;
        bool voided;
    }

    /// @notice What the probe measured. Signed by the probe key (EIP-712). An "offline" report, made when
    /// the probe could not reach M-Lab at all, has zero speeds and a test id that starts with "offline:".
    struct Reading {
        uint256 termId;
        uint64 takenAt;
        uint32 downKbps;
        uint32 upKbps;
        uint32 rttMs;
        bytes32 testId; //      keccak256 of the M-Lab test ids (emitted in full below)
        bytes32 clientHash; //  keccak256 of a probe-held salt and the client address
    }

    // ---------------------------------------------------------------- storage

    bytes32 private constant READING_TYPEHASH = keccak256(
        "Reading(uint256 termId,uint64 takenAt,uint32 downKbps,uint32 upKbps,uint32 rttMs,bytes32 testId,bytes32 clientHash)"
    );
    bytes32 private constant CLOSURE_TYPEHASH = keccak256("Closure(uint256 termId,uint16 day,string reason)");

    uint8 public constant MAX_READINGS_PER_DAY = 24;
    uint8 public constant MAX_SLOTS = 24;

    IERC20 public immutable token;

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
    error SettleFirst();
    error DayNotOver();
    error DayHasReadings();
    error AlreadyClosed();

    constructor(IERC20 token_) EIP712("Roll Call", "2") {
        token = token_;
    }

    // ------------------------------------------------------------ term set-up

    /// @notice Funder opens a term and locks ratePerDay x numDays. `t.funder` is ignored: the caller is the funder.
    function open(Terms calldata t, string calldata school) external returns (uint256 termId) {
        address[5] memory roles = [msg.sender, t.provider, t.probe, t.attester, t.arbiter];
        for (uint256 i; i < 5; ++i) {
            if (roles[i] == address(0)) revert BadTerms("zero address");
            for (uint256 j = i + 1; j < 5; ++j) {
                if (roles[i] == roles[j]) revert BadTerms("one key in two roles");
            }
        }
        if (t.numDays == 0 || t.numDays > 400) revert BadTerms("days");
        if (t.dayLength < 60) revert BadTerms("day length");
        if (t.required == 0 || t.required > MAX_SLOTS) revert BadTerms("required readings");
        if (t.ratePerDay == 0) revert BadTerms("rate");
        if (t.slash > t.bond) revert BadTerms("slash above bond");
        if (t.lateWindow > t.dayLength) revert BadTerms("late window");
        termId = ++termCount;
        Terms storage s = _terms[termId];
        s.funder = msg.sender;
        s.provider = t.provider;
        s.probe = t.probe;
        s.attester = t.attester;
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
        s.challengeDeposit = t.challengeDeposit;
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

    /// @notice The term's attester records probe-signed readings with the network each test ran over.
    /// @dev A batch, so one transaction can carry a school's whole day. Every reading in a batch must
    ///      belong to a term this sender attests.
    function record(
        Reading[] calldata rs,
        bytes[] calldata probeSigs,
        uint32[] calldata asns,
        string[] calldata mlabTestIds
    ) external {
        uint256 n = rs.length;
        if (probeSigs.length != n || asns.length != n || mlabTestIds.length != n) revert BadTerms("lengths");
        for (uint256 i; i < n; ++i) {
            _record(rs[i], probeSigs[i], asns[i], mlabTestIds[i]);
        }
    }

    function _record(Reading calldata r, bytes calldata sig, uint32 asn, string calldata mlabTestId) internal {
        Terms storage t = _terms[r.termId];
        State storage st = _state[r.termId];
        if (msg.sender != t.attester) revert NotAttester();
        if (!st.accepted) revert NotAccepted();
        if (st.ended) revert TermIsOver();
        if (keccak256(bytes(mlabTestId)) != r.testId) revert BadTerms("test id");
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(READING_TYPEHASH, r.termId, r.takenAt, r.downKbps, r.upKbps, r.rttMs, r.testId, r.clientHash)
            )
        );
        if (ECDSA.recover(digest, sig) != t.probe) revert BadSignature();
        if (r.takenAt > block.timestamp + 60) revert FromTheFuture();
        uint16 day = _dayOf(t, r.takenAt);
        if (block.timestamp >= _dayEnd(t, day) + t.lateWindow) revert TooLate(); // never on a day that can settle
        if (testUsed[r.testId]) revert TestAlreadyUsed();
        testUsed[r.testId] = true;
        Day storage d = _days[r.termId][day];
        bool pass = asn == t.asn && r.downKbps >= t.minDownKbps && r.upKbps >= t.minUpKbps && r.rttMs <= t.maxRttMs;
        uint32 bit = uint32(1) << _slotOf(t, day, r.takenAt);
        bool newSlot = pass && (d.slotMask & bit) == 0;
        // the cap stops a flood of failing readings, but never refuses a pass the day still needs
        if (d.readings >= MAX_READINGS_PER_DAY && !newSlot) revert DayFull();
        if (d.readings < type(uint8).max) d.readings += 1;
        if (newSlot) {
            d.slotMask |= bit;
            d.passes += 1;
        }
        emit ReadingRecorded(r.termId, day, r.takenAt, r.downKbps, r.upKbps, r.rttMs, asn, pass, mlabTestId);
    }

    /// @notice The school marks a day closed (holiday, exam day, power cut). Signed by the probe key and
    /// relayed by anyone. Only before the day has any reading, so it can neither erase a failure the
    /// probe already saw nor take back a pass the provider earned.
    function closeDay(uint256 termId, uint16 day, string calldata reason, bytes calldata probeSig) external {
        Terms storage t = _terms[termId];
        if (_state[termId].ended) revert TermIsOver();
        if (day >= t.numDays) revert OutsideTerm();
        if (block.timestamp >= _dayEnd(t, day)) revert TooLate();
        bytes32 digest =
            _hashTypedDataV4(keccak256(abi.encode(CLOSURE_TYPEHASH, termId, day, keccak256(bytes(reason)))));
        if (ECDSA.recover(digest, probeSig) != t.probe) revert BadSignature();
        Day storage d = _days[termId][day];
        if (d.closed) revert AlreadyClosed();
        if (d.readings > 0) revert DayHasReadings();
        d.closed = true;
        emit DayClosed(termId, day, reason);
    }

    // ------------------------------------------------------------- challenges

    /// @notice Funder flags a finished day before it settles, e.g. a test id missing from M-Lab's archive,
    /// and stakes the term's challenge deposit. Upheld: the deposit comes back. Rejected, or left
    /// undecided by the arbiter for one more challenge window: the deposit goes to the provider.
    function challenge(uint256 termId, uint16 day, string calldata evidence) external {
        Terms storage t = _terms[termId];
        if (msg.sender != t.funder) revert NotFunder();
        if (_state[termId].ended) revert TermIsOver();
        if (day >= t.numDays) revert OutsideTerm();
        Day storage d = _days[termId][day];
        if (d.mark != Mark.Open) revert AlreadySettled();
        if (d.challenged || d.voided) revert ChallengeClosed();
        if (block.timestamp < _dayEnd(t, day)) revert DayNotOver();
        if (block.timestamp >= _settleableAt(t, day)) revert ChallengeClosed();
        d.challenged = true;
        if (t.challengeDeposit > 0) token.safeTransferFrom(msg.sender, address(this), t.challengeDeposit);
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
            if (t.challengeDeposit > 0) token.safeTransfer(t.funder, t.challengeDeposit);
            _slash(termId);
        } else if (t.challengeDeposit > 0) {
            token.safeTransfer(t.provider, t.challengeDeposit);
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
            if (d.challenged) {
                if (block.timestamp < _settleableAt(t, day) + t.challengeWindow) break; // waits for the arbiter
                d.challenged = false; // the arbiter let it lapse: the day settles as measured
                if (t.challengeDeposit > 0) token.safeTransfer(t.provider, t.challengeDeposit);
                emit ChallengeResolved(termId, day, false);
            }
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
        if (m == Mark.Absent || m == Mark.Voided) {
            if (st.strikes < type(uint8).max) st.strikes += 1;
        } else if (m == Mark.Present || m == Mark.Partial) {
            st.strikes = 0;
        } // Silent and Closed leave the run of strikes as it was
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
        st.slashed += cut;
        token.safeTransfer(t.funder, cut);
    }

    /// @notice After strikeLimit absent days in a row, the funder may end the term: the days not yet
    /// served come back, and part of the provider's bond with them. A day the provider earned is
    /// always paid: a finished day with any passing test has to settle before the term can end.
    function terminate(uint256 termId) external {
        Terms storage t = _terms[termId];
        State storage st = _state[termId];
        if (msg.sender != t.funder) revert NotFunder();
        if (st.ended) revert TermIsOver();
        if (t.strikeLimit == 0 || st.strikes < t.strikeLimit) revert NotEnoughStrikes();
        // a finished day that is not settled yet must be a failure the probe can no longer change:
        // no passing test, no open challenge, late window over. Anything else has to settle first.
        for (uint16 d = st.nextToSettle; d < t.numDays && _dayEnd(t, d) <= block.timestamp; ++d) {
            Day storage x = _days[termId][d];
            if (x.passes > 0 || x.challenged || block.timestamp < _dayEnd(t, d) + t.lateWindow) revert SettleFirst();
        }
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
        // forge-lint: disable-next-line(unsafe-typecast)
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
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint16(d);
    }

    /// @dev Which of the day's `required` equal slots a moment falls in.
    function _slotOf(Terms storage t, uint16 day, uint64 ts) internal view returns (uint8) {
        uint256 into = ts - (uint256(t.start) + uint256(day) * t.dayLength);
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint8((into * t.required) / t.dayLength);
    }

    function _dayEnd(Terms storage t, uint16 day) internal view returns (uint256) {
        return uint256(t.start) + uint256(day + 1) * t.dayLength;
    }

    function _settleableAt(Terms storage t, uint16 day) internal view returns (uint256) {
        return _dayEnd(t, day) + t.lateWindow + t.challengeWindow;
    }
}
