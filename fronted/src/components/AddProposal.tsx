"use client";

import { useState, useEffect } from "react";
import { createProposal } from "@/utils/daoParty";
import { ethers } from "ethers";

// Замените на реальный адрес вашего смарт‑контракта
const contractAddress = "0xF33f51C638Ab1394818ce7c6F3F0D8c272235071";
// Вставьте фрагменты ABI для получения данных о предложениях (например, getProposal)
const contractABI = [
  "function getProposal(uint256 index) public view returns (string memory, bool, uint256, uint256, uint256)"
];

export default function AddProposal() {
  const [open, setOpen] = useState<boolean>(false);
  const [text, setText] = useState<string>("");
  const [proposals, setProposals] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (text.trim().length === 0) {
      setError("Текст предложения не может быть пустым.");
      return;
    }
    try {
      const votingPeriod = 7 * 24 * 3600; // 7 дней
      setError(null);
      const txSuccess = await createProposal(text, votingPeriod);
      if (txSuccess) {
        console.log("Предложение успешно создано on-chain");
        await fetchProposals(); // Обновляем список предложений после создания
      } else {
        throw new Error("Ошибка при отправке транзакции в блокчейн.");
      }
    } catch (error: any) {
      setError(`Ошибка при создании предложения: ${error.message}`);
      console.error("Ошибка при создании предложения:", error);
    }
    setText("");
    setOpen(false);
  };

  const fetchProposals = async () => {
    try {
      if (!window.ethereum) {
        throw new Error("Нет доступа к Ethereum. Убедитесь, что установлен MetaMask.");
      }
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send("eth_requestAccounts", []); // Запрашиваем доступ к аккаунтам
      const contract = new ethers.Contract(contractAddress, contractABI, provider);
      
      // Если в контракте реализована функция для получения количества предложений,
      // её можно вызвать, например:
      // const proposalCount = await contract.getProposalsCount();
      // Для демонстрации используем фиксированное число:
      const proposalCount = 3;
      
      const fetchedProposals = [];
      for (let i = 0; i < proposalCount; i++) {
        const proposal = await contract.getProposal(i);
        // Предполагается, что getProposal возвращает кортеж:
        // (description, completed, votesFor, votesAgainst, deadline)
        fetchedProposals.push({
          description: proposal[0],
          completed: proposal[1],
          votesFor: proposal[2].toNumber(),
          votesAgainst: proposal[3].toNumber(),
          deadline: new Date(proposal[4].toNumber() * 1000).toLocaleString(),
        });
      }
      setProposals(fetchedProposals);
    } catch (error: any) {
      setError(`Ошибка при получении предложений: ${error.message}`);
      console.error("Ошибка при получении предложений:", error);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, []);

  return (
    <div className="mb-4">
      {error && <div className="text-red-600 mb-2">{error}</div>}
      
      {!open ? (
        <button
          className="px-4 py-2 bg-green-600 text-white rounded"
          onClick={() => setOpen(true)}
        >
          Предложить
        </button>
      ) : (
        <div className="flex flex-col space-y-2">
          <textarea
            className="border rounded p-2"
            placeholder="Введите предложение..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          ></textarea>
          <div>
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded mr-2"
              onClick={handleSubmit}
            >
              Создать предложение
            </button>
            <button
              className="px-4 py-2 bg-gray-300 text-black rounded"
              onClick={() => setOpen(false)}
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      <h2 className="mt-4">Список предложений</h2>
      <ul>
        {proposals.length === 0 ? (
          <p>Нет предложений</p>
        ) : (
          proposals.map((proposal, index) => (
            <li key={index} className="p-2 border-b">
              <strong>Описание:</strong> {proposal.description}<br />
              <strong>Голоса за:</strong> {proposal.votesFor} |
              <strong> Голоса против:</strong> {proposal.votesAgainst}<br />
              <strong>Завершено:</strong> {proposal.completed ? "Да" : "Нет"}<br />
              <strong>Крайний срок:</strong> {proposal.deadline}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
