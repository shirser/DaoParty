const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("DaoParty - Proposal Functionality", function () {
  let daoParty, kycManager, owner, verifiedUser, nonVerifiedUser;

  beforeEach(async function () {
    [owner, verifiedUser, nonVerifiedUser] = await ethers.getSigners();

    // Развертываем mock-контракт KYCManagerMock
    const KYCManagerMock = await ethers.getContractFactory("KYCManagerMock");
    kycManager = await KYCManagerMock.deploy();
    await kycManager.waitForDeployment();

    // Устанавливаем верификацию для verifiedUser, а для nonVerifiedUser оставляем false
    await kycManager.setKycVerified(verifiedUser.address, true);

    // Развертываем контракт DaoParty, передавая адрес KYCManagerMock
    const DaoParty = await ethers.getContractFactory("DaoParty");
    daoParty = await DaoParty.deploy(owner.address, kycManager.target);
    await daoParty.waitForDeployment();
  });

  it("should allow a verified user to create a proposal", async function () {
    const description = "Proposal for testing";
    const votingDuration = 3600; // 1 час

    // Проверяем, что функция createProposal эмитирует событие ProposalCreated с корректными параметрами
    await expect(daoParty.connect(verifiedUser).createProposal(description, votingDuration))
      .to.emit(daoParty, "ProposalCreated")
      .withArgs(0, description, anyValue); // Если это первое предложение, его ID будет 0

    // Проверяем, что данные предложения сохранены корректно
    const proposal = await daoParty.proposals(0);
    expect(proposal.description).to.equal(description);
    const currentTime = (await ethers.provider.getBlock("latest")).timestamp;
    expect(Number(proposal.deadline)).to.be.greaterThan(currentTime);
    expect(proposal.votesFor).to.equal(0);
    expect(proposal.votesAgainst).to.equal(0);
    expect(proposal.completed).to.equal(false);
  });

  it("should revert if non-verified user tries to create a proposal", async function () {
    await expect(
      daoParty.connect(nonVerifiedUser).createProposal("Invalid Proposal", 3600)
    ).to.be.revertedWith("You must own an NFT"); // Или с сообщением из модификатора onlyVerified
  });

  it("should revert if votingDuration is 0", async function () {
    await expect(
      daoParty.connect(verifiedUser).createProposal("Invalid Proposal", 0)
    ).to.be.revertedWith("Voting duration must be greater than 0");
  });
});
