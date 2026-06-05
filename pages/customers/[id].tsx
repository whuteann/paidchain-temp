import { useRouter } from "next/router";
import { Shell, useNav } from "@/components/shell";
import { CustomerDetail } from "@/components/screen-customers";

export default function CustomerDetailPage() {
  const router = useRouter();
  const nav = useNav();
  const { id } = router.query;
  if (!id) return null;
  return <Shell><CustomerDetail id={id as string} nav={nav} /></Shell>;
}
