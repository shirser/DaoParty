"use client";

import { useEffect, useState } from "react";
import { likeProposal, getLikes, hasUserLiked } from "@/utils/daoParty";
import { getProposalsFromFirestore } from "@/utils/proposalsFirestore";
import ProposalCard from "./ProposalCard";
import AddProposal from "./AddProposal";

interface Proposal {
  id: string; // Firestore document ID
  proposalId: number;
  description: string;
  likes: number;
  userLiked: boolean;
  deadline: number;
}

export default function ProposalsList() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  async function updateProposals() {
    try {
      const proposalsFromFirestore = await getProposalsFromFirestore();
      const updatedProposals = proposalsFromFirestore.map((p) => ({
        id: p.id!,
        proposalId: p.proposalId,
        description: p.description,
        likes: p.likes,
        deadline: p.deadline,
        userLiked: false, // Пока оставляем false; можно добавить проверку, поставил ли пользователь лайк
      }));
      setProposals(updatedProposals);
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

  async function handleCreateProposal(text: string) {
    // Здесь вызывайте on-chain метод создания предложения,
    // а затем обновляйте список через updateProposals().
    // Для демонстрации обновляем список предложений:
    await updateProposals();
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
            id={proposal.proposalId}
            text={proposal.description}
            likes={proposal.likes}
            userLiked={proposal.userLiked}
            onLike={handleLike}
          />
        ))
      )}
    </div>
  );
}
