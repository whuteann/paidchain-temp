import { useRouter } from "next/router";
import { Shell, useNav } from "@/components/shell";
import { SimCardDetail } from "@/components/screen-simcards";

export default function SimCardDetailPage() {
  const router = useRouter();
  const nav = useNav();
  const { id } = router.query;
  if (!id) return null;
  return <Shell><SimCardDetail id={id as string} nav={nav} /></Shell>;
}
