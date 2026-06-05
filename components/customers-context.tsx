import { createContext, useContext, useState, ReactNode } from "react";
import { customers as initialCustomers } from "./data";
import type { Customer } from "./data";

interface CustomersCtx {
  customers: Customer[];
  addCustomer: (c: Customer) => void;
}

const CustomersContext = createContext<CustomersCtx | null>(null);

export function CustomersProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const addCustomer = (c: Customer) => setCustomers((prev) => [c, ...prev]);
  return (
    <CustomersContext.Provider value={{ customers, addCustomer }}>
      {children}
    </CustomersContext.Provider>
  );
}

export function useCustomers(): CustomersCtx {
  const ctx = useContext(CustomersContext);
  if (!ctx) throw new Error("useCustomers must be used within CustomersProvider");
  return ctx;
}
