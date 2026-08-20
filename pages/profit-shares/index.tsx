import { ProfitShares } from "@/components/screen-profit-shares";
import { Shell, useNav } from "@/components/shell";

export default function ProfitSharesPage() {
  const nav = useNav();
  return <Shell><ProfitShares nav={nav} /></Shell>;
}
