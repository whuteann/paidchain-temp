/* PaidChain — Rental listing + detail + create modal */
import { useState } from "react";
import { Icon } from "./icons";
import { Card, Btn, PageHead, Toolbar, SearchBox, Pagination, Empty, Chip, Modal, Field } from "./components";
import { RENTAL_PLANS, RENTAL_STATUS } from "./data";
import type { Rental } from "./data";
import { useRentals } from "./rentals-context";
import { useCustomers } from "./customers-context";
import { useMerchants } from "./merchants-context";
import { useTerminals } from "./terminals-context";
import { NavFn } from "./shell";

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
interface CreateRentalModalProps { onClose: () => void; onCreate: (r: Rental) => void }

function CreateRentalModal({ onClose, onCreate }: CreateRentalModalProps) {
  const { customers } = useCustomers();
  const { merchants } = useMerchants();
  const { terminals } = useTerminals();
  const [form, setForm] = useState({
    merchantId: "", terminalSerial: "", plan: RENTAL_PLANS[0],
    monthlyRate: "", deposit: "",
    startDate: new Date().toISOString().slice(0, 10),
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const selectedMerchant = merchants.find((m) => m.id === form.merchantId);
  const selectedCustomer = customers.find((c) => c.id === selectedMerchant?.customerId);
  const selectedTerminal = terminals.find((t) => t.serial === form.terminalSerial);
  const valid = form.merchantId && form.terminalSerial && form.startDate;

  function selectTerminal(serial: string) {
    const t = terminals.find((t) => t.serial === serial);
    setForm((f) => ({ ...f, terminalSerial: serial, monthlyRate: t ? String(t.rentalRate) : f.monthlyRate }));
  }

  function submit() {
    const m = selectedMerchant!;
    const c = selectedCustomer!;
    const t = selectedTerminal!;
    onCreate({
      id: "RNT-" + Math.floor(4100 + Math.random() * 400),
      customer: { id: c.id, name: c.name, tin: c.tin },
      merchant: { id: m.id, name: m.name, mid: m.mid },
      terminal: { serial: t.serial, brand: t.brand, model: t.model, tid: t.tid },
      plan: form.plan,
      monthlyRate: parseFloat(form.monthlyRate) || t.rentalRate,
      deposit: parseFloat(form.deposit) || 0,
      startDate: form.startDate,
      endDate: null,
      status: "Active",
      invoiceIssued: null,
      einvoiceIssued: null,
      isNew: true,
    });
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

/* =================== LISTING =================== */
export function Rentals({ nav }: { nav: NavFn }) {
  const { rentals, addRental } = useRentals();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const filtered = rentals.filter((r) => {
    const hay = (r.id + " " + r.customer.name + " " + r.customer.id + " " + r.merchant.name + " " + r.merchant.mid + " " + r.terminal.serial + " " + r.terminal.brand + " " + r.terminal.model).toLowerCase();
    if (q && !hay.includes(q.toLowerCase())) return false;
    if (status !== "All" && r.status !== status) return false;
    return true;
  });

  const stats = {
    total: rentals.length,
    active: rentals.filter((r) => r.status === "Active").length,
    revenue: rentals.filter((r) => r.status === "Active").reduce((a, r) => a + r.monthlyRate, 0),
    ended: rentals.filter((r) => r.status === "Ended").length,
  };

  function handleCreate(r: Rental) {
    addRental(r);
    setToast("Rental " + r.id + " created");
    setTimeout(() => setToast(null), 2800);
  }

  return (
    <div>
      <PageHead
        title="Rentals"
        sub="Terminal rental agreements · customer, merchant and device billing relationships"
        actions={<>
          <Btn variant="ghost" icon="download">Export</Btn>
          <Btn variant="primary" icon="plus" onClick={() => setShowCreate(true)}>Create Rental</Btn>
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
          <SearchBox value={q} onChange={setQ} placeholder="Search rental ID, customer, merchant, terminal serial…" />
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            {["All", "Active", "Suspended", "Ended"].map((s) => (
              <option key={s}>{s === "All" ? "All Statuses" : s}</option>
            ))}
          </select>
          <span className="tb-meta">{filtered.length} rentals</span>
        </Toolbar>
        {filtered.length === 0 ? <Empty icon="receipt" title="No rentals match" /> : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>{["Rental ID","Customer","Merchant","Terminal","Plan","Monthly Rate","Start Date","Status",""].map((h) => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span className="td-mono td-strong">{r.id}</span>
                        {r.isNew && <Chip cls="chip-ok" sq>New</Chip>}
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
                    <td className="td-mono td-strong">{money(r.monthlyRate)}</td>
                    <td className="td-mono td-mut">{r.startDate}</td>
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
        <Pagination total={rentals.length} shown={filtered.length} />
      </Card>

      {showCreate && <CreateRentalModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
      {toast && (
        <div className="toast">
          <span className="t-ico"><Icon name="checkCircle" size={17} /></span>{toast}
        </div>
      )}
    </div>
  );
}

/* =================== DETAIL =================== */
export function RentalDetail({ id, nav }: { id: string; nav: NavFn }) {
  const { rentals, updateRental } = useRentals();
  const { customers } = useCustomers();
  const { merchants } = useMerchants();
  const { terminals } = useTerminals();
  const rental = rentals.find((r) => r.id === id);
  const [toast, setToast] = useState<string | null>(null);

  if (!rental) return (
    <div>
      <PageHead title="Rental not found" actions={<Btn variant="ghost" icon="arrowLeft" onClick={() => nav("rentals")}>Back to Rentals</Btn>} />
      <Empty icon="receipt" title="Rental not found" sub={"No rental with ID " + id} />
    </div>
  );

  const currentRental = rental;
  const customer = customers.find((c) => c.id === currentRental.customer.id);
  const merchant = merchants.find((m) => m.id === currentRental.merchant.id);
  const terminal = terminals.find((t) => t.serial === currentRental.terminal.serial);
  const customerTin = customer?.tin || currentRental.customer.tin;
  const canGenerateEinvoice = !!customerTin;

  const today = new Date().toISOString().slice(0, 10);
  const durationEnd = currentRental.endDate || today;
  const months = monthsBetween(currentRental.startDate, durationEnd);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2800);
  }

  function generateInvoice() {
    updateRental(currentRental.id, { invoiceIssued: today });
    showToast(currentRental.invoiceIssued ? "Invoice regenerated" : "Invoice generated");
  }

  function generateEinvoice() {
    if (!canGenerateEinvoice) return;
    updateRental(currentRental.id, { einvoiceIssued: today, invoiceIssued: currentRental.invoiceIssued || today });
    showToast(currentRental.einvoiceIssued ? "eInvoice regenerated" : "eInvoice generated");
  }

  return (
    <div>
      <PageHead
        title={currentRental.id}
        sub={currentRental.customer.name + " · " + currentRental.merchant.name + " · " + currentRental.terminal.brand + " " + currentRental.terminal.model}
        actions={<>
          <Btn variant="ghost" icon="arrowLeft" onClick={() => nav("rentals")}>Back</Btn>
          <Btn variant="ghost" icon="download">Export</Btn>
        </>}
      />

      {/* Status bar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}>
        <RentalStatus status={currentRental.status} />
        <span style={{ fontSize: 13, color: "var(--ink-3)" }}>{currentRental.plan}</span>
        {currentRental.invoiceIssued && <Chip cls="chip-info">Invoice {currentRental.invoiceIssued}</Chip>}
        {currentRental.einvoiceIssued && <Chip cls="chip-indigo"><Icon name="invoice" size={13} />eInvoice {currentRental.einvoiceIssued}</Chip>}
        {currentRental.isNew && <Chip cls="chip-ok" sq>New</Chip>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card title="Customer" icon="building">
          <div style={{ padding: "4px 20px 16px" }}>
            {[
              ["Name", customer?.name || currentRental.customer.name],
              ["Customer ID", customer?.id || currentRental.customer.id],
              ["Registration No.", customer?.regNo || "—"],
              ["TIN No.", customerTin || "—"],
              ["Contact", customer?.contact || "—"],
              ["Email", customer?.email || "—"],
            ].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                <span style={{ color: "var(--ink-2)" }}>{l}</span>
                <span style={{ fontWeight: 500, textAlign: "right", maxWidth: "60%" }}>{v}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Merchant card */}
        <Card title="Merchant" icon="merchants">
          <div style={{ padding: "4px 20px 16px" }}>
            {[
              ["Name",    merchant?.name    || currentRental.merchant.name],
              ["MID",     currentRental.merchant.mid],
              ["Bank",    merchant?.bank    || "—"],
              ["Type",    merchant?.type    || "—"],
              ["Contact", merchant?.contact || "—"],
              ["Phone",   merchant?.phone   || "—"],
            ].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                <span style={{ color: "var(--ink-2)" }}>{l}</span>
                <span style={{ fontWeight: 500, textAlign: "right", maxWidth: "60%" }}>{v}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Terminal card */}
        <Card title="Terminal" icon="terminal">
          <div style={{ padding: "4px 20px 16px" }}>
            {[
              ["Serial",    currentRental.terminal.serial],
              ["Brand",     currentRental.terminal.brand],
              ["Model",     currentRental.terminal.model],
              ["TID",       currentRental.terminal.tid || "—"],
              ["SIM",       terminal?.sim      || "—"],
              ["Condition", terminal?.conditionNote || "—"],
            ].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                <span style={{ color: "var(--ink-2)" }}>{l}</span>
                <span style={{ fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Billing Documents" icon="invoice" actions={<>
          <Btn variant="ghost" sm icon="invoice" onClick={generateInvoice}>
            {currentRental.invoiceIssued ? "Regenerate Invoice" : "Generate Invoice"}
          </Btn>
          <Btn variant="ghost" sm icon="invoice" disabled={!canGenerateEinvoice} title={canGenerateEinvoice ? "Generate eInvoice" : "Customer TIN number required"} onClick={generateEinvoice}>
            {currentRental.einvoiceIssued ? "Regenerate eInvoice" : "Generate eInvoice"}
          </Btn>
        </>}>
          <div style={{ padding: "4px 20px 16px" }}>
            {[
              ["Invoice", currentRental.invoiceIssued ? "Generated on " + currentRental.invoiceIssued : "Not generated"],
              ["eInvoice", currentRental.einvoiceIssued ? "Generated on " + currentRental.einvoiceIssued : (canGenerateEinvoice ? "Ready to generate" : "Customer TIN number required")],
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

      {/* Rental terms card */}
      <Card title="Rental Terms" icon="receipt">
        <div style={{ padding: "4px 20px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 32px" }}>
          {[
            ["Plan",          currentRental.plan],
            ["Monthly Rate",  money(currentRental.monthlyRate)],
            ["Deposit Paid",  money(currentRental.deposit)],
            ["Start Date",    currentRental.startDate],
            ["End Date",      currentRental.endDate || "Ongoing"],
            ["Duration",      months > 0 ? months + " month" + (months !== 1 ? "s" : "") : "< 1 month"],
          ].map(([l, v]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
              <span style={{ color: "var(--ink-2)" }}>{l}</span>
              <span style={{ fontWeight: 500 }}>{v}</span>
            </div>
          ))}
        </div>
      </Card>

      {toast && (
        <div className="toast">
          <span className="t-ico"><Icon name="checkCircle" size={17} /></span>{toast}
        </div>
      )}
    </div>
  );
}
