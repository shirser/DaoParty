"use client";

import { useState } from "react";
import { createProposal } from "@/utils/daoParty";
import { addProposalToFirestore, ProposalFirestore } from "@/utils/proposalsFirestore";

interface AddProposalProps {
  onCreate: (text: string) => Promise<void>;
}

export default function AddProposal({ onCreate }: AddProposalProps) {
  const [open, setOpen] = useState<boolean>(false);
  const [text, setText] = useState<string>("");

  const handleSubmit = async () => {
    if (text.trim().length === 0) return;
    try {
      // Задаем период голосования: 7 дней = 7 * 24 * 3600 секунд
      const votingPeriod = 7 * 24 * 3600;
      const txSuccess = await createProposal(text, votingPeriod);
      if (txSuccess) {
        console.log("Предложение успешно создано on-chain");
        // Здесь можно получить on-chain ID предложения, если контракт его возвращает.
        // Пока используем 0 как заглушку.
        const proposalOnChainId = 0;
        
        // Формируем объект данных для Firestore
        const proposalData: ProposalFirestore = {
          proposalId: proposalOnChainId,
          description: text,
          deadline: Math.floor(Date.now() / 1000) + votingPeriod,
          likes: 0,
          createdAt: Date.now(),
        };
        await addProposalToFirestore(proposalData);
        
        // Вызываем callback для обновления списка предложений
        await onCreate(text);
      }
    } catch (error) {
      console.error("Ошибка при создании предложения:", error);
    }
    setText("");
    setOpen(false);
  };

  return (
    <div className="mb-4">
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
    </div>
  );
}
