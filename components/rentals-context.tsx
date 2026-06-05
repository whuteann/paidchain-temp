import { createContext, useContext, useState, ReactNode } from "react";
import { rentals as initialRentals } from "./data";
import type { Rental } from "./data";

interface RentalsCtx {
  rentals: Rental[];
  addRental: (r: Rental) => void;
  updateRental: (id: string, patch: Partial<Rental>) => void;
}

const RentalsContext = createContext<RentalsCtx | null>(null);

export function RentalsProvider({ children }: { children: ReactNode }) {
  const [rentals, setRentals] = useState<Rental[]>(initialRentals);

  const addRental = (r: Rental) => setRentals((prev) => [r, ...prev]);
  const updateRental = (id: string, patch: Partial<Rental>) =>
    setRentals((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <RentalsContext.Provider value={{ rentals, addRental, updateRental }}>
      {children}
    </RentalsContext.Provider>
  );
}

export function useRentals(): RentalsCtx {
  const ctx = useContext(RentalsContext);
  if (!ctx) throw new Error("useRentals must be used within RentalsProvider");
  return ctx;
}
