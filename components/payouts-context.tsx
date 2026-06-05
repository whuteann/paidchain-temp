import { createContext, useContext, useState, ReactNode } from "react";
import { payouts as initialPayouts, transactions as initialTransactions } from "./data";
import type { Payout, Transaction } from "./data";

interface PayoutsCtx {
  payouts: Payout[];
  transactions: Transaction[];
  addPayouts: (pos: Payout[], txns?: Transaction[]) => void;
  markAsPaid: (id: string, proofFileName: string) => void;
}

const PayoutsContext = createContext<PayoutsCtx | null>(null);

export function PayoutsProvider({ children }: { children: ReactNode }) {
  const [payouts, setPayouts] = useState<Payout[]>(initialPayouts);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);

  const addPayouts = (pos: Payout[], txns?: Transaction[]) => {
    setPayouts((prev) => [...pos, ...prev]);
    if (txns?.length) setTransactions((prev) => [...txns, ...prev]);
  };

  const markAsPaid = (id: string, proofFileName: string) => {
    const today = new Date().toISOString().slice(0, 10);
    setPayouts((prev) =>
      prev.map((p) => p.id === id ? { ...p, status: "Paid", einvoice: true, issued: today, paymentProof: proofFileName } : p)
    );
  };

  return (
    <PayoutsContext.Provider value={{ payouts, transactions, addPayouts, markAsPaid }}>
      {children}
    </PayoutsContext.Provider>
  );
}

export function usePayouts(): PayoutsCtx {
  const ctx = useContext(PayoutsContext);
  if (!ctx) throw new Error("usePayouts must be used within PayoutsProvider");
  return ctx;
}
