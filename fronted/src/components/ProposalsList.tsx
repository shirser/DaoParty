"use client";

import { useEffect, useState } from "react";
import { likeProposal, getLikes, hasUserLiked } from "@/utils/daoParty";
import ProposalCard from "./ProposalCard";
import AddProposal from "./AddProposal";

interface Proposal {
  id: number;
  text: string;
  likes: number;
  userLiked: boolean;
}

export default function ProposalsList() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Пока on-chain данные не получаются, инициализируем список предложений пустым
    setProposals([]);
    setLoading(false);
  }, []);

  // Функция для обработки создания нового предложения
  function handleCreateProposal(text: string) {
    // Здесь вы бы вызвали метод смарт-контракта для создания предложения.
    // Пока для демонстрации добавляем предложение в локальное состояние.
    const newProposal: Proposal = {
      id: proposals.length + 1, // Примерное определение ID
      text,
      likes: 0,
      userLiked: false,
    };
    setProposals([...proposals, newProposal]);
  }

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
      <AddProposal onCreate={handleCreateProposal} />
      {proposals.length === 0 ? (
        <p>Нет предложений</p>
      ) : (
        proposals.map((proposal) => (
          <ProposalCard
            key={proposal.id}
            id={proposal.id}
            text={proposal.text}
            likes={proposal.likes}
            userLiked={proposal.userLiked}
            onLike={handleLike}
          />
        ))
      )}
    </div>
  );
}
