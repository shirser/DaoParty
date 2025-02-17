"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { connectWallet } from "@/utils/ethereum";
import { getBalance } from "@/utils/balance";
import { checkNFT } from "@/utils/nftPassportContract";
import { getKYCData } from "@/utils/kyc";

interface NFTData {
  hasNFT: boolean;
  reason: string | null;
  tokenId?: string;
}

interface KYCData {
  verified: boolean;
  expiry: number | null;
  documentType: string | null;
}

export default function ProfilePage() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [nftData, setNftData] = useState<NFTData | null>(null);
  const [kycData, setKycData] = useState<KYCData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();

  async function loadAccountData() {
    try {
      const result = await connectWallet();
      if (result) {
        setWallet(result.address);
        const bal = await getBalance(result.address);
        setBalance(bal);
        const nftResult = await checkNFT(result.address);
        setNftData(nftResult);
        const kyc = await getKYCData(result.address);
        setKycData(kyc);
      }
    } catch (error) {
      console.error("Ошибка при загрузке данных аккаунта:", error);
    } finally {
      setLoading(false);
    }
  }

  // Функция "Выйти": очищает данные и перенаправляет на страницу подключения кошелька
  function handleLogout() {
    setWallet(null);
    setBalance(null);
    setNftData(null);
    setKycData(null);
    console.log("Пользователь разлогинен");
    router.push("/"); // Предполагается, что на "/" находится страница подключения кошелька
  }

  useEffect(() => {
    loadAccountData();
  }, []);

  if (loading) {
    return <p>Загрузка данных...</p>;
  }

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded-lg shadow-md">
      {/* Навигация табов определяется общим layout (src/app/dashboard/layout.tsx) */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold mb-4">Профиль</h1>
        <button
          onClick={handleLogout}
          className="px-4 py-2 text-sm text-white bg-red-600 rounded hover:bg-red-700"
        >
          Выйти
        </button>
      </div>

      {wallet ? (
        <>
          <p>
            <strong>Кошелек:</strong> {wallet}
          </p>
          <p>
            <strong>Баланс:</strong> {balance ? balance : "Нет данных"}
          </p>
          <h2 className="mt-4 font-semibold">NFT-паспорт</h2>
          {nftData ? (
            <>
              <p>
                <strong>Статус:</strong>{" "}
                {nftData.hasNFT
                  ? "✅ Есть"
                  : `❌ Нет${nftData.reason ? ` (${nftData.reason})` : ""}`}
              </p>
              {nftData.tokenId && (
                <p>
                  <strong>ID NFT-паспорта:</strong> {nftData.tokenId}
                </p>
              )}
            </>
          ) : (
            <p>Нет данных о NFT</p>
          )}
          <h2 className="mt-4 font-semibold">Данные KYC</h2>
          {kycData ? (
            <ul className="list-disc ml-6">
              <li>
                <strong>Верифицирован:</strong>{" "}
                {kycData.verified ? "✅ Да" : "❌ Нет"}
              </li>
              <li>
                <strong>Срок действия:</strong>{" "}
                {kycData.expiry
                  ? new Date(kycData.expiry * 1000).toLocaleString()
                  : "Нет данных"}
              </li>
              <li>
                <strong>Тип документа:</strong>{" "}
                {kycData.documentType || "Нет данных"}
              </li>
            </ul>
          ) : (
            <p>Нет данных KYC</p>
          )}
        </>
      ) : (
        <p>Кошелек не подключён</p>
      )}
    </div>
  );
}
