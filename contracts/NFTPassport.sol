// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title NFTPassport
 * @dev Смарт-контракт для выпуска NFT-паспортов.
 */
contract NFTPassport is ERC721, Ownable {
    uint256 private _tokenIds;

    // Хранение данных о паспортах
    mapping(address => bool) public hasPassportMapping;
    mapping(address => uint256) private userPassports; // Теперь сразу храним ID паспорта

    constructor() ERC721("DAO Party Passport", "DPP") Ownable(msg.sender) {}

    /**
     * @dev Проверяет, есть ли у пользователя NFT-паспорт.
     */
    function hasPassport(address user) public view returns (bool) {
        return hasPassportMapping[user];
    }

    /**
     * @dev Выпускает NFT-паспорт для пользователя.
     */
    function mintPassport(address user) external onlyOwner {
        require(!hasPassportMapping[user], "User already has a passport");
        
        _tokenIds += 1;
        uint256 newPassportId = _tokenIds;
        _safeMint(user, newPassportId);
        hasPassportMapping[user] = true;
        userPassports[user] = newPassportId; // Запоминаем ID паспорта
    }

    /**
     * @dev Возвращает ID NFT-паспорта для пользователя.
     */
    function getUserPassport(address user) external view returns (uint256) {
        require(hasPassportMapping[user], "User does not have a passport");
        return userPassports[user]; // Теперь просто возвращаем сохранённый ID
    }

    /**
     * @dev Возвращает общее количество выпущенных NFT-паспортов.
     */
    function totalSupply() external view returns (uint256) {
        return _tokenIds;
    }
}
