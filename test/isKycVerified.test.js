const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DaoParty - KYC Integration", function () {
  let daoParty, kycManager, owner, addr1;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();

    // Развертываем mock‑контракт KYCManager
    const KYCManagerMock = await ethers.getContractFactory("KYCManagerMock");
    kycManager = await KYCManagerMock.deploy();
    await kycManager.waitForDeployment();

    // Развертываем контракт DaoParty, передавая адрес KYCManagerMock в конструктор
    const DaoParty = await ethers.getContractFactory("DaoParty");
    daoParty = await DaoParty.deploy(owner.address, kycManager.target);
    await daoParty.waitForDeployment();
  });

  it("should return correct KYC verification status via isKycVerified", async function () {
    // Первоначально для addr1 статус должен быть false
    expect(await daoParty.isKycVerified(addr1.address)).to.be.false;

    // Устанавливаем для addr1 статус верификации в true через KYCManagerMock
    await kycManager.setKycVerified(addr1.address, true);
    expect(await daoParty.isKycVerified(addr1.address)).to.be.true;

    // Сбрасываем статус верификации для addr1
    await kycManager.setKycVerified(addr1.address, false);
    expect(await daoParty.isKycVerified(addr1.address)).to.be.false;
  });
});
