const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("DaoParty (обновлённая версия с KYC и NFT, используя NFTPassport)", function () {
  let daoParty, nftPassport;
  let owner, verifiedUser, unverifiedUser, otherUser;
  const votingPeriod = 3600; // 1 час
  const KYC_VALIDITY_PERIOD = 2592000; // 30 дней в секундах

  beforeEach(async function () {
    [owner, verifiedUser, unverifiedUser, otherUser] = await ethers.getSigners();

    // Развёртывание NFTPassport (контракт для ментинга NFT)
    const NFTPassport = await ethers.getContractFactory("NFTPassport");
    nftPassport = await NFTPassport.deploy();
    await nftPassport.waitForDeployment();

    const nftPassportAddress = await nftPassport.getAddress();
    console.log("NFTPassport deployed at:", nftPassportAddress);

    // Выдаем NFT для verifiedUser (при необходимости другим)
    await nftPassport.mintPassport(verifiedUser.address);

    // Развёртывание DaoParty
    const DaoParty = await ethers.getContractFactory("DaoParty");
    daoParty = await DaoParty.deploy(owner.address);
    await daoParty.waitForDeployment();

    await daoParty.setNftContract(nftPassportAddress);

    // Верифицируем пользователя через verifyUser с корректными данными:
    // documentType: "ВНУТРЕННИЙ ПАСПОРТ РФ", liveness: true, faceId: "face123"
    await daoParty.verifyUser(verifiedUser.address, "ВНУТРЕННИЙ ПАСПОРТ РФ", true, "face123");
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
        .withArgs(unverifiedUser.address, true, anyValue, "");
    });

    it("Должен позволять верифицировать пользователя с корректным документом, liveness и FaceID", async function () {
      await expect(
        daoParty.verifyUser(otherUser.address, "ВНУТРЕННИЙ ПАСПОРТ РФ", true, "face456")
      )
        .to.emit(daoParty, "KycUpdated")
        .withArgs(otherUser.address, true, anyValue, "ВНУТРЕННИЙ ПАСПОРТ РФ");
    });

    it("Должен отклонять верификацию пользователя с некорректным документом", async function () {
      await expect(
        daoParty.verifyUser(otherUser.address, "Заграничный паспорт", true, "face456")
      ).to.be.revertedWith("Only Russian internal passports are allowed");
    });

    it("Должен отклонять верификацию, если liveness check не пройдена", async function () {
      await expect(
        daoParty.verifyUser(otherUser.address, "ВНУТРЕННИЙ ПАСПОРТ РФ", false, "face456")
      ).to.be.revertedWith("Liveness check failed");
    });

    it("Должен отклонять верификацию, если faceID пустой", async function () {
      await expect(
        daoParty.verifyUser(otherUser.address, "ВНУТРЕННИЙ ПАСПОРТ РФ", true, "")
      ).to.be.revertedWith("Invalid faceID");
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
      await nftPassport.mintPassport(otherUser.address);
      await expect(
        daoParty.connect(otherUser).createProposal("Test Proposal", votingPeriod)
      ).to.be.revertedWith("KYC verification required");
    });
  });

  describe("Механизм повторного KYC", function () {
    it("Должен блокировать создание предложения, если срок KYC истёк", async function () {
      await daoParty.updateKyc(verifiedUser.address, true);
      await network.provider.send("evm_increaseTime", [KYC_VALIDITY_PERIOD + 1]);
      await network.provider.send("evm_mine");
      await expect(
        daoParty.connect(verifiedUser).createProposal("Test Proposal after KYC expiry", votingPeriod)
      ).to.be.revertedWith("KYC expired");
    });

    it("Должен разрешать создание предложения после повторного KYC", async function () {
      await daoParty.updateKyc(verifiedUser.address, true);
      await network.provider.send("evm_increaseTime", [KYC_VALIDITY_PERIOD + 1]);
      await network.provider.send("evm_mine");
      await expect(
        daoParty.connect(verifiedUser).createProposal("Test Proposal after KYC expiry", votingPeriod)
      ).to.be.revertedWith("KYC expired");
      await daoParty.updateKyc(verifiedUser.address, true);
      await expect(
        daoParty.connect(verifiedUser).createProposal("Test Proposal after KYC renewal", votingPeriod)
      ).to.emit(daoParty, "ProposalCreated");
    });
  });

  describe("Ограничения KYC", function () {
    it("Не должен разрешать использовать один и тот же паспорт (faceId) для верификации другого пользователя", async function () {
      await expect(
        daoParty.verifyUser(otherUser.address, "ВНУТРЕННИЙ ПАСПОРТ РФ", true, "face123")
      ).to.be.revertedWith("Identifier already used");
    });

    it("Не должен разрешать повторную верификацию для одного и того же пользователя без отмены KYC", async function () {
      await expect(
        daoParty.verifyUser(verifiedUser.address, "ВНУТРЕННИЙ ПАСПОРТ РФ", true, "faceNew")
      ).to.be.revertedWith("User already verified");
    });

    it("Должен разрешать повторную верификацию с тем же идентификатором после отмены KYC", async function () {
      await daoParty.connect(verifiedUser).cancelKyc();
      await expect(
        daoParty.verifyUser(verifiedUser.address, "ВНУТРЕННИЙ ПАСПОРТ РФ", true, "face123")
      ).to.emit(daoParty, "KycUpdated")
       .withArgs(verifiedUser.address, true, anyValue, "ВНУТРЕННИЙ ПАСПОРТ РФ");
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

      const parsedEvents = receipt.logs
        .map((log) => {
          try {
            return daoParty.interface.parseLog(log);
          } catch (e) {
            return null;
          }
        })
        .filter((e) => e && e.name === "ProposalCreated");

      if (parsedEvents.length === 0) {
        throw new Error("ProposalCreated event not found in transaction");
      }
      proposalId = Number(parsedEvents[0].args[0].toString());
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

  describe("Механизм отмены KYC", function () {
    it("Должен позволять пользователю отменить свой KYC", async function () {
      await expect(daoParty.connect(verifiedUser).cancelKyc())
        .to.emit(daoParty, "KycUpdated")
        .withArgs(verifiedUser.address, false, 0, "");

      await expect(daoParty.connect(verifiedUser).cancelKyc())
        .to.be.revertedWith("KYC is not active");

      await expect(
        daoParty.connect(verifiedUser).createProposal("Proposal after cancelKyc", votingPeriod)
      ).to.be.revertedWith("KYC verification required");
    });

    it("Должен позволять повторную верификацию после отмены KYC", async function () {
      await daoParty.connect(verifiedUser).cancelKyc();

      await expect(
        daoParty.connect(verifiedUser).createProposal("Proposal after cancelKyc", votingPeriod)
      ).to.be.revertedWith("KYC verification required");

      await expect(
        daoParty.verifyUser(verifiedUser.address, "ВНУТРЕННИЙ ПАСПОРТ РФ", true, "face123")
      ).to.emit(daoParty, "KycUpdated")
        .withArgs(verifiedUser.address, true, anyValue, "ВНУТРЕННИЙ ПАСПОРТ РФ");

      await expect(
        daoParty.connect(verifiedUser).createProposal("Proposal after re-KYC", votingPeriod)
      ).to.emit(daoParty, "ProposalCreated");
    });
  });

  describe("Автоматическая финализация голосования", function () {
    const maxVoters = 200;
    let proposalId;

    beforeEach(async function () {
      await daoParty.setMaxVoters(maxVoters);
      const tx = await daoParty.connect(verifiedUser).createProposal("Auto Finalization Proposal", votingPeriod);
      const receipt = await tx.wait();
      const parsedEvents = receipt.logs
        .map((log) => {
          try {
            return daoParty.interface.parseLog(log);
          } catch (e) {
            return null;
          }
        })
        .filter((e) => e && e.name === "ProposalCreated");
      if (parsedEvents.length === 0) {
        throw new Error("ProposalCreated event not found in transaction");
      }
      proposalId = Number(parsedEvents[0].args[0].toString());
    });

    it("Должна автоматически завершаться голосование, если исход предрешён (пример 1)", async function () {
      // Новый сценарий:
      // maxVoters = 200.
      // Сформируем последовательность голосов таким образом, чтобы автоматическая финализация произошла
      // ровно при достижении 160 голосов.
      // Пусть:
      // - первые 100 голосов: "за" (votesFor = 100)
      // - следующие 59 голосов: "против" (votesAgainst = 59)
      // Тогда до 160-го голоса общее число голосов = 159, разница = 41, оставшиеся = 200 - 159 = 41,
      // условие (41 > 41) ложно.
      // 160-й голос "за" увеличит votesFor до 101, разница станет 42, оставшиеся = 40, условие 42 > 40 истинно.
      const additionalVoters = [];
      const totalVotersNeeded = 160;
      for (let i = 0; i < totalVotersNeeded; i++) {
        const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
        await owner.sendTransaction({ to: wallet.address, value: ethers.parseEther("1") });
        await nftPassport.mintPassport(wallet.address);
        await daoParty.updateKyc(wallet.address, true);
        additionalVoters.push(wallet);
      }
      // Первые 100 голосов "за"
      for (let i = 0; i < 100; i++) {
        await daoParty.connect(additionalVoters[i]).vote(proposalId, true);
      }
      // Следующие 59 голосов "против"
      for (let i = 100; i < 159; i++) {
        await daoParty.connect(additionalVoters[i]).vote(proposalId, false);
      }
      // 160-й голос "за" – должен вызвать автоматическую финализацию
      await daoParty.connect(additionalVoters[159]).vote(proposalId, true);
      
      const proposal = await daoParty.getProposal(proposalId);
      expect(proposal.completed).to.equal(true);

      // Дополнительно проверим, что попытка проголосовать после финализации приводит к revert
      await expect(
        daoParty.connect(additionalVoters[0]).vote(proposalId, true)
      ).to.be.revertedWith("Proposal already finalized");
    });

    it("Голосование продолжается, если исход ещё может измениться (пример 2)", async function () {
      await daoParty.setMaxVoters(300);
      const additionalVoters = [];
      for (let i = 0; i < 270; i++) {
        const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
        await owner.sendTransaction({ to: wallet.address, value: ethers.parseEther("1") });
        await nftPassport.mintPassport(wallet.address);
        await daoParty.updateKyc(wallet.address, true);
        additionalVoters.push(wallet);
      }
      for (let i = 0; i < 140; i++) {
        await daoParty.connect(additionalVoters[i]).vote(proposalId, true);
      }
      for (let i = 140; i < 270; i++) {
        await daoParty.connect(additionalVoters[i]).vote(proposalId, false);
      }
      const proposal = await daoParty.getProposal(proposalId);
      expect(proposal.completed).to.equal(false);
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
