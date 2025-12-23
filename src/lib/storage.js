const KEY = "agenda_v1";

export function loadEvents() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Erro ao carregar eventos:", e);
    return [];
  }
}

export function saveEvents(events) {
  try {
    localStorage.setItem(KEY, JSON.stringify(events));
  } catch (e) {
    console.error("Erro ao salvar eventos:", e);
  }
}
