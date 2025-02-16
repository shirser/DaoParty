"use client";

import { useEffect, useState } from "react";
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

  async function loadAccountData() {
    try {
      const result = await connectWallet();
      if (result) {
        setWallet(result.address);

        // Получаем баланс токенов
        const bal = await getBalance(result.address);
        setBalance(bal);

        // Получаем данные NFT-паспорта
        const nftResult = await checkNFT(result.address);
        setNftData(nftResult);

        // Получаем данные KYC
        const kyc = await getKYCData(result.address);
        setKycData(kyc);
      }
    } catch (error) {
      console.error("Ошибка при загрузке данных аккаунта:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccountData();
  }, []);

  if (loading) {
    return <p>Загрузка данных...</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Профиль</h1>
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
