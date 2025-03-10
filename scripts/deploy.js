// scripts/deploy.js
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Развертывание NFTPassport
  const NFTPassport = await ethers.getContractFactory("NFTPassport");
  const nftPassport = await NFTPassport.deploy();
  await nftPassport.waitForDeployment();
  const nftPassportAddress = await nftPassport.getAddress();
  console.log("NFTPassport deployed to:", nftPassportAddress);

  // Развертывание DaoParty
  const DaoParty = await ethers.getContractFactory("DaoParty");
  const daoParty = await DaoParty.deploy(deployer.address);
  await daoParty.waitForDeployment();
  const daoPartyAddress = await daoParty.getAddress();
  console.log("DaoParty deployed to:", daoPartyAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
