// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title Afterbell: a school's internet line, shared with the village after the bell.
/// @notice The payment partner settles rupee voucher sales in a stable token. Each sale is split between the school's
/// connectivity fund, the local operator and the provider. The split, the parties and the after-hours window change only
/// when a threshold of School Management Committee members approve. Any one member can pause public sales; unpausing
/// needs the threshold. Sales that started during school hours are refused: school hours always win.
contract Afterbell {
    using SafeERC20 for IERC20;

    struct Terms {
        address school; // the school's connectivity fund
        address operator; // the local operator who runs the hotspot
        address provider; // the internet provider
        uint16 schoolBps;
        uint16 operatorBps;
        uint16 providerBps;
        uint8 openHour; // public network opens (local time, inclusive)
        uint8 closeHour; // public network closes (local time, exclusive)
    }

    struct Proposal {
        Terms terms;
        uint64 expires;
        uint8 approvals;
        bool executed;
    }

    IERC20 public immutable token;
    address public immutable partner; // the payment partner (UPI side) that settles sales
    int32 public immutable utcOffset; // seconds, e.g. 19800 for IST
    uint8 public immutable threshold;

    mapping(address => bool) public isMember;
    address[] public members;
    Terms public terms;
    bool public paused;

    Proposal[] internal proposals;
    mapping(uint256 => mapping(address => bool)) public approved;
    mapping(bytes32 => bool) public voucherSettled;
    uint256 public unpauseApprovals;
    mapping(uint256 => mapping(address => bool)) public unpauseVoted;
    uint256 public pauseEpoch;

    uint256 public salesCount;
    uint256 public minutesSold;
    uint256 public totalIn;
    uint256 public toSchool;
    uint256 public toOperator;
    uint256 public toProvider;

    event Sale(
        bytes32 indexed voucher, uint64 startedAt, uint32 minutes_, uint256 amount, uint256 school, uint256 operator, uint256 provider
    );
    event TermsProposed(uint256 indexed id, address indexed by, Terms terms);
    event TermsApproved(uint256 indexed id, address indexed member, uint8 approvals);
    event TermsChanged(uint256 indexed id, Terms terms);
    event Paused(address indexed member);
    event UnpauseApproved(address indexed member, uint256 approvals);
    event Unpaused();

    error NotMember();
    error NotPartner();
    error BadTerms();
    error IsPaused();
    error SchoolHours();
    error BadTime();
    error AlreadySettled();
    error AlreadyApproved();
    error ProposalClosed();

    modifier onlyMember() {
        if (!isMember[msg.sender]) revert NotMember();
        _;
    }

    constructor(IERC20 token_, address partner_, int32 utcOffset_, address[] memory members_, uint8 threshold_, Terms memory terms_) {
        if (threshold_ == 0 || threshold_ > members_.length) revert BadTerms();
        token = token_;
        partner = partner_;
        utcOffset = utcOffset_;
        threshold = threshold_;
        for (uint256 i; i < members_.length; ++i) {
            if (isMember[members_[i]] || members_[i] == address(0)) revert BadTerms();
            isMember[members_[i]] = true;
            members.push(members_[i]);
        }
        _check(terms_);
        terms = terms_;
        emit TermsChanged(type(uint256).max, terms_);
    }

    function _check(Terms memory t) internal pure {
        if (t.school == address(0) || t.operator == address(0) || t.provider == address(0)) revert BadTerms();
        if (uint256(t.schoolBps) + t.operatorBps + t.providerBps != 10_000) revert BadTerms();
        if (t.openHour >= 24 || t.closeHour > 24 || t.openHour >= t.closeHour) revert BadTerms();
    }

    /// Local hour of a timestamp.
    function localHour(uint64 ts) public view returns (uint8) {
        int256 local = int256(uint256(ts)) + utcOffset;
        return uint8(uint256(local % 86400) / 3600);
    }

    /// True if a session starting at `ts` is inside the public after-hours window.
    function isPublicHour(uint64 ts) public view returns (bool) {
        uint8 h = localHour(ts);
        return h >= terms.openHour && h < terms.closeHour;
    }

    /// The payment partner settles one voucher: the rupee sale converted to the stable token, split on chain.
    function recordSale(bytes32 voucher, uint64 startedAt, uint32 minutes_, uint256 amount) external {
        if (msg.sender != partner) revert NotPartner();
        if (paused) revert IsPaused();
        if (voucherSettled[voucher]) revert AlreadySettled();
        if (startedAt > block.timestamp || startedAt + 7 days < block.timestamp || minutes_ == 0) revert BadTime();
        if (!isPublicHour(startedAt)) revert SchoolHours();
        voucherSettled[voucher] = true;

        Terms memory t = terms;
        uint256 s = (amount * t.schoolBps) / 10_000;
        uint256 o = (amount * t.operatorBps) / 10_000;
        uint256 p = amount - s - o;

        salesCount += 1;
        minutesSold += minutes_;
        totalIn += amount;
        toSchool += s;
        toOperator += o;
        toProvider += p;

        token.safeTransferFrom(msg.sender, t.school, s);
        token.safeTransferFrom(msg.sender, t.operator, o);
        token.safeTransferFrom(msg.sender, t.provider, p);
        emit Sale(voucher, startedAt, minutes_, amount, s, o, p);
    }

    // ---- committee-approved changes ----

    function propose(Terms calldata t) external onlyMember returns (uint256 id) {
        _check(t);
        id = proposals.length;
        proposals.push(Proposal({terms: t, expires: uint64(block.timestamp + 14 days), approvals: 0, executed: false}));
        emit TermsProposed(id, msg.sender, t);
        approve(id);
    }

    function approve(uint256 id) public onlyMember {
        Proposal storage p = proposals[id];
        if (p.executed || block.timestamp > p.expires) revert ProposalClosed();
        if (approved[id][msg.sender]) revert AlreadyApproved();
        approved[id][msg.sender] = true;
        p.approvals += 1;
        emit TermsApproved(id, msg.sender, p.approvals);
        if (p.approvals >= threshold) {
            p.executed = true;
            terms = p.terms;
            emit TermsChanged(id, p.terms);
        }
    }

    function proposal(uint256 id) external view returns (Proposal memory) {
        return proposals[id];
    }

    function proposalCount() external view returns (uint256) {
        return proposals.length;
    }

    function memberCount() external view returns (uint256) {
        return members.length;
    }

    // ---- kill switch ----

    /// Any one committee member can switch public sales off at once.
    function pause() external onlyMember {
        paused = true;
        pauseEpoch += 1;
        unpauseApprovals = 0;
        emit Paused(msg.sender);
    }

    /// Switching back on needs the committee threshold.
    function approveUnpause() external onlyMember {
        if (!paused) revert ProposalClosed();
        if (unpauseVoted[pauseEpoch][msg.sender]) revert AlreadyApproved();
        unpauseVoted[pauseEpoch][msg.sender] = true;
        unpauseApprovals += 1;
        emit UnpauseApproved(msg.sender, unpauseApprovals);
        if (unpauseApprovals >= threshold) {
            paused = false;
            emit Unpaused();
        }
    }
}
