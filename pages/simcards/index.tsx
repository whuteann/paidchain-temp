import { Shell, useNav } from "@/components/shell";
import { SimCards } from "@/components/screen-simcards";

export default function SimCardsPage() {
  const nav = useNav();
  return <Shell><SimCards nav={nav} /></Shell>;
}
