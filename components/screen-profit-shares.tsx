import { Fragment, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type {
  ConnectorDeviceOut,
  CustomerOut,
  CustomerType,
  ProfitShareDetailOut,
  ProfitShareLineOut,
  ProfitShareOut,
  ProfitShareSqlAccountMapping,
} from "@/lib/api";
import { useCan } from "@/lib/use-permissions";
import { Btn, Card, Chip, Empty, Field, Modal, MobileListItem, PageHead, Pagination, ResponsiveTable, SearchBox, Toolbar, useToast } from "./components";
import { Icon } from "./icons";
import type { NavFn } from "./shell";

const PAGE_SIZE = 20;
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const SQL_ITEM_TYPES: CustomerType[] = ["EV", "TNBX", "KTS", "SWITCH", "RETAIL"];

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
      <Field label="Sales report" hint=".xlsx · up to 20 MB">
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

function sqlPostingChip(status?: string) {
  if (status === "POSTED") return <Chip cls="chip-ok" dot><Icon name="check" size={12} />Posted</Chip>;
  if (status === "FAILED") return <Chip cls="chip-bad" dot>Failed</Chip>;
  if (status === "PROCESSING") return <Chip cls="chip-info" dot>Processing</Chip>;
  if (status === "QUEUED") return <Chip cls="chip-warn" dot>Queued</Chip>;
  return <Chip cls="chip-neutral">Not posted</Chip>;
}

function friendlySqlFailure(errorCode?: string | null, errorMessage?: string | null) {
  const messages: Record<string, string> = {
    SQL_CUSTOMER_NOT_FOUND: "Customer code was not found in SQL Account.",
    SQL_ITEM_NOT_FOUND: "Item code was not found in SQL Account. Correct it or leave it blank for a free-text line.",
    SQL_ITEM_UOM_NOT_FOUND: "The SQL item does not have a base UOM. Correct it or leave the item code blank.",
    SQL_TERMS_FIELD_NOT_FOUND: "This SQL Account version cannot apply the terms code.",
    SQL_EINVOICE_EXPLICIT_NOT_VERIFIED: "The selected E-Invoice setting is not supported by this SQL Account version.",
    SQL_EXTERNAL_REFERENCE_FIELD_NOT_FOUND: "SQL Account cannot store the Bumipay invoice reference with the selected document numbering.",
    SQL_AUTOMATION_NOT_REGISTERED: "SQL Account Automation is not registered on the connector PC.",
    SQL_LOGIN_FAILED: "The connector could not log in to SQL Account.",
    SQL_DOCUMENT_SAVE_FAILED: "SQL Account could not save the Sales Invoice.",
    SQL_DOCUMENT_CREATE_FAILED: "SQL Account could not create the Sales Invoice.",
  };
  const code = errorCode || "";
  const summary = messages[code];
  if (!summary) return errorMessage || "The connector could not post this invoice.";
  let detail = errorMessage || "";
  while (code && detail.startsWith(`${code}:`)) detail = detail.slice(code.length + 1).trim();
  if (detail && ["SQL_CUSTOMER_NOT_FOUND", "SQL_ITEM_NOT_FOUND", "SQL_ITEM_UOM_NOT_FOUND"].includes(code)) {
    return `${summary.replace(/\.$/, "")}: ${detail}`;
  }
  return summary;
}

function emptyItemCodes(): Record<CustomerType, string> {
  return { EV: "", TNBX: "", KTS: "", SWITCH: "", RETAIL: "" };
}

function savedLineMode(mapping: ProfitShareSqlAccountMapping | null): "SINGLE" | "BY_TYPE" {
  if (mapping?.line_mode) return mapping.line_mode;
  return mapping && new Set(Object.values(mapping.item_codes).filter(Boolean)).size === 1 ? "SINGLE" : "BY_TYPE";
}

function GenerateInvoiceModal({ report, regenerate = false, onClose, onGenerated }: {
  report: ProfitShareDetailOut;
  regenerate?: boolean;
  onClose: () => void;
  onGenerated: (blob: Blob) => void | Promise<void>;
}) {
  const saved = report.sql_account_mapping;
  const savedCodes = saved?.item_codes || emptyItemCodes();
  const unresolvedCount = report.unlinked_count + report.untyped_count;
  const initialMode = saved ? savedLineMode(saved) : unresolvedCount > 0 ? "SINGLE" : "BY_TYPE";
  const [lineMode, setLineMode] = useState<"SINGLE" | "BY_TYPE">(initialMode);
  const [customerCode, setCustomerCode] = useState(saved?.customer_code || "");
  const [singleItemCode, setSingleItemCode] = useState(
    initialMode === "SINGLE" ? Object.values(savedCodes).find(Boolean) || "" : "",
  );
  const [itemCodes, setItemCodes] = useState<Record<CustomerType, string>>(savedCodes);
  const [termsCode, setTermsCode] = useState(saved?.terms_code || "");
  const [taxCode, setTaxCode] = useState(saved?.tax_code || "");
  const [documentNumberMode, setDocumentNumberMode] = useState<"PAIDCHAIN" | "SQL_AUTO">(saved?.document_number_mode || "PAIDCHAIN");
  const [einvoiceMode, setEinvoiceMode] = useState<"INHERIT" | "EXPLICIT">(saved?.einvoice_mode || "INHERIT");
  const [einvoiceSubmissionType, setEinvoiceSubmissionType] = useState(saved?.einvoice_submission_type || "");
  const [manualTypeAmounts, setManualTypeAmounts] = useState<Record<CustomerType, string>>(
    Object.fromEntries(SQL_ITEM_TYPES.map((type) => [
      type,
      Number(report.type_summary.find((entry) => entry.type === type)?.amount || 0).toFixed(2),
    ])) as Record<CustomerType, string>,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedItemCodes = lineMode === "SINGLE"
    ? Object.fromEntries(SQL_ITEM_TYPES.map((type) => [type, singleItemCode.trim()])) as Record<CustomerType, string>
    : Object.fromEntries(SQL_ITEM_TYPES.map((type) => [type, itemCodes[type].trim()])) as Record<CustomerType, string>;
  const splitBlocked = lineMode === "BY_TYPE" && (unresolvedCount > 0 || report.unallocated_total !== 0);
  const manualSplitRequired = regenerate && splitBlocked;
  const manualAmountValues = SQL_ITEM_TYPES.map((type) => manualTypeAmounts[type]);
  const manualAmountsValid = manualAmountValues.every((value) => {
    const amount = Number(value);
    return value.trim() !== "" && Number.isFinite(amount) && amount >= 0;
  });
  const manualTotalCents = manualAmountsValid
    ? manualAmountValues.reduce((total, value) => total + Math.round(Number(value) * 100), 0)
    : 0;
  const reportTotalCents = Math.round(report.total_amount * 100);
  const manualDifference = (manualTotalCents - reportTotalCents) / 100;
  const manualSplitComplete = !manualSplitRequired || (manualAmountsValid && manualTotalCents === reportTotalCents);
  const complete = Boolean(
    customerCode.trim()
    && (einvoiceMode === "INHERIT" || einvoiceSubmissionType.trim())
    && (!splitBlocked || manualSplitRequired)
    && manualSplitComplete
  );

  async function generate() {
    if (!complete) return;
    setSaving(true);
    setError(null);
    try {
      const mapping: ProfitShareSqlAccountMapping = {
        customer_code: customerCode.trim(),
        item_codes: resolvedItemCodes,
        line_mode: lineMode,
        terms_code: termsCode.trim() || null,
        tax_code: taxCode.trim() || null,
        document_number_mode: documentNumberMode,
        einvoice_mode: einvoiceMode,
        einvoice_submission_type: einvoiceMode === "EXPLICIT" ? einvoiceSubmissionType.trim() : null,
      };
      const invoice = regenerate
        ? await api.profitShares.regenerateInvoice(
            report.id,
            mapping,
            manualSplitRequired
              ? Object.fromEntries(SQL_ITEM_TYPES.map((type) => [type, Number(manualTypeAmounts[type])])) as Record<CustomerType, number>
              : null,
          )
        : await api.profitShares.generateInvoice(report.id, mapping);
      await onGenerated(invoice);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Failed to ${regenerate ? "regenerate" : "generate"} invoice`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={regenerate ? "Regenerate Invoice" : "Generate Invoice"}
      sub={`${report.id} · ${money(report.total_amount)}`}
      icon="invoice"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" disabled={saving} onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="invoice" disabled={!complete || saving} onClick={generate}>
          {saving ? "Generating…" : regenerate ? "Replace & Download" : "Generate & Download"}
        </Btn>
      </>}
    >
      {regenerate && (
        <div style={{ padding: "10px 12px", background: "var(--warn-bg)", border: "1px solid var(--warn-line)", borderRadius: 8, fontSize: 12.5, lineHeight: 1.5, marginBottom: 14 }}>
          This replaces the current PDF but keeps invoice number <strong>{report.invoice_number}</strong>. You can change between one total line and separate type lines. A failed SQL job will remain paused until you review the replacement and click Retry posting.
        </div>
      )}
      <div style={{ padding: "10px 12px", background: "var(--info-bg)", border: "1px solid var(--info-line)", borderRadius: 8, fontSize: 12.5, lineHeight: 1.5, marginBottom: 14 }}>
        {lineMode === "SINGLE"
          ? `The complete ${money(report.total_amount)} report total will be invoiced as one line. ${unresolvedCount} unresolved row${unresolvedCount === 1 ? "" : "s"} will not block generation.`
          : "The invoice will contain separate EV, TNBX, KTS, SWITCH and RETAIL lines."}
      </div>
      <div className="field-row">
        <Field label="SQL Account customer code" hint="required">
          <input className="input mono" value={customerCode} disabled={saving} placeholder="e.g. CIMB" onChange={(event) => setCustomerCode(event.target.value)} />
        </Field>
        <Field label="Invoice lines" hint="required">
          <select className="input" value={lineMode} disabled={saving} onChange={(event) => setLineMode(event.target.value as "SINGLE" | "BY_TYPE")}>
            <option value="SINGLE">One line for the full report total</option>
            <option value="BY_TYPE">Separate lines by profit-share type</option>
          </select>
        </Field>
      </div>
      {lineMode === "SINGLE" ? (
        <Field label="SQL Account item code" hint="optional - blank creates a free-text invoice line">
          <input className="input mono" value={singleItemCode} disabled={saving} placeholder="e.g. MDRPS" onChange={(event) => setSingleItemCode(event.target.value)} />
        </Field>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          {SQL_ITEM_TYPES.map((type) => (
            <Field key={type} label={`${type} item code`} hint="optional - blank creates a free-text line">
              <input className="input mono" value={itemCodes[type]} disabled={saving} placeholder={`MDR-${type}`} onChange={(event) => setItemCodes((current) => ({ ...current, [type]: event.target.value }))} />
            </Field>
          ))}
        </div>
      )}
      {manualSplitRequired ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ padding: "10px 12px", background: "var(--warn-bg)", border: "1px solid var(--warn-line)", borderRadius: 8, fontSize: 12.5, lineHeight: 1.5, marginBottom: 12 }}>
            This report has {report.unlinked_count} unlinked row{report.unlinked_count === 1 ? "" : "s"} and {report.untyped_count} untyped row{report.untyped_count === 1 ? "" : "s"}, so Bumipay cannot calculate the five type amounts. Enter the approved split below; it must equal {money(report.total_amount)}.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            {SQL_ITEM_TYPES.map((type) => (
              <Field key={type} label={`${type} amount`} hint="required">
                <input
                  className="input mono"
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualTypeAmounts[type]}
                  disabled={saving}
                  onChange={(event) => setManualTypeAmounts((current) => ({ ...current, [type]: event.target.value }))}
                />
              </Field>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 16, fontSize: 12.5, marginTop: 8, color: manualSplitComplete ? "var(--green-700)" : "var(--bad)" }}>
            <span>Entered: <strong>{money(manualTotalCents / 100)}</strong></span>
            <span>Required: <strong>{money(report.total_amount)}</strong></span>
            {!manualSplitComplete && <span>Difference: <strong>{money(manualDifference)}</strong></span>}
          </div>
        </div>
      ) : splitBlocked && (
        <div style={{ color: "var(--bad)", fontSize: 12.5, marginTop: 10 }}>
          Type-split invoicing requires all rows to be classified. Select “One line for the full report total” to bypass this review.
        </div>
      )}
      <div className="field-row" style={{ marginTop: 12 }}>
        <Field label="SQL terms code" hint="optional · blank inherits customer">
          <input className="input mono" value={termsCode} disabled={saving} placeholder="e.g. 30D" onChange={(event) => setTermsCode(event.target.value)} />
        </Field>
        <Field label="SQL tax code" hint="optional · blank inherits SQL defaults">
          <input className="input mono" value={taxCode} disabled={saving} placeholder="e.g. SV-0" onChange={(event) => setTaxCode(event.target.value)} />
        </Field>
      </div>
      <div className="field-row">
        <Field label="SQL document number" hint="required">
          <select className="input" value={documentNumberMode} disabled={saving} onChange={(event) => setDocumentNumberMode(event.target.value as "PAIDCHAIN" | "SQL_AUTO")}>
            <option value="PAIDCHAIN">Use Bumipay invoice number</option>
            <option value="SQL_AUTO">Use SQL auto-number</option>
          </select>
        </Field>
        <Field label="E-Invoice submission" hint="required">
          <select className="input" value={einvoiceMode} disabled={saving} onChange={(event) => { const mode = event.target.value as "INHERIT" | "EXPLICIT"; setEinvoiceMode(mode); if (mode === "INHERIT") setEinvoiceSubmissionType(""); }}>
            <option value="INHERIT">Inherit SQL customer default</option>
            <option value="EXPLICIT">Set an explicit SQL submission type</option>
          </select>
        </Field>
      </div>
      {einvoiceMode === "EXPLICIT" && (
        <Field label="SQL E-Invoice submission type" hint="required when explicit">
          <input className="input mono" value={einvoiceSubmissionType} disabled={saving} placeholder="Enter the installed SQL Account value" onChange={(event) => setEinvoiceSubmissionType(event.target.value)} />
        </Field>
      )}
      {error && <div style={{ color: "var(--bad)", fontSize: 13, marginTop: 10 }}>{error}</div>}
    </Modal>
  );
}

function SqlAccountSettings({ report, canEdit, onSaved, onDirtyChange }: {
  report: ProfitShareDetailOut;
  canEdit: boolean;
  onSaved: (report: ProfitShareDetailOut) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const saved = report.sql_account_mapping;
  const savedCodes = saved?.item_codes || emptyItemCodes();
  const initialItemMode = savedLineMode(saved);
  const [customerCode, setCustomerCode] = useState(saved?.customer_code || "");
  const [itemMode, setItemMode] = useState<"SINGLE" | "BY_TYPE">(initialItemMode);
  const [singleItemCode, setSingleItemCode] = useState(initialItemMode === "SINGLE" ? Object.values(savedCodes)[0] || "" : "");
  const [itemCodes, setItemCodes] = useState<Record<CustomerType, string>>(savedCodes);
  const [termsCode, setTermsCode] = useState(saved?.terms_code || "");
  const [taxCode, setTaxCode] = useState(saved?.tax_code || "");
  const [documentNumberMode, setDocumentNumberMode] = useState<"PAIDCHAIN" | "SQL_AUTO">(saved?.document_number_mode || "PAIDCHAIN");
  const [einvoiceMode, setEinvoiceMode] = useState<"INHERIT" | "EXPLICIT">(saved?.einvoice_mode || "INHERIT");
  const [einvoiceSubmissionType, setEinvoiceSubmissionType] = useState(saved?.einvoice_submission_type || "");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const failedCorrection = report.status !== "Draft" && report.sql_posting?.status === "FAILED";

  function changed() {
    setDirty(true);
    onDirtyChange(true);
  }

  const resolvedItemCodes = itemMode === "SINGLE"
    ? Object.fromEntries(SQL_ITEM_TYPES.map((type) => [type, singleItemCode.trim()])) as Record<CustomerType, string>
    : Object.fromEntries(SQL_ITEM_TYPES.map((type) => [type, itemCodes[type].trim()])) as Record<CustomerType, string>;
  const complete = Boolean(
    customerCode.trim()
    && (einvoiceMode === "INHERIT" || einvoiceSubmissionType.trim())
  );

  async function save() {
    if (!complete) return;
    setSaving(true);
    setError(null);
    try {
      const mapping: ProfitShareSqlAccountMapping = {
        customer_code: customerCode.trim(),
        item_codes: resolvedItemCodes,
        line_mode: itemMode,
        terms_code: termsCode.trim() || null,
        tax_code: taxCode.trim() || null,
        document_number_mode: documentNumberMode,
        einvoice_mode: einvoiceMode,
        einvoice_submission_type: einvoiceMode === "EXPLICIT" ? einvoiceSubmissionType.trim() : null,
      };
      const updated = await api.profitShares.updateSqlAccountMapping(report.id, mapping);
      setDirty(false);
      onDirtyChange(false);
      onSaved(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save SQL Account settings");
    } finally {
      setSaving(false);
    }
  }

  if (report.status !== "Draft" && !failedCorrection) {
    if (!saved) return null;
    const oneItem = savedLineMode(saved) === "SINGLE";
    return (
      <Card
        title="SQL Account Settings"
        icon="settings"
        pad
        style={{ marginBottom: 16 }}
        actions={<Chip cls="chip-neutral">Frozen with invoice</Chip>}
      >
        <dl className="kv" style={{ margin: 0 }}>
          <dt>Customer code</dt><dd className="mono">{saved.customer_code}</dd>
          <dt>Invoice lines</dt><dd>{oneItem ? `One total line · ${saved.item_codes.EV || "Free-text line"}` : "One line per profit-share type"}</dd>
          {!oneItem && SQL_ITEM_TYPES.map((type) => <Fragment key={type}><dt>{type}</dt><dd className="mono">{saved.item_codes[type] || "Free-text line"}</dd></Fragment>)}
          <dt>Terms</dt><dd className="mono">{saved.terms_code || "Inherit SQL customer"}</dd>
          <dt>Tax</dt><dd className="mono">{saved.tax_code || "Inherit SQL defaults"}</dd>
          <dt>SQL document number</dt><dd>{saved.document_number_mode === "PAIDCHAIN" ? "Use Bumipay invoice number" : "SQL auto-number; Bumipay number as reference"}</dd>
          <dt>E-Invoice</dt><dd>{saved.einvoice_mode === "INHERIT" ? "Inherit SQL customer default" : saved.einvoice_submission_type}</dd>
        </dl>
      </Card>
    );
  }

  return (
    <Card
      title="SQL Account Settings"
      icon="settings"
      pad
      style={{ marginBottom: 16 }}
      actions={dirty
        ? <Chip cls="chip-warn">Unsaved changes</Chip>
        : failedCorrection
          ? <Chip cls="chip-warn">Correction allowed</Chip>
          : saved
          ? <Chip cls="chip-ok">Configured</Chip>
          : <Chip cls="chip-neutral">Can also enter during Generate</Chip>}
    >
      <div style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--ink-3)", marginBottom: 14 }}>
        {failedCorrection
          ? "The SQL posting failed, so you may correct these SQL Account values. Save the correction, then use Retry below. If the invoice line layout itself is wrong, use Regenerate Invoice above."
          : "These values identify SQL Account master records. Saving them does not create or post an SQL invoice. They are frozen after this Bumipay invoice is generated unless its SQL posting fails."}
      </div>
      <div className="field-row">
        <Field label="SQL customer code" hint="required">
          <input className="input mono" value={customerCode} disabled={!canEdit || saving} placeholder="e.g. CIMB" onChange={(event) => { setCustomerCode(event.target.value); changed(); }} />
        </Field>
        <Field label="Item mapping" hint="required">
          <select className="input" value={itemMode} disabled={!canEdit || saving || failedCorrection} onChange={(event) => { setItemMode(event.target.value as "SINGLE" | "BY_TYPE"); changed(); }}>
            <option value="SINGLE">One service item for all lines</option>
            <option value="BY_TYPE">Separate item for each type</option>
          </select>
        </Field>
      </div>
      {itemMode === "SINGLE" ? (
        <Field label="SQL service item code" hint="optional - blank creates a free-text total line">
          <input className="input mono" value={singleItemCode} disabled={!canEdit || saving} placeholder="e.g. MDRPS" onChange={(event) => { setSingleItemCode(event.target.value); changed(); }} />
        </Field>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          {SQL_ITEM_TYPES.map((type) => (
            <Field key={type} label={`${type} item code`} hint="optional - blank creates a free-text line">
              <input
                className="input mono"
                value={itemCodes[type]}
                disabled={!canEdit || saving}
                placeholder={`MDR-${type}`}
                onChange={(event) => { setItemCodes((current) => ({ ...current, [type]: event.target.value })); changed(); }}
              />
            </Field>
          ))}
        </div>
      )}
      <div className="field-row">
        <Field label="SQL terms code" hint="optional · blank inherits customer">
          <input className="input mono" value={termsCode} disabled={!canEdit || saving} placeholder="e.g. 30D" onChange={(event) => { setTermsCode(event.target.value); changed(); }} />
        </Field>
        <Field label="SQL tax code" hint="optional · blank inherits SQL defaults">
          <input className="input mono" value={taxCode} disabled={!canEdit || saving} placeholder="e.g. SV-0" onChange={(event) => { setTaxCode(event.target.value); changed(); }} />
        </Field>
      </div>
      <div className="field-row">
        <Field label="SQL document number" hint="required">
          <select className="input" value={documentNumberMode} disabled={!canEdit || saving} onChange={(event) => { setDocumentNumberMode(event.target.value as "PAIDCHAIN" | "SQL_AUTO"); changed(); }}>
            <option value="PAIDCHAIN">Use Bumipay invoice number as SQL DocNo</option>
            <option value="SQL_AUTO">Use SQL auto-number; store Bumipay number as reference</option>
          </select>
        </Field>
        <Field label="E-Invoice submission" hint="required">
          <select className="input" value={einvoiceMode} disabled={!canEdit || saving} onChange={(event) => { const mode = event.target.value as "INHERIT" | "EXPLICIT"; setEinvoiceMode(mode); if (mode === "INHERIT") setEinvoiceSubmissionType(""); changed(); }}>
            <option value="INHERIT">Inherit SQL customer default</option>
            <option value="EXPLICIT">Set an explicit SQL submission type</option>
          </select>
        </Field>
      </div>
      {einvoiceMode === "EXPLICIT" && (
        <Field label="SQL E-Invoice submission type" hint="required when explicit">
          <input className="input mono" value={einvoiceSubmissionType} disabled={!canEdit || saving} placeholder="Enter the installed SQL Account value" onChange={(event) => { setEinvoiceSubmissionType(event.target.value); changed(); }} />
        </Field>
      )}
      {error && <div style={{ color: "var(--bad)", fontSize: 13, marginTop: 10 }}>{error}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
        {!canEdit && <span style={{ color: "var(--ink-3)", fontSize: 12.5, alignSelf: "center" }}>You need Profit Shares.Edit permission to configure this mapping.</span>}
        {canEdit && (
          <Btn variant="primary" icon="check" disabled={!complete || saving || (!dirty && Boolean(saved))} onClick={save}>
            {saving ? "Saving..." : saved ? "Save Changes" : "Save SQL Settings"}
          </Btn>
        )}
      </div>
    </Card>
  );
}

function SqlPostingCard({
  report,
  connectors,
  canPost,
  loading,
  mappingDirty,
  onPost,
  onRetry,
}: {
  report: ProfitShareDetailOut;
  connectors: ConnectorDeviceOut[];
  canPost: boolean;
  loading: boolean;
  mappingDirty: boolean;
  onPost: () => void;
  onRetry: () => void;
}) {
  if (report.status === "Draft") return null;
  const job = report.sql_posting;
  const connector = job?.connector || connectors.find((item) => item.enabled && item.status !== "Revoked") || null;
  const online = Boolean(connector?.online);
  const waitingOffline = job?.status === "QUEUED" && !online;
  const action = !job
    ? (
      <Btn
        variant="primary"
        icon="receipt"
        disabled={!canPost || !connector || loading}
        title={!connector ? "An administrator must pair an SQL Account connector first" : undefined}
        onClick={onPost}
      >
        {loading ? "Queueing..." : online ? "Post to SQL Account" : "Queue for SQL Account"}
      </Btn>
    )
    : job.status === "FAILED"
      ? <Btn variant="primary" icon="refresh" disabled={!canPost || loading || mappingDirty} onClick={onRetry}>{loading ? "Queueing..." : "Retry posting"}</Btn>
      : null;

  return (
    <Card
      title="SQL Account Posting"
      icon="receipt"
      pad
      style={{ marginBottom: 16 }}
      actions={sqlPostingChip(job?.status)}
    >
      {job?.status === "FAILED" && (
        <div style={{ padding: "10px 12px", background: "var(--warn-bg)", border: "1px solid var(--warn-line)", borderRadius: 8, marginBottom: 14, fontSize: 12.5, lineHeight: 1.5 }}>
          Correct the SQL Account Settings above, save the changes, then retry this posting. The Bumipay invoice remains unchanged.
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <dl className="kv" style={{ margin: 0, flex: "1 1 520px" }}>
          <dt>Connector</dt><dd>{connector?.name || "No connector configured"}</dd>
          <dt>Connector status</dt>
          <dd>
            {connector
              ? <Chip cls={online ? "chip-ok" : "chip-neutral"} dot>{online ? "Online" : "Offline"}</Chip>
              : <Chip cls="chip-warn">Setup required</Chip>}
            {connector?.last_seen_at && <span style={{ marginLeft: 8, color: "var(--ink-3)", fontSize: 12 }}>Last seen {fmtDateTime(connector.last_seen_at)}</span>}
          </dd>
          <dt>SQL connection</dt><dd>{connector?.sql_status || "Unknown"}{connector?.sql_company ? ` · ${connector.sql_company}` : ""}</dd>
          <dt>Posting state</dt>
          <dd>
            {!job
              ? "Ready to queue"
              : waitingOffline
                ? "Waiting for the Finance SQL laptop"
                : job.status === "QUEUED"
                  ? "Waiting for the connector"
                  : job.status === "PROCESSING"
                    ? "The connector is creating the Sales Invoice"
                    : job.status === "POSTED"
                      ? "Sales Invoice created in SQL Account"
                      : "Posting requires attention"}
          </dd>
          {job && <><dt>Job</dt><dd className="mono">{job.job_id} · {job.attempt_count} attempt{job.attempt_count === 1 ? "" : "s"}</dd></>}
          {job?.sql_doc_no && <><dt>SQL document</dt><dd className="mono">{job.sql_doc_no}</dd></>}
          {job?.posted_at && <><dt>Posted</dt><dd>{fmtDateTime(job.posted_at)}</dd></>}
          {job?.status === "FAILED" && (
            <>
              <dt>Failure</dt>
              <dd style={{ color: "var(--bad)" }}>
                <div>{friendlySqlFailure(job.error_code, job.error_message)}</div>
                {job.error_code && <div className="mono" style={{ color: "var(--ink-3)", fontSize: 11.5, marginTop: 3 }}>{job.error_code}</div>}
              </dd>
              <dt>Last attempt</dt><dd>{fmtDateTime(job.last_attempt_at)}</dd>
            </>
          )}
        </dl>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          {action}
          {!canPost && !job && <span style={{ color: "var(--ink-3)", fontSize: 12 }}>Profit Shares.Process permission is required.</span>}
          {job?.status === "FAILED" && mappingDirty && <span style={{ maxWidth: 260, color: "var(--ink-3)", fontSize: 12, textAlign: "right" }}>Save the SQL Account correction before retrying.</span>}
          {waitingOffline && <span style={{ maxWidth: 260, color: "var(--ink-3)", fontSize: 12, textAlign: "right" }}>The job is safe in Bumipay and will be picked up when the laptop reconnects.</span>}
        </div>
      </div>
    </Card>
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
  const [showGenerateInvoice, setShowGenerateInvoice] = useState(false);
  const [showPaidConfirm, setShowPaidConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [sqlMappingDirty, setSqlMappingDirty] = useState(false);
  const [connectors, setConnectors] = useState<ConnectorDeviceOut[]>([]);
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

  useEffect(() => {
    let cancelled = false;
    const refreshSqlState = () => {
      Promise.all([
        api.sqlConnectors.list(),
        api.profitShares.getSqlPosting(id),
      ]).then(([connectorRows, posting]) => {
        if (cancelled) return;
        setConnectors(connectorRows);
        setReport((current) => current ? { ...current, sql_posting: posting } : current);
      }).catch(() => undefined);
    };
    refreshSqlState();
    const activePosting = report?.sql_posting?.status === "QUEUED" || report?.sql_posting?.status === "PROCESSING";
    const timer = window.setInterval(refreshSqlState, activePosting ? 3000 : 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [id, report?.sql_posting?.status]);

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
  const regenerationAllowed = report.status === "Invoiced"
    && (!report.sql_posting || report.sql_posting.status === "FAILED");

  async function downloadInvoice() {
    setActionLoading(true);
    setError(null);
    try {
      const blob = await api.profitShares.downloadInvoice(currentReport.id);
      downloadBlob(blob, `profit-share-invoice-${currentReport.invoice_number?.replace("/", "-") || currentReport.id}.pdf`);
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

  async function postToSql(retry = false) {
    setActionLoading(true);
    setError(null);
    try {
      const posting = retry
        ? await api.profitShares.retrySqlPosting(currentReport.id)
        : await api.profitShares.postToSql(currentReport.id);
      setReport((current) => current ? { ...current, sql_posting: posting } : current);
      showToast(retry ? "SQL posting queued again" : "Invoice queued for SQL Account");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to queue the SQL Account posting");
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
          {report.invoice_file_url && can("Profit Shares.Export") && <Btn variant="ghost" icon="download" disabled={actionLoading} onClick={downloadInvoice}>Download Invoice</Btn>}
          {regenerationAllowed && can("Profit Shares.Export") && <Btn variant="ghost" icon="refresh" disabled={actionLoading} onClick={() => setShowGenerateInvoice(true)}>Regenerate Invoice</Btn>}
          {report.status === "Draft" && can("Profit Shares.Export") && <Btn variant="primary" icon="invoice" disabled={actionLoading} onClick={() => setShowGenerateInvoice(true)}>Generate Invoice</Btn>}
          {report.status === "Invoiced" && can("Profit Shares.Process") && <Btn variant="primary" icon="check" disabled={actionLoading} onClick={() => setShowPaidConfirm(true)}>Mark as Paid</Btn>}
        </>}
      />

      {error && <div style={{ padding: "10px 12px", background: "var(--red-050, #fef2f2)", color: "var(--bad)", borderRadius: 8, marginBottom: 14, fontSize: 13 }}>{error}</div>}
      {report.status === "Draft" && unresolvedCount > 0 && (
        <div style={{ padding: "11px 13px", background: "var(--warn-bg)", border: "1px solid var(--warn-line)", color: "var(--ink-2)", borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
          This report has <strong>{report.unlinked_count} unlinked</strong> and <strong>{report.untyped_count} untyped</strong> rows. You may review them for a category breakdown, or generate one invoice line for the complete report total without resolving them.
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

      <SqlAccountSettings
        report={report}
        canEdit={can("Profit Shares.Edit")}
        onDirtyChange={setSqlMappingDirty}
        onSaved={(updated) => { setSqlMappingDirty(false); setReport(updated); showToast("SQL Account settings saved"); }}
      />

      <SqlPostingCard
        report={report}
        connectors={connectors}
        canPost={can("Profit Shares.Process")}
        loading={actionLoading}
        mappingDirty={sqlMappingDirty}
        onPost={() => postToSql(false)}
        onRetry={() => postToSql(true)}
      />

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

      {showGenerateInvoice && (
        <GenerateInvoiceModal
          report={report}
          regenerate={report.status === "Invoiced"}
          onClose={() => setShowGenerateInvoice(false)}
          onGenerated={async (blob) => {
            const regenerated = report.status === "Invoiced";
            downloadBlob(blob, `profit-share-invoice-${report.id}.pdf`);
            setReport(await api.profitShares.get(report.id));
            setSqlMappingDirty(false);
            setShowGenerateInvoice(false);
            showToast(regenerated ? "Invoice regenerated - review it before retrying SQL posting" : "Invoice generated");
          }}
        />
      )}

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
