import { Shell, useNav } from "@/components/shell";
import { Rentals } from "@/components/screen-rentals";

export default function RentalsPage() {
  const nav = useNav();
  return <Shell><Rentals nav={nav} /></Shell>;
}
