// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract DaoParty is Ownable {
    // Ссылка на контракт NFT.
    IERC721 public nftContract;

    // Мэппинг для хранения статуса KYC: true - верифицирован, false - не верифицирован.
    mapping(address => bool) public kycVerified;
    // Хранение даты истечения KYC для каждого пользователя.
    mapping(address => uint256) public kycExpiry;
    // (Опционально) Хранение типа документа для каждого пользователя.
    mapping(address => string) public kycDocumentType;
    // Период валидности KYC (например, 30 дней = 2592000 секунд).
    uint256 public constant KYC_VALIDITY_PERIOD = 2592000;

    // Максимальное количество голосующих (может задаваться владельцем)
    uint256 public maxVoters;

    // --- Новый функционал для доверенных KYC-провайдеров ---
    // Мэппинг доверенных KYC-провайдеров.
    mapping(address => bool) public kycProviders;

    // Модификатор, разрешающий вызов только владельцу или доверенным KYC-провайдерам.
    modifier onlyKycProvider() {
        require(kycProviders[msg.sender] || msg.sender == owner(), "Not an authorized KYC provider");
        _;
    }

    // Функция для добавления доверенного KYC-провайдера. Вызывается только владельцем.
    function addKycProvider(address provider) external onlyOwner {
        kycProviders[provider] = true;
    }

    // Функция для удаления доверенного KYC-провайдера. Вызывается только владельцем.
    function removeKycProvider(address provider) external onlyOwner {
        kycProviders[provider] = false;
    }
    // -----------------------------------------------

    // --- Новый функционал для проверки уникальности идентификатора ---
    // Мэппинг для хранения использованных идентификаторов (например, faceId).
    mapping(string => bool) public usedIdentifiers;
    // Мэппинг для хранения идентификатора для каждого пользователя.
    mapping(address => string) public userIdentifier;
    // -------------------------------------------------------------------

    // Новый мэппинг для ограничения частоты создания предложений:
    // Хранит timestamp последнего создания предложения для каждого пользователя.
    mapping(address => uint256) public lastProposalTimestamp;

    // Структура обычного предложения
    struct Proposal {
        string description;
        bool completed;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 deadline; // Timestamp окончания голосования
        uint256 likes;         // Новое поле: количество лайков
        bool openForVoting;    // Новое поле: предложение открыто для голосования
        mapping(address => bool) voted;
        mapping(address => bool) liked; // Новое поле: отслеживание лайков
    }

    Proposal[] public proposals;

    event ProposalCreated(uint256 proposalId, string description, uint256 deadline);
    event Voted(uint256 proposalId, address voter, bool support);
    event ProposalFinalized(uint256 proposalId);
    // Новое событие: предложение открыто для голосования
    event ProposalOpen(uint256 proposalId);
    // Обновлено событие KycUpdated: добавлен параметр documentType (можно использовать пустую строку, если не требуется)
    event KycUpdated(address indexed user, bool verified, uint256 expiry, string documentType);
    event NftContractUpdated(address indexed nftAddress);
    // Событие для запроса на повторную верификацию (аннулирование старых данных)
    event KycResetRequested(address indexed user);

    // --- Новый функционал для голосования по изменению состава администраторов ---
    // Мэппинг для хранения текущих администраторов.
    // Владелец (initialOwner) при деплое может быть добавлен в качестве администратора.
    mapping(address => bool) public admins;

    // Структура предложения по изменению состава администраторов.
    // Поле toAdd == true означает, что предложение направлено на добавление администратора,
    // а false – на его удаление.
    struct AdminProposal {
        address adminCandidate;
        bool toAdd;
        string description;
        bool completed;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 deadline; // Timestamp окончания голосования
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
    // -------------------------------------------------------------------

    // Модификатор, проверяющий, что вызывающий адрес:
    // 1. NFT-контракт установлен;
    // 2. владеет хотя бы одним NFT;
    // 3. прошёл верификацию KYC и срок верификации не истёк.
    modifier onlyVerified() {
        require(address(nftContract) != address(0), "NFT contract not set");
        require(nftContract.balanceOf(msg.sender) > 0, "You must own an NFT");
        require(kycVerified[msg.sender], "KYC verification required");
        require(kycExpiry[msg.sender] > block.timestamp, "KYC expired");
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {
        // Добавляем initialOwner в список администраторов
        admins[initialOwner] = true;
    }

    function setNftContract(address _nftAddress) external onlyOwner {
        nftContract = IERC721(_nftAddress);
        emit NftContractUpdated(_nftAddress);
    }

    function updateKyc(address user, bool verified) external onlyOwner {
        kycVerified[user] = verified;
        if (verified) {
            kycExpiry[user] = block.timestamp + KYC_VALIDITY_PERIOD;
        } else {
            kycExpiry[user] = 0;
            kycDocumentType[user] = "";
        }
        emit KycUpdated(user, verified, kycExpiry[user], kycDocumentType[user]);
    }

    // Функция для установки максимального числа голосующих
    function setMaxVoters(uint256 _maxVoters) external onlyOwner {
        maxVoters = _maxVoters;
    }

    // Функция verifyUser теперь доступна доверенным KYC-провайдерам (или владельцу)
    function verifyUser(
        address user,
        string calldata documentType,
        bool liveness,
        string calldata faceId
    ) external onlyKycProvider {
        // Проверяем, что пользователь ещё не верифицирован
        require(!kycVerified[user], "User already verified");

        require(
            keccak256(bytes(documentType)) == keccak256(bytes(unicode"ВНУТРЕННИЙ ПАСПОРТ РФ")),
            "Only Russian internal passports are allowed"
        );
        require(liveness, "Liveness check failed");
        require(bytes(faceId).length > 0, "Invalid faceID");
        // Проверяем, что данный идентификатор (faceId) ещё не использовался
        require(!usedIdentifiers[faceId], "Identifier already used");
        
        // Помечаем идентификатор как использованный и сохраняем его для пользователя
        usedIdentifiers[faceId] = true;
        userIdentifier[user] = faceId;
        
        kycVerified[user] = true;
        kycExpiry[user] = block.timestamp + KYC_VALIDITY_PERIOD;
        kycDocumentType[user] = documentType;
        emit KycUpdated(user, true, kycExpiry[user], documentType);
    }

    /// @notice Функция для создания предложения. Доступна только для верифицированных пользователей.
    /// Ограничение: пользователь может создавать не более одного предложения в 30 дней.
    function createProposal(string memory description, uint256 votingPeriod) external onlyVerified returns (bool) {
        // Проверяем, что с момента последнего создания предложения прошло не менее 30 дней (2592000 секунд)
        require(
            lastProposalTimestamp[msg.sender] == 0 || block.timestamp >= lastProposalTimestamp[msg.sender] + 2592000,
            "You can only create one proposal every 30 days"
        );
        // Обновляем время создания последнего предложения для пользователя
        lastProposalTimestamp[msg.sender] = block.timestamp;

        proposals.push();
        uint256 proposalId = proposals.length - 1;
        Proposal storage newProposal = proposals[proposalId];
        newProposal.description = description;
        newProposal.completed = false;
        newProposal.votesFor = 0;
        newProposal.votesAgainst = 0;
        newProposal.deadline = block.timestamp + votingPeriod;
        newProposal.likes = 0;
        newProposal.openForVoting = false;

        emit ProposalCreated(proposalId, description, newProposal.deadline);
        return true;
    }

    /// @notice Функция для голосования за предложение. Доступна только для верифицированных пользователей.
    /// Перед голосованием проверяем, что предложение открыто для голосования.
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

        // Если maxVoters установлен, проверяем возможность досрочной финализации
        if (maxVoters > 0) {
            uint256 totalVotes = p.votesFor + p.votesAgainst;
            uint256 remainingVotes = (maxVoters > totalVotes) ? (maxVoters - totalVotes) : 0;
            if (p.votesFor >= p.votesAgainst) {
                if (p.votesFor - p.votesAgainst > remainingVotes) {
                    p.completed = true;
                    emit ProposalFinalized(proposalId);
                }
            } else {
                if (p.votesAgainst - p.votesFor > remainingVotes) {
                    p.completed = true;
                    emit ProposalFinalized(proposalId);
                }
            }
        }
    }

    /// @notice Функция для финализации голосования по предложению. Вызывается владельцем контракта.
    /// Если автоматическая финализация не сработала, администратор может завершить голосование вручную после окончания срока.
    function finalizeProposal(uint256 proposalId) external onlyOwner {
        require(proposalId < proposals.length, "Invalid proposal ID");
        Proposal storage p = proposals[proposalId];
        require(!p.completed, "Proposal already finalized");
        require(block.timestamp > p.deadline, "Voting period is not over yet");

        p.completed = true;
        emit ProposalFinalized(proposalId);
    }

    /// @notice Получение информации о предложении по его идентификатору.
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

    /// @notice Проверка, голосовал ли указанный адрес по данному предложению.
    function hasVoted(uint256 proposalId, address voter) external view returns (bool) {
        require(proposalId < proposals.length, "Invalid proposal ID");
        Proposal storage p = proposals[proposalId];
        return p.voted[voter];
    }

    /// @notice Функция для аннулирования текущей KYC. Пользователь может вызвать эту функцию,
    /// чтобы удалить свои старые данные и запросить повторную верификацию.
    /// При отмене KYC сбрасывается также флаг использования идентификатора, чтобы тот мог быть использован повторно.
    function cancelKyc() external {
        require(kycVerified[msg.sender], "KYC is not active");
        // Если для пользователя установлен идентификатор, сбрасываем его использование.
        string memory faceId = userIdentifier[msg.sender];
        if (bytes(faceId).length > 0) {
            usedIdentifiers[faceId] = false;
            userIdentifier[msg.sender] = "";
        }
        // Аннулируем KYC: сбрасываем статус, дату истечения и тип документа.
        kycVerified[msg.sender] = false;
        kycExpiry[msg.sender] = 0;
        kycDocumentType[msg.sender] = "";
        emit KycUpdated(msg.sender, false, 0, "");
        emit KycResetRequested(msg.sender);
    }

    /// @notice Функция для лайка предложения. Доступна только для верифицированных пользователей.
    /// Если количество лайков достигает 1% от maxVoters, предложение открывается для голосования.
    function likeProposal(uint256 proposalId) external onlyVerified returns (bool) {
        require(proposalId < proposals.length, "Invalid proposal ID");
        Proposal storage p = proposals[proposalId];
        require(!p.liked[msg.sender], "You already liked this proposal");
        p.liked[msg.sender] = true;
        p.likes++;

        // Если установлено значение maxVoters, считаем, что threshold = maxVoters / 100 (1%)
        if (maxVoters > 0 && p.likes * 100 >= maxVoters) {
            p.openForVoting = true;
            emit ProposalOpen(proposalId);
        }
        return true;
    }

    // ================================
    // МЕХАНИЗМ ГОЛОСОВАНИЯ ЗА АДМИНИСТРАТОРОВ
    // ================================

    /// @notice Функция для создания предложения по изменению состава администраторов.
    /// Параметры:
    /// - adminCandidate: адрес кандидата на добавление или удаление.
    /// - toAdd: если true – предложение на добавление, если false – на его удаление.
    /// - description: описание предложения.
    /// - votingPeriod: период голосования в секундах.
    /// Требование: пользователь должен быть верифицирован.
    /// Для предложения на удаление проверяем, что кандидат уже является администратором,
    /// а для добавления – что он ещё не является администратором.
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
        AdminProposal storage newProposal = adminProposals[proposalId];
        newProposal.adminCandidate = adminCandidate;
        newProposal.toAdd = toAdd;
        newProposal.description = description;
        newProposal.completed = false;
        newProposal.votesFor = 0;
        newProposal.votesAgainst = 0;
        newProposal.deadline = block.timestamp + votingPeriod;

        emit AdminProposalCreated(proposalId, adminCandidate, toAdd, description, newProposal.deadline);
        return proposalId;
    }

    /// @notice Функция для голосования по предложению об изменении состава администраторов.
    /// Доступна для верифицированных пользователей.
    function voteAdminProposal(uint256 proposalId, bool support) external onlyVerified {
        require(proposalId < adminProposals.length, "Invalid proposal ID");
        AdminProposal storage p = adminProposals[proposalId];
        require(!p.completed, "Proposal already finalized");
        require(block.timestamp <= p.deadline, "Voting period has ended");
        require(!p.voted[msg.sender], "Already voted");

        p.voted[msg.sender] = true;
        if (support) {
            p.votesFor++;
        } else {
            p.votesAgainst++;
        }
        emit AdminVoted(proposalId, msg.sender, support);

        // Если maxVoters установлен, проверяем возможность досрочной финализации
        if (maxVoters > 0) {
            uint256 totalVotes = p.votesFor + p.votesAgainst;
            uint256 remainingVotes = (maxVoters > totalVotes) ? (maxVoters - totalVotes) : 0;
            if (p.votesFor >= p.votesAgainst) {
                if (p.votesFor - p.votesAgainst > remainingVotes) {
                    _finalizeAdminProposal(proposalId);
                }
            } else {
                if (p.votesAgainst - p.votesFor > remainingVotes) {
                    _finalizeAdminProposal(proposalId);
                }
            }
        }
    }

    /// @notice Функция для финализации предложения по изменению состава администраторов.
    /// Если автоматическая финализация не сработала, владелец может завершить голосование вручную после окончания срока.
    function finalizeAdminProposal(uint256 proposalId) external onlyOwner {
        require(proposalId < adminProposals.length, "Invalid proposal ID");
        AdminProposal storage p = adminProposals[proposalId];
        require(!p.completed, "Proposal already finalized");
        require(block.timestamp > p.deadline, "Voting period is not over yet");
        _finalizeAdminProposal(proposalId);
    }

    /// @dev Внутренняя функция для финализации предложения по администраторам.
    function _finalizeAdminProposal(uint256 proposalId) internal {
        AdminProposal storage p = adminProposals[proposalId];
        if (p.completed) return;
        p.completed = true;
        bool approved = (p.votesFor > p.votesAgainst);
        if (approved) {
            if (p.toAdd) {
                admins[p.adminCandidate] = true;
            } else {
                admins[p.adminCandidate] = false;
            }
        }
        emit AdminProposalFinalized(proposalId, approved);
    }
}
