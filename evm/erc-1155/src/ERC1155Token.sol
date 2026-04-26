// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.6.0
pragma solidity 0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";


error EmptyURI();
error ZeroAddress();
error RolesNotSeparated();

/// @title ERC1155Token
/// @notice A multi-token contract implementing ERC-1155 with role-based access control.
/// @dev Inherits OpenZeppelin's ERC1155 and AccessControl. Three distinct roles are
/// required at deployment — admin, minter, and URI setter — and must be separate addresses.
contract ERC1155Token is ERC1155, AccessControl {

    /// @notice Role identifier for accounts permitted to update the token metadata URI.
    /// @dev Computed as keccak256("URI_SETTER_ROLE"). Granted at construction.
    bytes32 public constant URI_SETTER_ROLE = keccak256("URI_SETTER_ROLE");

    /// @notice Role identifier for accounts permitted to mint tokens.
    /// @dev Computed as keccak256("MINTER_ROLE"). Granted at construction.
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @notice Ensures the provided address is not the zero address.
    /// @dev Applied to each constructor argument individually.
    /// @param input The address to validate.
    modifier checkAddress(address input) {
        if (input == address(0)) revert ZeroAddress();
        _;
    }

    /// @notice Ensures two role addresses are not identical.
    /// @dev Prevents a single address from holding multiple roles at deployment,
    /// which would defeat the purpose of role separation.
    /// @param input1 The first address to compare.
    /// @param input2 The second address to compare.
    modifier checkRoles(address input1, address input2) {
        if (input1 == input2) revert RolesNotSeparated();
        _;
    }

    /// @notice Deploys the ERC1155Token contract and assigns all three roles.
    /// @dev Each address is validated to be non-zero and distinct from the others
    /// before roles are granted. The base URI is initialized as empty and must
    /// be set after deployment via `setURI`.
    /// @param defaultAdmin The address granted DEFAULT_ADMIN_ROLE. Can manage all roles.
    /// @param minter The address granted MINTER_ROLE. Can mint and batch mint tokens.
    /// @param uriSetter The address granted URI_SETTER_ROLE. Can update the base metadata URI.
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

    /// @notice Updates the base metadata URI for all token types.
    /// @dev Caller must have URI_SETTER_ROLE. The URI should follow the ERC-1155
    /// metadata standard where `{id}` is substituted by clients with the token ID.
    /// Example: "ipfs://QmYourHash/{id}.json"
    /// Reverts with `EmptyURI` if an empty string is provided.
    /// @param newuri The new base URI string to set.
    function setURI(string memory newuri) public onlyRole(URI_SETTER_ROLE) {
        if (bytes(newuri).length == 0) revert EmptyURI();
        _setURI(newuri);
    }

    /// @notice Mints a specified amount of a single token type to an address.
    /// @dev Caller must have MINTER_ROLE. Reverts with `ERC1155InvalidReceiver`
    /// if `account` is address(0). If `account` is a contract, it must implement
    /// `onERC1155Received` or the transaction will revert.
    /// @param account The address to receive the minted tokens.
    /// @param id The token ID to mint.
    /// @param amount The quantity of tokens to mint.
    /// @param data Additional data passed to the receiver hook if `account` is a contract.
    function mint(address account, uint256 id, uint256 amount, bytes memory data)
        public
        onlyRole(MINTER_ROLE)
    {
        _mint(account, id, amount, data);
    }

    /// @notice Mints multiple token types to a single address in one transaction.
    /// @dev Caller must have MINTER_ROLE. `ids` and `amounts` must be equal length arrays —
    /// reverts with `ERC1155InvalidArrayLength` otherwise. More gas efficient than
    /// calling `mint` multiple times. If `to` is a contract, it must implement
    /// `onERC1155BatchReceived` or the transaction will revert.
    /// @param to The address to receive all minted tokens.
    /// @param ids Array of token IDs to mint.
    /// @param amounts Array of quantities corresponding to each token ID.
    /// @param data Additional data passed to the receiver hook if `to` is a contract.
    function mintBatch(address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data)
        public
        onlyRole(MINTER_ROLE)
    {
        _mintBatch(to, ids, amounts, data);
    }

    /// @notice Returns true if this contract implements the given interface.
    /// @dev Required override to resolve the diamond inheritance conflict between
    /// ERC1155 and AccessControl, both of which implement ERC-165 supportsInterface.
    /// Supported interfaces include ERC-1155, ERC-1155 MetadataURI, AccessControl, and ERC-165.
    /// @param interfaceId The ERC-165 interface identifier to check.
    /// @return bool True if the interface is supported, false otherwise.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
