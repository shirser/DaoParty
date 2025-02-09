const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

async function deployDaoParty() {
  // Получаем аккаунты. Первый аккаунт используется как deployer.
  const [deployer, verifiedUser, unverifiedUser, otherUser] = await ethers.getSigners();

  // Развёртывание контракта DaoParty.
  const DaoParty = await ethers.getContractFactory("DaoParty");
  // Передаём deployer.address для необходимых параметров, например, для KYCManager.
  const daoParty = await DaoParty.deploy(deployer.address, deployer.address);
  await daoParty.waitForDeployment();

  return { daoParty, deployer, verifiedUser, unverifiedUser, otherUser };
}

describe("DaoParty контракт", function () {
  let daoParty, deployer, verifiedUser, unverifiedUser, otherUser;

  // Загружаем фикстуру перед каждым тестом
  beforeEach(async function () {
    ({ daoParty, deployer, verifiedUser, unverifiedUser, otherUser } = await loadFixture(deployDaoParty));
  });

  it("DaoParty должен иметь корректный адрес", async function () {
    console.log("DaoParty address:", daoParty.address);
    expect(daoParty.address).to.not.equal(ethers.constants.AddressZero);
  });
});
