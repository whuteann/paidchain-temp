import { createContext, useContext, useState, ReactNode } from "react";
import { jobs as initialJobs } from "./data";
import type { Job } from "./data";

interface JobsCtx {
  jobs: Job[];
  onCreate: (job: Job) => void;
  onUpdate: (id: string, patch: Partial<Job>) => void;
}

const JobsContext = createContext<JobsCtx | null>(null);

export function JobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const onCreate = (job: Job) => setJobs((prev) => [job, ...prev]);
  const onUpdate = (id: string, patch: Partial<Job>) =>
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  return (
    <JobsContext.Provider value={{ jobs, onCreate, onUpdate }}>
      {children}
    </JobsContext.Provider>
  );
}

export function useJobs(): JobsCtx {
  const ctx = useContext(JobsContext);
  if (!ctx) throw new Error("useJobs must be used within JobsProvider");
  return ctx;
}
