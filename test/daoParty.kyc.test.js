// daoParty.kyc.test.js
const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("DaoParty KYC Functions", function () {
  async function deployFixture() {
    const [owner, verifiedUser, unverifiedUser, otherUser] = await ethers.getSigners();

    const NFTPassport = await ethers.getContractFactory("NFTPassport");
    const nftPassport = await NFTPassport.deploy();
    await nftPassport.waitForDeployment();
    expect(nftPassport.address).to.not.be.null;
    await (await nftPassport.mintPassport(verifiedUser.address)).wait();

    const DaoParty = await ethers.getContractFactory("DaoParty");
    const daoParty = await DaoParty.deploy(nftPassport.address, owner.address);
    await daoParty.deployed();
    expect(daoParty.address).to.not.be.null;

    await (await daoParty.verifyUser(verifiedUser.address, "ВНУТРЕННИЙ ПАСПОРТ РФ", true, "face123")).wait();

    return { daoParty, nftPassport, owner, verifiedUser, unverifiedUser, otherUser };
  }

  describe("Механизм повторного KYC", function () {
    it("Блокируется создание предложения после истечения срока KYC", async function () {
      const { daoParty, verifiedUser } = await loadFixture(deployFixture);
      await daoParty.updateKyc(verifiedUser.address, true);
      await network.provider.send("evm_increaseTime", [2592000 + 1]);
      await network.provider.send("evm_mine");
      await expect(
        daoParty.connect(verifiedUser).createProposal("Test Proposal after KYC expiry", 3600)
      ).to.be.revertedWithCustomError(daoParty, "KYCExpired");
    });

    it("После отмены KYC возможно повторное прохождение верификации", async function () {
      const { daoParty, verifiedUser } = await loadFixture(deployFixture);
      await daoParty.connect(verifiedUser).cancelKyc();
      await expect(
        daoParty.connect(verifiedUser).createProposal("Proposal after cancelKYC", 3600)
      ).to.be.revertedWithCustomError(daoParty, "KYCVerificationRequired");

      const reverifyTx = await daoParty.verifyUser(verifiedUser.address, "ВНУТРЕННИЙ ПАСПОРТ РФ", true, "face123");
      await expect(reverifyTx)
        .to.emit(daoParty, "KycUpdated")
        .withArgs(verifiedUser.address, true, anyValue, "ВНУТРЕННИЙ ПАСПОРТ РФ");
      expect(await daoParty.kycVerified(verifiedUser.address)).to.equal(true);
      expect(await daoParty.kycExpiry(verifiedUser.address)).to.be.gt(0);

      await expect(
        daoParty.connect(verifiedUser).createProposal("Proposal after re-KYC", 3600)
      ).to.emit(daoParty, "ProposalCreated");
    });
  });
});
