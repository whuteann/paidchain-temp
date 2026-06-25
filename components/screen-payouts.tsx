/* PaidChain — Payout listing + upload + detail */
import { useState, useEffect, useRef } from "react";
import { Icon } from "./icons";
import { Card, Btn, PageHead, Toolbar, SearchBox, PayoutStatus, Pagination, Empty, Chip, Modal, Field } from "./components";
import { PAYOUT_METHODS } from "./data";
import { checksPassedSummary, ALL_CHECKS } from "./payout-exceptions";
import { api, ApiError } from "@/lib/api";
import type { PayoutOut, PayoutTransaction, BulkCreateResult, PayoutException, PayoutDetails, CustomerOut, MerchantOut } from "@/lib/api";
import { NavFn } from "./shell";

const money = (n: number) => "RM " + n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PAYOUTS_PAGE_SIZE = 20;

function EntitySearchSelect<T extends { id: string }>({
  label, hint, placeholder, value, onSelect, fetchResults, renderOption, getLabel, disabled, disabledHint,
}: {
  label: string;
  hint?: string;
  placeholder: string;
  value: T | null;
  onSelect: (item: T | null) => void;
  fetchResults: (query: string) => Promise<T[]>;
  renderOption: (item: T) => React.ReactNode;
  getLabel: (item: T) => string;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function runSearch(v: string) {
    setLoading(true);
    fetchResults(v).then(setResults).catch(console.error).finally(() => setLoading(false));
  }

  function handleChange(v: string) {
    setQuery(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => runSearch(v), 300);
  }

  function handleFocus() {
    setOpen(true);
    if (!loading && results.length === 0) runSearch(query);
  }

  return (
    <Field label={label} hint={hint}>
      <div style={{ position: "relative" }}>
        {value ? (
          <div className="input" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-2, #f5f5f5)" }}>
            <span>{getLabel(value)}</span>
            <button type="button" className="icon-btn" onClick={() => { onSelect(null); setQuery(""); setResults([]); }}>
              <Icon name="x" size={13} />
            </button>
          </div>
        ) : (
          <input
            className="input"
            placeholder={disabled ? disabledHint : placeholder}
            value={query}
            disabled={disabled}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
        )}
        {open && !value && !disabled && (
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20,
            background: "#fff", border: "1px solid var(--line)", borderRadius: 10,
            boxShadow: "var(--sh-sm)", maxHeight: 220, overflowY: "auto",
          }}>
            {loading ? (
              <div style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--ink-3)" }}>Searching…</div>
            ) : results.length === 0 ? (
              <div style={{ padding: "10px 14px", fontSize: 12.5, color: "var(--ink-3)" }}>No matches</div>
            ) : (
              results.map((item) => (
                <div
                  key={item.id}
                  className="search-opt"
                  onMouseDown={() => { onSelect(item); setQuery(""); setOpen(false); }}
                >
                  {renderOption(item)}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Field>
  );
}

/* =================== SHARED EXCEPTION UI =================== */
function ExceptionBadge({ exceptions }: { exceptions: PayoutException[] }) {
  const errors = exceptions.filter((e) => e.severity === "error").length;
  const warns  = exceptions.filter((e) => e.severity === "warning").length;
  if (errors > 0) return <Chip cls="chip-bad"><Icon name="x" size={12} />{errors} error{errors > 1 ? "s" : ""}{warns > 0 ? ` · ${warns} warn` : ""}</Chip>;
  if (warns  > 0) return <Chip cls="chip-warn"><Icon name="alert" size={12} />{warns} warning{warns > 1 ? "s" : ""}</Chip>;
  return <Chip cls="chip-ok"><Icon name="check" size={12} />All clear</Chip>;
}

function ExceptionChecksPanel({ exceptions }: { exceptions: PayoutException[] }) {
  const errors = exceptions.filter((e) => e.severity === "error").length;
  const warns  = exceptions.filter((e) => e.severity === "warning").length;
  const summaryColor = errors > 0 ? "var(--bad)" : warns > 0 ? "var(--warn)" : "var(--ok)";
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
      <div style={{ padding: "9px 14px", background: "var(--bg-2)", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>Exception Checks</span>
        <span style={{ fontSize: 12, color: summaryColor, fontWeight: 600 }}>{checksPassedSummary(exceptions)}</span>
      </div>
      <div style={{ padding: "6px 0" }}>
        {ALL_CHECKS.map((check) => {
          const exc = exceptions.find((e) => e.code === check.code);
          const passed = !exc;
          const color = passed ? "var(--ok)" : exc.severity === "error" ? "var(--bad)" : "var(--warn)";
          return (
            <div key={check.code} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "5px 14px" }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", flexShrink: 0, marginTop: 1, background: color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name={passed ? "check" : exc.severity === "error" ? "x" : "alert"} size={9} style={{ color: "#fff" }} />
              </div>
              <div>
                <div style={{ fontSize: 12.5, color: passed ? "var(--ink-2)" : "var(--ink-1)", fontWeight: passed ? 400 : 500 }}>{check.label}</div>
                {exc && <div style={{ fontSize: 11.5, color, marginTop: 1 }}>{exc.message}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =================== CREATE PAYOUT MODAL =================== */
function CreatePayoutModal({ onClose, onCreate }: { onClose: () => void; onCreate: (p: PayoutOut) => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [customer, setCustomer] = useState<CustomerOut | null>(null);
  const [merchant, setMerchant] = useState<MerchantOut | null>(null);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(PAYOUT_METHODS[0]);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const canNext = !!customer && !!merchant && !!periodStart && !!periodEnd;

  function handleFileDrop(files: FileList | null) {
    if (files?.[0]) setFile(files[0]);
  }

  async function submit() {
    if (!file) return;
    setSaving(true); setErr(null);
    try {
      const po = await api.payouts.create({
        customer_id: customer!.id,
        merchant_id: merchant!.id,
        period_start: periodStart,
        period_end: periodEnd,
        payment_method: paymentMethod,
        file,
      });
      onCreate(po);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to create payout");
      setSaving(false);
    }
  }

  const stepLabels = ["Customer & Merchant", "Transaction File"];

  return (
    <Modal
      title="Create Payout"
      sub={step === 1 ? "Select customer and merchant for this payout" : "Upload the transaction file for " + (merchant?.name || "")}
      icon="payouts"
      onClose={onClose}
      foot={step === 1 ? (
        <>
          <div className="mf-spacer" />
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" icon="arrowRight" disabled={!canNext} onClick={() => setStep(2)}>Next</Btn>
        </>
      ) : (
        <>
          <Btn variant="ghost" icon="arrowLeft" onClick={() => { setStep(1); setFile(null); }}>Back</Btn>
          <div className="mf-spacer" />
          <Btn variant="primary" icon="check" disabled={!file || saving} onClick={submit}>
            {saving ? "Creating…" : "Create Payout"}
          </Btn>
        </>
      )}
    >
      {/* Step indicator */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 20 }}>
        {stepLabels.map((label, idx) => {
          const n = idx + 1; const active = n === step; const done = n < step;
          return (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {idx > 0 && <div style={{ width: 28, height: 1, background: "var(--line)" }} />}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, background: done ? "var(--ok)" : active ? "var(--ink-1)" : "var(--bg-2)", color: done || active ? "#fff" : "var(--ink-3)", border: "1.5px solid " + (done ? "var(--ok)" : active ? "var(--ink-1)" : "var(--line)") }}>
                  {done ? <Icon name="check" size={11} /> : n}
                </div>
                <span style={{ fontSize: 12.5, fontWeight: active ? 600 : 400, color: active ? "var(--ink-1)" : "var(--ink-3)" }}>{label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {step === 1 ? (
        <>
          <EntitySearchSelect<CustomerOut>
            label="Customer"
            hint="required"
            placeholder="Search existing customer…"
            value={customer}
            onSelect={(item) => { setCustomer(item); setMerchant(null); }}
            fetchResults={(query) => api.customers.list({ query, per_page: 8 }).then((p) => p.items)}
            getLabel={(item) => item.name}
            renderOption={(item) => (
              <div className="cell-2">
                <span className="td-strong">{item.name}</span>
                <span className="c2-sub">{item.reg_no || item.id}</span>
              </div>
            )}
          />
          {customer && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <Chip cls="chip-neutral">{customer.type}</Chip>
              <Chip cls={customer.status === "Active" ? "chip-ok" : "chip-warn"}>{customer.status}</Chip>
            </div>
          )}
          <EntitySearchSelect<MerchantOut>
            key={customer?.id || "no-customer"}
            label="Merchant"
            hint="required"
            placeholder="Search merchant…"
            value={merchant}
            onSelect={setMerchant}
            fetchResults={(query) => customer
              ? api.merchants.list({ query, customer_id: customer.id, per_page: 8 }).then((p) => p.items)
              : Promise.resolve([])}
            getLabel={(item) => item.name + " · " + item.mid}
            renderOption={(item) => (
              <div className="cell-2">
                <span className="td-strong">{item.name}</span>
                <span className="c2-sub">{item.mid}</span>
              </div>
            )}
            disabled={!customer}
            disabledHint="Select customer first"
          />
          {merchant && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <Chip cls="chip-neutral">{merchant.bank}</Chip>
              <Chip cls="chip-neutral">MID {merchant.mid}</Chip>
              {merchant.finance === "Ready" ? <Chip cls="chip-ok">Finance ready</Chip> : <Chip cls="chip-warn">{merchant.finance}</Chip>}
            </div>
          )}
          <div className="field-row">
            <Field label="Period start" hint="required">
              <input className="input" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </Field>
            <Field label="Period end" hint="required">
              <input className="input" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </Field>
          </div>
          <Field label="Payment method">
            <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              {PAYOUT_METHODS.map((pm) => <option key={pm}>{pm}</option>)}
            </select>
          </Field>
        </>
      ) : (
        <Field label="Transaction file" hint="Excel or CSV">
          <div
            className={"dropzone" + (file ? " has" : "")}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFileDrop(e.dataTransfer.files); }}
          >
            <Icon name="upload" size={22} style={{ marginBottom: 6 }} />
            <div style={{ fontWeight: 600, fontSize: 13 }}>Drop file or click to upload</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>
              Excel (.xlsx, .xls) or CSV · Expected columns: Amount, Payment Method, Date
            </div>
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => handleFileDrop(e.target.files)} />
          </div>
          {file && (
            <div className="dz-files" style={{ marginTop: 8 }}>
              <div className="dz-file">
                <Icon name="fileCheck" size={16} className="dzf-ico" />
                <span className="dzf-name">{file.name}</span>
                <span className="dzf-size">{(file.size / 1024).toFixed(0)} KB</span>
                <button className="modal-close" style={{ width: 24, height: 24 }} onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                  <Icon name="x" size={13} />
                </button>
              </div>
            </div>
          )}
          {err && <div style={{ marginTop: 10, fontSize: 13, color: "var(--bad)" }}>{err}</div>}
        </Field>
      )}
    </Modal>
  );
}

/* =================== UPLOAD TRANSACTIONS MODAL =================== */
function UploadTransactionsModal({ onClose, onProcess }: { onClose: () => void; onProcess: (result: BulkCreateResult) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileDrop(files: FileList | null) {
    if (files?.[0]) setFile(files[0]);
  }

  async function process() {
    if (!file) return;
    setSaving(true); setErr(null);
    try {
      const result = await api.payouts.upload(file, periodStart || undefined, periodEnd || undefined);
      onProcess(result);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Upload failed");
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Upload Transactions" sub="Parse an Excel/CSV file to auto-generate payouts grouped by merchant" icon="upload"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="arrowRight" disabled={!file || saving} onClick={process}>
          {saving ? "Processing…" : "Process File"}
        </Btn>
      </>}
    >
      <div className="field-row">
        <Field label="Period start">
          <input className="input" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
        </Field>
        <Field label="Period end">
          <input className="input" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </Field>
      </div>
      <Field label="Transaction file" hint="Excel or CSV">
        <div
          className={"dropzone" + (file ? " has" : "")}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleFileDrop(e.dataTransfer.files); }}
        >
          <Icon name="upload" size={22} style={{ marginBottom: 6 }} />
          <div style={{ fontWeight: 600, fontSize: 13 }}>Drop file or click to upload</div>
          <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>
            Excel (.xlsx, .xls) or CSV · Expected columns: Merchant Name, Amount, Payment Method
          </div>
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => handleFileDrop(e.target.files)} />
        </div>
        {file && (
          <div className="dz-files" style={{ marginTop: 8 }}>
            <div className="dz-file">
              <Icon name="fileCheck" size={16} className="dzf-ico" />
              <span className="dzf-name">{file.name}</span>
              <span className="dzf-size">{(file.size / 1024).toFixed(0)} KB</span>
              <button className="modal-close" style={{ width: 24, height: 24 }} onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                <Icon name="x" size={13} />
              </button>
            </div>
          </div>
        )}
        {err && <div style={{ marginTop: 10, fontSize: 13, color: "var(--bad)" }}>{err}</div>}
      </Field>
    </Modal>
  );
}

/* =================== LISTING =================== */
export function Payouts({ nav }: { nav: NavFn }) {
  const [rows, setRows] = useState<PayoutOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<PayoutDetails>({
    net_this_cycle: 0,
    total_paid_out: 0,
    total_pending: 0,
    pending_count: 0,
  });
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.payouts.list({
        page,
        per_page: PAYOUTS_PAGE_SIZE,
        query: q || undefined,
        status: status !== "All" ? status : undefined,
      }),
      api.payouts.details(),
    ])
      .then(([payoutsPage, nextDetails]) => {
        setRows(payoutsPage.items);
        setPages(payoutsPage.pages);
        setTotal(payoutsPage.total);
        setDetails(nextDetails);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, q, status]);

  function resetPage() {
    setLoading(true);
    setPage(1);
  }

  function changePage(nextPage: number) {
    setLoading(true);
    setPage(nextPage);
  }

  async function refreshPayouts() {
    setLoading(true);
    try {
      const [payoutsPage, nextDetails] = await Promise.all([
        api.payouts.list({
          page,
          per_page: PAYOUTS_PAGE_SIZE,
          query: q || undefined,
          status: status !== "All" ? status : undefined,
        }),
        api.payouts.details(),
      ]);
      setRows(payoutsPage.items);
      setPages(payoutsPage.pages);
      setTotal(payoutsPage.total);
      setDetails(nextDetails);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2800); }

  function handleCreate(po: PayoutOut) {
    setNewIds((prev) => new Set([...prev, po.id]));
    void refreshPayouts();
    showToast("Payout " + po.id + " created");
  }

  function handleUpload(result: BulkCreateResult) {
    void refreshPayouts();
    const msg = result.created + " payout" + (result.created !== 1 ? "s" : "") + " created"
      + (result.failed.length > 0 ? " · " + result.failed.length + " failed" : "");
    showToast(msg);
  }

  return (
    <div>
      <PageHead
        title="Payouts"
        sub="Settlement & merchant payouts · exception checks and e-invoicing"
        actions={<>
          <Btn variant="ghost" icon="download">Export</Btn>
          <Btn variant="ghost" icon="upload" onClick={() => setShowUpload(true)}>Upload Transactions</Btn>
          <Btn variant="primary" icon="plus" onClick={() => setShowCreate(true)}>Create Payout</Btn>
        </>}
      />

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        {[
          { l: "Net This Cycle",  v: money(details.net_this_cycle), ico: "cash",        c: "var(--green-700)", bg: "var(--green-050)" },
          { l: "Paid Out",        v: money(details.total_paid_out), ico: "checkCircle", c: "var(--info)",      bg: "var(--info-bg)" },
          { l: "Pending",         v: details.pending_count,         ico: "clock",       c: "var(--warn)",      bg: "var(--warn-bg)" },
          { l: "Pending Net",     v: money(details.total_pending),  ico: "payouts",     c: "var(--ink-2)",     bg: "var(--bg-2)" },
        ].map((s, i) => (
          <div key={i} className="stat">
            <div className="stat-top">
              <div className="stat-ico" style={{ background: s.bg, color: s.c }}><Icon name={s.ico} size={17} /></div>
              <div className="stat-label">{s.l}</div>
            </div>
            <div className="stat-val" style={{ fontSize: typeof s.v === "string" && s.v.length > 8 ? 21 : 28 }}>{s.v}</div>
          </div>
        ))}
      </div>

      <Card>
        <Toolbar>
          <SearchBox value={q} onChange={(value) => { setQ(value); resetPage(); }} placeholder="Search payout ID, merchant, MID…" />
          <select className="select" value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }}>
            {["All","Pending","Paid"].map((s) => (
              <option key={s} value={s}>{s === "All" ? "All Statuses" : s}</option>
            ))}
          </select>
          <span className="tb-meta">{loading ? "Loading…" : `${total} payouts`}</span>
        </Toolbar>
        {loading ? (
          <div style={{ padding: "24px 20px", fontSize: 13, color: "var(--ink-3)" }}>Loading…</div>
        ) : rows.length === 0 ? <Empty icon="payouts" title="No payouts match" /> : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  {["Payout ID","Merchant","Txns","Gross","Net","Status","Checks","eInvoice",""].map((h) => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td><span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span className="td-mono td-strong">{p.id}</span>
                      {newIds.has(p.id) && <Chip cls="chip-ok" sq>New</Chip>}
                    </span></td>
                    <td><div className="cell-2">
                      <span className="td-strong">{p.merchant.name}</span>
                      <span className="c2-sub mono">{p.mid}</span>
                    </div></td>
                    <td className="td-mut">{p.txns}</td>
                    <td className="td-mono td-mut">{money(p.gross)}</td>
                    <td className="td-mono td-strong">{money(p.net)}</td>
                    <td><PayoutStatus status={p.status} /></td>
                    <td><ExceptionBadge exceptions={p.exceptions} /></td>
                    <td>
                      {p.einvoice
                        ? <Chip cls="chip-indigo"><Icon name="invoice" size={13} />Issued</Chip>
                        : <span className="td-mut">—</span>}
                    </td>
                    <td>
                      <Btn variant="ghost" sm icon="eye" onClick={() => nav("payout-detail", p.id)}>View</Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination total={total} shown={rows.length} page={page} pages={pages} onPageChange={changePage} />
      </Card>

      {showCreate && <CreatePayoutModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
      {showUpload && <UploadTransactionsModal onClose={() => setShowUpload(false)} onProcess={handleUpload} />}
      {toast && <div className="toast"><span className="t-ico"><Icon name="checkCircle" size={17} /></span>{toast}</div>}
    </div>
  );
}

/* =================== PAYOUT DETAIL =================== */
export function PayoutDetail({ id, nav }: { id: string; nav: NavFn }) {
  const [payout, setPayout] = useState<PayoutOut | null>(null);
  const [txns, setTxns] = useState<PayoutTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [q, setQ] = useState("");
  const [showMarkPaid, setShowMarkPaid] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const proofInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([api.payouts.get(id), api.payouts.transactions(id)])
      .then(([p, t]) => { setPayout(p); setTxns(t); })
      .catch((e) => { if (e instanceof ApiError && e.status === 404) setNotFound(true); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div>
      <PageHead title="Payout" actions={<Btn variant="ghost" icon="arrowLeft" onClick={() => nav("payouts")}>Back to Payouts</Btn>} />
      <div style={{ padding: "40px 0", fontSize: 13, color: "var(--ink-3)", textAlign: "center" }}>Loading…</div>
    </div>
  );

  if (notFound || !payout) return (
    <div>
      <PageHead title="Payout not found" actions={<Btn variant="ghost" icon="arrowLeft" onClick={() => nav("payouts")}>Back to Payouts</Btn>} />
      <Empty icon="payouts" title="Payout not found" sub={"No payout with ID " + id} />
    </div>
  );

  const filteredTxns = txns.filter((t) => {
    if (!q) return true;
    return (t.id + " " + t.merchant_name + " " + t.payment_method).toLowerCase().includes(q.toLowerCase());
  });

  const methodBreakdown: Record<string, number> = {};
  txns.forEach((t) => { methodBreakdown[t.payment_method] = (methodBreakdown[t.payment_method] || 0) + t.amount; });

  async function handleMarkPaid() {
    if (!proofFile) return;
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const updated = await api.payouts.update(id, { status: "Paid", payment_proof: proofFile, issued_date: today });
      setPayout(updated);
      setShowMarkPaid(false);
      setProofFile(null);
    } catch {
      // leave panel open on error
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHead
        title={payout.id}
        sub={payout.merchant.name + " · " + payout.period}
        actions={<>
          <Btn variant="ghost" icon="arrowLeft" onClick={() => nav("payouts")}>Back</Btn>
          <Btn variant="ghost" icon="download">Export</Btn>
          {payout.status === "Pending" && !showMarkPaid && (
            <Btn variant="primary" icon="check" onClick={() => setShowMarkPaid(true)}>Mark as Paid</Btn>
          )}
        </>}
      />

      {/* Inline mark-as-paid panel */}
      {showMarkPaid && (
        <div className="card" style={{ marginBottom: 16, border: "1px solid var(--info-line, var(--line))", background: "var(--info-bg, var(--bg-2))" }}>
          <div className="card-head">
            <Icon name="checkCircle" size={17} style={{ color: "var(--info)" }} />
            <h3>Proof of Payment</h3>
          </div>
          <div style={{ padding: "0 20px 20px" }}>
            <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 14 }}>
              Upload a bank transfer receipt or payment confirmation document to mark this payout as paid.
            </p>
            <div
              className={"dropzone" + (proofFile ? " has" : "")}
              onClick={() => proofInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setProofFile(f); }}
            >
              <Icon name="upload" size={22} style={{ marginBottom: 6 }} />
              <div style={{ fontWeight: 600, fontSize: 13 }}>Drop file or click to upload</div>
              <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>PDF, JPG or PNG · bank receipt or transfer confirmation</div>
              <input ref={proofInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setProofFile(f); }} />
            </div>
            {proofFile && (
              <div className="dz-files" style={{ marginTop: 8 }}>
                <div className="dz-file">
                  <Icon name="fileCheck" size={16} className="dzf-ico" />
                  <span className="dzf-name">{proofFile.name}</span>
                  <span className="dzf-size">{(proofFile.size / 1024).toFixed(0)} KB</span>
                  <button className="modal-close" style={{ width: 24, height: 24 }} onClick={() => setProofFile(null)}>
                    <Icon name="x" size={13} />
                  </button>
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <Btn variant="ghost" onClick={() => { setShowMarkPaid(false); setProofFile(null); }}>Cancel</Btn>
              <Btn variant="primary" icon="check" disabled={!proofFile || saving} onClick={handleMarkPaid}>
                {saving ? "Saving…" : "Confirm Payment"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* Status bar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
        <PayoutStatus status={payout.status} />
        {payout.einvoice && <Chip cls="chip-indigo"><Icon name="invoice" size={13} />eInvoice Issued</Chip>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Summary card */}
        <Card title="Payout Summary" icon="payouts">
          <div style={{ padding: "4px 20px 16px" }}>
            {[
              ["Merchant",       payout.merchant.name],
              ["MID",            payout.mid],
              ["Bank",           payout.bank],
              ["Payment Method", payout.payment_method],
              ["Period",         payout.period],
              ["Issued",         payout.issued || "—"],
            ].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                <span style={{ color: "var(--ink-2)" }}>{l}</span>
                <span style={{ fontWeight: 500 }}>{v}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", fontSize: 13 }}>
              <span style={{ color: "var(--ink-2)" }}>
                Payment Proof
                {payout.status === "Paid" && !payout.payment_proof && (
                  <span style={{ marginLeft: 6, color: "var(--bad)", fontWeight: 600 }}>· required</span>
                )}
              </span>
              {payout.payment_proof ? (
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 500, color: "var(--ink-1)" }}>
                  <Icon name="fileCheck" size={14} style={{ color: "var(--ok)" }} />
                  {payout.payment_proof}
                </span>
              ) : payout.status === "Paid" ? (
                <Chip cls="chip-bad"><Icon name="alert" size={13} />Missing</Chip>
              ) : (
                <span style={{ color: "var(--ink-3)" }}>—</span>
              )}
            </div>
          </div>
        </Card>

        {/* Financials card */}
        <Card title="Financials" icon="cash">
          <div style={{ padding: "4px 20px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
              <span style={{ color: "var(--ink-2)" }}>Gross Amount</span>
              <span className="mono">{money(payout.gross)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
              <span style={{ color: "var(--ink-2)" }}>MDR Fee (1.8%)</span>
              <span className="mono" style={{ color: "var(--bad)" }}>− {money(payout.fee)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", fontSize: 16, fontWeight: 700 }}>
              <span>Net Payout</span>
              <span className="mono" style={{ color: "var(--green-700)" }}>{money(payout.net)}</span>
            </div>
            {Object.keys(methodBreakdown).length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)", marginTop: 8, marginBottom: 6 }}>By Payment Method</div>
                {Object.entries(methodBreakdown).map(([method, amt]) => (
                  <div key={method} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--ink-2)", marginBottom: 4 }}>
                    <span>{method}</span>
                    <span className="mono">{money(amt)}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Exception Checks */}
      <Card title={"Exception Checks · " + payout.checks} icon="alert">
        <div style={{ padding: "8px 20px 16px" }}>
          <ExceptionChecksPanel exceptions={payout.exceptions} />
        </div>
      </Card>

      {/* Transactions table */}
      <Card title={`Transactions (${txns.length})`} icon="receipt">
        {txns.length === 0 ? (
          <Empty icon="receipt" title="No transactions linked" sub="Transactions are attached to this payout by the server" />
        ) : (
          <>
            <Toolbar>
              <SearchBox value={q} onChange={setQ} placeholder="Search transaction ID, merchant, method…" />
              <span className="tb-meta">{filteredTxns.length} of {txns.length} transactions</span>
            </Toolbar>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>{["Transaction ID","Date","Merchant","Amount (RM)","Payment Method"].map((h) => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {filteredTxns.map((t) => (
                    <tr key={t.id}>
                      <td className="td-mono td-strong">{t.id}</td>
                      <td className="td-mono td-mut">{t.txn_date}</td>
                      <td>{t.merchant_name}</td>
                      <td className="td-mono">{money(t.amount)}</td>
                      <td><Chip cls="chip-neutral">{t.payment_method}</Chip></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination total={txns.length} shown={filteredTxns.length} />
          </>
        )}
      </Card>
    </div>
  );
}
