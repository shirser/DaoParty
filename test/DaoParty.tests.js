const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("DaoParty (обновлённая версия с KYC и NFT, используя NFTPassport)", function () {
  let daoParty, nftPassport;
  let owner, verifiedUser, unverifiedUser, otherUser;
  const votingPeriod = 3600; // 1 час

  beforeEach(async function () {
    [owner, verifiedUser, unverifiedUser, otherUser] = await ethers.getSigners();

    // Развёртывание NFTPassport (контракт для ментинга NFT)
    const NFTPassport = await ethers.getContractFactory("NFTPassport");
    nftPassport = await NFTPassport.deploy();
    await nftPassport.waitForDeployment();

    const nftPassportAddress = await nftPassport.getAddress();
    console.log("NFTPassport deployed at:", nftPassportAddress);

    // Выдаем NFT для verifiedUser и при необходимости другим
    await nftPassport.mintPassport(verifiedUser.address);

    const DaoParty = await ethers.getContractFactory("DaoParty");
    daoParty = await DaoParty.deploy(owner.address);
    await daoParty.waitForDeployment();

    await daoParty.setNftContract(nftPassportAddress);
    // Верифицируем пользователя через verifyUser с корректным документом:
    await daoParty.verifyUser(verifiedUser.address, "ВНУТРЕННИЙ ПАСПОРТ РФ");
  });

  describe("Функции администратора", function () {
    it("Должен позволять владельцу установить адрес NFT-контракта и выбросить событие", async function () {
      await expect(daoParty.setNftContract(await nftPassport.getAddress()))
        .to.emit(daoParty, "NftContractUpdated")
        .withArgs(await nftPassport.getAddress());
    });

    it("Должен позволять владельцу обновить статус KYC и выбросить событие", async function () {
      await expect(daoParty.updateKyc(unverifiedUser.address, true))
        .to.emit(daoParty, "KycUpdated")
        .withArgs(unverifiedUser.address, true);
    });

    it("Должен позволять верифицировать пользователя с корректным документом", async function () {
      await expect(daoParty.verifyUser(otherUser.address, "ВНУТРЕННИЙ ПАСПОРТ РФ"))
        .to.emit(daoParty, "KycUpdated")
        .withArgs(otherUser.address, true);
    });

    it("Должен отклонять верификацию пользователя с некорректным документом", async function () {
      await expect(
        daoParty.verifyUser(otherUser.address, "Заграничный паспорт")
      ).to.be.revertedWith("Only Russian internal passports are allowed");
    });
  });

  describe("Проверка требований KYC и NFT", function () {
    it("Должен отклонять создание предложения, если NFT-контракт не установлен", async function () {
      const DaoParty = await ethers.getContractFactory("DaoParty");
      const daoPartyNoNFT = await DaoParty.deploy(owner.address);
      await daoPartyNoNFT.waitForDeployment();
      await daoPartyNoNFT.updateKyc(verifiedUser.address, true);
      await expect(
        daoPartyNoNFT.connect(verifiedUser).createProposal("Test Proposal", votingPeriod)
      ).to.be.revertedWith("NFT contract not set");
    });

    it("Должен отклонять создание предложения, если вызывающий не владеет NFT", async function () {
      await daoParty.updateKyc(unverifiedUser.address, true);
      await expect(
        daoParty.connect(unverifiedUser).createProposal("Test Proposal", votingPeriod)
      ).to.be.revertedWith("You must own an NFT");
    });

    it("Должен отклонять создание предложения, если KYC не пройден", async function () {
      // Выдаем NFT otherUser, но не верифицируем его
      await nftPassport.mintPassport(otherUser.address);
      await expect(
        daoParty.connect(otherUser).createProposal("Test Proposal", votingPeriod)
      ).to.be.revertedWith("KYC verification required");
    });
  });

  describe("Создание предложений и голосование", function () {
    let proposalId;
    beforeEach(async function () {
      const tx = await daoParty.connect(verifiedUser).createProposal("Proposal 1", votingPeriod);
      const receipt = await tx.wait();

      console.log("Transaction logs:", receipt.logs);

      if (!receipt.logs || receipt.logs.length === 0) {
        throw new Error("ProposalCreated event not emitted");
      }

      // Ищем событие ProposalCreated по имени
      const event = receipt.logs.find(e => e.fragment && e.fragment.name === "ProposalCreated");
      if (!event) {
        throw new Error("ProposalCreated event not found in transaction");
      }

      // Используем Number(event.args[0]) вместо .toNumber()
      proposalId = Number(event.args[0]);
    });

    it("Должно создавать предложение с корректным дедлайном", async function () {
      const currentBlock = await ethers.provider.getBlock("latest");
      const proposal = await daoParty.getProposal(proposalId);
      expect(proposal.description).to.equal("Proposal 1");
      expect(proposal.completed).to.equal(false);
      expect(proposal.votesFor).to.equal(0);
      expect(proposal.votesAgainst).to.equal(0);
      expect(proposal.deadline).to.be.closeTo(currentBlock.timestamp + votingPeriod, 5);
    });

    it("Должен позволять голосовать верифицированному пользователю", async function () {
      const tx = await daoParty.connect(verifiedUser).vote(proposalId, true);
      await tx.wait();
      const proposal = await daoParty.getProposal(proposalId);
      expect(proposal.votesFor).to.equal(1);
      expect(await daoParty.hasVoted(proposalId, verifiedUser.address)).to.equal(true);
    });

    it("Не должен позволять двойное голосование", async function () {
      await daoParty.connect(verifiedUser).vote(proposalId, true);
      await expect(
        daoParty.connect(verifiedUser).vote(proposalId, false)
      ).to.be.revertedWith("Already voted");
    });

    it("Не должен позволять голосование после истечения срока", async function () {
      await network.provider.send("evm_increaseTime", [votingPeriod + 1]);
      await network.provider.send("evm_mine");
      await expect(
        daoParty.connect(verifiedUser).vote(proposalId, true)
      ).to.be.revertedWith("Voting period has ended");
    });
  });

  describe("Финализация предложений", function () {
    let proposalId;
    beforeEach(async function () {
      const tx = await daoParty.connect(verifiedUser).createProposal("Proposal Finalize", votingPeriod);
      const receipt = await tx.wait();

      console.log("Transaction logs:", receipt.logs);

      if (!receipt.logs || receipt.logs.length === 0) {
        throw new Error("ProposalCreated event not emitted");
      }

      const event = receipt.logs.find(e => e.fragment && e.fragment.name === "ProposalCreated");
      if (!event) {
        throw new Error("ProposalCreated event not found in transaction");
      }

      proposalId = Number(event.args[0]);
    });

    it("Не должен позволять финализировать предложение до истечения срока", async function () {
      await expect(daoParty.finalizeProposal(proposalId))
        .to.be.revertedWith("Voting period is not over yet");
    });

    it("Должен позволять владельцу финализировать предложение после истечения срока", async function () {
      await network.provider.send("evm_increaseTime", [votingPeriod + 1]);
      await network.provider.send("evm_mine");
      const tx = await daoParty.finalizeProposal(proposalId);
      await tx.wait();
      const proposal = await daoParty.getProposal(proposalId);
      expect(proposal.completed).to.equal(true);
    });

    it("Не должен позволять не-владельцу финализировать предложение", async function () {
      await network.provider.send("evm_increaseTime", [votingPeriod + 1]);
      await network.provider.send("evm_mine");
      await expect(
        daoParty.connect(verifiedUser).finalizeProposal(proposalId)
      ).to.be.reverted;
    });
  });
});
