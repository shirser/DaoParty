const hre = require("hardhat");

async function main() {
  const DaoParty = await hre.ethers.getContractFactory("DaoParty");
  const daoParty = await DaoParty.deploy();

  await daoParty.deployed();
  console.log(`DaoParty deployed to: ${daoParty.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
