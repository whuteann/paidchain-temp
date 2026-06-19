import { useRouter } from "next/router";
import { Shell, useNav } from "@/components/shell";
import { JobDetail } from "@/components/screen-jobs";

export default function JobDetailPage() {
  const router = useRouter();
  const nav = useNav();
  const { id } = router.query;

  if (!id) return null;
  return <Shell><JobDetail id={id as string} nav={nav} /></Shell>;
}
