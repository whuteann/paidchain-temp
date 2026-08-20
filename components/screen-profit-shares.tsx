import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { CustomerOut, ProfitShareDetailOut, ProfitShareLineOut, ProfitShareOut } from "@/lib/api";
import { useCan } from "@/lib/use-permissions";
import { Btn, Card, Chip, Empty, Field, Modal, MobileListItem, PageHead, Pagination, ResponsiveTable, SearchBox, Toolbar, useToast } from "./components";
import { Icon } from "./icons";
import type { NavFn } from "./shell";

const PAGE_SIZE = 20;
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const money = (value?: number | null) => `RM ${Number(value || 0).toLocaleString("en-MY", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

function periodLabel(year: number, month: number) {
  return `${MONTHS[month - 1] || month} ${year}`;
}

function fmtDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-MY", {
    year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function statusChip(status: string) {
  const cls = status === "Paid" ? "chip-ok" : status === "Invoiced" ? "chip-info" : "chip-warn";
  return <Chip cls={cls} dot>{status === "Paid" && <Icon name="check" size={12} />}{status}</Chip>;
}

function resolutionChip(line: ProfitShareLineOut) {
  if (line.resolution === "Linked") {
    return <Chip cls={line.match_method === "Auto" ? "chip-info" : "chip-ok"} dot>{line.match_method} match</Chip>;
  }
  if (line.resolution === "Untyped") return <Chip cls="chip-warn" dot>Customer type missing</Chip>;
  return <Chip cls="chip-bad" dot>Unlinked</Chip>;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function publicFileUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) return path;
  try {
    return new URL(path, base).toString();
  } catch {
    return path;
  }
}

function UploadProfitShareModal({ onClose, onUploaded }: {
  onClose: () => void;
  onUploaded: (report: ProfitShareDetailOut) => void;
}) {
  const now = new Date();
  const [file, setFile] = useState<File | null>(null);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      const report = await api.profitShares.upload(file, year, month);
      onUploaded(report);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to upload sales report");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Upload Sales Report"
      sub="Create and calculate a monthly profit-share report"
      icon="upload"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="upload" disabled={!file || saving} onClick={submit}>
          {saving ? "Processing…" : "Upload & Process"}
        </Btn>
      </>}
    >
      <div className="field-row">
        <Field label="Reporting month" hint="required">
          <select className="input" value={month} onChange={(event) => setMonth(Number(event.target.value))}>
            {MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
          </select>
        </Field>
        <Field label="Reporting year" hint="required">
          <input className="input" type="number" min={2000} max={2100} value={year} onChange={(event) => setYear(Number(event.target.value))} />
        </Field>
      </div>
      <Field label="Sales report" hint=".xlsx · up to 10 MB">
        <input
          className="input"
          type="file"
          accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => setFile(event.target.files?.[0] || null)}
        />
      </Field>
      {file && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 12px", background: "var(--bg-2)", borderRadius: 8, fontSize: 13 }}>
          <Icon name="fileCheck" size={16} />
          <span style={{ fontWeight: 600, flex: 1 }}>{file.name}</span>
          <span style={{ color: "var(--ink-3)" }}>{Math.ceil(file.size / 1024)} KB</span>
        </div>
      )}
      <div style={{ marginTop: 12, fontSize: 12.5, lineHeight: 1.5, color: "var(--ink-3)" }}>
        Required columns: Row Labels, Count of MERCH_NO, and Sum of TOT_PFT_SHARES. The system will retain all rows and flag unmatched or untyped customers for review.
      </div>
      {error && <div style={{ color: "var(--bad)", fontSize: 13, marginTop: 12 }}>{error}</div>}
    </Modal>
  );
}

export function ProfitShares({ nav }: { nav: NavFn }) {
  const can = useCan();
  const [rows, setRows] = useState<ProfitShareOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.profitShares.list({
      page,
      per_page: PAGE_SIZE,
      query: query || undefined,
      status: status === "All" ? undefined : status,
    }).then((result) => {
      if (cancelled) return;
      setRows(result.items);
      setPages(result.pages);
      setTotal(result.total);
    }).catch(console.error).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, query, status]);

  return (
    <div>
      <PageHead
        title="Profit Shares"
        sub="Upload sales reports, review customer matches, generate invoices and track payment"
        actions={can("Profit Shares.Create") ? <Btn variant="primary" icon="upload" onClick={() => setShowUpload(true)}>Upload Sales Report</Btn> : undefined}
      />
      <Card>
        <Toolbar>
          <SearchBox value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Search report, filename or invoice…" />
          <select className="select" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            {["All", "Draft", "Invoiced", "Paid"].map((value) => <option key={value}>{value === "All" ? "All Statuses" : value}</option>)}
          </select>
          <span className="tb-meta">{loading ? "Loading…" : `${total} reports`}</span>
        </Toolbar>
        {loading ? (
          <div style={{ padding: 24, color: "var(--ink-3)", fontSize: 13 }}>Loading…</div>
        ) : rows.length === 0 ? (
          <Empty icon="cash" title="No profit-share reports" sub="Upload a monthly sales report to begin" />
        ) : (
          <ResponsiveTable
            rows={rows}
            getKey={(row) => row.id}
            onRowClick={(row) => nav("profit-share-detail", row.id)}
            columns={[
              { key: "report", header: "Report", render: (row) => <div className="cell-2"><span className="td-strong">{periodLabel(row.period_year, row.period_month)}</span><span className="c2-sub mono">{row.id}</span></div> },
              { key: "file", header: "Source", render: (row) => <span className="td-mut">{row.source_filename}</span> },
              { key: "progress", header: "Resolved", render: (row) => <span><strong>{row.line_count - row.unlinked_count - row.untyped_count}</strong> / {row.line_count}</span> },
              { key: "unresolved", header: "Unresolved", render: (row) => row.unlinked_count + row.untyped_count ? <Chip cls="chip-warn">{row.unlinked_count + row.untyped_count}</Chip> : <Chip cls="chip-ok">0</Chip> },
              { key: "amount", header: "Total", render: (row) => <span className="td-mono td-strong">{money(row.total_amount)}</span> },
              { key: "status", header: "Status", render: (row) => statusChip(row.status) },
            ]}
            renderMobile={(row) => (
              <MobileListItem
                title={periodLabel(row.period_year, row.period_month)}
                sub={<span className="mono">{row.id}</span>}
                status={statusChip(row.status)}
                meta={[
                  { label: "Total", value: money(row.total_amount) },
                  { label: "Resolved", value: `${row.line_count - row.unlinked_count - row.untyped_count} / ${row.line_count}` },
                  { label: "Unresolved", value: row.unlinked_count + row.untyped_count },
                ]}
                onClick={() => nav("profit-share-detail", row.id)}
                chevron
              />
            )}
          />
        )}
        <Pagination total={total} shown={rows.length} page={page} pages={pages} onPageChange={setPage} />
      </Card>
      {showUpload && (
        <UploadProfitShareModal
          onClose={() => setShowUpload(false)}
          onUploaded={(report) => { setShowUpload(false); nav("profit-share-detail", report.id); }}
        />
      )}
    </div>
  );
}

function LinkCustomerModal({ reportId, line, onClose, onUpdated }: {
  reportId: string;
  line: ProfitShareLineOut;
  onClose: () => void;
  onUpdated: (report: ProfitShareDetailOut) => void;
}) {
  const [query, setQuery] = useState(line.row_label);
  const [results, setResults] = useState<CustomerOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      api.customers.list({ query: query || undefined, per_page: 20 })
        .then((page) => setResults(page.items))
        .catch((err) => setError(err instanceof Error ? err.message : "Failed to search customers"))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  async function selectCustomer(customerId: string | null) {
    setSavingId(customerId || "unlink");
    setError(null);
    try {
      onUpdated(await api.profitShares.linkLine(reportId, line.id, customerId));
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update customer link");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <Modal
      title={line.customer ? "Replace Customer Match" : "Link Customer"}
      sub={`${line.row_label} · ${money(line.amount)}`}
      icon="link"
      onClose={onClose}
      foot={<>
        {line.customer && <Btn variant="danger" icon="x" disabled={Boolean(savingId)} onClick={() => selectCustomer(null)}>Unlink</Btn>}
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      </>}
    >
      {line.customer && (
        <div style={{ padding: "10px 12px", marginBottom: 12, background: "var(--info-bg)", border: "1px solid var(--info-line)", borderRadius: 8, fontSize: 12.5 }}>
          Current {line.match_method.toLowerCase()} match: <strong>{line.customer.name}</strong> ({line.customer.id}). You can replace it even if it was automatically matched.
        </div>
      )}
      <SearchBox value={query} onChange={setQuery} placeholder="Search customer name or ID…" fullWidth />
      <div style={{ maxHeight: 360, overflowY: "auto", marginTop: 12, border: "1px solid var(--line)", borderRadius: 8 }}>
        {loading ? (
          <div style={{ padding: 18, color: "var(--ink-3)", fontSize: 13 }}>Searching…</div>
        ) : results.length === 0 ? (
          <Empty icon="search" title="No accessible customers found" />
        ) : results.map((customer) => (
          <button
            type="button"
            key={customer.id}
            disabled={Boolean(savingId)}
            onClick={() => selectCustomer(customer.id)}
            style={{ width: "100%", border: 0, borderBottom: "1px solid var(--line)", background: customer.id === line.customer_id ? "var(--bg-2)" : "transparent", padding: "11px 12px", display: "flex", alignItems: "center", gap: 10, textAlign: "left", cursor: "pointer" }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{customer.name}</div>
              <div className="mono" style={{ color: "var(--ink-3)", fontSize: 11.5 }}>{customer.id}{customer.reg_no ? ` · ${customer.reg_no}` : ""}</div>
            </div>
            {customer.type ? <Chip cls="chip-info">{customer.type}</Chip> : <Chip cls="chip-warn">Type not set</Chip>}
            {savingId === customer.id && <span style={{ fontSize: 12 }}>Saving…</span>}
          </button>
        ))}
      </div>
      {error && <div style={{ color: "var(--bad)", fontSize: 13, marginTop: 12 }}>{error}</div>}
    </Modal>
  );
}

export function ProfitShareDetail({ id, nav }: { id: string; nav: NavFn }) {
  const can = useCan();
  const [report, setReport] = useState<ProfitShareDetailOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [query, setQuery] = useState("");
  const [resolution, setResolution] = useState("All");
  const [linkLine, setLinkLine] = useState<ProfitShareLineOut | null>(null);
  const [showPaidConfirm, setShowPaidConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, showToast] = useToast();

  useEffect(() => {
    api.profitShares.get(id)
      .then(setReport)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
        else setError(err instanceof Error ? err.message : "Failed to load profit share");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const visibleLines = useMemo(() => {
    if (!report) return [];
    const normalizedQuery = query.trim().toLowerCase();
    return report.lines.filter((line) => {
      if (resolution === "Unresolved" && line.resolution === "Linked") return false;
      if (resolution === "Linked" && !line.customer_id) return false;
      if (!normalizedQuery) return true;
      return line.row_label.toLowerCase().includes(normalizedQuery)
        || line.customer?.name.toLowerCase().includes(normalizedQuery)
        || line.customer?.id.toLowerCase().includes(normalizedQuery);
    });
  }, [query, report, resolution]);

  if (loading) return <div><PageHead title="Profit Share" /><div style={{ padding: 40, textAlign: "center", color: "var(--ink-3)" }}>Loading…</div></div>;
  if (notFound || !report) return <div><PageHead title="Profit share not found" actions={<Btn variant="ghost" icon="arrowLeft" onClick={() => nav("profit-shares")}>Back</Btn>} /><Empty icon="cash" title="Profit share not found" sub={`No report with ID ${id}`} /></div>;

  const currentReport = report;
  const unresolvedCount = report.unlinked_count + report.untyped_count;
  const canInvoice = report.status === "Draft" && unresolvedCount === 0 && report.unallocated_total === 0;

  async function invoice(generate: boolean) {
    setActionLoading(true);
    setError(null);
    try {
      const blob = generate
        ? await api.profitShares.generateInvoice(currentReport.id)
        : await api.profitShares.downloadInvoice(currentReport.id);
      downloadBlob(blob, `profit-share-invoice-${currentReport.invoice_number?.replace("/", "-") || currentReport.id}.pdf`);
      if (generate) {
        setReport(await api.profitShares.get(currentReport.id));
        showToast("Invoice generated");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invoice action failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function markPaid() {
    setActionLoading(true);
    setError(null);
    try {
      setReport(await api.profitShares.markPaid(currentReport.id));
      setShowPaidConfirm(false);
      showToast("Profit share marked as paid");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to mark as paid");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div>
      <PageHead
        title={periodLabel(report.period_year, report.period_month)}
        sub={`${report.id} · ${report.report_name || report.source_filename}`}
        meta={<div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>{statusChip(report.status)}{report.invoice_number && <Chip cls="chip-neutral">Invoice {report.invoice_number}</Chip>}</div>}
        actions={<>
          <Btn variant="ghost" icon="arrowLeft" onClick={() => nav("profit-shares")}>Back</Btn>
          {report.invoice_file_url && can("Profit Shares.Export") && <Btn variant="ghost" icon="download" disabled={actionLoading} onClick={() => invoice(false)}>Download Invoice</Btn>}
          {report.status === "Draft" && can("Profit Shares.Export") && <Btn variant="primary" icon="invoice" disabled={!canInvoice || actionLoading} title={!canInvoice ? `Resolve ${unresolvedCount} lines before invoicing` : undefined} onClick={() => invoice(true)}>Generate Invoice</Btn>}
          {report.status === "Invoiced" && can("Profit Shares.Process") && <Btn variant="primary" icon="check" disabled={actionLoading} onClick={() => setShowPaidConfirm(true)}>Mark as Paid</Btn>}
        </>}
      />

      {error && <div style={{ padding: "10px 12px", background: "var(--red-050, #fef2f2)", color: "var(--bad)", borderRadius: 8, marginBottom: 14, fontSize: 13 }}>{error}</div>}
      {report.status === "Draft" && unresolvedCount > 0 && (
        <div style={{ padding: "11px 13px", background: "var(--warn-bg)", border: "1px solid var(--warn-line)", color: "var(--ink-2)", borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
          Resolve <strong>{report.unlinked_count} unlinked</strong> and <strong>{report.untyped_count} untyped</strong> rows before generating the invoice. Automatically matched rows can also be replaced if the match is incorrect.
        </div>
      )}
      {report.rounding_difference !== 0 && (
        <div style={{ padding: "10px 13px", background: "var(--info-bg)", border: "1px solid var(--info-line)", borderRadius: 8, marginBottom: 14, fontSize: 12.5 }}>
          The workbook Grand Total is {money(report.workbook_total_amount)}, while its displayed detail rows sum to {money(report.total_amount)}. Calculations use the visible detail rows; rounding variance: {money(report.rounding_difference)}.
        </div>
      )}

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        {report.type_summary.map((entry) => (
          <div className="stat" key={entry.type}>
            <div className="stat-top"><div className="stat-ico" style={{ color: "var(--info)", background: "var(--info-bg)" }}><Icon name="cash" size={16} /></div><div className="stat-label">{entry.type}</div></div>
            <div className="stat-val" style={{ fontSize: 20 }}>{money(entry.amount)}</div>
            <div style={{ color: "var(--ink-3)", fontSize: 11.5, marginTop: 4 }}>{entry.line_count} rows · {entry.merchant_count} merchants</div>
          </div>
        ))}
      </div>

      <div className="detail-grid" style={{ marginBottom: 16 }}>
        <Card title="Reconciliation" icon="cash" pad>
          <dl className="kv" style={{ margin: 0 }}>
            <dt>Calculated report total</dt><dd className="mono">{money(report.total_amount)}</dd>
            <dt>Classified total</dt><dd className="mono">{money(report.classified_total)}</dd>
            <dt>Unallocated total</dt><dd className="mono" style={{ color: report.unallocated_total ? "var(--bad)" : "var(--green-700)" }}>{money(report.unallocated_total)}</dd>
            <dt>Merchant count</dt><dd>{report.total_merchant_count.toLocaleString("en-MY")}</dd>
          </dl>
        </Card>
        <Card title="Report Details" icon="fileCheck" pad>
          <dl className="kv" style={{ margin: 0 }}>
            <dt>Source</dt><dd><a href={publicFileUrl(report.source_file_url)} target="_blank" rel="noreferrer">{report.source_filename}</a></dd>
            <dt>Created</dt><dd>{fmtDateTime(report.created_at)}</dd>
            <dt>Created by</dt><dd>{report.created_by?.name || "—"}</dd>
            <dt>Paid</dt><dd>{report.paid_at ? `${fmtDateTime(report.paid_at)} · ${report.paid_by?.name || "—"}` : "—"}</dd>
          </dl>
        </Card>
      </div>

      <Card title={`Sales Report Rows (${report.line_count})`} icon="receipt">
        <Toolbar>
          <SearchBox value={query} onChange={setQuery} placeholder="Search row label or linked customer…" />
          <select className="select" value={resolution} onChange={(event) => setResolution(event.target.value)}>
            {["All", "Unresolved", "Linked"].map((value) => <option key={value}>{value}</option>)}
          </select>
          <span className="tb-meta">{visibleLines.length} rows</span>
        </Toolbar>
        {visibleLines.length === 0 ? <Empty icon="search" title="No rows match" /> : (
          <ResponsiveTable
            rows={visibleLines}
            getKey={(line) => line.id}
            columns={[
              { key: "label", header: "Row Labels", render: (line) => <div className="cell-2"><span className="td-strong">{line.row_label}</span><span className="c2-sub">Excel row {line.source_row_number} · {line.match_note || "—"}</span></div> },
              { key: "count", header: "MERCH_NO", render: (line) => <span className="td-mono">{line.merchant_count}</span> },
              { key: "amount", header: "Profit Share", render: (line) => <span className="td-mono td-strong">{money(line.amount)}</span> },
              { key: "customer", header: "Customer", render: (line) => line.customer ? <div className="cell-2"><span className="td-strong">{line.customer.name}</span><span className="c2-sub mono">{line.customer.id}</span></div> : <span className="td-mut">Not linked</span> },
              { key: "type", header: "Type", render: (line) => line.customer?.type ? <Chip cls="chip-info">{line.customer.type}</Chip> : <span className="td-mut">—</span> },
              { key: "resolution", header: "Resolution", render: resolutionChip },
              { key: "action", header: "", render: (line) => report.status === "Draft" && can("Profit Shares.Edit") ? <Btn sm variant="ghost" icon="link" onClick={() => setLinkLine(line)}>{line.customer ? "Replace" : "Link"}</Btn> : null },
            ]}
            renderMobile={(line) => (
              <MobileListItem
                title={line.row_label}
                sub={`Excel row ${line.source_row_number}`}
                status={resolutionChip(line)}
                meta={[
                  { label: "Profit share", value: money(line.amount) },
                  { label: "Customer", value: line.customer?.name || "Not linked" },
                  { label: "Type", value: line.customer?.type || "—" },
                ]}
                actions={report.status === "Draft" && can("Profit Shares.Edit") ? <Btn sm variant="ghost" icon="link" onClick={() => setLinkLine(line)}>{line.customer ? "Replace match" : "Link customer"}</Btn> : undefined}
              />
            )}
          />
        )}
      </Card>

      {linkLine && (
        <LinkCustomerModal
          reportId={report.id}
          line={linkLine}
          onClose={() => setLinkLine(null)}
          onUpdated={(updated) => { setReport(updated); showToast("Customer match updated"); }}
        />
      )}
      {showPaidConfirm && (
        <Modal
          title="Mark Profit Share as Paid?"
          sub={`${report.invoice_number || report.id} · ${money(report.total_amount)}`}
          icon="checkCircle"
          onClose={() => setShowPaidConfirm(false)}
          foot={<>
            <div className="mf-spacer" />
            <Btn variant="ghost" onClick={() => setShowPaidConfirm(false)}>Cancel</Btn>
            <Btn variant="primary" icon="check" disabled={actionLoading} onClick={markPaid}>{actionLoading ? "Saving…" : "Confirm Paid"}</Btn>
          </>}
        >
          <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--ink-2)" }}>
            This will record the current time and your user account, display the report as Paid, and keep its invoice and customer allocations locked.
          </div>
        </Modal>
      )}
      {toast}
    </div>
  );
}
