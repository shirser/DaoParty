const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("KYCManagerMock", function () {
  let kycManager, owner, addr1;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    const KYCManagerMock = await ethers.getContractFactory("KYCManagerMock");
    kycManager = await KYCManagerMock.deploy();
    await kycManager.waitForDeployment();
  });

  it("should return correct kycVerified status", async function () {
    // По умолчанию статус должен быть false
    expect(await kycManager.kycVerified(addr1.address)).to.be.false;

    // Устанавливаем статус верификации в true
    await kycManager.setKycVerified(addr1.address, true);
    expect(await kycManager.kycVerified(addr1.address)).to.be.true;

    // Сбрасываем статус верификации в false
    await kycManager.setKycVerified(addr1.address, false);
    expect(await kycManager.kycVerified(addr1.address)).to.be.false;
  });

  it("should return a valid kycExpiry", async function () {
    // Если пользователь не верифицирован, expiry должен быть равен 0
    expect(await kycManager.kycExpiry(addr1.address)).to.equal(0);

    // Устанавливаем верификацию — expiry должен стать больше текущего времени
    await kycManager.setKycVerified(addr1.address, true);
    const expiry = await kycManager.kycExpiry(addr1.address);
    const currentTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
    expect(Number(expiry)).to.be.greaterThan(currentTimestamp);
  });

  it("should return true for added kycProvider", async function () {
    // Изначально addr1 не является доверенным провайдером
    expect(await kycManager.kycProviders(addr1.address)).to.be.false;
    
    // Добавляем addr1 в список доверенных провайдеров
    await kycManager.addKycProvider(addr1.address);
    expect(await kycManager.kycProviders(addr1.address)).to.be.true;
  });
});
