const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

async function deployNFTPassport() {
  // Получаем аккаунты. Первый аккаунт используется как deployer (развёртыватель).
  const [deployer, verifiedUser, unverifiedUser, otherUser] = await ethers.getSigners();

  // Развёртывание контракта NFTPassport.
  const NFTPassport = await ethers.getContractFactory("NFTPassport");
  const nftPassport = await NFTPassport.deploy(); // При необходимости передайте аргументы конструктора.
  await nftPassport.waitForDeployment();

  return { nftPassport, deployer, verifiedUser, unverifiedUser, otherUser };
}

describe("NFTPassport контракт", function () {
  let nftPassport, deployer, verifiedUser, unverifiedUser, otherUser;

  // Загружаем фикстуру перед каждым тестом
  beforeEach(async function () {
    ({ nftPassport, deployer, verifiedUser, unverifiedUser, otherUser } = await loadFixture(deployNFTPassport));
  });

  it("NFTPassport должен иметь корректный адрес", async function () {
    console.log("NFTPassport address:", nftPassport.address);
    expect(nftPassport.address).to.not.equal(ethers.constants.AddressZero);
  });
});
