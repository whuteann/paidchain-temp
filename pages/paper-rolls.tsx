import { Shell, useNav } from "@/components/shell";
import { PaperRolls } from "@/components/screen-paper-rolls";

export default function PaperRollsPage() {
  const nav = useNav();
  return <Shell><PaperRolls nav={nav} /></Shell>;
}
