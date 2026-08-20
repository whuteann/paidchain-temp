import { useRouter } from "next/router";
import { ProfitShareDetail } from "@/components/screen-profit-shares";
import { Shell, useNav } from "@/components/shell";

export default function ProfitShareDetailPage() {
  const router = useRouter();
  const nav = useNav();
  const { id } = router.query;
  if (!id) return null;
  return <Shell><ProfitShareDetail key={String(id)} id={String(id)} nav={nav} /></Shell>;
}
