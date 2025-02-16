"use client";

import { useEffect, useState } from "react";
import { likeProposal, getLikes, hasUserLiked } from "@/utils/daoParty";

// Определяем интерфейс для предложения
interface Proposal {
  id: number;
  text: string;
  likes: number;
  userLiked: boolean;
}

export default function ProposalsList() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Загрузка списка предложений (пока заглушка)
  useEffect(() => {
    // Пример массива предложений
    const sampleProposals: Proposal[] = [
      { id: 1, text: "Предложение 1: Улучшить интерфейс", likes: 0, userLiked: false },
      { id: 2, text: "Предложение 2: Добавить новые функции", likes: 0, userLiked: false },
      { id: 3, text: "Предложение 3: Оптимизировать работу контракта", likes: 0, userLiked: false },
    ];
    setProposals(sampleProposals);
    setLoading(false);
  }, []);

  // Функция обработки лайка
  async function handleLike(proposalId: number) {
    try {
      await likeProposal(proposalId);
      // После успешного лайка обновляем данные для предложения
      const updatedProposals = await Promise.all(
        proposals.map(async (proposal) => {
          if (proposal.id === proposalId) {
            const newLikes = await getLikes(proposalId);
            // Здесь вместо "0xYourUserAddress" нужно передать адрес подключённого пользователя
            const userLiked = await hasUserLiked(proposalId, "0xYourUserAddress");
            return { ...proposal, likes: newLikes, userLiked };
          }
          return proposal;
        })
      );
      setProposals(updatedProposals);
    } catch (error) {
      console.error("Ошибка при постановке лайка:", error);
    }
  }

  if (loading) {
    return <p>Загрузка предложений...</p>;
  }

  return (
    <div className="space-y-4">
      {proposals.map((proposal) => (
        <div key={proposal.id} className="p-4 border rounded shadow">
          <p className="mb-2">{proposal.text}</p>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleLike(proposal.id)}
              disabled={proposal.userLiked}
              className={`px-3 py-1 text-sm rounded ${
                proposal.userLiked ? "bg-gray-400" : "bg-blue-600 text-white"
              }`}
            >
              {proposal.userLiked ? "Лайк поставлен" : "Поставить лайк"}
            </button>
            <p>
              Лайков: <span>{proposal.likes}</span>
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
