import { Shell, useNav } from "@/components/shell";
import { Dashboard } from "@/components/screen-dashboard";

export default function DashboardPage() {
  const nav = useNav();
  return <Shell><Dashboard nav={nav} /></Shell>;
}
