"use client";

import { useState } from "react";
import { connectWallet } from "@/utils/ethereum";
import { checkNFT } from "@/utils/nftPassportContract";

export default function ConnectWallet() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [hasNFT, setHasNFT] = useState<boolean | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  async function handleConnect() {
    console.log("🔌 Нажата кнопка подключения...");
    const result = await connectWallet();
    console.log("🔗 Результат подключения:", result);

    if (result) {
      setWallet(result.address);
      console.log("✅ Кошелек установлен:", result.address);

      // Лог перед вызовом checkNFT
      console.log("📞 Вызываем checkNFT для:", result.address);
      
      // Ожидаем, что checkNFT вернёт объект с полями hasNFT и reason
      const { hasNFT, reason } = await checkNFT(result.address);
      setHasNFT(hasNFT);
      setRejectionReason(reason);
      console.log("📜 Проверка NFT:", { hasNFT, reason });
    }
  }

  return (
    <div className="flex flex-col items-center p-6 bg-white shadow-lg rounded-lg">
      <h1 className="text-lg font-bold">Добро пожаловать в DAO Party!</h1>
      <p className="text-sm text-gray-700">Подключите свой кошелек, чтобы начать.</p>

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
