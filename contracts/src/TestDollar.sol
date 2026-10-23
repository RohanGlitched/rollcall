// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @notice A test dollar for the Roll Call demo on a public testnet. It has no value.
/// The owner (the demo's house wallet) mints it to fund demo terms.
contract TestDollar is ERC20, ERC20Permit {
    address public immutable owner;

    error NotOwner();

    constructor(address owner_) ERC20("Roll Call Test Dollar", "tUSD") ERC20Permit("Roll Call Test Dollar") {
        owner = owner_;
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        if (msg.sender != owner) revert NotOwner();
        _mint(to, amount);
    }
}
