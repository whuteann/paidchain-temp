import { Shell, useNav } from "@/components/shell";
import { Jobs } from "@/components/screen-jobs";
import { useJobs } from "@/components/jobs-context";

export default function JobsPage() {
  const nav = useNav();
  const { jobs, onCreate } = useJobs();
  return <Shell><Jobs nav={nav} jobs={jobs} onCreate={onCreate} /></Shell>;
}
