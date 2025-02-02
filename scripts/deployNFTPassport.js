// scripts/deployNFTPassport.js
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying NFTPassport with the account:", deployer.address);

  const NFTPassport = await ethers.getContractFactory("NFTPassport");
  const nftPassport = await NFTPassport.deploy();
  await nftPassport.waitForDeployment();

  const nftPassportAddress = await nftPassport.getAddress();
  console.log("NFTPassport deployed to:", nftPassportAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
