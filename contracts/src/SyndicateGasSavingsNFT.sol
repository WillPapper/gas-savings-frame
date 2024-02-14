// SPDX-License-Identifier: MIT
// By Will Papper
// Example NFT contract for the Syndicate Frame API

pragma solidity ^0.8.20;

import {ERC721} from "../lib/openzeppelin-contracts/contracts/token/ERC721//ERC721.sol";
import {Ownable} from "../lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import {Strings} from "../lib/openzeppelin-contracts/contracts/utils/Strings.sol";

contract SyndicateGasSavingsNFT is ERC721, Ownable {
    using Strings for uint256;

    uint256 public currentTokenId = 0;
    // Every X interactions leads to a metadata update. The interaction interval
    // can be updated by the owner as needed
    uint256 public interactionInterval;
    string public baseURI;

    mapping(address authorizedMinter => bool authorized) public authorizedMinters;

    event AuthorizedMinterSet(address indexed minter, bool authorized);
    event BaseTokenURISet(string tokenURI);
    event InteractionIntervalSet(uint256 interval);

    modifier onlyAuthorizedMinter() {
        require(authorizedMinters[msg.sender], "SyndicateGasSavingsNFT: Mint must be triggered by API");
        _;
    }

    // The deployer is set as the initial owner by default. Make sure to
    // transfer this to a Safe or other multisig for long-term use!
    // You can call `transferOwnership` to do this.
    constructor() ERC721("Syndicate Gas Savings NFT", "SAVEGAS") Ownable(msg.sender) {
        // Update this with your own NFT collection's metadata
        // TODO: Set this value
        baseURI = "";
        // Metadata updates evey 1000 interactions
        interactionInterval = 1000;

        // The deployer is set as an authorized minter, allowing them to set up
        // owner mints manually via the contract as needed
        authorizedMinters[msg.sender] = true;
        emit AuthorizedMinterSet(msg.sender, true);

        // Authorize Syndicate's API-based wallet pool as a minter on the
        // Syndicate Frame Chain
        authorizeFrameChainSyndicateAPI();
    }

    function mint(address to) public onlyAuthorizedMinter {
        ++currentTokenId;
        _mint(to, currentTokenId);
    }

    // Set the token URI for all tokens that don't have a custom tokenURI set.
    // Must be called by the owner given its global impact on the collection
    function setBaseURI(string memory _baseURI) public onlyOwner {
        baseURI = _baseURI;
        emit BaseTokenURISet(baseURI);
    }

    function setInteractionInterval(uint256 _interactionInterval) public onlyOwner {
        interactionInterval = _interactionInterval;
        emit InteractionIntervalSet(_interactionInterval);
    }

    function tokenURI(uint256 tokenId) public view virtual override(ERC721) returns (string memory) {
        // Require that the token ID exists before querying it
        _requireOwned(tokenId);

        // Calculate interval for metadata update for all tokens
        // Solidity automatically truncates, so any tokens under the starting interval are 0
        uint256 interval = currentTokenId / interactionInterval;

        return string.concat(baseURI, interval.toString());
    }

    // Only the owner can set authorized minters. True = authorized, false =
    // unauthorized
    function setAuthorizedMinter(address minter, bool authorized) public onlyOwner {
        authorizedMinters[minter] = authorized;

        emit AuthorizedMinterSet(minter, authorized);
    }

    // You can find your wallet address at frame.syndicate.io
    function authorizeFrameChainSyndicateAPI() internal {
        authorizedMinters[0xEb788291f8f33039EfB82530A1a14490930c049B] = true;

        emit AuthorizedMinterSet(0xEb788291f8f33039EfB82530A1a14490930c049B, true);
    }

    // This function ensures that ETH sent directly to the contract by mistake
    // is rejected
    fallback() external payable {
        revert("SyndicateGasSavingsNFT: Does not accept ETH");
    }
}
