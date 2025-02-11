// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract KYCManagerMock {
    // Внутренние переменные с префиксом _ для избежания конфликтов имён с автоматически генерируемыми геттерами
    mapping(address => bool) private _kycVerified;
    mapping(address => uint256) private _kycExpiry;
    mapping(address => bool) private _kycProviders;

    // Функции-геттеры, соответствующие интерфейсу IKYCManager
    function kycVerified(address user) external view returns (bool) {
        return _kycVerified[user];
    }

    function kycExpiry(address user) external view returns (uint256) {
        return _kycExpiry[user];
    }

    function kycProviders(address provider) external view returns (bool) {
        return _kycProviders[provider];
    }

    // Функция для установки статуса верификации пользователя.
    // Если verified == true, срок верификации устанавливается на 30 дней от текущего времени.
    function setKycVerified(address user, bool verified) public {
        _kycVerified[user] = verified;
        if (verified) {
            _kycExpiry[user] = block.timestamp + 30 days; // 30 дней
        } else {
            _kycExpiry[user] = 0;
        }
    }

    // Функция для принудительной установки срока верификации для пользователя.
    function setKycExpiry(address user, uint256 expiry) public {
        _kycExpiry[user] = expiry;
    }

    // Функция для добавления доверенного KYC-провайдера.
    function addKycProvider(address provider) public {
        _kycProviders[provider] = true;
    }
}
