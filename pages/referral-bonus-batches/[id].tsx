import { useRouter } from "next/router";
import { Shell, useNav } from "@/components/shell";
import { ReferralBonusBatchDetail } from "@/components/screen-referrals";

export default function ReferralBonusBatchDetailPage() {
  const router = useRouter();
  const nav = useNav();
  const { id } = router.query;
  if (!id) return null;
  return <Shell><ReferralBonusBatchDetail id={id as string} nav={nav} /></Shell>;
}
