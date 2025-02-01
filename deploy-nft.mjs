import hardhat from "hardhat";

async function main() {
    const [deployer] = await hardhat.ethers.getSigners();
    console.log("Deploying NFTPassport with account:", deployer.address);

    const NFTPassport = await hardhat.ethers.getContractFactory("NFTPassport");

    // Деплой контракта с указанием владельца
    const nftPassport = await NFTPassport.deploy();
    await nftPassport.waitForDeployment();

    console.log("NFTPassport deployed to:", await nftPassport.getAddress());

    // Выдача тестового паспорта владельцу (если надо)
    console.log("Minting test NFTPassport for deployer...");
    const tx = await nftPassport.mintPassport(deployer.address);
    await tx.wait();

    console.log("Deployer has been assigned an NFT Passport.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
