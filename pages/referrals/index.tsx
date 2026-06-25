import { Shell, useNav } from "@/components/shell";
import { Referrals } from "@/components/screen-referrals";

export default function ReferralsPage() {
  const nav = useNav();
  return <Shell><Referrals nav={nav} /></Shell>;
}
