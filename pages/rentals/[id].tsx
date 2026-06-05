import { useRouter } from "next/router";
import { Shell, useNav } from "@/components/shell";
import { RentalDetail } from "@/components/screen-rentals";

export default function RentalDetailPage() {
  const router = useRouter();
  const nav = useNav();
  const { id } = router.query;
  if (!id) return null;
  return <Shell><RentalDetail id={id as string} nav={nav} /></Shell>;
}
