import { ethers } from "ethers";

// Подключение к RPC Amoy Testnet
const rpcUrl = "https://rpc-amoy.polygon.technology";
const provider = new ethers.JsonRpcProvider(rpcUrl);

console.log("🌍 Подключаемся к сети:", rpcUrl);

async function connectWallet() {
  if (typeof window === "undefined" || !window.ethereum) {
    alert("Установите MetaMask!");
    return null;
  }

  try {
    const browserProvider = new ethers.BrowserProvider(window.ethereum);
    await browserProvider.send("eth_requestAccounts", []); // Запрос разрешения на подключение
    const signer = await browserProvider.getSigner(); // Получаем signer асинхронно
    const address = await signer.getAddress(); // Теперь getAddress() будет работать

    console.log("✅ Кошелек подключен:", address);
    return { address, signer };
  } catch (error) {
    console.error("❌ Ошибка при подключении кошелька:", error);
    return null;
  }
}

export { provider, connectWallet };
