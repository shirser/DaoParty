// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./VotingLib.sol";  // Библиотека для проверки финализации голосования
import "hardhat/console.sol"; // Для отладки (Hardhat)

// Интерфейс KYCManager:
interface IKYCManager {
    function kycVerified(address user) external view returns (bool);
    function kycExpiry(address user) external view returns (uint256);
    function kycProviders(address provider) external view returns (bool);
}

contract DaoParty is Ownable {
    // Адрес контракта NFT
    IERC721 public nftContract;

    // Переменная для хранения адреса KYCManager
    IKYCManager public kycManager;

    // Конструктор: задаёт владельца и адрес KYCManager
    constructor(address initialOwner, address _kycManager) Ownable(initialOwner) {
        kycManager = IKYCManager(_kycManager);
    }

    // Функция для установки адреса NFT-контракта (только владелец)
    function setNftContract(address _nftAddress) external onlyOwner {
        nftContract = IERC721(_nftAddress);
        emit NftContractUpdated(_nftAddress);
    }

    event NftContractUpdated(address indexed nftAddress);

    // Модификатор, разрешающий вызов функции только верифицированным пользователям
    modifier onlyVerified() {
        require(kycManager.kycVerified(msg.sender), "User is not KYC verified");
        _;
    }

    // Функция‑геттер для проверки KYC-верификации пользователя
    function isKycVerified(address user) external view returns (bool) {
        return kycManager.kycVerified(user);
    }

    // ====================================================================
    // Функционал, связанный с предложениями (Proposals)
    // ====================================================================

    // Структура для хранения информации о предложении
    struct Proposal {
        address proposer;
        string description;
        uint256 votingDeadline;
        uint256 votesFor;
        uint256 votesAgainst;
        bool finalized;
    }

    // Событие, эмитируемое при создании предложения
    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string description, uint256 votingDeadline);

    // Переменные для хранения предложений
    uint256 public nextProposalId = 1;
    mapping(uint256 => Proposal) public proposals;

    /// @notice Создает новое предложение. Доступно только для верифицированных пользователей.
    /// @param description Описание предложения.
    /// @param votingDuration Продолжительность голосования в секундах (должна быть > 0).
    /// @return proposalId Уникальный идентификатор созданного предложения.
    function createProposal(string memory description, uint256 votingDuration) external onlyVerified returns (uint256) {
        require(votingDuration > 0, "Voting duration must be greater than 0");

        uint256 proposalId = nextProposalId++;
        Proposal storage proposal = proposals[proposalId];

        proposal.proposer = msg.sender;
        proposal.description = description;
        proposal.votingDeadline = block.timestamp + votingDuration;
        proposal.votesFor = 0;
        proposal.votesAgainst = 0;
        proposal.finalized = false;

        emit ProposalCreated(proposalId, msg.sender, description, proposal.votingDeadline);
        return proposalId;
    }

    /*
    // Остальной функционал (голосование, финализация и т.д.) будет добавлен позже.
    */
}
