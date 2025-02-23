"use client";

import { useEffect, useState } from "react";
import { likeProposal, getLikes, hasUserLiked, getProposals } from "@/utils/daoParty";
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

  // Функция для обновления списка предложений с on‑chain данных
  async function updateProposals() {
    try {
      const proposalsOnChain = await getProposals();
      setProposals(proposalsOnChain);
    } catch (error) {
      console.error("Ошибка получения предложений:", error);
      setProposals([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    updateProposals();
  }, []);

  // Функция для создания нового предложения on‑chain
  async function handleCreateProposal(text: string) {
    try {
      // Здесь вы бы вызвали on‑chain функцию создания предложения, например:
      // await createProposal(text, 7 * 24 * 3600);
      // После успешного создания обновляем список предложений:
      await updateProposals();
    } catch (error) {
      console.error("Ошибка при создании предложения:", error);
    }
  }

  async function handleLike(proposalId: number) {
    try {
      await likeProposal(proposalId);
      await updateProposals();
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
