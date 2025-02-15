import { ethers } from "ethers";
import { provider } from "./ethereum";

// Функция получения баланса кошелька (в ETH)
// Если у вас используется другой токен, можно изменить логику
export async function getBalance(address: string): Promise<string> {
  try {
    // Получаем баланс (в wei)
    const balanceWei = await provider.getBalance(address);
    // Преобразуем баланс в строку в формате ETH (если ethers v6, используйте ethers.formatEther)
    return ethers.formatEther(balanceWei);
  } catch (error) {
    console.error("Ошибка при получении баланса:", error);
    return "0";
  }
}
