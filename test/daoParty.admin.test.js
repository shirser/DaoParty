const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

async function deployFixture() {
  const [deployer, verifiedUser, unverifiedUser, otherUser] = await ethers.getSigners();

  // Развертывание контракта KYCManager
  const KYCManager = await ethers.getContractFactory("KYCManager");
  const kycManager = await KYCManager.deploy(deployer.address);
  await kycManager.waitForDeployment();
  console.log("KYCManager deployed at:", kycManager.target);

  // Развертывание контракта NFTPassport (если используется)
  const NFTPassport = await ethers.getContractFactory("NFTPassport");
  const nftPassport = await NFTPassport.deploy();
  await nftPassport.waitForDeployment();
  console.log("NFTPassport deployed at:", nftPassport.target);

  // Развертывание контракта DaoParty, передаём deployer как владельца и адрес kycManager
  const DaoParty = await ethers.getContractFactory("DaoParty");
  const daoParty = await DaoParty.deploy(deployer.address, kycManager.target);
  await daoParty.waitForDeployment();
  console.log("DaoParty deployed at:", daoParty.target);

  // Добавляем deployer в список доверенных KYC-провайдеров
  const addProviderTx = await kycManager.addKycProvider(deployer.address);
  await addProviderTx.wait();

  // *** Ключевой шаг: KYC-верификация пользователя через KYCManager ***
  const kycVerifyTx = await kycManager.verifyUser(
    verifiedUser.address,         // Пользователь, который будет верифицирован
    "ВНУТРЕННИЙ ПАСПОРТ РФ",       // Тип документа (пример)
    true,                         // Результат liveness-чека (пример)
    "face123"                     // Пример faceID
  );
  await kycVerifyTx.wait();
  console.log("verifiedUser KYC verified");

  // Теперь вызываем verifyUser у daoParty с единственным аргументом (адрес пользователя)
  const daoVerifyTx = await daoParty.verifyUser(verifiedUser.address);
  await daoVerifyTx.wait();
  console.log("DaoParty.verifyUser called successfully for verifiedUser");

  return { nftPassport, daoParty, kycManager, deployer, verifiedUser, unverifiedUser, otherUser };
}

describe("DaoParty Admin Functions", function () {
  let nftPassport, daoParty, kycManager, deployer, verifiedUser, unverifiedUser, otherUser;

  beforeEach(async function () {
    ({ nftPassport, daoParty, kycManager, deployer, verifiedUser, unverifiedUser, otherUser } = await loadFixture(deployFixture));
  });

  it("Владелец может установить адрес NFT-контракта", async function () {
    // Используем адрес развернутого NFTPassport (через .target)
    const someNFTAddress = nftPassport.target;
    const tx = await daoParty.setNftContract(someNFTAddress);
    await tx.wait();
    expect(await daoParty.nftContract()).to.equal(someNFTAddress);
  });
});
