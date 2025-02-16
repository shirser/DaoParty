import { ethers } from "ethers";
import { provider } from "./ethereum";

const daoPartyAddress = process.env.NEXT_PUBLIC_DAOPARTY_CONTRACT!;
const daoPartyABI = [
  "function likes(uint256 proposalId) external view returns (uint256)",
  "function liked(uint256 proposalId, address user) external view returns (bool)",
  "function likeProposal(uint256 proposalId) external",
];

if (!daoPartyAddress) {
  throw new Error("Адрес контракта DaoParty не задан в переменных окружения!");
}

async function getDaoPartyContract(withSigner = false) {
  if (withSigner) {
    if (!provider) {
      throw new Error("Провайдер не найден");
    }
    // Запрашиваем подключение аккаунтов через window.ethereum.request
    if (typeof window !== "undefined" && window.ethereum) {
      await window.ethereum.request({ method: "eth_requestAccounts" });
    }
    // Получаем список аккаунтов через provider.send("eth_accounts", [])
    const accounts = await provider.send("eth_accounts", []);
    if (!accounts || accounts.length === 0) {
      throw new Error("Нет доступных аккаунтов. Пожалуйста, подключите кошелек.");
    }
    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();
    console.log("Используем signer с адресом:", signerAddress);
    return new ethers.Contract(daoPartyAddress, daoPartyABI, signer);
  } else {
    return new ethers.Contract(daoPartyAddress, daoPartyABI, provider);
  }
}

export async function likeProposal(proposalId: number): Promise<void> {
  try {
    const contract = await getDaoPartyContract(true);
    const tx = await contract.likeProposal(proposalId);
    await tx.wait(); // Дождаться подтверждения транзакции
    console.log("Лайк успешно поставлен");
  } catch (error) {
    console.error("Ошибка при постановке лайка:", error);
    throw error;
  }
}

export async function getLikes(proposalId: number): Promise<number> {
  const contract = await getDaoPartyContract();
  const likes = await contract.likes(proposalId);
  return Number(likes);
}

export async function hasUserLiked(proposalId: number, userAddress: string): Promise<boolean> {
  const contract = await getDaoPartyContract();
  const liked = await contract.liked(proposalId, userAddress);
  return liked;
}
