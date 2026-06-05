import { useRouter } from "next/router";
import { Shell, useNav } from "@/components/shell";
import { MerchantDetail } from "@/components/screen-merchants";

export default function MerchantDetailPage() {
  const router = useRouter();
  const nav = useNav();
  const { id } = router.query;
  if (!id) return null;
  return <Shell><MerchantDetail id={id as string} nav={nav} /></Shell>;
}
