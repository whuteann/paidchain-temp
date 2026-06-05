import { createContext, useContext, useState, ReactNode } from "react";
import { simCards as initialSimCards } from "./data";
import type { SimCard } from "./data";

interface SimCardsCtx {
  simCards: SimCard[];
  addSimCard: (s: SimCard) => void;
  updateSimCard: (id: string, patch: Partial<SimCard>) => void;
}

const SimCardsContext = createContext<SimCardsCtx | null>(null);

export function SimCardsProvider({ children }: { children: ReactNode }) {
  const [simCards, setSimCards] = useState<SimCard[]>(initialSimCards);

  const addSimCard = (s: SimCard) => setSimCards((prev) => [s, ...prev]);

  const updateSimCard = (id: string, patch: Partial<SimCard>) =>
    setSimCards((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  return (
    <SimCardsContext.Provider value={{ simCards, addSimCard, updateSimCard }}>
      {children}
    </SimCardsContext.Provider>
  );
}

export function useSimCards(): SimCardsCtx {
  const ctx = useContext(SimCardsContext);
  if (!ctx) throw new Error("useSimCards must be used within SimCardsProvider");
  return ctx;
}
