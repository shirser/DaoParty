"use client";

import React from "react";

interface ProposalCardProps {
  id: number;
  text: string;
  likes: number;
  userLiked: boolean;
  onLike: (id: number) => void;
}

const ProposalCard: React.FC<ProposalCardProps> = ({ id, text, likes, userLiked, onLike }) => {
  return (
    <div className="p-4 border rounded shadow mb-4">
      <p className="mb-2">{text}</p>
      <div className="flex items-center space-x-2">
        <button
          onClick={() => onLike(id)}
          disabled={userLiked}
          className={`px-3 py-1 text-sm rounded ${
            userLiked ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {userLiked ? "Лайк поставлен" : "Поставить лайк"}
        </button>
        <p>
          Лайков: <span>{likes}</span>
        </p>
      </div>
    </div>
  );
};

export default ProposalCard;
