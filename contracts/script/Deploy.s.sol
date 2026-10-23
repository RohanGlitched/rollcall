// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {RollCall} from "../src/RollCall.sol";
import {TestDollar} from "../src/TestDollar.sol";

/// Deploys the test dollar and Roll Call. The house key owns the test dollar and is the attester.
contract Deploy is Script {
    function run() external {
        uint256 key = vm.envUint("HOUSE_KEY");
        address house = vm.addr(key);
        vm.startBroadcast(key);
        TestDollar usd = new TestDollar(house);
        RollCall rc = new RollCall(usd, house);
        vm.stopBroadcast();
        console.log("TestDollar", address(usd));
        console.log("RollCall", address(rc));
    }
}
