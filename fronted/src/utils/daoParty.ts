import { ethers } from "ethers";
import { provider } from "./ethereum";

const daoPartyAddress = process.env.NEXT_PUBLIC_DAOPARTY_CONTRACT!;
const daoPartyABI = [
  "function createProposal(string description, uint256 votingPeriod) external returns (bool)",
  "function likes(uint256 proposalId) external view returns (uint256)",
  "function liked(uint256 proposalId, address user) external view returns (bool)",
  "function likeProposal(uint256 proposalId) external"
];

if (!daoPartyAddress) {
  throw new Error("Адрес контракта DaoParty не задан в переменных окружения!");
}

async function getDaoPartyContract(withSigner = false) {
  if (withSigner) {
    if (!provider) {
      throw new Error("Провайдер не найден");
    }
    if (typeof window !== "undefined" && window.ethereum) {
      await window.ethereum.request({ method: "eth_requestAccounts" });
    }
    const accounts = (await window.ethereum!.request({ method: "eth_accounts" })) as string[];
    if (!accounts || accounts.length === 0) {
      throw new Error("Нет доступных аккаунтов. Пожалуйста, подключите кошелек.");
    }
    const browserProvider = provider as ethers.BrowserProvider;
    const signer = await browserProvider.getSigner();
    const signerAddress = await signer.getAddress();
    console.log("Используем signer с адресом:", signerAddress);
    return new ethers.Contract(daoPartyAddress, daoPartyABI, signer);
  } else {
    return new ethers.Contract(daoPartyAddress, daoPartyABI, provider);
  }
}

export async function createProposal(description: string, votingPeriod: number): Promise<boolean> {
  try {
    const contract = await getDaoPartyContract(true);
    const tx = await contract.createProposal(description, votingPeriod);
    await tx.wait();
    console.log("Предложение успешно создано on-chain");
    return true;
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Ошибка при создании предложения:", err);
    throw err;
  }
}

export async function likeProposal(proposalId: number): Promise<void> {
  try {
    const contract = await getDaoPartyContract(true);
    const tx = await contract.likeProposal(proposalId);
    await tx.wait();
    console.log("Лайк успешно поставлен");
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Ошибка при постановке лайка:", err);
    throw err;
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
