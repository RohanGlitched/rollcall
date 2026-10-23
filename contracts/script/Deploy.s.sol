// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {RollCall} from "../src/RollCall.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// Deploys Roll Call v2 against the existing test dollar (TEST_DOLLAR env).
contract Deploy is Script {
    function run() external {
        uint256 key = vm.envUint("HOUSE_KEY");
        address usd = vm.envAddress("TEST_DOLLAR");
        vm.startBroadcast(key);
        RollCall rc = new RollCall(IERC20(usd));
        vm.stopBroadcast();
        console.log("RollCall", address(rc));
    }
}
