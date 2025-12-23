import React from "react";

export default function Fab({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-20 right-4 z-40 rounded-full bg-blue-600 px-5 py-3 text-white shadow-lg active:scale-95 md:bottom-6"
    >
      ➕ Novo
    </button>
  );
}
