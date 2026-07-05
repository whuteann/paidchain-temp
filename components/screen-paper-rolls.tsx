/* PaidChain — Paper roll inventory */
import { useState, useEffect } from "react";
import { Icon } from "./icons";
import { Card, Btn, PageHead, Toolbar, SearchBox, Pagination, Empty, Chip, Modal, Field } from "./components";
import { api, ApiError } from "@/lib/api";
import type { PaperRollOut, PaperRollCreate, PaperRollDetails } from "@/lib/api";
import { NavFn } from "./shell";

const LOW = 100;
const CRITICAL = 50;

function TypeChip({ type }: { type: string }) {
  const cls = type === "Received" ? "chip-ok" : type === "Adjustment" ? "chip-warn" : "chip-info";
  return <Chip cls={cls}>{type}</Chip>;
}

/* =================== UPDATE STOCK MODAL =================== */
function UpdateStockModal({ onClose, onSave }: { onClose: () => void; onSave: (e: PaperRollOut) => void }) {
  const [f, setF] = useState({
    direction: "in", subType: "Issued",
    quantity: "", reference: "", note: "",
    date: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const qty = parseInt(f.quantity);
  const valid = qty > 0;

  async function submit() {
    if (!valid) return;
    const type = f.direction === "in" ? "Received" : (f.subType as "Issued" | "Adjustment");
    const body: PaperRollCreate = {
      type,
      quantity: f.direction === "in" ? qty : -qty,
      reference: f.reference.trim(),
      note: f.note.trim() || undefined,
      date: f.date,
    };
    setSaving(true); setErr(null);
    try {
      const entry = await api.paperRolls.create(body);
      onSave(entry);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to save entry");
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Update Stock" sub="Record a paper roll stock movement" icon="receipt"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={!valid || saving} onClick={submit}>
          {saving ? "Saving…" : "Save Entry"}
        </Btn>
      </>}
    >
      <Field label="Movement direction">
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { id: "in",  label: "Stock In — Received",  icon: "arrowUp" },
            { id: "out", label: "Stock Out — Issued",    icon: "arrowDownRight" },
          ].map((opt) => (
            <label
              key={opt.id}
              style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", border: "1.5px solid " + (f.direction === opt.id ? "var(--slate)" : "var(--line)"), borderRadius: 10, cursor: "pointer", background: f.direction === opt.id ? "var(--bg-2, #f5f5f5)" : "transparent" }}
            >
              <input type="radio" name="direction" checked={f.direction === opt.id} onChange={() => set("direction", opt.id)} />
              <Icon name={opt.icon} size={15} style={{ color: f.direction === opt.id ? "var(--slate)" : "var(--ink-3)" }} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>{opt.label}</span>
            </label>
          ))}
        </div>
      </Field>

      {f.direction === "out" && (
        <Field label="Type">
          <select className="input" value={f.subType} onChange={(e) => set("subType", e.target.value)}>
            <option>Issued</option>
            <option>Adjustment</option>
          </select>
        </Field>
      )}

      <div className="field-row">
        <Field label="Quantity (rolls)" hint="required">
          <input className="input" type="number" min="1" placeholder="e.g. 50" value={f.quantity} onChange={(e) => set("quantity", e.target.value)} />
        </Field>
        <Field label="Date">
          <input className="input" type="date" value={f.date} onChange={(e) => set("date", e.target.value)} />
        </Field>
      </div>

      <Field label="Reference">
        <input className="input" placeholder="Merchant name, PO number, or Job ID" value={f.reference} onChange={(e) => set("reference", e.target.value)} />
      </Field>
      <Field label="Note">
        <input className="input" placeholder="Optional note" value={f.note} onChange={(e) => set("note", e.target.value)} />
      </Field>

      {err && <div style={{ marginTop: 8, fontSize: 13, color: "var(--bad)" }}>{err}</div>}
    </Modal>
  );
}

/* =================== MAIN =================== */
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

export function PaperRolls({ nav: _ }: { nav: NavFn }) {
  const [entries, setEntries] = useState<PaperRollOut[]>([]);
  const [details, setDetails] = useState<PaperRollDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [showUpdate, setShowUpdate] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.paperRolls.list()
      .then(setEntries)
      .catch(console.error)
      .finally(() => setLoading(false));
    api.paperRolls.details().then(setDetails).catch(console.error);
  }, []);

  // Running balance in chronological order
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const runningMap: Record<string, number> = {};
  let balance = 0;
  sorted.forEach((e) => { balance += e.quantity; runningMap[e.id] = balance; });

  const currentStock  = details?.current_stock ?? 0;
  const totalReceived = details?.total_received ?? 0;
  const totalIssued   = details?.total_issued ?? 0;

  // Display newest first
  const displayed = [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const filtered = displayed.filter((e) => {
    const hay = (e.id + " " + e.type + " " + e.reference + " " + e.note + " " + e.created_by).toLowerCase();
    if (q && !hay.includes(q.toLowerCase())) return false;
    if (typeFilter !== "All" && e.type !== typeFilter) return false;
    return true;
  });

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await api.paperRolls.exportBillingReport();
      downloadBlob(blob, "paper-roll-billing.csv");
    } catch {
      /* errors surface in the listing */
    } finally {
      setExporting(false);
    }
  }

  function handleSave(e: PaperRollOut) {
    setEntries((prev) => [e, ...prev]);
    api.paperRolls.details().then(setDetails).catch(console.error);
    const sign = e.quantity > 0 ? "+" : "";
    setToast(sign + e.quantity + " rolls recorded");
    setTimeout(() => setToast(null), 2800);
  }

  const stockColor = currentStock <= CRITICAL ? "var(--bad)" : currentStock <= LOW ? "var(--warn)" : "var(--green-700)";

  return (
    <div>
      <PageHead
        title="Paper Rolls"
        sub="Thermal paper roll inventory · track stock received and issued to merchants"
        actions={<>
          <Btn variant="ghost" icon="download" disabled={exporting} onClick={handleExport}>
            {exporting ? "Exporting…" : "Export"}
          </Btn>
          <Btn variant="primary" icon="plus" onClick={() => setShowUpdate(true)}>Update Stock</Btn>
        </>}
      />

      {/* Inventory summary */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card>
          <div style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 10 }}>Current Inventory</div>
                <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1, color: stockColor }}>{currentStock}</div>
                <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 6 }}>rolls in stock</div>
              </div>
              <div>
                {currentStock <= CRITICAL && <Chip cls="chip-bad"><Icon name="alert" size={13} />Critical</Chip>}
                {currentStock > CRITICAL && currentStock <= LOW && <Chip cls="chip-warn"><Icon name="alert" size={13} />Low Stock</Chip>}
                {currentStock > LOW && <Chip cls="chip-ok"><Icon name="check" size={13} />Sufficient</Chip>}
              </div>
            </div>
            {currentStock <= LOW && (
              <div style={{ marginTop: 14, padding: "9px 12px", background: currentStock <= CRITICAL ? "var(--bad-bg)" : "var(--warn-bg)", borderRadius: 8, fontSize: 12.5, color: currentStock <= CRITICAL ? "var(--bad)" : "var(--warn)", display: "flex", gap: 7, alignItems: "center" }}>
                <Icon name="alert" size={14} />
                {currentStock <= CRITICAL
                  ? "Stock critically low — place a purchase order immediately."
                  : "Stock below minimum threshold (" + LOW + " rolls). Consider reordering soon."}
              </div>
            )}
          </div>
        </Card>

        <div className="stat">
          <div className="stat-top">
            <div className="stat-ico" style={{ background: "var(--green-050)", color: "var(--green-700)" }}><Icon name="arrowUp" size={17} /></div>
            <div className="stat-label">Total Received</div>
          </div>
          <div className="stat-val">{totalReceived}</div>
        </div>

        <div className="stat">
          <div className="stat-top">
            <div className="stat-ico" style={{ background: "var(--info-bg)", color: "var(--info)" }}><Icon name="arrowDownRight" size={17} /></div>
            <div className="stat-label">Total Issued</div>
          </div>
          <div className="stat-val">{totalIssued}</div>
        </div>
      </div>

      {/* Movement log */}
      <Card>
        <Toolbar>
          <SearchBox value={q} onChange={setQ} placeholder="Search reference, note, created by…" />
          <select className="select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            {["All","Received","Issued","Adjustment"].map((t) => (
              <option key={t}>{t === "All" ? "All Types" : t}</option>
            ))}
          </select>
          <span className="tb-meta">{filtered.length} entries</span>
        </Toolbar>
        {loading ? (
          <div style={{ padding: "24px 20px", fontSize: 13, color: "var(--ink-3)" }}>Loading…</div>
        ) : filtered.length === 0 ? <Empty icon="receipt" title="No entries match" /> : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>{["Date","Type","Quantity","Balance","Reference","Note","Created by"].map((h) => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id}>
                    <td className="td-mono td-mut">{e.date}</td>
                    <td><TypeChip type={e.type} /></td>
                    <td>
                      <span style={{ fontWeight: 700, fontFamily: "var(--mono)", fontSize: 14, color: e.quantity > 0 ? "var(--green-700)" : "var(--bad)" }}>
                        {e.quantity > 0 ? "+" : ""}{e.quantity}
                      </span>
                    </td>
                    <td className="td-mono td-mut">{runningMap[e.id] ?? "—"}</td>
                    <td className="td-mut">{e.reference || "—"}</td>
                    <td className="td-mut">{e.note || "—"}</td>
                    <td className="td-mut">{e.created_by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination total={entries.length} shown={filtered.length} />
      </Card>

      {showUpdate && <UpdateStockModal onClose={() => setShowUpdate(false)} onSave={handleSave} />}
      {toast && <div className="toast"><span className="t-ico"><Icon name="checkCircle" size={17} /></span>{toast}</div>}
    </div>
  );
}
