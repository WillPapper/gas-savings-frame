// SPDX-License-Identifier: MIT
// By Will Papper
// Example NFT contract for the Syndicate Frame API
// Deployed on the Syndicate Frame Chain at 0xa4d2e7e997A837e6CB6Cf0C1607D93955C31AF7a
// Wallets in wallet pool are:
// 0xa027cb4e5c487470e2b296041bcf02adeba0dfa1
// 0x8976c7643e853be50312a9b421a2400f129b5f2e
// 0xa0047267957b069874b336303302d48a9eaeb9ec
// 0xb434d8c1dac71ad18dfd1d130e745e6f16e1f37a
// 0x54b6750d18a0a922f8ecdf4bd249884f700913db

pragma solidity ^0.8.20;

import {ERC721} from "../lib/openzeppelin-contracts/contracts/token/ERC721//ERC721.sol";
import {Ownable} from "../lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import {Strings} from "../lib/openzeppelin-contracts/contracts/utils/Strings.sol";
import {Counter} from "./Counter.sol";

contract SyndicateGasSavingsNFT is ERC721, Ownable {
    using Strings for uint256;

    uint256 public currentTokenId = 0;
    string public baseURI;

    mapping(address authorizedMinter => bool authorized) public authorizedMinters;
    mapping(uint256 tokenId => string data) public dataStore;
    string public constant DATA_TO_STORE = "This is a string stored on Syndicate's L3!";

    event AuthorizedMinterSet(address indexed minter, bool authorized);
    event BaseTokenURISet(string tokenURI);
    event DataStored(uint256 tokenId, string data);
    event ContractDeployed(address indexed contractAddress);

    modifier onlyAuthorizedMinter() {
        require(authorizedMinters[msg.sender], "SyndicateGasSavingsNFT: Mint must be triggered by API");
        _;
    }

    // The deployer is set as the initial owner by default. Make sure to
    // transfer this to a Safe or other multisig for long-term use!
    // You can call `transferOwnership` to do this.
    constructor() ERC721("Syndicate Gas Savings NFT", "SAVEGAS") Ownable(msg.sender) {
        // Update this with your own NFT collection's metadata
        baseURI = "https://gas-savings-frame.syndicate.io/metadata/";

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

    function storeData(address to) public onlyAuthorizedMinter {
        ++currentTokenId;
        dataStore[currentTokenId] = DATA_TO_STORE;
        _mint(to, currentTokenId);

        emit DataStored(currentTokenId, DATA_TO_STORE);
    }

    function deployContract(address to) public onlyAuthorizedMinter {
        ++currentTokenId;
        Counter counter = new Counter();
        _mint(to, currentTokenId);

        emit ContractDeployed(address(counter));
    }

    // Set the token URI for all tokens that don't have a custom tokenURI set.
    // Must be called by the owner given its global impact on the collection
    function setBaseURI(string memory _baseURI) public onlyOwner {
        baseURI = _baseURI;
        emit BaseTokenURISet(baseURI);
    }

    function tokenURI(uint256 tokenId) public view virtual override(ERC721) returns (string memory) {
        // Require that the token ID exists before querying it
        _requireOwned(tokenId);

        return string.concat(baseURI, currentTokenId.toString());
    }

    // Only the owner can set authorized minters. True = authorized, false =
    // unauthorized
    function setAuthorizedMinter(address minter, bool authorized) public onlyOwner {
        authorizedMinters[minter] = authorized;

        emit AuthorizedMinterSet(minter, authorized);
    }

    // You can find your wallet address at frame.syndicate.io
    function authorizeFrameChainSyndicateAPI() internal {
        authorizedMinters[0xA027cB4E5C487470E2b296041Bcf02adEBa0dfA1] = true;
        authorizedMinters[0x8976c7643E853bE50312a9B421A2400f129b5F2e] = true;
        authorizedMinters[0xa0047267957B069874B336303302d48a9eaEb9eC] = true;
        authorizedMinters[0xB434d8c1dac71aD18DFD1d130E745e6F16e1f37A] = true;
        authorizedMinters[0x54b6750d18A0A922f8ecDF4bD249884F700913DB] = true;

        emit AuthorizedMinterSet(0xA027cB4E5C487470E2b296041Bcf02adEBa0dfA1, true);
        emit AuthorizedMinterSet(0x8976c7643E853bE50312a9B421A2400f129b5F2e, true);
        emit AuthorizedMinterSet(0xa0047267957B069874B336303302d48a9eaEb9eC, true);
        emit AuthorizedMinterSet(0xB434d8c1dac71aD18DFD1d130E745e6F16e1f37A, true);
        emit AuthorizedMinterSet(0x54b6750d18A0A922f8ecDF4bD249884F700913DB, true);
    }

    // This function ensures that ETH sent directly to the contract by mistake
    // is rejected
    fallback() external payable {
        revert("SyndicateGasSavingsNFT: Does not accept ETH");
    }
}
