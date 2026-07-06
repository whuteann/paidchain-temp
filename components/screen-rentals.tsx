/* PaidChain — Rental listing + detail + create modal */
import { useState, useEffect } from "react";
import { Icon } from "./icons";
import { Card, Btn, PageHead, Toolbar, SearchBox, Pagination, Empty, Chip, Modal, Field } from "./components";
import { RENTAL_PLANS, RENTAL_STATUS, BANKS } from "./data";
import { useCustomers } from "./customers-context";
import { useMerchants } from "./merchants-context";
import { useTerminals } from "./terminals-context";
import { api, ApiError } from "@/lib/api";
import type { RentalOut } from "@/lib/api";
import { NavFn } from "./shell";
import { useCan } from "@/lib/use-permissions";

const money = (n: number) => "RM " + n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function RentalStatus({ status }: { status: string }) {
  const m = RENTAL_STATUS[status] || {};
  return <Chip cls={m.chip} dot>{status}</Chip>;
}

function monthsBetween(start: string, end: string): number {
  const a = new Date(start), b = new Date(end);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

/* =================== CREATE MODAL =================== */
function CreateRentalModal({ onClose, onCreate }: { onClose: () => void; onCreate: (r: RentalOut) => void }) {
  const { customers } = useCustomers();
  const { merchants } = useMerchants();
  const { terminals } = useTerminals();
  const [form, setForm] = useState({
    merchantId: "", terminalSerial: "", plan: RENTAL_PLANS[0],
    monthlyRate: "", deposit: "",
    startDate: new Date().toISOString().slice(0, 10),
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const selectedMerchant  = merchants.find((m) => m.id === form.merchantId);
  const selectedCustomer  = customers.find((c) => c.id === selectedMerchant?.customerId);
  const selectedTerminal  = terminals.find((t) => t.serial === form.terminalSerial);
  const valid = form.merchantId && form.terminalSerial && form.startDate;

  function selectTerminal(serial: string) {
    const t = terminals.find((t) => t.serial === serial);
    setForm((f) => ({ ...f, terminalSerial: serial, monthlyRate: t ? String(t.rentalRate) : f.monthlyRate }));
  }

  function submit() {
    const m = selectedMerchant!;
    const c = selectedCustomer!;
    const t = selectedTerminal!;
    const r: RentalOut = {
      id: "RNT-" + Math.floor(4100 + Math.random() * 400),
      customer: { id: c.id, name: c.name, tin: c.tin || "" },
      merchant: { id: m.id, name: m.name, mid: m.mid },
      terminal: { serial: t.serial, brand: t.brand, model: t.model, tid: t.tid || null },
      plan: form.plan,
      rental_plan_id: null,
      plan_period: null,
      monthly_rate: parseFloat(form.monthlyRate) || t.rentalRate,
      deposit: parseFloat(form.deposit) || 0,
      start_date: form.startDate,
      end_date: null,
      status: "Active",
      trial_start: null,
      trial_end: null,
      discount_type: null,
      discount_value: null,
      invoice_issued: null,
      einvoice_issued: null,
    };
    onCreate(r);
    onClose();
  }

  return (
    <Modal
      title="Create Rental" sub="Link a terminal to a merchant under a rental agreement" icon="receipt"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={!valid} onClick={submit}>Create Rental</Btn>
      </>}
    >
      <Field label="Merchant" hint="required">
        <select className="input" value={form.merchantId} onChange={(e) => set("merchantId", e.target.value)}>
          <option value="">Select merchant…</option>
          {merchants.map((m) => (
            <option key={m.id} value={m.id}>{m.name} · {m.mid}</option>
          ))}
        </select>
      </Field>
      {selectedMerchant && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {selectedCustomer && <Chip cls="chip-info">{selectedCustomer.name}</Chip>}
          <Chip cls="chip-neutral">{selectedMerchant.bank}</Chip>
          <Chip cls="chip-neutral">{selectedMerchant.type}</Chip>
          {selectedCustomer?.tin
            ? <Chip cls="chip-ok">TIN {selectedCustomer.tin}</Chip>
            : <Chip cls="chip-warn">No TIN on customer</Chip>}
        </div>
      )}

      <Field label="Terminal" hint="required">
        <select className="input" value={form.terminalSerial} onChange={(e) => selectTerminal(e.target.value)}>
          <option value="">Select terminal…</option>
          {terminals.map((t) => (
            <option key={t.serial} value={t.serial}>
              {t.brand} {t.model} · {t.serial} · {t.status}
            </option>
          ))}
        </select>
      </Field>
      {selectedTerminal && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <Chip cls="chip-neutral">{selectedTerminal.sim}</Chip>
          <Chip cls={selectedTerminal.status === "In Stock" ? "chip-ok" : "chip-info"}>{selectedTerminal.status}</Chip>
          {selectedTerminal.tid && <Chip cls="chip-neutral">TID {selectedTerminal.tid}</Chip>}
        </div>
      )}

      <Field label="Rental plan">
        <select className="input" value={form.plan} onChange={(e) => set("plan", e.target.value)}>
          {RENTAL_PLANS.map((p) => <option key={p}>{p}</option>)}
        </select>
      </Field>

      <div className="field-row">
        <Field label="Monthly rate (RM)" hint="required">
          <input
            className="input" type="number" min="0" step="0.01"
            placeholder={selectedTerminal ? String(selectedTerminal.rentalRate) : "0.00"}
            value={form.monthlyRate} onChange={(e) => set("monthlyRate", e.target.value)}
          />
        </Field>
        <Field label="Deposit (RM)">
          <input className="input" type="number" min="0" step="0.01"
            placeholder="0.00" value={form.deposit} onChange={(e) => set("deposit", e.target.value)} />
        </Field>
      </div>

      <Field label="Start date" hint="required">
        <input className="input" type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
      </Field>
    </Modal>
  );
}

