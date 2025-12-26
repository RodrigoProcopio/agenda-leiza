// src/lib/financeFiltersStore.js

// Armazena os filtros atuais da tela de Financeiro
// para que a exportação consiga respeitar mês/ano + status.

let lastFilters = {
  year: null,   // ex: 2025
  month: null,  // 1-12
  status: "todos", // "todos" | "a_receber" | "recebido"
};

export function setFinanceFilters(partial) {
  lastFilters = {
    ...lastFilters,
    ...partial,
  };
}

export function getFinanceFilters() {
  return lastFilters;
}
