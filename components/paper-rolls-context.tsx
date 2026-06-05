import { createContext, useContext, useState, ReactNode } from "react";
import { paperRollEntries as initialEntries } from "./data";
import type { PaperRollEntry } from "./data";

interface PaperRollsCtx {
  entries: PaperRollEntry[];
  addEntry: (e: PaperRollEntry) => void;
}

const PaperRollsContext = createContext<PaperRollsCtx | null>(null);

export function PaperRollsProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<PaperRollEntry[]>(initialEntries);
  const addEntry = (e: PaperRollEntry) => setEntries((prev) => [e, ...prev]);
  return (
    <PaperRollsContext.Provider value={{ entries, addEntry }}>
      {children}
    </PaperRollsContext.Provider>
  );
}

export function usePaperRolls(): PaperRollsCtx {
  const ctx = useContext(PaperRollsContext);
  if (!ctx) throw new Error("usePaperRolls must be used within PaperRollsProvider");
  return ctx;
}
