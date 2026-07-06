/* PaidChain — Paper Roll Billing Report */
import { useState, useEffect } from "react";
import { Card, Btn, PageHead, Toolbar, Empty, Chip, ResponsiveTable, MobileListItem } from "./components";
import { api, ApiError } from "@/lib/api";
import type { PaperRollBillingRow } from "@/lib/api";
import { useCan } from "@/lib/use-permissions";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

function InvoiceStatusChip({ status }: { status: string }) {
  if (!status) return <span style={{ color: "var(--ink-3)" }}>—</span>;
  const cls =
    status === "Invoiced" ? "chip-ok" :
    status === "Pending"  ? "chip-warn" :
    status === "Paid"     ? "chip-info" :
    "chip-neutral";
  return <Chip cls={cls}>{status}</Chip>;
}

const INVOICE_STATUS_OPTIONS = ["All", "Pending", "Invoiced", "Paid"];

export function PaperRollBilling() {
  const can = useCan();
  const [rows, setRows] = useState<PaperRollBillingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoiceStatus, setInvoiceStatus] = useState("All");
  const [exporting, setExporting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setErr(null);
    const filter = invoiceStatus !== "All" ? invoiceStatus : undefined;
    api.paperRolls.billingReport(filter)
      .then(setRows)
      .catch((e) => setErr(e instanceof ApiError ? e.message : "Failed to load billing report"))
      .finally(() => setLoading(false));
  }, [invoiceStatus]);

  async function handleExport() {
    if (!can("Paper Rolls.Export")) return;
    setExporting(true);
    try {
      const filter = invoiceStatus !== "All" ? invoiceStatus : undefined;
      const blob = await api.paperRolls.exportBillingReport(filter);
      downloadBlob(blob, "paper-roll-billing.csv");
    } catch {
      /* silently ignore — server errors will surface in the listing */
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <PageHead
        title="Paper Roll Billing"
        sub={`${rows.length} record${rows.length !== 1 ? "s" : ""} · billing details for all paper roll jobs`}
        actions={can("Paper Rolls.Export") ? (
          <Btn variant="primary" icon="download" onClick={handleExport} disabled={exporting}>
            {exporting ? "Exporting…" : "Export CSV"}
          </Btn>
        ) : undefined}
      />

      <Card>
        <Toolbar>
          <select
            className="select"
            value={invoiceStatus}
            onChange={(e) => setInvoiceStatus(e.target.value)}
          >
            {INVOICE_STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt === "All" ? "All Statuses" : opt}</option>
            ))}
          </select>
          <span className="tb-meta">{loading ? "Loading…" : `${rows.length} records`}</span>
        </Toolbar>

        {err && (
          <div style={{ padding: "16px 20px", fontSize: 13, color: "var(--bad)" }}>{err}</div>
        )}

        {!err && (loading ? (
          <div style={{ padding: "24px 20px", fontSize: 13, color: "var(--ink-3)" }}>Loading…</div>
        ) : rows.length === 0 ? (
          <Empty icon="receipt" title="No records" sub="No paper roll billing records match this filter." />
        ) : (
          <ResponsiveTable
            rows={rows}
            getKey={(r) => r.job_id}
            columns={[
              {
                key: "job_id", header: "Job ID",
                render: (r) => <span className="td-mono td-strong">{r.job_id}</span>,
              },
              {
                key: "merchant", header: "Merchant",
                render: (r) => (
                  <div className="cell-2">
                    <span className="td-strong">{r.merchant_name}</span>
                    <span className="c2-sub">{r.bank}</span>
                  </div>
                ),
              },
              {
                key: "quantity", header: "Qty",
                render: (r) => <span>{r.quantity}</span>,
              },
              {
                key: "payment_target", header: "Pay by",
                render: (r) => <span className="td-mut">{r.payment_target || "—"}</span>,
              },
              {
                key: "invoice_party", header: "Invoice party",
                render: (r) => <span className="td-mut">{r.invoice_party || "—"}</span>,
              },
              {
                key: "invoice_required", header: "Inv. req.",
                render: (r) => (
                  <span className="td-mut">
                    {r.invoice_required === null ? "—" : r.invoice_required ? "Yes" : "No"}
                  </span>
                ),
              },
              {
                key: "invoice_status", header: "Inv. status",
                render: (r) => <InvoiceStatusChip status={r.invoice_status} />,
              },
              {
                key: "accounting_handling", header: "Accounting",
                render: (r) => <span className="td-mut">{r.accounting_handling || "—"}</span>,
              },
              {
                key: "billing_reference", header: "Billing ref.",
                render: (r) => <span className="td-mono td-mut">{r.billing_reference || "—"}</span>,
              },
              {
                key: "completed_at", header: "Completed",
                render: (r) => <span className="td-mono td-mut">{formatDate(r.completed_at)}</span>,
              },
            ]}
            renderMobile={(r) => (
              <MobileListItem
                title={r.merchant_name}
                sub={<><span className="td-mono">{r.job_id}</span> · {r.bank}</>}
                status={<InvoiceStatusChip status={r.invoice_status} />}
                meta={[
                  { label: "Qty", value: String(r.quantity) },
                  { label: "Pay by", value: r.payment_target || "—" },
                  { label: "Invoice party", value: r.invoice_party || "—" },
                  { label: "Billing ref.", value: r.billing_reference || "—" },
                  { label: "Completed", value: formatDate(r.completed_at) },
                ]}
              />
            )}
          />
        ))}
      </Card>
    </div>
  );
}