/* =================== EXPORT MODAL =================== */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function ExportRentalsModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ query: "", status: "", bank: "", date_from: "", date_to: "", date_field: "start_date" });
  const [exporting, setExporting] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setExporting(true);
    try {
      const blob = await api.rentals.export({
        query:      form.query      || undefined,
        status:     form.status     || undefined,
        bank:       form.bank       || undefined,
        date_from:  form.date_from  || undefined,
        date_to:    form.date_to    || undefined,
        date_field: form.date_field || undefined,
      });
      downloadBlob(blob, "rentals-export.csv");
      onClose();
    } catch {
      /* errors will be visible to the user */
    } finally {
      setExporting(false);
    }
  }

  return (
    <Modal
      title="Export Rentals" sub="Download a CSV of rentals matching the filters below" icon="download"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="download" disabled={exporting} onClick={submit}>
          {exporting ? "Exporting…" : "Export CSV"}
        </Btn>
      </>}
    >
      <Field label="Search query">
        <input className="input" placeholder="Rental ID, customer, merchant…" value={form.query} onChange={(e) => set("query", e.target.value)} />
      </Field>
      <div className="field-row">
        <Field label="Status">
          <select className="input" value={form.status} onChange={(e) => set("status", e.target.value)}>
            <option value="">All Statuses</option>
            {Object.keys(RENTAL_STATUS).map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Bank">
          <select className="input" value={form.bank} onChange={(e) => set("bank", e.target.value)}>
            <option value="">All Banks</option>
            {BANKS.map((b) => <option key={b}>{b}</option>)}
          </select>
        </Field>
      </div>
      <div className="field-row">
        <Field label="Date from">
          <input className="input" type="date" value={form.date_from} onChange={(e) => set("date_from", e.target.value)} />
        </Field>
        <Field label="Date to">
          <input className="input" type="date" value={form.date_to} onChange={(e) => set("date_to", e.target.value)} />
        </Field>
      </div>
      <Field label="Date field">
        <select className="input" value={form.date_field} onChange={(e) => set("date_field", e.target.value)}>
          <option value="start_date">Start Date</option>
          <option value="end_date">End Date</option>
          <option value="created_at">Created At</option>
        </select>
      </Field>
    </Modal>
  );
}

