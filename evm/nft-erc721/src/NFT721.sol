// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.6.0
pragma solidity 0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

error EmptyURI();
error ZeroAddress();
error RolesNotSeparated();

contract ERC1155Token is ERC1155, AccessControl {
    /// @notice Role identifier for accounts permitted to update the token metadata URI
    bytes32 public constant URI_SETTER_ROLE = keccak256("URI_SETTER_ROLE");

    /// @notice Role identifier for accounts permitted to mint tokens
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @dev Ensures the provided address is not the zero address
    /// @param input The address to validate
    modifier checkAddress(address input) {
        if(input == address(0)) revert ZeroAddress();
        _;
    }

    /// @dev Ensures two role addresses are not identical
    /// @param input1 The first address to compare
    /// @param input2 The second address to compare
    modifier checkRoles(address input1, address input2) {
        if(input1 == input2) revert RolesNotSeparated();
        _;
    }

    /// @notice Deploys the ERC1155Token contract and assigns all three roles
    /// @param defaultAdmin Address granted DEFAULT_ADMIN_ROLE
    /// @param minter Address granted MINTER_ROLE
    /// @param uriSetter Address granted URI_SETTER_ROLE
    constructor(address defaultAdmin, address minter, address uriSetter) 
    ERC1155("") 
    checkAddress(defaultAdmin) 
    checkAddress(minter) 
    checkAddress(uriSetter)
    checkRoles(defaultAdmin, minter)
    checkRoles(defaultAdmin, uriSetter)
    checkRoles(minter, uriSetter) {
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, minter);
        _grantRole(URI_SETTER_ROLE, uriSetter);

    }

    /// @notice Updates the base metadata URI for all token types
    /// @dev URI should follow ERC-1155 metadata standard where `{id}` is
    /// substituted by clients with the token ID e.g. "ipfs://QmHash/{id}.json"
    /// @param newuri The new base URI string to set
    function setURI(string memory newuri) public onlyRole(URI_SETTER_ROLE) {
        if(bytes(newuri).length == 0) revert EmptyURI();
        _setURI(newuri);
    }

    /// @notice Mints a specified amount of a single token type to an address
    /// @dev If `account` is a contract it must implement `onERC1155Received`
    /// @param account Address to receive the minted tokens
    /// @param id Token ID to mint
    /// @param amount Quantity of tokens to mint
    /// @param data Additional data passed to the receiver hook
    function mint(address account, uint256 id, uint256 amount, bytes memory data)
        public
        onlyRole(MINTER_ROLE)
    {
        _mint(account, id, amount, data);
    }

    /// @notice Mints multiple token types to a single address in one transaction
    /// @dev `ids` and `amounts` must be equal length arrays. If `to` is a contract
    /// it must implement `onERC1155BatchReceived`
    /// @param to Address to receive all minted tokens
    /// @param ids Array of token IDs to mint
    /// @param amounts Array of quantities corresponding to each token ID
    /// @param data Additional data passed to the receiver hook
    function mintBatch(address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data)
        public
        onlyRole(MINTER_ROLE)
    {
        _mintBatch(to, ids, amounts, data);
    }

    /// @notice Checks if the contract supports an interface
    /// @param interfaceId Interface identifier
    /// @return True if supported
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
