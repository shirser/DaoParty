// scripts/interact.js

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

  // Устанавливаем адрес NFT-контракта равным задеплоенному NFTPassport,
  // чтобы проверка владения NFT работала корректно.
  console.log("\n[Администрирование] Установка адреса NFT-контракта...");
  let tx = await daoParty.setNftContract(nftPassportAddress);
  await tx.wait();
  console.log("NFT-контракт установлен на:", nftPassportAddress);

  // Регистрируем доверенного KYC-провайдера (например, user1)
  console.log("\n[Администрирование] Регистрируем доверенного KYC-провайдера (user1)...");
  tx = await daoParty.addKycProvider(user1.address);
  await tx.wait();
  console.log("User1 добавлен как доверенный KYC-провайдер.");

  // Минтим NFT для user3, чтобы он владел NFT и мог создавать предложения.
  console.log("\n[Администрирование] Минтим NFT для user3...");
  tx = await nftPassport.mintPassport(user3.address);
  await tx.wait();
  console.log("NFT для user3 успешно выдан.");

  // Обновляем статус KYC для user2 через updateKyc (без проверки биометрии)
  console.log("\n[Администрирование] Обновление KYC для user2 через updateKyc...");
  tx = await daoParty.updateKyc(user2.address, true);
  await tx.wait();
  console.log("KYC для user2 обновлён через updateKyc.");

  // Верифицируем user3 через verifyUser с корректными параметрами:
  // documentType: "ВНУТРЕННИЙ ПАСПОРТ РФ", liveness: true, faceId: "faceXYZ"
  // Вызываем verifyUser от имени доверенного провайдера (user1)
  console.log("\n[Администрирование] Верификация user3 с корректными данными от доверенного провайдера...");
  tx = await daoParty.connect(user1).verifyUser(user3.address, "ВНУТРЕННИЙ ПАСПОРТ РФ", true, "faceXYZ");
  await tx.wait();
  console.log("User3 успешно верифицирован.");

  // --- Проверка механизма отмены KYC и повторной верификации ---

  // 1. Отмена KYC от имени user3
  console.log("\n[Проверка KYC] User3 отменяет свой KYC...");
  tx = await daoParty.connect(user3).cancelKyc();
  await tx.wait();
  console.log("User3 успешно отменил KYC.");

  // 2. Попытка создать предложение от user3 после отмены KYC (ожидается ошибка)
  console.log("\n[Проверка KYC] Попытка создать предложение от user3 после отмены KYC...");
  try {
    tx = await daoParty.connect(user3).createProposal("Test Proposal - After CancelKYC", votingPeriod);
    await tx.wait();
    console.log("Ошибка: предложение создано, хотя KYC отменён.");
  } catch (error) {
    console.log("Ожидаемая ошибка при создании предложения:", error.message);
  }

  // 3. Повторная верификация user3 для восстановления возможности создания предложения
  console.log("\n[Проверка KYC] Повторная верификация user3 от доверенного провайдера...");
  tx = await daoParty.connect(user1).verifyUser(user3.address, "ВНУТРЕННИЙ ПАСПОРТ РФ", true, "faceXYZ");
  await tx.wait();
  console.log("User3 успешно повторно верифицирован.");

  // 4. Создание предложения от user3 после повторной верификации – операция должна пройти успешно
  console.log("\n[Проверка KYC] Создание предложения от user3 после повторной верификации...");
  tx = await daoParty.connect(user3).createProposal("Test Proposal - After ReKYC", votingPeriod);
  await tx.wait();
  console.log("Предложение успешно создано после повторной верификации.");

  // Остальной код для взаимодействия с контрактом можно добавить здесь...
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
