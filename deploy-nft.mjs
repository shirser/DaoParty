import { ethers } from "hardhat"; // Импортируем ethers напрямую

async function main() {
    try {
        const [deployer] = await ethers.getSigners(); // Используем ethers.getSigners()
        console.log("Deploying NFTPassport with account:", deployer.address);

        const NFTPassport = await ethers.getContractFactory("NFTPassport"); // ethers.getContractFactory
        const nftPassport = await NFTPassport.deploy(); // Deploy без аргументов (если конструктор пустой)
        await nftPassport.waitForDeployment();

        const nftPassportAddress = await nftPassport.getAddress(); // Получаем адрес отдельно
        console.log("NFTPassport deployed to:", nftPassportAddress);

        // Проверяем, что адрес не нулевой
        if (nftPassportAddress === ethers.ZeroAddress) {
            throw new Error("NFTPassport deployment failed: Zero address");
        }

        // Выдача тестового паспорта владельцу (если надо)
        console.log("Minting test NFTPassport for deployer...");
        const mintTx = await nftPassport.mintPassport(deployer.address);
        await mintTx.wait();

        console.log("Deployer has been assigned an NFT Passport.");

        // Верифицируем контракт (опционально, но рекомендуется)
        if (hardhat.network.name !== "hardhat") { // Не верифицируем локально
            try {
                await hardhat.run("verify:verify", {
                    address: nftPassportAddress,
                    constructorArguments: [], // Аргументы конструктора (если есть)
                });
                console.log("NFTPassport contract verified.");
            } catch (verifyError) {
                console.error("Contract verification failed:", verifyError);
            }
        }

    } catch (error) {
        console.error("Deployment failed:", error);
        process.exitCode = 1;
    }
}

main(); // Вызываем main