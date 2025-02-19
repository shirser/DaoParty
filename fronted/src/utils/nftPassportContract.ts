import { ethers } from "ethers";

// Используем BrowserProvider вместо JsonRpcProvider!
const provider =
  typeof window !== "undefined" && window.ethereum
    ? new ethers.BrowserProvider(window.ethereum)
    : null;

const nftPassportABI = [
  "function balanceOf(address owner) external view returns (uint256)",
  "function hasPassport(address user) external view returns (bool)",
  "function getUserPassport(address user) external view returns (uint256)",
  "function mintPassport(address user) external"
];

console.log("🔍 NEXT_PUBLIC_NFT_CONTRACT:", process.env.NEXT_PUBLIC_NFT_CONTRACT);
console.log("🔍 NEXT_PUBLIC_DAOPARTY_CONTRACT:", process.env.NEXT_PUBLIC_DAOPARTY_CONTRACT);

const nftPassportAddress = process.env.NEXT_PUBLIC_NFT_CONTRACT!;
console.log("🔗 Адрес контракта:", nftPassportAddress);

if (!nftPassportAddress) {
  throw new Error("❌ Адрес контракта NFT не задан в переменных окружения!");
}

async function getSigner() {
  if (!provider) {
    console.error("❌ Ошибка: MetaMask не найден!");
    throw new Error("MetaMask не найден!");
  }
  try {
    console.log("🌍 Подключаемся к MetaMask...");
    console.log("🖥️ Провайдер:", provider);
    await provider.send("eth_requestAccounts", []); // Запрашиваем доступ
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    console.log("👤 Signer адрес:", address);
    return signer;
  } catch (error: unknown) {
    const err = error as Error;
    console.error("❌ Ошибка при получении signer:", err);
    throw new Error("Ошибка получения signer. Проверь MetaMask.");
  }
}

async function getNftPassportContract() {
  const signer = await getSigner();
  console.log("📜 Создаем контракт NFTPassport...");
  console.log("🔗 Контракт адрес:", nftPassportAddress);
  console.log("📝 ABI контракта:", nftPassportABI);
  const contract = new ethers.Contract(nftPassportAddress, nftPassportABI, signer);
  console.log("🛠 Создан контракт NFTPassport:", contract);
  return contract;
}

async function checkNFT(address: string): Promise<{ hasNFT: boolean; reason: string | null }> {
  console.log("📞 Вызываем checkNFT для:", address);
  try {
    const nftPassportContract = await getNftPassportContract();
    console.log("🛠 Контракт NFTPassport создан:", nftPassportContract);

    // 🔎 Проверяем баланс NFT
    console.log("🔍 Вызываем balanceOf...");
    const balanceRaw = await nftPassportContract.balanceOf(address);
    if (balanceRaw == null) {
      console.error("❌ Ошибка: balanceOf вернул undefined или null");
      return { hasNFT: false, reason: "Ошибка вызова balanceOf" };
    }
    console.log("✅ Баланс NFT перед проверкой:", balanceRaw.toString());

    // Преобразуем баланс в BigInt
    const balance = BigInt(balanceRaw.toString());
    console.log("✅ Баланс NFT после преобразования в BigInt:", balance.toString());

    if (balance <= 0n) {
      console.log("🚫 У пользователя нет NFT.");
      return { hasNFT: false, reason: "Вы должны владеть NFT" };
    }

    // 🔎 Проверяем, есть ли паспорт
    console.log("📜 Проверяем hasPassport...");
    const hasPassport = await nftPassportContract.hasPassport(address);
    console.log("📜 Пользователь имеет NFT-паспорт?", hasPassport);
    if (!hasPassport) {
      return { hasNFT: false, reason: "Паспорт не найден в системе" };
    }

    console.log("🆔 Получаем ID NFT-паспорта...");
    const tokenId = await nftPassportContract.getUserPassport(address);
    console.log("🆔 ID NFT-паспорта:", tokenId.toString());

    return { hasNFT: true, reason: null };
  } catch (error: unknown) {
    const err = error as Error;
    console.error("❌ Ошибка при вызове balanceOf:", err);
    return { hasNFT: false, reason: err.message || "Неизвестная ошибка" };
  }
}

export { checkNFT };
