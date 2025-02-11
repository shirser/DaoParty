const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DaoParty", function () {
  let daoParty;
  let owner, addr1;
  // Тестовый адрес NFT-контракта
  const dummyNftAddress = "0x1000000000000000000000000000000000000001";

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();

    const DaoParty = await ethers.getContractFactory("DaoParty");
    // Для ethers v6 используем ethers.ZeroAddress для нулевого адреса
    daoParty = await DaoParty.deploy(owner.address, ethers.ZeroAddress);
    
    // Ожидаем завершения развертывания контракта
    await daoParty.waitForDeployment();
    
    // Вывод адреса контракта для отладки
    console.log("DaoParty deployed at:", daoParty.target);
  });

  describe("setNftContract", function () {
    it("должен позволить владельцу установить адрес NFT-контракта", async function () {
      await expect(daoParty.setNftContract(dummyNftAddress))
        .to.emit(daoParty, "NftContractUpdated")
        .withArgs(dummyNftAddress);

      expect(await daoParty.nftContract()).to.equal(dummyNftAddress);
    });

    it("должен отклонить вызов функции не владельцем", async function () {
      await expect(
        daoParty.connect(addr1).setNftContract(dummyNftAddress)
      )
        // Проверяем, что выбрасывается ошибка OwnableUnauthorizedAccount с параметром addr1.address
        .to.be.revertedWithCustomError(daoParty, "OwnableUnauthorizedAccount")
        .withArgs(addr1.address);
    });
  });
});
