import { createContext, useContext, useState, ReactNode } from "react";
import { merchants as initialMerchants } from "./data";
import type { Merchant } from "./data";

interface MerchantsCtx {
  merchants: Merchant[];
  addMerchant: (m: Merchant) => void;
}

const MerchantsContext = createContext<MerchantsCtx | null>(null);

export function MerchantsProvider({ children }: { children: ReactNode }) {
  const [merchants, setMerchants] = useState<Merchant[]>(initialMerchants);
  const addMerchant = (m: Merchant) => setMerchants((prev) => [m, ...prev]);
  return (
    <MerchantsContext.Provider value={{ merchants, addMerchant }}>
      {children}
    </MerchantsContext.Provider>
  );
}

export function useMerchants(): MerchantsCtx {
  const ctx = useContext(MerchantsContext);
  if (!ctx) throw new Error("useMerchants must be used within MerchantsProvider");
  return ctx;
}
