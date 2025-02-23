"use client";

import { useState } from "react";

interface AddProposalProps {
  onCreate: (text: string) => void;
}

export default function AddProposal({ onCreate }: AddProposalProps) {
  const [open, setOpen] = useState<boolean>(false);
  const [text, setText] = useState<string>("");

  const handleSubmit = () => {
    if (text.trim().length === 0) return;
    onCreate(text);
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
