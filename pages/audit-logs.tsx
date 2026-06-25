import { Shell, useNav } from "@/components/shell";
import { AuditLogs } from "@/components/screen-auditlogs";

export default function AuditLogsPage() {
  const nav = useNav();
  return <Shell><AuditLogs /></Shell>;
}