/* =================== LISTING =================== */
const RENTALS_PAGE_SIZE = 20;

export function Rentals({ nav }: { nav: NavFn }) {
  const can = useCan();
  const [rentals, setRentals] = useState<RentalOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    api.rentals.list({
      page,
      per_page: RENTALS_PAGE_SIZE,
      query: q || undefined,
      status: status !== "All" ? status : undefined,
    })
      .then((p) => {
        setRentals(p.items);
        setPages(p.pages);
        setTotal(p.total);
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

  const stats = {
    total,
    active:  rentals.filter((r) => r.status === "Active").length,
    revenue: rentals.filter((r) => r.status === "Active").reduce((a, r) => a + r.monthly_rate, 0),
    ended:   rentals.filter((r) => r.status === "Ended").length,
  };

  function handleCreate(r: RentalOut) {
    const hay = (r.id + " " + r.customer.name + " " + r.customer.id + " " + r.merchant.name + " " + r.merchant.mid + " " + r.terminal.serial + " " + r.terminal.brand + " " + r.terminal.model).toLowerCase();
    const matchesQuery = !q || hay.includes(q.toLowerCase());
    const matchesStatus = status === "All" || r.status === status;
    const matchesCurrentFilters = matchesQuery && matchesStatus;
    setRentals((prev) => page === 1 && matchesCurrentFilters ? [r, ...prev].slice(0, RENTALS_PAGE_SIZE) : prev);
    setNewIds((prev) => new Set([...prev, r.id]));
    if (matchesCurrentFilters) {
      const nextTotal = total + 1;
      setTotal(nextTotal);
      setPages(Math.max(pages, Math.ceil(nextTotal / RENTALS_PAGE_SIZE)));
    }
    setToast("Rental " + r.id + " created");
    setTimeout(() => setToast(null), 2800);
  }

  return (
    <div>
      <PageHead
        title="Rentals"
        sub="Terminal rental agreements · customer, merchant and device billing relationships"
        actions={<>
          {can("Rentals.Export") && <Btn variant="ghost" icon="download" onClick={() => setShowExport(true)}>Export</Btn>}
          {/* <Btn variant="primary" icon="plus" onClick={() => setShowCreate(true)}>Create Rental</Btn> */}
        </>}
      />

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        {[
          { l: "Total Rentals",   v: stats.total,          ico: "receipt",  c: "var(--ink-2)",     bg: "var(--bg-2, #f5f5f5)" },
          { l: "Active",          v: stats.active,          ico: "check",    c: "var(--ok)",        bg: "var(--green-050)" },
          { l: "Monthly Revenue", v: money(stats.revenue),  ico: "cash",     c: "var(--green-700)", bg: "var(--green-050)" },
          { l: "Ended",           v: stats.ended,           ico: "x",        c: "var(--ink-3)",     bg: "var(--bg-2, #f5f5f5)" },
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
          <SearchBox value={q} onChange={(value) => { setQ(value); resetPage(); }} placeholder="Search rental ID, customer, merchant, terminal serial…" />
          <select className="select" value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }}>
            {["All", "Active", "Suspended", "Ended"].map((s) => (
              <option key={s} value={s}>{s === "All" ? "All Statuses" : s}</option>
            ))}
          </select>
          <span className="tb-meta">{loading ? "Loading…" : `${total} rentals`}</span>
        </Toolbar>
        {loading ? (
          <div style={{ padding: "24px 20px", fontSize: 13, color: "var(--ink-3)" }}>Loading…</div>
        ) : rentals.length === 0 ? <Empty icon="receipt" title="No rentals match" /> : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>{["Rental ID","Customer","Merchant","Terminal","Plan","Monthly Rate","Start Date","Status",""].map((h) => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {rentals.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span className="td-mono td-strong">{r.id}</span>
                        {newIds.has(r.id) && <Chip cls="chip-ok" sq>New</Chip>}
                      </span>
                    </td>
                    <td>
                      <div className="cell-2">
                        <span className="td-strong">{r.customer.name}</span>
                        <span className="c2-sub mono">{r.customer.id}</span>
                      </div>
                    </td>
                    <td>
                      <div className="cell-2">
                        <span className="td-strong">{r.merchant.name}</span>
                        <span className="c2-sub mono">{r.merchant.mid}</span>
                      </div>
                    </td>
                    <td>
                      <div className="cell-2">
                        <span className="td-strong">{r.terminal.brand} {r.terminal.model}</span>
                        <span className="c2-sub mono">{r.terminal.serial}</span>
                      </div>
                    </td>
                    <td className="td-mut">{r.plan}</td>
                    <td className="td-mono td-strong">{money(r.monthly_rate)}</td>
                    <td className="td-mono td-mut">{r.start_date}</td>
                    <td><RentalStatus status={r.status} /></td>
                    <td>
                      <Btn variant="ghost" sm icon="eye" onClick={() => nav("rental-detail", r.id)}>View</Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination total={total} shown={rentals.length} page={page} pages={pages} onPageChange={changePage} />
      </Card>

      {showExport && can("Rentals.Export") && <ExportRentalsModal onClose={() => setShowExport(false)} />}
      {showCreate && can("Rentals.Create") && <CreateRentalModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
      {toast && <div className="toast"><span className="t-ico"><Icon name="checkCircle" size={17} /></span>{toast}</div>}
    </div>
  );
}

/* =================== EDIT RENTAL MODAL =================== */
function EditRentalModal({ rental, onClose, onSave }: {
  rental: RentalOut;
  onClose: () => void;
  onSave: (r: RentalOut) => void;
}) {
  const [form, setForm] = useState({
    status:       rental.status,
    plan:         rental.plan,
    monthly_rate: String(rental.monthly_rate),
    end_date:     rental.end_date || "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setSaving(true); setErr(null);
    try {
      const result = await api.rentals.update(rental.id, {
        status:       form.status       || undefined,
        plan:         form.plan         || undefined,
        monthly_rate: form.monthly_rate ? parseFloat(form.monthly_rate) : undefined,
        end_date:     form.end_date     || null,
      });
      onSave(result);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Save failed");
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Edit Rental" sub={"Update rental " + rental.id} icon="edit"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={saving} onClick={submit}>
          {saving ? "Saving…" : "Save Changes"}
        </Btn>
      </>}
    >
      <div className="field-row">
        <Field label="Status">
          <select className="input" value={form.status} onChange={(e) => set("status", e.target.value)}>
            {Object.keys(RENTAL_STATUS).map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Plan">
          <select className="input" value={form.plan} onChange={(e) => set("plan", e.target.value)}>
            {RENTAL_PLANS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
      </div>
      <div className="field-row">
        <Field label="Monthly Rate (RM)">
          <input className="input" type="number" min="0" step="0.01" value={form.monthly_rate}
            onChange={(e) => set("monthly_rate", e.target.value)} />
        </Field>
        <Field label="End Date">
          <input className="input" type="date" value={form.end_date}
            onChange={(e) => set("end_date", e.target.value)} />
        </Field>
      </div>
      {err && (
        <div style={{ padding: "8px 12px", background: "var(--bad-bg)", border: "1px solid var(--bad)", borderRadius: 7, fontSize: 13, color: "var(--bad)" }}>
          {err}
        </div>
      )}
    </Modal>
  );
}

/* =================== DETAIL =================== */
export function RentalDetail({ id, nav }: { id: string; nav: NavFn }) {
  const can = useCan();
  const [rental, setRental] = useState<RentalOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [docBusy, setDocBusy] = useState<"invoice" | "einvoice" | null>(null);

  useEffect(() => {
    api.rentals.get(id)
      .then(setRental)
      .catch((e) => { if (e instanceof ApiError && e.status === 404) setNotFound(true); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div>
      <PageHead title="Rental" actions={<Btn variant="ghost" icon="arrowLeft" onClick={() => nav("rentals")}>Back to Rentals</Btn>} />
      <div style={{ padding: "40px 0", fontSize: 13, color: "var(--ink-3)", textAlign: "center" }}>Loading…</div>
    </div>
  );

  if (notFound || !rental) return (
    <div>
      <PageHead title="Rental not found" actions={<Btn variant="ghost" icon="arrowLeft" onClick={() => nav("rentals")}>Back to Rentals</Btn>} />
      <Empty icon="receipt" title="Rental not found" sub={"No rental with ID " + id} />
    </div>
  );

  const today = new Date().toISOString().slice(0, 10);
  const durationEnd = rental.end_date || today;
  const months = monthsBetween(rental.start_date, durationEnd);
  const customerTin = rental.customer.tin;
  const canGenerateEinvoice = !!customerTin;

  function showToast(message: string) { setToast(message); setTimeout(() => setToast(null), 2800); }

  const hadInvoice   = !!rental.invoice_issued;
  const hadEinvoice  = !!rental.einvoice_issued;

  async function refreshRental() {
    const next = await api.rentals.get(id);
    setRental(next);
  }

  function openDocument(blob: Blob) {
    if (typeof window === "undefined") return;
    const url = window.URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
  }

  async function generateInvoice() {
    if (!can("Rentals.Edit")) return;
    setDocBusy("invoice");
    try {
      const document = await api.rentals.invoice(rental!.id);
      openDocument(document);
      await refreshRental().catch(() => {
        setRental((r) => r ? { ...r, invoice_issued: r.invoice_issued || today } : r);
      });
      showToast(hadInvoice ? "Invoice regenerated" : "Invoice generated");
    } catch {
      showToast("Failed to generate invoice");
    } finally {
      setDocBusy(null);
    }
  }

  async function generateEinvoice() {
    if (!canGenerateEinvoice) return;
    if (!can("Rentals.Edit")) return;
    setDocBusy("einvoice");
    try {
      const document = await api.rentals.einvoice(rental!.id);
      openDocument(document);
      await refreshRental().catch(() => {
        setRental((r) => r ? {
          ...r,
          einvoice_issued: r.einvoice_issued || today,
          invoice_issued: r.invoice_issued || today,
        } : r);
      });
      showToast(hadEinvoice ? "eInvoice regenerated" : "eInvoice generated");
    } catch {
      showToast("Failed to generate eInvoice");
    } finally {
      setDocBusy(null);
    }
  }

  return (
    <div>
      <PageHead
        title={rental.id}
        sub={rental.customer.name + " · " + rental.merchant.name + " · " + rental.terminal.brand + " " + rental.terminal.model}
        actions={<>
          <Btn variant="ghost" icon="arrowLeft" onClick={() => nav("rentals")}>Back</Btn>
          {can("Rentals.Edit") && <Btn variant="ghost" icon="edit" onClick={() => setShowEdit(true)}>Edit</Btn>}
          {can("Rentals.Export") && <Btn variant="ghost" icon="download">Export</Btn>}
        </>}
      />

      {/* Status bar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}>
        <RentalStatus status={rental.status} />
        <span style={{ fontSize: 13, color: "var(--ink-3)" }}>{rental.plan}</span>
        {rental.invoice_issued && <Chip cls="chip-info">Invoice {rental.invoice_issued}</Chip>}
        {rental.einvoice_issued && <Chip cls="chip-indigo"><Icon name="invoice" size={13} />eInvoice {rental.einvoice_issued}</Chip>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Left column: Terminal + Billing Documents stacked */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="Terminal" icon="terminal">
            <div style={{ padding: "4px 20px 16px" }}>
              {[
                ["Serial", rental.terminal.serial],
                ["Brand",  rental.terminal.brand],
                ["Model",  rental.terminal.model],
                ["TID",    rental.terminal.tid || "—"],
              ].map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                  <span style={{ color: "var(--ink-2)" }}>{l}</span>
                  <span style={{ fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Billing Documents" icon="invoice" style={{ flex: 1 }} actions={<>
            {can("Rentals.Edit") && <Btn variant="ghost" sm icon="invoice" disabled={docBusy !== null} onClick={generateInvoice}>
              {docBusy === "invoice" ? "Generating…" : rental.invoice_issued ? "Regenerate Invoice" : "Generate Invoice"}
            </Btn>}
            {can("Rentals.Edit") && <Btn variant="ghost" sm icon="invoice" disabled={!canGenerateEinvoice || docBusy !== null} title={canGenerateEinvoice ? "Generate eInvoice" : "Customer TIN number required"} onClick={generateEinvoice}>
              {docBusy === "einvoice" ? "Generating…" : rental.einvoice_issued ? "Regenerate eInvoice" : "Generate eInvoice"}
            </Btn>}
          </>}>
            <div style={{ padding: "4px 20px 16px" }}>
              {[
                ["Invoice",  rental.invoice_issued  ? "Last generated on " + rental.invoice_issued  : "Not generated"],
                ["eInvoice", rental.einvoice_issued ? "Last generated on " + rental.einvoice_issued : (canGenerateEinvoice ? "Ready to generate" : "Customer TIN number required")],
              ].map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                  <span style={{ color: "var(--ink-2)" }}>{l}</span>
                  <span style={{ fontWeight: 500, textAlign: "right", maxWidth: "60%" }}>{v}</span>
                </div>
              ))}
              {!canGenerateEinvoice && (
                <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--ink-3)" }}>
                  Add a TIN number to the customer profile before generating an eInvoice for this rental.
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right column: Customer + Merchant in one card */}
        <Card title="Customer & Merchant" icon="building">
          <div style={{ padding: "4px 20px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-3)" }}>Customer</span>
              <Btn variant="ghost" sm icon="chevRight" onClick={() => nav("customer-detail", rental.customer.id)}>View</Btn>
            </div>
            {[
              ["Name",        rental.customer.name],
              ["Customer ID", rental.customer.id],
              ["TIN No.",     customerTin || "—"],
            ].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                <span style={{ color: "var(--ink-2)" }}>{l}</span>
                <span style={{ fontWeight: 500, textAlign: "right", maxWidth: "60%" }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: "12px 20px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-3)" }}>Merchant</span>
              <Btn variant="ghost" sm icon="chevRight" onClick={() => nav("merchant-detail", rental.merchant.id)}>View</Btn>
            </div>
            {[
              ["Name", rental.merchant.name],
              ["MID",  rental.merchant.mid],
              ["ID",   rental.merchant.id],
            ].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                <span style={{ color: "var(--ink-2)" }}>{l}</span>
                <span style={{ fontWeight: 500, textAlign: "right", maxWidth: "60%" }}>{v}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Rental terms card */}
      <Card title="Rental Terms" icon="receipt">
        <div style={{ padding: "4px 20px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 32px" }}>
          {([
            ["Plan",         rental.plan],
            rental.rental_plan_id ? ["Plan ID",      rental.rental_plan_id] : null,
            rental.plan_period    ? ["Period",        rental.plan_period]    : null,
            ["Monthly Rate", money(rental.monthly_rate)],
            ["Deposit Paid", money(rental.deposit)],
            ["Start Date",   rental.start_date],
            ["End Date",     rental.end_date || "Ongoing"],
            ["Duration",     months > 0 ? months + " month" + (months !== 1 ? "s" : "") : "< 1 month"],
            rental.trial_start    ? ["Trial Start",   rental.trial_start]   : null,
            rental.trial_end      ? ["Trial End",     rental.trial_end]     : null,
            rental.discount_type  ? ["Discount Type", rental.discount_type] : null,
            rental.discount_value != null ? ["Discount Value", String(rental.discount_value)] : null,
          ] as ([string, string] | null)[]).filter((x): x is [string, string] => x !== null).map(([l, v]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
              <span style={{ color: "var(--ink-2)" }}>{l}</span>
              <span style={{ fontWeight: 500 }}>{v}</span>
            </div>
          ))}
        </div>
      </Card>

      {showEdit && can("Rentals.Edit") && <EditRentalModal rental={rental} onClose={() => setShowEdit(false)} onSave={(r) => { setRental(r); showToast("Rental updated"); }} />}
      {toast && <div className="toast"><span className="t-ico"><Icon name="checkCircle" size={17} /></span>{toast}</div>}
    </div>
  );
}
