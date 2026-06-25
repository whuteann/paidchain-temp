import { Shell, useNav } from "@/components/shell";
import { Payouts } from "@/components/screen-payouts";

export default function PayoutsPage() {
  const nav = useNav();
  return <Shell><Payouts nav={nav} /></Shell>;
}
