const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Deployment Sequence and Constructor Arguments", function () {
  // Фикстура для развертывания контрактов
  async function deployContracts() {
    // Получаем подписантов
    const [owner, verifiedUser] = await ethers.getSigners();

    // Развертывание NFTPassport.
    // Если конструктор NFTPassport требует параметр (например, baseURI), передайте его здесь:
    const NFTPassport = await ethers.getContractFactory("NFTPassport");
    const nftPassport = await NFTPassport.deploy();
    await nftPassport.waitForDeployment();
    // В ethers v6 адрес развернутого контракта хранится в свойстве target
    const nftPassportAddress = nftPassport.target;
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    expect(nftPassportAddress).to.not.equal(ZERO_ADDRESS);
    console.log("NFTPassport deployed at:", nftPassportAddress);

    // Для теста используем owner.address как заглушку для KYCManager
    // (в реальном случае сюда должен быть передан адрес контракта, реализующего IKYCManager)
    const kycManagerAddress = owner.address;

    // Развертывание DaoParty с передачей аргументов: initialOwner и _kycManager
    const DaoParty = await ethers.getContractFactory("DaoParty");
    const daoParty = await DaoParty.deploy(owner.address, kycManagerAddress);
    await daoParty.waitForDeployment();
    const daoPartyAddress = daoParty.target;
    expect(daoPartyAddress).to.not.equal(ZERO_ADDRESS);
    console.log("DaoParty deployed at:", daoPartyAddress);

    // Установка адреса NFT-контракта в DaoParty через функцию setNftContract
    const tx = await daoParty.setNftContract(nftPassportAddress);
    await tx.wait();
    expect(await daoParty.nftContract()).to.equal(nftPassportAddress);

    return { nftPassport, daoParty, owner, verifiedUser };
  }

  it("Развертывание NFTPassport и DaoParty, корректные аргументы конструктора", async function () {
    try {
      const { nftPassport, daoParty } = await loadFixture(deployContracts);
      const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
      // Проверяем, что адреса контрактов корректны
      expect(nftPassport.target).to.not.equal(ZERO_ADDRESS);
      expect(daoParty.target).to.not.equal(ZERO_ADDRESS);
      // Проверяем, что внутри DaoParty установлен адрес NFT-контракта
      expect(await daoParty.nftContract()).to.equal(nftPassport.target);
    } catch (error) {
      console.error("Ошибка при развертывании контрактов:", error);
      expect.fail("Развертывание контрактов завершилось с ошибкой");
    }
  });
});
