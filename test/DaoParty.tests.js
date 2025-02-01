const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DaoParty", function () {
  let daoParty;
  let owner, voter1, voter2, nonOwner;

  beforeEach(async function () {
    // Получаем тестовые аккаунты
    [owner, voter1, voter2, nonOwner] = await ethers.getSigners();

    // Получаем фабрику контракта
    const DaoPartyFactory = await ethers.getContractFactory("DaoParty");
    // Передаём owner.address в конструктор
    daoParty = await DaoPartyFactory.deploy(owner.address);
    // Ваша версия Ethers уже возвращает развернутый контракт,
    // поэтому вызов daoParty.deployed() не требуется и должен быть удалён.
  });

  it("Должен корректно деплоиться", async function () {
    expect(await daoParty.owner()).to.equal(owner.address);
  });

  describe("createProposal", function () {
    it("Должен позволять владельцу создавать предложение", async function () {
      const tx = await daoParty.createProposal("Proposal 1");
      await tx.wait();
      await expect(tx)
        .to.emit(daoParty, "ProposalCreated")
        .withArgs(0, "Proposal 1");
    });

    it("Должен отклонять попытку не-владельца создать предложение", async function () {
      await expect(
        daoParty.connect(nonOwner).createProposal("Invalid Proposal")
      ).to.be.reverted;
    });
  });

  describe("vote", function () {
    beforeEach(async function () {
      await daoParty.createProposal("Proposal for voting");
    });

    it("Должен позволять голосовать за предложение", async function () {
      const tx = await daoParty.connect(voter1).vote(0, true);
      await tx.wait();
      await expect(tx)
        .to.emit(daoParty, "Voted")
        .withArgs(0, voter1.address, true);
    });

    it("Должен позволять голосовать против предложения", async function () {
      const tx = await daoParty.connect(voter1).vote(0, false);
      await tx.wait();
      await expect(tx)
        .to.emit(daoParty, "Voted")
        .withArgs(0, voter1.address, false);
    });

    it("Должен отклонять повторное голосование одним и тем же адресом", async function () {
      await daoParty.connect(voter1).vote(0, true);
      await expect(
        daoParty.connect(voter1).vote(0, false)
      ).to.be.revertedWith("Already voted");
    });

    it("Должен отклонять голосование за несуществующее предложение", async function () {
      await expect(
        daoParty.connect(voter1).vote(1, true)
      ).to.be.revertedWith("Invalid proposal ID");
    });

    it("Должен отклонять голосование по уже финализированному предложению", async function () {
      await daoParty.finalizeProposal(0);
      await expect(
        daoParty.connect(voter1).vote(0, true)
      ).to.be.revertedWith("Proposal already finalized");
    });
  });

  describe("finalizeProposal", function () {
    beforeEach(async function () {
      await daoParty.createProposal("Proposal to finalize");
    });

    it("Должен позволять владельцу финализировать предложение", async function () {
      const tx = await daoParty.finalizeProposal(0);
      await tx.wait();
      await expect(tx)
        .to.emit(daoParty, "ProposalFinalized")
        .withArgs(0);
    });

    it("Должен отклонять попытку не-владельца финализировать предложение", async function () {
      await expect(
        daoParty.connect(nonOwner).finalizeProposal(0)
      ).to.be.reverted;
    });

    it("Должен отклонять повторную финализацию уже завершённого предложения", async function () {
      await daoParty.finalizeProposal(0);
      await expect(
        daoParty.finalizeProposal(0)
      ).to.be.revertedWith("Proposal already finalized");
    });

    it("Должен отклонять финализацию несуществующего предложения", async function () {
      await expect(
        daoParty.finalizeProposal(1)
      ).to.be.revertedWith("Invalid proposal ID");
    });
  });
});
