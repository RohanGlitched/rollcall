// Generated from contracts/out. Do not edit by hand.
export const rollCallAbi = [
 {
  "type": "constructor",
  "inputs": [
   {
    "name": "token_",
    "type": "address",
    "internalType": "contract IERC20"
   }
  ],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "MAX_CLOSURE_DAYS",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint16",
    "internalType": "uint16"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "MAX_READINGS_PER_DAY",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint8",
    "internalType": "uint8"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "MAX_SLOTS",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint8",
    "internalType": "uint8"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "accept",
  "inputs": [
   {
    "name": "termId",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "challenge",
  "inputs": [
   {
    "name": "termId",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "day",
    "type": "uint16",
    "internalType": "uint16"
   },
   {
    "name": "evidence",
    "type": "string",
    "internalType": "string"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "closeDays",
  "inputs": [
   {
    "name": "termId",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "fromDay",
    "type": "uint16",
    "internalType": "uint16"
   },
   {
    "name": "toDay",
    "type": "uint16",
    "internalType": "uint16"
   },
   {
    "name": "reason",
    "type": "string",
    "internalType": "string"
   },
   {
    "name": "probeSig",
    "type": "bytes",
    "internalType": "bytes"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "currentDay",
  "inputs": [
   {
    "name": "termId",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "uint16",
    "internalType": "uint16"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "dayOf",
  "inputs": [
   {
    "name": "termId",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "day",
    "type": "uint16",
    "internalType": "uint16"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "tuple",
    "internalType": "struct RollCall.Day",
    "components": [
     {
      "name": "readings",
      "type": "uint8",
      "internalType": "uint8"
     },
     {
      "name": "passes",
      "type": "uint8",
      "internalType": "uint8"
     },
     {
      "name": "slotMask",
      "type": "uint32",
      "internalType": "uint32"
     },
     {
      "name": "mark",
      "type": "uint8",
      "internalType": "enum RollCall.Mark"
     },
     {
      "name": "closed",
      "type": "bool",
      "internalType": "bool"
     },
     {
      "name": "challenged",
      "type": "bool",
      "internalType": "bool"
     },
     {
      "name": "voided",
      "type": "bool",
      "internalType": "bool"
     }
    ]
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "domainSeparator",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "bytes32",
    "internalType": "bytes32"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "eip712Domain",
  "inputs": [],
  "outputs": [
   {
    "name": "fields",
    "type": "bytes1",
    "internalType": "bytes1"
   },
   {
    "name": "name",
    "type": "string",
    "internalType": "string"
   },
   {
    "name": "version",
    "type": "string",
    "internalType": "string"
   },
   {
    "name": "chainId",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "verifyingContract",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "salt",
    "type": "bytes32",
    "internalType": "bytes32"
   },
   {
    "name": "extensions",
    "type": "uint256[]",
    "internalType": "uint256[]"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "open",
  "inputs": [
   {
    "name": "t",
    "type": "tuple",
    "internalType": "struct RollCall.Terms",
    "components": [
     {
      "name": "funder",
      "type": "address",
      "internalType": "address"
     },
     {
      "name": "provider",
      "type": "address",
      "internalType": "address"
     },
     {
      "name": "probe",
      "type": "address",
      "internalType": "address"
     },
     {
      "name": "attester",
      "type": "address",
      "internalType": "address"
     },
     {
      "name": "arbiter",
      "type": "address",
      "internalType": "address"
     },
     {
      "name": "asn",
      "type": "uint32",
      "internalType": "uint32"
     },
     {
      "name": "minDownKbps",
      "type": "uint32",
      "internalType": "uint32"
     },
     {
      "name": "minUpKbps",
      "type": "uint32",
      "internalType": "uint32"
     },
     {
      "name": "maxRttMs",
      "type": "uint32",
      "internalType": "uint32"
     },
     {
      "name": "start",
      "type": "uint64",
      "internalType": "uint64"
     },
     {
      "name": "dayLength",
      "type": "uint32",
      "internalType": "uint32"
     },
     {
      "name": "schoolHours",
      "type": "uint32",
      "internalType": "uint32"
     },
     {
      "name": "lateWindow",
      "type": "uint32",
      "internalType": "uint32"
     },
     {
      "name": "challengeWindow",
      "type": "uint32",
      "internalType": "uint32"
     },
     {
      "name": "numDays",
      "type": "uint16",
      "internalType": "uint16"
     },
     {
      "name": "required",
      "type": "uint8",
      "internalType": "uint8"
     },
     {
      "name": "strikeLimit",
      "type": "uint8",
      "internalType": "uint8"
     },
     {
      "name": "ratePerDay",
      "type": "uint128",
      "internalType": "uint128"
     },
     {
      "name": "bond",
      "type": "uint128",
      "internalType": "uint128"
     },
     {
      "name": "slash",
      "type": "uint128",
      "internalType": "uint128"
     },
     {
      "name": "challengeDeposit",
      "type": "uint128",
      "internalType": "uint128"
     }
    ]
   },
   {
    "name": "school",
    "type": "string",
    "internalType": "string"
   }
  ],
  "outputs": [
   {
    "name": "termId",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "readingDigest",
  "inputs": [
   {
    "name": "r",
    "type": "tuple",
    "internalType": "struct RollCall.Reading",
    "components": [
     {
      "name": "termId",
      "type": "uint256",
      "internalType": "uint256"
     },
     {
      "name": "takenAt",
      "type": "uint64",
      "internalType": "uint64"
     },
     {
      "name": "downKbps",
      "type": "uint32",
      "internalType": "uint32"
     },
     {
      "name": "upKbps",
      "type": "uint32",
      "internalType": "uint32"
     },
     {
      "name": "rttMs",
      "type": "uint32",
      "internalType": "uint32"
     },
     {
      "name": "testId",
      "type": "bytes32",
      "internalType": "bytes32"
     },
     {
      "name": "clientHash",
      "type": "bytes32",
      "internalType": "bytes32"
     }
    ]
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "bytes32",
    "internalType": "bytes32"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "record",
  "inputs": [
   {
    "name": "rs",
    "type": "tuple[]",
    "internalType": "struct RollCall.Reading[]",
    "components": [
     {
      "name": "termId",
      "type": "uint256",
      "internalType": "uint256"
     },
     {
      "name": "takenAt",
      "type": "uint64",
      "internalType": "uint64"
     },
     {
      "name": "downKbps",
      "type": "uint32",
      "internalType": "uint32"
     },
     {
      "name": "upKbps",
      "type": "uint32",
      "internalType": "uint32"
     },
     {
      "name": "rttMs",
      "type": "uint32",
      "internalType": "uint32"
     },
     {
      "name": "testId",
      "type": "bytes32",
      "internalType": "bytes32"
     },
     {
      "name": "clientHash",
      "type": "bytes32",
      "internalType": "bytes32"
     }
    ]
   },
   {
    "name": "probeSigs",
    "type": "bytes[]",
    "internalType": "bytes[]"
   },
   {
    "name": "asns",
    "type": "uint32[]",
    "internalType": "uint32[]"
   },
   {
    "name": "mlabTestIds",
    "type": "string[]",
    "internalType": "string[]"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "register",
  "inputs": [
   {
    "name": "termId",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [
   {
    "name": "out",
    "type": "tuple[]",
    "internalType": "struct RollCall.Day[]",
    "components": [
     {
      "name": "readings",
      "type": "uint8",
      "internalType": "uint8"
     },
     {
      "name": "passes",
      "type": "uint8",
      "internalType": "uint8"
     },
     {
      "name": "slotMask",
      "type": "uint32",
      "internalType": "uint32"
     },
     {
      "name": "mark",
      "type": "uint8",
      "internalType": "enum RollCall.Mark"
     },
     {
      "name": "closed",
      "type": "bool",
      "internalType": "bool"
     },
     {
      "name": "challenged",
      "type": "bool",
      "internalType": "bool"
     },
     {
      "name": "voided",
      "type": "bool",
      "internalType": "bool"
     }
    ]
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "resolve",
  "inputs": [
   {
    "name": "termId",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "day",
    "type": "uint16",
    "internalType": "uint16"
   },
   {
    "name": "upheld",
    "type": "bool",
    "internalType": "bool"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "settle",
  "inputs": [
   {
    "name": "termId",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "upTo",
    "type": "uint16",
    "internalType": "uint16"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "state",
  "inputs": [
   {
    "name": "termId",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "tuple",
    "internalType": "struct RollCall.State",
    "components": [
     {
      "name": "escrow",
      "type": "uint128",
      "internalType": "uint128"
     },
     {
      "name": "bondHeld",
      "type": "uint128",
      "internalType": "uint128"
     },
     {
      "name": "paid",
      "type": "uint128",
      "internalType": "uint128"
     },
     {
      "name": "refunded",
      "type": "uint128",
      "internalType": "uint128"
     },
     {
      "name": "slashed",
      "type": "uint128",
      "internalType": "uint128"
     },
     {
      "name": "settledDays",
      "type": "uint16",
      "internalType": "uint16"
     },
     {
      "name": "nextToSettle",
      "type": "uint16",
      "internalType": "uint16"
     },
     {
      "name": "strikes",
      "type": "uint8",
      "internalType": "uint8"
     },
     {
      "name": "accepted",
      "type": "bool",
      "internalType": "bool"
     },
     {
      "name": "ended",
      "type": "bool",
      "internalType": "bool"
     }
    ]
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "termCount",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "terminate",
  "inputs": [
   {
    "name": "termId",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "terms",
  "inputs": [
   {
    "name": "termId",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "tuple",
    "internalType": "struct RollCall.Terms",
    "components": [
     {
      "name": "funder",
      "type": "address",
      "internalType": "address"
     },
     {
      "name": "provider",
      "type": "address",
      "internalType": "address"
     },
     {
      "name": "probe",
      "type": "address",
      "internalType": "address"
     },
     {
      "name": "attester",
      "type": "address",
      "internalType": "address"
     },
     {
      "name": "arbiter",
      "type": "address",
      "internalType": "address"
     },
     {
      "name": "asn",
      "type": "uint32",
      "internalType": "uint32"
     },
     {
      "name": "minDownKbps",
      "type": "uint32",
      "internalType": "uint32"
     },
     {
      "name": "minUpKbps",
      "type": "uint32",
      "internalType": "uint32"
     },
     {
      "name": "maxRttMs",
      "type": "uint32",
      "internalType": "uint32"
     },
     {
      "name": "start",
      "type": "uint64",
      "internalType": "uint64"
     },
     {
      "name": "dayLength",
      "type": "uint32",
      "internalType": "uint32"
     },
     {
      "name": "schoolHours",
      "type": "uint32",
      "internalType": "uint32"
     },
     {
      "name": "lateWindow",
      "type": "uint32",
      "internalType": "uint32"
     },
     {
      "name": "challengeWindow",
      "type": "uint32",
      "internalType": "uint32"
     },
     {
      "name": "numDays",
      "type": "uint16",
      "internalType": "uint16"
     },
     {
      "name": "required",
      "type": "uint8",
      "internalType": "uint8"
     },
     {
      "name": "strikeLimit",
      "type": "uint8",
      "internalType": "uint8"
     },
     {
      "name": "ratePerDay",
      "type": "uint128",
      "internalType": "uint128"
     },
     {
      "name": "bond",
      "type": "uint128",
      "internalType": "uint128"
     },
     {
      "name": "slash",
      "type": "uint128",
      "internalType": "uint128"
     },
     {
      "name": "challengeDeposit",
      "type": "uint128",
      "internalType": "uint128"
     }
    ]
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "testUsed",
  "inputs": [
   {
    "name": "",
    "type": "bytes32",
    "internalType": "bytes32"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "bool",
    "internalType": "bool"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "token",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "contract IERC20"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "withdrawUnaccepted",
  "inputs": [
   {
    "name": "termId",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "event",
  "name": "ChallengeResolved",
  "inputs": [
   {
    "name": "termId",
    "type": "uint256",
    "indexed": true,
    "internalType": "uint256"
   },
   {
    "name": "day",
    "type": "uint16",
    "indexed": true,
    "internalType": "uint16"
   },
   {
    "name": "upheld",
    "type": "bool",
    "indexed": false,
    "internalType": "bool"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "DayChallenged",
  "inputs": [
   {
    "name": "termId",
    "type": "uint256",
    "indexed": true,
    "internalType": "uint256"
   },
   {
    "name": "day",
    "type": "uint16",
    "indexed": true,
    "internalType": "uint16"
   },
   {
    "name": "by",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "evidence",
    "type": "string",
    "indexed": false,
    "internalType": "string"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "DayClosed",
  "inputs": [
   {
    "name": "termId",
    "type": "uint256",
    "indexed": true,
    "internalType": "uint256"
   },
   {
    "name": "day",
    "type": "uint16",
    "indexed": true,
    "internalType": "uint16"
   },
   {
    "name": "reason",
    "type": "string",
    "indexed": false,
    "internalType": "string"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "DaySettled",
  "inputs": [
   {
    "name": "termId",
    "type": "uint256",
    "indexed": true,
    "internalType": "uint256"
   },
   {
    "name": "day",
    "type": "uint16",
    "indexed": true,
    "internalType": "uint16"
   },
   {
    "name": "mark",
    "type": "uint8",
    "indexed": false,
    "internalType": "enum RollCall.Mark"
   },
   {
    "name": "passes",
    "type": "uint8",
    "indexed": false,
    "internalType": "uint8"
   },
   {
    "name": "paid",
    "type": "uint128",
    "indexed": false,
    "internalType": "uint128"
   },
   {
    "name": "refunded",
    "type": "uint128",
    "indexed": false,
    "internalType": "uint128"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "EIP712DomainChanged",
  "inputs": [],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "ReadingRecorded",
  "inputs": [
   {
    "name": "termId",
    "type": "uint256",
    "indexed": true,
    "internalType": "uint256"
   },
   {
    "name": "day",
    "type": "uint16",
    "indexed": true,
    "internalType": "uint16"
   },
   {
    "name": "takenAt",
    "type": "uint64",
    "indexed": false,
    "internalType": "uint64"
   },
   {
    "name": "downKbps",
    "type": "uint32",
    "indexed": false,
    "internalType": "uint32"
   },
   {
    "name": "upKbps",
    "type": "uint32",
    "indexed": false,
    "internalType": "uint32"
   },
   {
    "name": "rttMs",
    "type": "uint32",
    "indexed": false,
    "internalType": "uint32"
   },
   {
    "name": "asn",
    "type": "uint32",
    "indexed": false,
    "internalType": "uint32"
   },
   {
    "name": "pass",
    "type": "bool",
    "indexed": false,
    "internalType": "bool"
   },
   {
    "name": "mlabTestId",
    "type": "string",
    "indexed": false,
    "internalType": "string"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "TermAccepted",
  "inputs": [
   {
    "name": "termId",
    "type": "uint256",
    "indexed": true,
    "internalType": "uint256"
   },
   {
    "name": "bond",
    "type": "uint128",
    "indexed": false,
    "internalType": "uint128"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "TermEnded",
  "inputs": [
   {
    "name": "termId",
    "type": "uint256",
    "indexed": true,
    "internalType": "uint256"
   },
   {
    "name": "early",
    "type": "bool",
    "indexed": false,
    "internalType": "bool"
   },
   {
    "name": "bondReturned",
    "type": "uint128",
    "indexed": false,
    "internalType": "uint128"
   },
   {
    "name": "escrowReturned",
    "type": "uint128",
    "indexed": false,
    "internalType": "uint128"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "TermOpened",
  "inputs": [
   {
    "name": "termId",
    "type": "uint256",
    "indexed": true,
    "internalType": "uint256"
   },
   {
    "name": "funder",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "provider",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "probe",
    "type": "address",
    "indexed": false,
    "internalType": "address"
   },
   {
    "name": "asn",
    "type": "uint32",
    "indexed": false,
    "internalType": "uint32"
   },
   {
    "name": "school",
    "type": "string",
    "indexed": false,
    "internalType": "string"
   }
  ],
  "anonymous": false
 },
 {
  "type": "error",
  "name": "AlreadyAccepted",
  "inputs": []
 },
 {
  "type": "error",
  "name": "AlreadyClosed",
  "inputs": []
 },
 {
  "type": "error",
  "name": "AlreadySettled",
  "inputs": []
 },
 {
  "type": "error",
  "name": "BadSignature",
  "inputs": []
 },
 {
  "type": "error",
  "name": "BadTerms",
  "inputs": [
   {
    "name": "why",
    "type": "string",
    "internalType": "string"
   }
  ]
 },
 {
  "type": "error",
  "name": "ChallengeClosed",
  "inputs": []
 },
 {
  "type": "error",
  "name": "DayAlreadyStarted",
  "inputs": []
 },
 {
  "type": "error",
  "name": "DayFull",
  "inputs": []
 },
 {
  "type": "error",
  "name": "DayHasReadings",
  "inputs": []
 },
 {
  "type": "error",
  "name": "DayNotOver",
  "inputs": []
 },
 {
  "type": "error",
  "name": "ECDSAInvalidSignature",
  "inputs": []
 },
 {
  "type": "error",
  "name": "ECDSAInvalidSignatureLength",
  "inputs": [
   {
    "name": "length",
    "type": "uint256",
    "internalType": "uint256"
   }
  ]
 },
 {
  "type": "error",
  "name": "ECDSAInvalidSignatureS",
  "inputs": [
   {
    "name": "s",
    "type": "bytes32",
    "internalType": "bytes32"
   }
  ]
 },
 {
  "type": "error",
  "name": "FromTheFuture",
  "inputs": []
 },
 {
  "type": "error",
  "name": "InvalidShortString",
  "inputs": []
 },
 {
  "type": "error",
  "name": "NoChallenge",
  "inputs": []
 },
 {
  "type": "error",
  "name": "NotAccepted",
  "inputs": []
 },
 {
  "type": "error",
  "name": "NotArbiter",
  "inputs": []
 },
 {
  "type": "error",
  "name": "NotAttester",
  "inputs": []
 },
 {
  "type": "error",
  "name": "NotEnoughStrikes",
  "inputs": []
 },
 {
  "type": "error",
  "name": "NotFunder",
  "inputs": []
 },
 {
  "type": "error",
  "name": "NotProvider",
  "inputs": []
 },
 {
  "type": "error",
  "name": "NotSettleable",
  "inputs": []
 },
 {
  "type": "error",
  "name": "OutsideTerm",
  "inputs": []
 },
 {
  "type": "error",
  "name": "SafeERC20FailedOperation",
  "inputs": [
   {
    "name": "token",
    "type": "address",
    "internalType": "address"
   }
  ]
 },
 {
  "type": "error",
  "name": "SettleFirst",
  "inputs": []
 },
 {
  "type": "error",
  "name": "StringTooLong",
  "inputs": [
   {
    "name": "str",
    "type": "string",
    "internalType": "string"
   }
  ]
 },
 {
  "type": "error",
  "name": "TermIsOver",
  "inputs": []
 },
 {
  "type": "error",
  "name": "TestAlreadyUsed",
  "inputs": []
 },
 {
  "type": "error",
  "name": "TooLate",
  "inputs": []
 }
] as const;

export const testDollarAbi = [
 {
  "type": "function",
  "name": "allowance",
  "inputs": [
   {
    "name": "owner",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "spender",
    "type": "address",
    "internalType": "address"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "approve",
  "inputs": [
   {
    "name": "spender",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "value",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "bool",
    "internalType": "bool"
   }
  ],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "balanceOf",
  "inputs": [
   {
    "name": "account",
    "type": "address",
    "internalType": "address"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "mint",
  "inputs": [
   {
    "name": "to",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "amount",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "totalSupply",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "transfer",
  "inputs": [
   {
    "name": "to",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "value",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "bool",
    "internalType": "bool"
   }
  ],
  "stateMutability": "nonpayable"
 },
 {
  "type": "event",
  "name": "Transfer",
  "inputs": [
   {
    "name": "from",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "to",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "value",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 }
] as const;
