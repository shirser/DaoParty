// scripts/mintPassport.js
const { ethers } = require("hardhat");

async function main() {
  // Адрес уже развернутого контракта NFTPassport
  const nftPassportAddress = "0xf3c3087E77c21705C16044434e1E4e9f09D2dA65";

  // Получаем фабрику контракта NFTPassport и связываем его с адресом развернутого контракта
  const NFTPassport = await ethers.getContractFactory("NFTPassport");
  const nftPassport = NFTPassport.attach(nftPassportAddress);

  // Укажите свой адрес (тот, для которого хотите выпустить NFT-паспорт)
  const myAddress = "0x0eA794f60598936cA33bc43306d8eB73e2cd6533"; 

  console.log(`Выпускаем NFT-паспорт для адреса ${myAddress}...`);
  const tx = await nftPassport.mintPassport(myAddress);
  console.log("Транзакция отправлена, ожидаем подтверждения...");
  await tx.wait();
  console.log("NFT-паспорт успешно выпущен!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Ошибка при выполнении скрипта:", error);
    process.exit(1);
  });
