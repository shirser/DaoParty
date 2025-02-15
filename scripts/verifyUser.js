// scripts/verifyUser.js
const { ethers } = require("hardhat");

async function main() {
  // Адрес вашего контракта DaoParty
  const daoPartyAddress = "0xe924AE6631Eb7959560F3eAeB95eecFE5af7C488";
  
  // Получаем экземпляр контракта DaoParty
  const DaoParty = await ethers.getContractFactory("DaoParty");
  const daoParty = DaoParty.attach(daoPartyAddress);

  // Параметры верификации
  const userAddress = "0x0eA794f60598936cA33bc43306d8eB73e2cd6533"; // ваш адрес
  const documentType = "ВНУТРЕННИЙ ПАСПОРТ РФ";
  const liveness = true;
  const faceId = "testFaceId123"; // Убедитесь, что этот идентификатор уникален для теста

  console.log("Запуск верификации KYC...");
  const tx = await daoParty.verifyUser(userAddress, documentType, liveness, faceId);
  console.log("Транзакция отправлена, ожидаем подтверждения...");
  await tx.wait();
  console.log("Ваш аккаунт успешно верифицирован!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Ошибка при верификации:", error);
    process.exit(1);
  });
