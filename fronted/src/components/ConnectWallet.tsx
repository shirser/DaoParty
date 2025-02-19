"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { connectWallet } from "@/utils/ethereum";
import { checkNFT } from "@/utils/nftPassportContract";

export default function ConnectWallet() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [hasNFT, setHasNFT] = useState<boolean | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const router = useRouter();

  async function handleConnect() {
    console.log("🔌 Нажата кнопка подключения...");
    // Ожидаем, что connectWallet возвращает объект { address, signer }
    const result = await connectWallet();
    console.log("🔗 Результат подключения:", result);

    if (result) {
      setWallet(result.address);
      console.log("✅ Кошелек подключен:", result.address);

      console.log("📞 Вызываем checkNFT для:", result.address);
      // Получаем данные о NFT-паспорте
      const nftResult = await checkNFT(result.address);
      setHasNFT(nftResult.hasNFT);
      setRejectionReason(nftResult.reason);
      console.log("📜 Проверка NFT:", nftResult);

      // Если NFT-паспорт есть, переходим на страницу профиля
      if (nftResult.hasNFT) {
        router.push("/dashboard/profile");
      }
    }
  }

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={handleConnect}
        className="mt-4 px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
      >
        Подключить кошелек
      </button>

      {wallet && <p className="mt-2 text-sm text-gray-700">Кошелек: {wallet}</p>}

      {hasNFT !== null && (
        <p className="mt-2 text-sm">
          NFT-паспорт: {hasNFT ? "✅ Есть" : "❌ Нет"}
        </p>
      )}

      {rejectionReason && (
        <div className="mt-2 p-2 bg-red-100 text-red-600 rounded-lg text-sm">
          🚫 {rejectionReason}
        </div>
      )}
    </div>
  );
}
