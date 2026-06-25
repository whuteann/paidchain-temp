import { Shell, useNav } from "@/components/shell";
import { ReferralBonusBatches } from "@/components/screen-referrals";

export default function ReferralBonusBatchesPage() {
  const nav = useNav();
  return <Shell><ReferralBonusBatches nav={nav} /></Shell>;
}
