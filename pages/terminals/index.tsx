import { Shell, useNav } from "@/components/shell";
import { Terminals } from "@/components/screen-terminals";

export default function TerminalsPage() {
  const nav = useNav();
  return <Shell><Terminals nav={nav} /></Shell>;
}
