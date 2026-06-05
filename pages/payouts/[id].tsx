import { useRouter } from "next/router";
import { Shell, useNav } from "@/components/shell";
import { PayoutDetail } from "@/components/screen-payouts";

export default function PayoutDetailPage() {
  const router = useRouter();
  const nav = useNav();
  const { id } = router.query;
  if (!id) return null;
  return <Shell><PayoutDetail id={id as string} nav={nav} /></Shell>;
}
