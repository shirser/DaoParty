// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract DaoParty is Ownable {
    // Ссылка на контракт NFT.
    IERC721 public nftContract;

    // Мэппинг для хранения статуса KYC: true - верифицирован, false - не верифицирован.
    mapping(address => bool) public kycVerified;

    struct Proposal {
        string description;
        bool completed;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 deadline; // Timestamp окончания голосования
        mapping(address => bool) voted;
    }

    Proposal[] public proposals;

    event ProposalCreated(uint256 proposalId, string description, uint256 deadline);
    event Voted(uint256 proposalId, address voter, bool support);
    event ProposalFinalized(uint256 proposalId);
    event KycUpdated(address indexed user, bool verified);
    event NftContractUpdated(address indexed nftAddress);

    // Передаём аргумент initialOwner базовому конструктору Ownable.
    // Если используем последнюю версию OpenZeppelin Ownable, в которой конструктор без параметров,
    // можно заменить на: constructor() { }
    constructor(address initialOwner) Ownable(initialOwner) {
        // Дополнительной логики не требуется.
    }

    /**
     * @dev Модификатор, проверяющий, что вызывающий адрес:
     * 1. NFT-контракт установлен;
     * 2. владеет хотя бы одним NFT;
     * 3. прошёл верификацию KYC.
     */
    modifier onlyVerified() {
        require(address(nftContract) != address(0), "NFT contract not set");
        require(nftContract.balanceOf(msg.sender) > 0, "You must own an NFT");
        require(kycVerified[msg.sender], "KYC verification required");
        _;
    }

    /**
     * @dev Функция для установки адреса NFT-контракта.
     * Может вызываться только владельцем.
     * @param _nftAddress адрес NFT-контракта.
     */
    function setNftContract(address _nftAddress) external onlyOwner {
        nftContract = IERC721(_nftAddress);
        emit NftContractUpdated(_nftAddress);
    }

    /**
     * @dev Функция для обновления статуса KYC для пользователя.
     * Может вызываться только владельцем.
     * @param user адрес пользователя.
     * @param verified true, если пользователь верифицирован, иначе false.
     */
    function updateKyc(address user, bool verified) external onlyOwner {
        kycVerified[user] = verified;
        emit KycUpdated(user, verified);
    }

    /**
     * @dev Верифицирует пользователя, используя документ.
     * Проверка выполняется только для внутренних паспортов РФ.
     * Может вызываться только владельцем.
     * @param user адрес пользователя.
     * @param documentType строка, описывающая тип документа.
     * Требуется, чтобы documentType был равен "ВНУТРЕННИЙ ПАСПОРТ РФ".
     */
    function verifyUser(address user, string calldata documentType) external onlyOwner {
        require(
            keccak256(bytes(documentType)) == keccak256(bytes(unicode"ВНУТРЕННИЙ ПАСПОРТ РФ")),
            "Only Russian internal passports are allowed"
        );
        kycVerified[user] = true;
        emit KycUpdated(user, true);
    }

    /**
     * @dev Создаёт новое предложение с заданным периодом голосования.
     * Может вызываться только верифицированными пользователями.
     * @param description Описание предложения.
     * @param votingPeriod Период голосования в секундах (от текущего времени).
     */
    function createProposal(string memory description, uint256 votingPeriod) external onlyVerified {
        proposals.push();
        uint256 proposalId = proposals.length - 1;
        Proposal storage newProposal = proposals[proposalId];
        newProposal.description = description;
        newProposal.completed = false;
        newProposal.votesFor = 0;
        newProposal.votesAgainst = 0;
        newProposal.deadline = block.timestamp + votingPeriod;

        emit ProposalCreated(proposalId, description, newProposal.deadline);
    }

    /**
     * @dev Функция для голосования за предложение.
     * Может вызываться только верифицированными пользователями.
     * @param proposalId Идентификатор предложения.
     * @param support true, если голос "за", false – "против".
     */
    function vote(uint256 proposalId, bool support) external onlyVerified {
        require(proposalId < proposals.length, "Invalid proposal ID");
        Proposal storage p = proposals[proposalId];
        require(!p.completed, "Proposal already finalized");
        require(block.timestamp <= p.deadline, "Voting period has ended");
        require(!p.voted[msg.sender], "Already voted");

        p.voted[msg.sender] = true;
        if (support) {
            p.votesFor++;
        } else {
            p.votesAgainst++;
        }
        emit Voted(proposalId, msg.sender, support);
    }

    /**
     * @dev Завершает голосование по предложению.
     * Может вызываться только владельцем и только после истечения периода голосования.
     * @param proposalId Идентификатор предложения.
     */
    function finalizeProposal(uint256 proposalId) external onlyOwner {
        require(proposalId < proposals.length, "Invalid proposal ID");
        Proposal storage p = proposals[proposalId];
        require(!p.completed, "Proposal already finalized");
        require(block.timestamp > p.deadline, "Voting period is not over yet");

        p.completed = true;
        emit ProposalFinalized(proposalId);
    }

    /**
     * @dev Возвращает данные предложения (без поля voted).
     * @param proposalId Идентификатор предложения.
     */
    function getProposal(uint256 proposalId) external view returns (
        string memory description,
        bool completed,
        uint256 votesFor,
        uint256 votesAgainst,
        uint256 deadline
    ) {
        require(proposalId < proposals.length, "Invalid proposal ID");
        Proposal storage p = proposals[proposalId];
        return (p.description, p.completed, p.votesFor, p.votesAgainst, p.deadline);
    }

    /**
     * @dev Проверяет, голосовал ли конкретный адрес за предложение.
     * @param proposalId Идентификатор предложения.
     * @param voter Адрес проверяемого участника.
     */
    function hasVoted(uint256 proposalId, address voter) external view returns (bool) {
        require(proposalId < proposals.length, "Invalid proposal ID");
        Proposal storage p = proposals[proposalId];
        return p.voted[voter];
    }
}
