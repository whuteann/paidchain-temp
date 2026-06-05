import { createContext, useContext, useMemo, useState, ReactNode } from "react";
import { DEFAULT_JOB_SLA_RULES } from "./data";
import type { SlaTransitionRule } from "./data";

interface JobSlaCtx {
  rules: Record<string, SlaTransitionRule[]>;
  updateRule: (jobType: string, from: string, to: string, patch: Partial<SlaTransitionRule>) => void;
  resetDefaults: () => void;
}

const JobSlaContext = createContext<JobSlaCtx | null>(null);

function cloneDefaults() {
  return Object.fromEntries(
    Object.entries(DEFAULT_JOB_SLA_RULES).map(([jobType, items]) => [
      jobType,
      items.map((item) => ({ ...item })),
    ])
  ) as Record<string, SlaTransitionRule[]>;
}

export function JobSlaProvider({ children }: { children: ReactNode }) {
  const [rules, setRules] = useState<Record<string, SlaTransitionRule[]>>(cloneDefaults);

  const updateRule = (jobType: string, from: string, to: string, patch: Partial<SlaTransitionRule>) => {
    setRules((prev) => ({
      ...prev,
      [jobType]: (prev[jobType] || []).map((rule) =>
        rule.from === from && rule.to === to ? { ...rule, ...patch } : rule
      ),
    }));
  };

  const value = useMemo(() => ({
    rules,
    updateRule,
    resetDefaults: () => setRules(cloneDefaults()),
  }), [rules]);

  return <JobSlaContext.Provider value={value}>{children}</JobSlaContext.Provider>;
}

export function useJobSla(): JobSlaCtx {
  const ctx = useContext(JobSlaContext);
  if (!ctx) throw new Error("useJobSla must be used within JobSlaProvider");
  return ctx;
}
