// daoParty.proposal.test.js
const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("DaoParty Proposal and Voting", function () {
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

  describe("Проверка требований KYC и NFT", function () {
    it("Не допускается создание предложения без установки NFT-контракта", async function () {
      const { daoParty, owner, verifiedUser } = await loadFixture(deployFixture);
      const DaoPartyFactory = await ethers.getContractFactory("DaoParty");
      const daoPartyNoNFT = await DaoPartyFactory.deploy(ethers.constants.AddressZero, owner.address);
      await daoPartyNoNFT.deployed();
      await daoPartyNoNFT.updateKyc(verifiedUser.address, true);
      await expect(
        daoPartyNoNFT.connect(verifiedUser).createProposal("Test Proposal", 3600)
      ).to.be.revertedWithCustomError(daoPartyNoNFT, "NFTContractNotSet");
    });

    it("Не допускается создание предложения, если вызывающий не владеет NFT", async function () {
      const { daoParty, unverifiedUser } = await loadFixture(deployFixture);
      await daoParty.updateKyc(unverifiedUser.address, true);
      await expect(
        daoParty.connect(unverifiedUser).createProposal("Test Proposal", 3600)
      ).to.be.revertedWithCustomError(daoParty, "MustOwnNFT");
    });

    it("Не допускается создание предложения без прохождения KYC", async function () {
      const { daoParty, nftPassport, otherUser } = await loadFixture(deployFixture);
      await (await nftPassport.mintPassport(otherUser.address)).wait();
      await expect(
        daoParty.connect(otherUser).createProposal("Test Proposal", 3600)
      ).to.be.revertedWithCustomError(daoParty, "KYCVerificationRequired");
    });
  });

  describe("Создание предложений и голосование", function () {
    let proposalId, proposalTx, proposalBlock;
    beforeEach(async function () {
      const { daoParty, verifiedUser } = await loadFixture(deployFixture);
      await daoParty.setProposalMaxVoters(100);
      proposalTx = await daoParty.connect(verifiedUser).createProposal("Proposal 1", 3600);
      const receipt = await proposalTx.wait();
      proposalBlock = await ethers.provider.getBlock(receipt.blockNumber);

      const parsedEvents = receipt.logs
        .map((log) => {
          try {
            return daoParty.interface.parseLog(log);
          } catch (e) {
            return null;
          }
        })
        .filter((e) => e && e.name === "ProposalCreated");
      expect(parsedEvents.length).to.equal(1);
      proposalId = Number(parsedEvents[0].args[0].toString());

      // Вызываем like для открытия голосования
      const likeTx = await daoParty.connect(verifiedUser).likeProposal(proposalId);
      await likeTx.wait();
    });

    it("Создаёт предложение с корректным дедлайном и состоянием", async function () {
      const { daoParty } = await loadFixture(deployFixture);
      const proposal = await daoParty.getProposal(proposalId);
      expect(proposal.description).to.equal("Proposal 1");
      expect(proposal.completed).to.equal(false);
      expect(proposal.votesFor).to.equal(0);
      expect(proposal.votesAgainst).to.equal(0);
      expect(proposal.deadline).to.be.closeTo(proposalBlock.timestamp + 3600, 5);
    });

    it("Позволяет верифицированному пользователю голосовать и эмитирует событие ProposalVoted", async function () {
      const { daoParty, verifiedUser } = await loadFixture(deployFixture);
      const voteTx = await daoParty.connect(verifiedUser).voteProposal(proposalId, true);
      await expect(voteTx)
        .to.emit(daoParty, "ProposalVoted")
        .withArgs(proposalId, verifiedUser.address, true);
      await voteTx.wait();
      const proposal = await daoParty.getProposal(proposalId);
      expect(proposal.votesFor).to.equal(1);
      expect(await daoParty.hasVoted(proposalId, verifiedUser.address)).to.equal(true);
    });

    it("Не допускается двойное голосование", async function () {
      const { daoParty, verifiedUser } = await loadFixture(deployFixture);
      await daoParty.connect(verifiedUser).voteProposal(proposalId, true);
      await expect(
        daoParty.connect(verifiedUser).voteProposal(proposalId, false)
      ).to.be.revertedWithCustomError(daoParty, "AlreadyVoted");
    });

    it("Голосование недоступно после истечения срока", async function () {
      const { daoParty, verifiedUser } = await loadFixture(deployFixture);
      await network.provider.send("evm_increaseTime", [3600 + 1]);
      await network.provider.send("evm_mine");
      await expect(
        daoParty.connect(verifiedUser).voteProposal(proposalId, true)
      ).to.be.revertedWithCustomError(daoParty, "VotingPeriodEnded");
    });
  });

  describe("Финализация предложений", function () {
    let proposalId;
    beforeEach(async function () {
      const { daoParty, verifiedUser } = await loadFixture(deployFixture);
      const tx = await daoParty.connect(verifiedUser).createProposal("Proposal Finalize", 3600);
      const receipt = await tx.wait();
      const parsedEvents = receipt.logs
        .map(log => {
          try {
            return daoParty.interface.parseLog(log);
          } catch (e) {
            return null;
          }
        })
        .filter(e => e && e.name === "ProposalCreated");
      expect(parsedEvents.length).to.equal(1);
      proposalId = Number(parsedEvents[0].args[0].toString());
    });

    it("Не позволяет финализировать предложение до истечения срока голосования", async function () {
      const { daoParty } = await loadFixture(deployFixture);
      await expect(daoParty.finalizeProposal(proposalId))
        .to.be.revertedWithCustomError(daoParty, "VotingPeriodEnded");
    });

    it("Позволяет владельцу финализировать предложение после истечения срока", async function () {
      const { daoParty } = await loadFixture(deployFixture);
      await network.provider.send("evm_increaseTime", [3600 + 1]);
      await network.provider.send("evm_mine");
      const finalizeTx = await daoParty.finalizeProposal(proposalId);
      await finalizeTx.wait();
      const proposal = await daoParty.getProposal(proposalId);
      expect(proposal.completed).to.equal(true);
    });

    it("Не позволяет не-владельцу финализировать предложение", async function () {
      const { daoParty, verifiedUser } = await loadFixture(deployFixture);
      await network.provider.send("evm_increaseTime", [3600 + 1]);
      await network.provider.send("evm_mine");
      await expect(
        daoParty.connect(verifiedUser).finalizeProposal(proposalId)
      ).to.be.reverted;
    });
  });
});
