// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./VotingLib.sol";  // Библиотека для проверки финализации голосования

// Интерфейс для доступа к данным KYC, реализованным в KYCManager.sol
interface IKYCManager {
    function kycVerified(address user) external view returns (bool);
    function kycExpiry(address user) external view returns (uint256);
}

contract DaoParty is Ownable {
    // Ссылка на контракт NFT.
    IERC721 public nftContract;

    // Интерфейс KYC-модуля.
    IKYCManager public kycManager;

    // Максимальное количество голосующих (может задаваться владельцем)
    uint256 public maxVoters;

    // Ограничение частоты создания предложений: timestamp последнего создания предложения для каждого пользователя.
    mapping(address => uint256) public lastProposalTimestamp;

    // -------------------------
    // Обычные предложения (за/против)
    // -------------------------
    struct Proposal {
        string description;
        bool completed;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 deadline;  // Timestamp окончания голосования
        uint256 likes;
        bool openForVoting;
        mapping(address => bool) voted;
        mapping(address => bool) liked;
    }
    Proposal[] public proposals;

    event ProposalCreated(uint256 proposalId, string description, uint256 deadline);
    event Voted(uint256 proposalId, address voter, bool support);
    event ProposalFinalized(uint256 proposalId);
    event ProposalOpen(uint256 proposalId);

    // -------------------------
    // Голосование за изменение состава администраторов
    // -------------------------
    mapping(address => bool) public admins;

    struct AdminProposal {
        address adminCandidate;
        bool toAdd;
        string description;
        bool completed;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 deadline;
        mapping(address => bool) voted;
    }
    AdminProposal[] public adminProposals;

    event AdminProposalCreated(
        uint256 proposalId,
        address adminCandidate,
        bool toAdd,
        string description,
        uint256 deadline
    );
    event AdminVoted(uint256 proposalId, address voter, bool support);
    event AdminProposalFinalized(uint256 proposalId, bool approved);

    // -------------------------
    // Многовариантное голосование
    // -------------------------
    struct MultiOptionProposal {
        string description;
        bool completed;
        uint256 deadline;
        string[] options;
        // votes: ключ – индекс варианта, значение – количество голосов за этот вариант
        mapping(uint256 => uint256) votes;
        mapping(address => bool) voted;
    }
    MultiOptionProposal[] public multiOptionProposals;

    event MultiOptionProposalCreated(
        uint256 proposalId,
        string description,
        uint256 deadline,
        string[] options
    );
    event MultiOptionVoted(uint256 proposalId, address voter, uint256 optionIndex);
    event MultiOptionProposalFinalized(uint256 proposalId, uint256 winningOption);

    // -------------------------
    // Модификатор, проверяющий, что:
    // 1. NFT-контракт установлен;
    // 2. Пользователь владеет хотя бы одним NFT;
    // 3. Пользователь прошёл KYC (через внешний KYCManager) и срок верификации не истёк.
    // -------------------------
    modifier onlyVerified() {
        require(address(nftContract) != address(0), "NFT contract not set");
        require(nftContract.balanceOf(msg.sender) > 0, "You must own an NFT");
        require(kycManager.kycVerified(msg.sender), "KYC verification required");
        require(kycManager.kycExpiry(msg.sender) > block.timestamp, "KYC expired");
        _;
    }

    // -------------------------
    // Конструктор: задаём владельца и адрес KYCManager
    // -------------------------
    constructor(address initialOwner, address _kycManager) Ownable(initialOwner) {
        kycManager = IKYCManager(_kycManager);
        admins[initialOwner] = true;
    }

    // Функция для установки адреса NFT-контракта (только владелец)
    function setNftContract(address _nftAddress) external onlyOwner {
        nftContract = IERC721(_nftAddress);
        emit NftContractUpdated(_nftAddress);
    }
    event NftContractUpdated(address indexed nftAddress);

    // Функция для установки максимального числа голосующих (только владелец)
    function setMaxVoters(uint256 _maxVoters) external onlyOwner {
        maxVoters = _maxVoters;
    }

    // -------------------------
    // Функции для работы с обычными предложениями
    // -------------------------
    /// @notice Создание обычного предложения (за/против)
    /// Ограничение: пользователь может создавать не более одного предложения в 30 дней.
    function createProposal(string memory description, uint256 votingPeriod) external onlyVerified returns (bool) {
        require(
            lastProposalTimestamp[msg.sender] == 0 ||
            block.timestamp >= lastProposalTimestamp[msg.sender] + 2592000,
            "You can only create one proposal every 30 days"
        );
        lastProposalTimestamp[msg.sender] = block.timestamp;

        proposals.push();
        uint256 proposalId = proposals.length - 1;
        Proposal storage p = proposals[proposalId];
        p.description = description;
        p.completed = false;
        p.votesFor = 0;
        p.votesAgainst = 0;
        p.deadline = block.timestamp + votingPeriod;
        p.likes = 0;
        p.openForVoting = false;

        emit ProposalCreated(proposalId, description, p.deadline);
        return true;
    }

    /// @notice Голосование за обычное предложение (за/против)
    function vote(uint256 proposalId, bool support) external onlyVerified {
        require(proposalId < proposals.length, "Invalid proposal ID");
        Proposal storage p = proposals[proposalId];
        require(p.openForVoting, "Proposal is not open for voting");
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

        // Используем библиотечную функцию для проверки досрочной финализации
        if (VotingLib.canFinalize(p.votesFor, p.votesAgainst, maxVoters)) {
            p.completed = true;
            emit ProposalFinalized(proposalId);
        }
    }

    /// @notice Финализация обычного предложения (только владелец)
    function finalizeProposal(uint256 proposalId) external onlyOwner {
        require(proposalId < proposals.length, "Invalid proposal ID");
        Proposal storage p = proposals[proposalId];
        require(!p.completed, "Proposal already finalized");
        require(block.timestamp > p.deadline, "Voting period is not over yet");

        p.completed = true;
        emit ProposalFinalized(proposalId);
    }

    /// @notice Получение информации о предложении
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

    /// @notice Проверка, голосовал ли указанный адрес по предложению
    function hasVoted(uint256 proposalId, address voter) external view returns (bool) {
        require(proposalId < proposals.length, "Invalid proposal ID");
        Proposal storage p = proposals[proposalId];
        return p.voted[voter];
    }

    /// @notice Функция для лайка предложения. При достижении порога (1% от maxVoters) предложение открывается для голосования.
    function likeProposal(uint256 proposalId) external onlyVerified returns (bool) {
        require(proposalId < proposals.length, "Invalid proposal ID");
        Proposal storage p = proposals[proposalId];
        require(!p.liked[msg.sender], "You already liked this proposal");
        p.liked[msg.sender] = true;
        p.likes++;

        if (maxVoters > 0 && p.likes * 100 >= maxVoters) {
            p.openForVoting = true;
            emit ProposalOpen(proposalId);
        }
        return true;
    }

    // -------------------------
    // Функции для административного голосования
    // -------------------------
    /// @notice Создание административного предложения (изменение состава администраторов)
    function proposeAdminChange(
        address adminCandidate,
        bool toAdd,
        string calldata description,
        uint256 votingPeriod
    ) external onlyVerified returns (uint256) {
        if (toAdd) {
            require(!admins[adminCandidate], "Address is already an admin");
        } else {
            require(admins[adminCandidate], "Address is not an admin");
        }

        adminProposals.push();
        uint256 proposalId = adminProposals.length - 1;
        AdminProposal storage ap = adminProposals[proposalId];
        ap.adminCandidate = adminCandidate;
        ap.toAdd = toAdd;
        ap.description = description;
        ap.completed = false;
        ap.votesFor = 0;
        ap.votesAgainst = 0;
        ap.deadline = block.timestamp + votingPeriod;

        emit AdminProposalCreated(proposalId, adminCandidate, toAdd, description, ap.deadline);
        return proposalId;
    }

    /// @notice Голосование по административному предложению
    function voteAdminProposal(uint256 proposalId, bool support) external onlyVerified {
        require(proposalId < adminProposals.length, "Invalid proposal ID");
        AdminProposal storage ap = adminProposals[proposalId];
        require(!ap.completed, "Proposal already finalized");
        require(block.timestamp <= ap.deadline, "Voting period has ended");
        require(!ap.voted[msg.sender], "Already voted");

        ap.voted[msg.sender] = true;
        if (support) {
            ap.votesFor++;
        } else {
            ap.votesAgainst++;
        }
        emit AdminVoted(proposalId, msg.sender, support);

        if (maxVoters > 0) {
            uint256 totalVotes = ap.votesFor + ap.votesAgainst;
            uint256 remaining = (maxVoters > totalVotes) ? (maxVoters - totalVotes) : 0;
            if (ap.votesFor >= ap.votesAgainst && ap.votesFor - ap.votesAgainst > remaining) {
                _finalizeAdminProposal(proposalId);
            } else if (ap.votesAgainst > ap.votesFor && ap.votesAgainst - ap.votesFor > remaining) {
                _finalizeAdminProposal(proposalId);
            }
        }
    }

    /// @notice Финализация административного предложения (только владелец)
    function finalizeAdminProposal(uint256 proposalId) external onlyOwner {
        require(proposalId < adminProposals.length, "Invalid proposal ID");
        AdminProposal storage ap = adminProposals[proposalId];
        require(!ap.completed, "Proposal already finalized");
        require(block.timestamp > ap.deadline, "Voting period is not over yet");
        _finalizeAdminProposal(proposalId);
    }

    /// @dev Внутренняя функция финализации административного предложения.
    function _finalizeAdminProposal(uint256 proposalId) internal {
        AdminProposal storage ap = adminProposals[proposalId];
        if (ap.completed) return;
        ap.completed = true;
        bool approved = (ap.votesFor > ap.votesAgainst);
        if (approved) {
            if (ap.toAdd) {
                admins[ap.adminCandidate] = true;
            } else {
                admins[ap.adminCandidate] = false;
            }
        }
        emit AdminProposalFinalized(proposalId, approved);
    }

    // -------------------------
    // Функции для многовариантного голосования
    // -------------------------
    /// @notice Создание многовариантного предложения
    function createMultiOptionProposal(string memory description, string[] memory options, uint256 votingPeriod) external onlyVerified returns (uint256) {
        require(options.length > 1, "At least two options required");
        multiOptionProposals.push();
        uint256 proposalId = multiOptionProposals.length - 1;
        MultiOptionProposal storage mop = multiOptionProposals[proposalId];
        mop.description = description;
        mop.completed = false;
        mop.deadline = block.timestamp + votingPeriod;
        for (uint256 i = 0; i < options.length; i++) {
            mop.options.push(options[i]);
        }
        emit MultiOptionProposalCreated(proposalId, description, mop.deadline, options);
        return proposalId;
    }

    /// @notice Голосование за вариант в многовариантном предложении
    function voteMultiOption(uint256 proposalId, uint256 optionIndex) external onlyVerified {
        require(proposalId < multiOptionProposals.length, "Invalid proposal ID");
        MultiOptionProposal storage mop = multiOptionProposals[proposalId];
        require(!mop.completed, "Proposal already finalized");
        require(block.timestamp <= mop.deadline, "Voting period has ended");
        require(optionIndex < mop.options.length, "Invalid option index");
        require(!mop.voted[msg.sender], "Already voted");

        mop.voted[msg.sender] = true;
        mop.votes[optionIndex] += 1;
        emit MultiOptionVoted(proposalId, msg.sender, optionIndex);
    }

    /// @notice Финализация многовариантного предложения (только владелец)
    function finalizeMultiOptionProposal(uint256 proposalId) external onlyOwner {
        require(proposalId < multiOptionProposals.length, "Invalid proposal ID");
        MultiOptionProposal storage mop = multiOptionProposals[proposalId];
        require(!mop.completed, "Proposal already finalized");
        require(block.timestamp > mop.deadline, "Voting period is not over yet");
        mop.completed = true;
        uint256 winningOption;
        uint256 highestVotes = 0;
        for (uint256 i = 0; i < mop.options.length; i++) {
            if (mop.votes[i] > highestVotes) {
                highestVotes = mop.votes[i];
                winningOption = i;
            }
        }
        emit MultiOptionProposalFinalized(proposalId, winningOption);
    }
}
