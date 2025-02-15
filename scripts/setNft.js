// scripts/setNft.js
const { ethers } = require("hardhat");

async function main() {
  // Адрес контракта DaoParty (тот, где функция setNftContract)
  const daoPartyAddress = "0xe924AE6631Eb7959560F3eAeB95eecFE5af7C488";
  // Адрес контракта NFTPassport (его нужно установить в DaoParty)
  const nftPassportAddress = "0xf3c3087E77c21705C16044434e1E4e9f09D2dA65";

  // Получаем фабрику и создаём экземпляр контракта DaoParty
  const DaoParty = await ethers.getContractFactory("DaoParty");
  const daoParty = DaoParty.attach(daoPartyAddress);

  console.log("Вызов setNftContract для установки адреса NFTPassport...");
  const tx = await daoParty.setNftContract(nftPassportAddress);
  console.log("Транзакция отправлена. Ожидаем подтверждения...");
  await tx.wait();
  console.log("Адрес NFTPassport успешно установлен в DaoParty!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Ошибка при выполнении скрипта:", error);
    process.exit(1);
  });
