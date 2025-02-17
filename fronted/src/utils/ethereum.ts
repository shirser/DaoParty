import { ethers } from "ethers";

// Если MetaMask доступен, используем BrowserProvider, иначе JSON-RPC Provider
let provider;
if (typeof window !== "undefined" && window.ethereum) {
  provider = new ethers.BrowserProvider(window.ethereum);
} else {
  const rpcUrl = "https://rpc-amoy.polygon.technology";
  provider = new ethers.JsonRpcProvider(rpcUrl);
}

// Логируем информацию о провайдере без обращения к несуществующему свойству connection.url
console.log("🌍 Подключаемся к сети:", provider ? provider.constructor.name : "Провайдер не найден");

async function connectWallet() {
  if (typeof window === "undefined" || !window.ethereum) {
    alert("Установите MetaMask!");
    return null;
  }

  try {
    // Используем BrowserProvider для подключения через MetaMask
    if (provider instanceof ethers.BrowserProvider) {
      // Запрашиваем разрешение на подключение аккаунтов
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      console.log("✅ Кошелек подключен:", address);
      return { address, signer };
    } else {
      throw new Error("BrowserProvider не найден");
    }
  } catch (error) {
    console.error("❌ Ошибка при подключении кошелька:", error);
    return null;
  }
}

export { provider, connectWallet };
