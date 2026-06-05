import { Shell, useNav } from "@/components/shell";
import { Customers } from "@/components/screen-customers";

export default function CustomersPage() {
  const nav = useNav();
  return <Shell><Customers nav={nav} /></Shell>;
}
