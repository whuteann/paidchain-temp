import { useRouter } from "next/router";
import { Shell, useNav } from "@/components/shell";
import { ReferralDetail } from "@/components/screen-referrals";

export default function ReferralDetailPage() {
  const router = useRouter();
  const nav = useNav();
  const { id } = router.query;
  if (!id) return null;
  return <Shell><ReferralDetail id={id as string} nav={nav} /></Shell>;
}
