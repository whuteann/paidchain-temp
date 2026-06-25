import { Shell, useNav } from "@/components/shell";
import { Jobs } from "@/components/screen-jobs";

export default function JobsPage() {
  const nav = useNav();
  return <Shell><Jobs nav={nav} /></Shell>;
}
