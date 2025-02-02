// interact.js

// Получаем адреса из переменных окружения или из аргументов командной строки
const contractAddressFromEnv = process.env.CONTRACT_ADDRESS;
const contractAddressArg = process.argv[process.argv.length - 1];
const daoPartyAddress =
  contractAddressFromEnv && !contractAddressFromEnv.startsWith("--")
    ? contractAddressFromEnv
    : contractAddressArg;

if (!daoPartyAddress || daoPartyAddress.startsWith("--")) {
  throw new Error("Пожалуйста, укажите адрес контракта DaoParty через переменную окружения CONTRACT_ADDRESS или как аргумент");
}
console.log("Используем адрес контракта DaoParty:", daoPartyAddress);

const nftPassportAddress = process.env.NFTPASSPORT_ADDRESS;
if (!nftPassportAddress || nftPassportAddress.startsWith("--")) {
  throw new Error("Пожалуйста, укажите адрес контракта NFTPassport через переменную окружения NFTPASSPORT_ADDRESS");
}
console.log("Используем адрес контракта NFTPassport:", nftPassportAddress);

const { ethers, network } = require("hardhat");

// Задаем период голосования (в секундах)
const votingPeriod = 3600; // 1 час

async function main() {
  // Получаем аккаунты (первый – владелец, далее тестовые пользователи)
  const [owner, user1, user2, user3] = await ethers.getSigners();

  // Получаем инстанс контракта DaoParty, используя переданный адрес
  const DaoParty = await ethers.getContractFactory("DaoParty");
  const daoParty = DaoParty.attach(daoPartyAddress);
  console.log("\nВзаимодействуем с контрактом DaoParty, адрес:", daoPartyAddress);

  // Получаем инстанс контракта NFTPassport, используя переданный адрес
  const NFTPassport = await ethers.getContractFactory("NFTPassport");
  const nftPassport = NFTPassport.attach(nftPassportAddress);
  console.log("Взаимодействуем с контрактом NFTPassport, адрес:", nftPassportAddress);

  // --- Административные функции ---

  // Устанавливаем адрес NFT-контракта (для примера используем адрес user1)
  console.log("\n[Администрирование] Установка адреса NFT-контракта...");
  const user1Address = await user1.getAddress();
  let tx = await daoParty.setNftContract(user1Address);
  await tx.wait();
  console.log("NFT-контракт установлен на:", user1Address);

  // Обновляем статус KYC для user2 через updateKyc (без проверки биометрии)
  console.log("\n[Администрирование] Обновление KYC для user2 через updateKyc...");
  tx = await daoParty.updateKyc(user2.address, true);
  await tx.wait();
  console.log("KYC для user2 обновлён через updateKyc.");

  // Верифицируем user3 через verifyUser с корректными параметрами:
  // documentType: "ВНУТРЕННИЙ ПАСПОРТ РФ", liveness: true, faceId: "faceXYZ"
  console.log("\n[Администрирование] Верификация user3 с корректными данными...");
  tx = await daoParty.verifyUser(user3.address, "ВНУТРЕННИЙ ПАСПОРТ РФ", true, "faceXYZ");
  await tx.wait();
  console.log("User3 успешно верифицирован.");

  // Остальной код остается без изменений...
  // ...
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
