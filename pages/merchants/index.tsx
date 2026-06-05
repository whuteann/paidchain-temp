import { Shell, useNav } from "@/components/shell";
import { Merchants } from "@/components/screen-merchants";

export default function MerchantsPage() {
  const nav = useNav();
  return <Shell><Merchants nav={nav} /></Shell>;
}
