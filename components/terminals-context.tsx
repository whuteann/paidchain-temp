import { createContext, useContext, useState, ReactNode } from "react";
import { terminals as initialTerminals } from "./data";
import type { Terminal } from "./data";

interface TerminalsCtx {
  terminals: Terminal[];
  addTerminal: (t: Terminal) => void;
  updateTerminal: (serial: string, patch: Partial<Terminal>) => void;
}

const TerminalsContext = createContext<TerminalsCtx | null>(null);

export function TerminalsProvider({ children }: { children: ReactNode }) {
  const [terminals, setTerminals] = useState<Terminal[]>(initialTerminals);

  const addTerminal = (t: Terminal) => setTerminals((prev) => [t, ...prev]);

  const updateTerminal = (serial: string, patch: Partial<Terminal>) =>
    setTerminals((prev) => prev.map((t) => (t.serial === serial ? { ...t, ...patch } : t)));

  return (
    <TerminalsContext.Provider value={{ terminals, addTerminal, updateTerminal }}>
      {children}
    </TerminalsContext.Provider>
  );
}

export function useTerminals(): TerminalsCtx {
  const ctx = useContext(TerminalsContext);
  if (!ctx) throw new Error("useTerminals must be used within TerminalsProvider");
  return ctx;
}
