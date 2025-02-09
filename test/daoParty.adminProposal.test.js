// daoParty.adminProposal.test.js
const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("DaoParty Admin Proposal Functions", function () {
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

  describe("Механизм голосования за изменение состава администраторов", function () {
    let adminProposalId;
    beforeEach(async function () {
      const { daoParty, verifiedUser, otherUser } = await loadFixture(deployFixture);
      const tx = await daoParty
        .connect(verifiedUser)
        .proposeAdminChange(otherUser.address, true, "Добавить otherUser в администраторы", 3600);
      const receipt = await tx.wait();
      const parsedEvents = receipt.logs
        .map(log => {
          try {
            return daoParty.interface.parseLog(log);
          } catch (e) {
            return null;
          }
        })
        .filter(e => e && e.name === "AdminProposalCreated");
      expect(parsedEvents.length).to.equal(1);
      adminProposalId = parsedEvents[0].args.proposalId;
    });

    it("Позволяет создать предложение по изменению состава администраторов", async function () {
      expect(adminProposalId).to.be.a("bigint");
    });

    it("Позволяет голосовать за предложение и автоматически финализировать его", async function () {
      const { daoParty, verifiedUser, owner, nftPassport, otherUser } = await loadFixture(deployFixture);
      await daoParty.setAdminMaxVoters(100);
      const additionalVoters = [];
      const totalVotersNeeded = 51;
      for (let i = 0; i < totalVotersNeeded; i++) {
        const wallet = ethers.Wallet.createRandom().connect(ethers.provider);
        await owner.sendTransaction({ to: wallet.address, value: ethers.utils.parseEther("1") });
        await (await nftPassport.mintPassport(wallet.address)).wait();
        await (await daoParty.updateKyc(wallet.address, true)).wait();
        additionalVoters.push(wallet);
      }
      for (let i = 0; i < totalVotersNeeded; i++) {
        await daoParty.connect(additionalVoters[i]).voteAdminProposal(adminProposalId, true);
      }
      expect(await daoParty.admins(otherUser.address)).to.equal(true);
    });

    it("Позволяет владельцу финализировать админ-предложение после истечения срока голосования", async function () {
      const { daoParty, verifiedUser, otherUser, owner, nftPassport } = await loadFixture(deployFixture);
      await daoParty.setAdminMaxVoters(1000);
      const tx = await daoParty
        .connect(verifiedUser)
        .proposeAdminChange(otherUser.address, true, "Добавить otherUser в администраторы", 3600);
      const receipt = await tx.wait();
      const parsedEvents = receipt.logs
        .map(log => {
          try {
            return daoParty.interface.parseLog(log);
          } catch (e) {
            return null;
          }
        })
        .filter(e => e && e.name === "AdminProposalCreated");
      expect(parsedEvents.length).to.equal(1);
      const adminProposalIdManual = parsedEvents[0].args.proposalId;
      await daoParty.connect(verifiedUser).voteAdminProposal(adminProposalIdManual, true);
      const extraWallet = ethers.Wallet.createRandom().connect(ethers.provider);
      await owner.sendTransaction({ to: extraWallet.address, value: ethers.utils.parseEther("1") });
      await (await nftPassport.mintPassport(extraWallet.address)).wait();
      await (await daoParty.updateKyc(extraWallet.address, true)).wait();
      await daoParty.connect(extraWallet).voteAdminProposal(adminProposalIdManual, true);
      await network.provider.send("evm_increaseTime", [3600 + 1]);
      await network.provider.send("evm_mine");
      await expect(daoParty.finalizeAdminProposal(adminProposalIdManual))
        .to.emit(daoParty, "AdminProposalFinalized")
        .withArgs(adminProposalIdManual, true);
      expect(await daoParty.admins(otherUser.address)).to.equal(true);
    });
  });
});
