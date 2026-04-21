// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";


error NullAddress();
error InvalidFee(uint256 _fee);
error NoURI();


contract NFT721 is ERC721, ERC721Enumerable, ERC721URIStorage, ERC2981, Ownable {
    /// @dev Tracks the next token ID to be minted
    uint256 private _nextTokenId;

    /// @notice Emitted when default royalty is updated
    /// @param _royaltyReceiver Address receiving royalty
    /// @param _feeNumerator Royalty fee in basis points
    event DefaultRoyaltyUpdate(address _royaltyReceiver, uint96 _feeNumerator);

    /// @dev Ensures royalty fee is within valid range (<= 10000 basis points)
    /// @param _fee Royalty fee in basis points
    modifier checkFee(uint96 _fee) {
        if(_fee > 10000) revert InvalidFee(_fee);
        _;
    }

    /// @notice Initializes the NFT contract
    /// @param name Name of the NFT collection
    /// @param symbol Symbol of the NFT collection
    /// @param initialOwner Address that will own the contract
    /// @param defaultFee Default royalty fee in basis points (10000 = 100%)
    constructor(
        string memory name,
        string memory symbol,
        address initialOwner,
        uint96 defaultFee
    )
        ERC721(name, symbol)
        Ownable(initialOwner)
        checkFee(defaultFee)
    {
        _setDefaultRoyalty(initialOwner, defaultFee);
    }

    /// @notice Mints a new NFT
    /// @dev Uses safe minting to prevent tokens from being locked in contracts
    /// @param to Address receiving the NFT
    /// @param uri Metadata URI of the NFT
    /// @param royaltyReceiver Address receiving royalties (optional)
    /// @param feeNumerator Royalty fee in basis points
    /// @return tokenId The ID of the newly minted token
    function safeMint(
        address to,
        string memory uri,
        address royaltyReceiver,
        uint96 feeNumerator
    )
        public
        onlyOwner
        checkFee(feeNumerator)
        returns (uint256)
    {
        if(bytes(uri).length == 0) revert NoURI();
        if(royaltyReceiver == address(0)) {
            if(feeNumerator != 0) revert InvalidFee(feeNumerator);
        } else {
            if(feeNumerator == 0) revert InvalidFee(feeNumerator);
        }
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        if(royaltyReceiver != address(0)){
            _setTokenRoyalty(tokenId, royaltyReceiver, feeNumerator);
        }

        return tokenId;
    }

    /// @notice Updates the default royalty for all tokens
    /// @param royaltyReceiver Address receiving royalties
    /// @param feeNumerator Royalty fee in basis points
    function setDefaultRoyalty(
        address royaltyReceiver,
        uint96 feeNumerator
    )
        public
        checkFee(feeNumerator)
        onlyOwner
    {
        if(royaltyReceiver == address(0)) revert NullAddress();

        _setDefaultRoyalty(royaltyReceiver, feeNumerator);
        emit DefaultRoyaltyUpdate(royaltyReceiver, feeNumerator);
    }

    /// @dev Handles ownership updates for transfers, minting, and burning
    /// @param to Address receiving the token
    /// @param tokenId Token ID being updated
    /// @param auth Address initiating the update
    /// @return previousOwner Address of the previous owner
    function _update(
        address to,
        uint256 tokenId,
        address auth
    )
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    /// @dev Updates balance accounting for enumeration
    /// @param account Address whose balance is updated
    /// @param value Amount added to balance
    function _increaseBalance(
        address account,
        uint128 value
    )
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    /// @notice Returns the metadata URI for a token
    /// @param tokenId Token ID
    /// @return URI Metadata URI of the token
    function tokenURI(
        uint256 tokenId
    )
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    /// @notice Checks if the contract supports an interface
    /// @param interfaceId Interface identifier
    /// @return True if supported
    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC721, ERC2981, ERC721Enumerable, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}