// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

contract KYCManager is Ownable {
    // Автоматически сгенерированные геттеры:
    // function kycVerified(address user) external view returns (bool);
    // function kycExpiry(address user) external view returns (uint256);
    mapping(address => bool) public kycVerified;
    mapping(address => uint256) public kycExpiry;
    mapping(address => string) public kycDocumentType;
    
    uint256 public constant KYC_VALIDITY_PERIOD = 2592000; // 30 дней

    mapping(string => bool) public usedIdentifiers;
    mapping(address => string) public userIdentifier;

    // Мэппинг для хранения доверенных KYC-провайдеров
    mapping(address => bool) public kycProviders;

    event KycUpdated(address indexed user, bool verified, uint256 expiry, string documentType);
    event KycResetRequested(address indexed user);
    event KycProviderAdded(address indexed provider);
    event KycProviderRemoved(address indexed provider);

    /// @notice Конструктор, передающий адрес владельца базовому конструктору Ownable.
    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @notice Добавляет адрес доверенного KYC-провайдера (только владелец)
    function addKycProvider(address provider) external onlyOwner {
        kycProviders[provider] = true;
        emit KycProviderAdded(provider);
    }

    /// @notice Удаляет адрес доверенного KYC-провайдера (только владелец)
    function removeKycProvider(address provider) external onlyOwner {
        kycProviders[provider] = false;
        emit KycProviderRemoved(provider);
    }

    /// @notice Модификатор, разрешающий вызов функции только владельцу или доверенным KYC-провайдерам
    modifier onlyKycProvider() {
        require(kycProviders[msg.sender] || msg.sender == owner(), "Not an authorized KYC provider");
        _;
    }

    /// @notice Обновляет статус KYC пользователя (вызывается, например, владельцем)
    function updateKyc(address user, bool verified) external {
        kycVerified[user] = verified;
        if (verified) {
            kycExpiry[user] = block.timestamp + KYC_VALIDITY_PERIOD;
        } else {
            kycExpiry[user] = 0;
            kycDocumentType[user] = "";
        }
        emit KycUpdated(user, verified, kycExpiry[user], kycDocumentType[user]);
    }

    /// @notice Верифицирует пользователя (вызывается только доверенными провайдерами или владельцем)
    /// @dev Проверяет, что пользователь ещё не верифицирован, что переданный тип документа соответствует требуемому,
    /// что пройден liveness-чек, что faceID корректен и не был использован ранее.
    function verifyUser(
        address user,
        string calldata documentType,
        bool liveness,
        string calldata faceId
    ) external onlyKycProvider {
        console.log("KYCManager.verifyUser called by:", msg.sender, "for user:", user);
        console.log("Document type: %s, liveness: %s, faceId: %s", documentType, liveness ? "true" : "false", faceId);

        require(!kycVerified[user], "User already verified");
        require(
            keccak256(bytes(documentType)) == keccak256(bytes(unicode"ВНУТРЕННИЙ ПАСПОРТ РФ")),
            "Only Russian internal passports are allowed"
        );
        require(liveness, "Liveness check failed");
        require(bytes(faceId).length > 0, "Invalid faceID");
        require(!usedIdentifiers[faceId], "Identifier already used");

        usedIdentifiers[faceId] = true;
        userIdentifier[user] = faceId;
        kycVerified[user] = true;
        kycExpiry[user] = block.timestamp + KYC_VALIDITY_PERIOD;
        kycDocumentType[user] = documentType;
        emit KycUpdated(user, true, kycExpiry[user], documentType);
    }

    /// @notice Отменяет KYC для пользователя
    function cancelKyc(address user) external {
        require(kycVerified[user], "KYC is not active");
        string memory faceId = userIdentifier[user];
        if (bytes(faceId).length > 0) {
            usedIdentifiers[faceId] = false;
            userIdentifier[user] = "";
        }
        kycVerified[user] = false;
        kycExpiry[user] = 0;
        kycDocumentType[user] = "";
        emit KycUpdated(user, false, 0, "");
        emit KycResetRequested(user);
    }
}
