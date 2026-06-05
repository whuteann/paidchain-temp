import { useRouter } from "next/router";
import { Shell, useNav } from "@/components/shell";
import { TerminalDetail } from "@/components/screen-terminals";

export default function TerminalDetailPage() {
  const router = useRouter();
  const nav = useNav();
  const { id } = router.query;
  if (!id) return null;
  return <Shell><TerminalDetail id={id as string} nav={nav} /></Shell>;
}
