const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Deployment Sequence and Constructor Arguments", function () {
  it("Развертывание NFTPassport и DaoParty, корректные аргументы конструктора", async function () {
    try {
      const [owner, verifiedUser] = await ethers.getSigners();

      // Развертывание NFTPassport
      const NFTPassport = await ethers.getContractFactory("NFTPassport");
      const nftPassport = await NFTPassport.deploy();
      await nftPassport.waitForDeployment();
      // Для ethers v6 используем nftPassport.target
      console.log("NFTPassport deployed at:", nftPassport.target);
      const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
      expect(nftPassport.target).to.not.equal(ZERO_ADDRESS);

      // Для теста используем owner.address в качестве заглушки для KYCManager.
      const kycManagerAddress = owner.address;

      // Развертывание DaoParty с передачей аргументов
      const DaoParty = await ethers.getContractFactory("DaoParty");
      const daoParty = await DaoParty.deploy(owner.address, kycManagerAddress);
      await daoParty.waitForDeployment();
      console.log("DaoParty deployed at:", daoParty.target);
      expect(daoParty.target).to.not.equal(ZERO_ADDRESS);

      // После развертывания устанавливаем адрес NFT-контракта через setNftContract
      const tx = await daoParty.setNftContract(nftPassport.target);
      await tx.wait();
      expect(await daoParty.nftContract()).to.equal(nftPassport.target);
      
    } catch (error) {
      console.error("Ошибка при развертывании контракта:", error);
      expect.fail("Развертывание контракта завершилось с ошибкой");
    }
  });
});
