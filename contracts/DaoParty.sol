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
    // Обновлено событие KycUpdated: добавлен параметр documentType (можно использовать пустую строку, если не требуется)
    event KycUpdated(address indexed user, bool verified, uint256 expiry, string documentType);
    event NftContractUpdated(address indexed nftAddress);
    // Событие для запроса на повторную верификацию (аннулирование старых данных)
    event KycResetRequested(address indexed user);

    constructor(address initialOwner) Ownable(initialOwner) {}

    modifier onlyVerified() {
        require(address(nftContract) != address(0), "NFT contract not set");
        require(nftContract.balanceOf(msg.sender) > 0, "You must own an NFT");
        require(kycVerified[msg.sender], "KYC verification required");
        require(kycExpiry[msg.sender] > block.timestamp, "KYC expired");
        _;
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
    function createProposal(string memory description, uint256 votingPeriod) external onlyVerified returns (bool) {
        proposals.push();
        uint256 proposalId = proposals.length - 1;
        Proposal storage newProposal = proposals[proposalId];
        newProposal.description = description;
        newProposal.completed = false;
        newProposal.votesFor = 0;
        newProposal.votesAgainst = 0;
        newProposal.deadline = block.timestamp + votingPeriod;

        emit ProposalCreated(proposalId, description, newProposal.deadline);
        return true;
    }

    /// @notice Функция для голосования за предложение. Доступна только для верифицированных пользователей.
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

    /// @notice Функция для финализации голосования по предложению. Вызывается владельцем контракта.
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
}
