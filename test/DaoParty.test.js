const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DaoParty - KYC Integration", function () {
  let daoParty, kycManager, owner, addr1;
  const dummyNftAddress = "0x1000000000000000000000000000000000000001";

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();

    // Развертываем KYCManagerMock
    const KYCManagerMock = await ethers.getContractFactory("KYCManagerMock");
    kycManager = await KYCManagerMock.deploy();
    await kycManager.waitForDeployment();

    // Развертываем DaoParty, передавая адрес KYCManager в конструктор
    const DaoParty = await ethers.getContractFactory("DaoParty");
    daoParty = await DaoParty.deploy(owner.address, kycManager.target);
    await daoParty.waitForDeployment();
  });

  it("should return correct KYC verification status", async function () {
    // Первоначально, для addr1 isKycVerified должен возвращать false
    expect(await daoParty.isKycVerified(addr1.address)).to.be.false;

    // Устанавливаем в KYCManager для addr1, что верификация пройдена
    await kycManager.setKycVerified(addr1.address, true);
    expect(await daoParty.isKycVerified(addr1.address)).to.be.true;

    // Сбрасываем верификацию для addr1 в KYCManager
    await kycManager.setKycVerified(addr1.address, false);
    expect(await daoParty.isKycVerified(addr1.address)).to.be.false;
  });
});
