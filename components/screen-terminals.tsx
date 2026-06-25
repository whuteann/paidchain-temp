/* PaidChain — Terminal inventory + detail */
import { useState, useEffect } from "react";
import { Icon } from "./icons";
import { Card, Btn, PageHead, Toolbar, SearchBox, TerminalStatus, Pagination, Empty, JobStatus, SlaChip, Modal, Field, Chip, MobileListItem, ResponsiveTable } from "./components";
import { jobs, TERMINAL_STATUS, TERMINAL_STATUS_ORDER, BRANDS, BANKS } from "./data";
import { api, ApiError, terminalSerial } from "@/lib/api";
import type { TermSettingOut, TermSettingCreate, TerminalOut, TerminalCreate, SimCardOut, BulkCreateResult, TerminalBulkCreate } from "@/lib/api";
import { NavFn } from "./shell";

/* =================== REGISTER DEVICE MODAL =================== */
function RegisterDeviceModal({ onClose, onRegister, initialSettingId }: {
  onClose: () => void;
  onRegister: (t: TerminalOut) => void;
  initialSettingId?: string;
}) {
  const [settings, setSettings] = useState<TermSettingOut[]>([]);
  const [storedSims, setStoredSims] = useState<SimCardOut[]>([]);
  const [step, setStep] = useState<1 | 2>(1);
  const [settingId, setSettingId] = useState(initialSettingId ?? "");
  const [serialNo, setSerialNo] = useState("");
  const [location, setLocation] = useState("KL Warehouse");
  const [selectedSimId, setSelectedSimId] = useState("");
  const [registering, setRegistering] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.termSettings.list({ active: true }).then(setSettings).catch(console.error);
    api.simCards.list({ status: "In Storage" }).then((p) => setStoredSims(p.items)).catch(console.error);
  }, []);

  const setting = settings.find((s) => s.id === settingId);
  const selectedSim = storedSims.find((s) => s.id === selectedSimId);

  async function register(linkSim: boolean) {
    if (!setting || !serialNo.trim()) return;
    setRegistering(true); setErr(null);
    const body: TerminalCreate = {
      serial_no: serialNo.trim(),
      brand: setting.brand, model: setting.model, location,
      rental_rate: setting.monthly_rental, rental_plan: "Monthly Rental",
      sim: linkSim && selectedSimId ? "4G + WiFi" : "WiFi only",
      condition_note: "Good", term_setting_id: setting.id,
    };
    try {
      const result = await api.terminals.create(body);
      if (linkSim && selectedSimId) {
        await api.simCards.update(selectedSimId, { terminal_serial: terminalSerial(result), status: "Active" });
      }
      onRegister(result);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Registration failed");
      setRegistering(false);
    }
  }

  return (
    <Modal
      title="Register Device" sub="Add a new terminal to the inventory" icon="terminal"
      onClose={onClose}
      foot={step === 1 ? (
        <>
          <div className="mf-spacer" />
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" iconRight="chevRight" disabled={!settingId || !serialNo.trim()} onClick={() => setStep(2)}>Create Device</Btn>
        </>
      ) : (
        <>
          <Btn variant="ghost" icon="arrowLeft" onClick={() => setStep(1)}>Back</Btn>
          <div className="mf-spacer" />
          <Btn variant="ghost" disabled={registering} onClick={() => register(false)}>Skip — No SIM</Btn>
          <Btn variant="primary" icon="check" disabled={registering} onClick={() => register(true)}>
            {registering ? "Registering…" : "Register Device"}
          </Btn>
        </>
      )}
    >
      {step === 1 ? (
        <>
          <Field label="Terminal setting" hint="required">
            <select className="input" value={settingId} onChange={(e) => setSettingId(e.target.value)}>
              <option value="">Select model…</option>
              {settings.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.brand} {s.model} · {s.category} · RM {s.monthly_rental}/mo
                </option>
              ))}
            </select>
          </Field>
          {setting && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              <Chip cls="chip-neutral">{setting.brand}</Chip>
              <Chip cls="chip-neutral">{setting.model}</Chip>
              <Chip cls="chip-info">{setting.category}</Chip>
              <Chip cls="chip-neutral">RM {setting.monthly_rental}/mo</Chip>
              {setting.deposit > 0 && <Chip cls="chip-neutral">Deposit RM {setting.deposit}</Chip>}
            </div>
          )}
          <Field label="Initial location">
            <select className="input" value={location} onChange={(e) => setLocation(e.target.value)}>
              {["KL Warehouse", "Repair Center", "In Transit"].map((l) => <option key={l}>{l}</option>)}
            </select>
          </Field>
          <Field label="Serial number" hint="required">
            <input
              className="input"
              placeholder="Enter device serial number…"
              value={serialNo}
              onChange={(e) => setSerialNo(e.target.value)}
            />
          </Field>
        </>
      ) : (
        <>
          <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 14 }}>
            Optionally link a SIM card from the <strong>In Storage</strong> inventory to this device. You can do this later from the device detail page.
          </div>
          {storedSims.length === 0 ? (
            <Empty icon="phone" title="No SIM cards in storage" sub="All available SIMs are already linked to devices" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {storedSims.map((s) => {
                const sel = selectedSimId === s.id;
                return (
                  <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", border: "1.5px solid " + (sel ? "var(--slate)" : "var(--line)"), borderRadius: 10, cursor: "pointer", background: sel ? "var(--bg-2, #f5f5f5)" : "transparent" }}>
                    <input type="radio" name="sim" checked={sel} onChange={() => setSelectedSimId(s.id)} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{s.carrier} — {s.plan}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{s.iccid} · {s.msisdn || "No MSISDN"}</div>
                    </div>
                    <Chip cls="chip-neutral">{s.data_allowance}</Chip>
                  </label>
                );
              })}
            </div>
          )}
          {selectedSim && (
            <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--info)", display: "flex", gap: 6, alignItems: "center" }}>
              <Icon name="check" size={14} />Selected: {selectedSim.carrier} · {selectedSim.iccid}
            </div>
          )}
          {err && <div style={{ marginTop: 10, fontSize: 13, color: "var(--bad)" }}>{err}</div>}
        </>
      )}
    </Modal>
  );
}

/* =================== BULK UPLOAD MODAL =================== */
function normalizeCsvValue(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function parseBulkSerialCsv(text: string) {
  const rows = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (rows.length <= 1) return [];

  return rows
    .slice(1)
    .map((line) => normalizeCsvValue((line.split(",")[0] ?? "")))
    .filter(Boolean);
}

function BulkUploadModal({ onClose, onComplete }: {
  onClose: () => void;
  onComplete: (result: BulkCreateResult) => void;
}) {
  const [settings, setSettings] = useState<TermSettingOut[]>([]);
  const [settingId, setSettingId] = useState("");
  const [location, setLocation] = useState("KL Warehouse");
  const [file, setFile] = useState<File | null>(null);
  const [serialCount, setSerialCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.termSettings.list({ active: true }).then(setSettings).catch(console.error);
  }, []);

  const setting = settings.find((s) => s.id === settingId);
  const valid = !!settingId && !!file && serialCount > 0;

  async function handleFile(next: File | null) {
    setFile(next);
    setErr(null);
    if (!next) {
      setSerialCount(0);
      return;
    }
    try {
      const text = await next.text();
      setSerialCount(parseBulkSerialCsv(text).length);
    } catch {
      setSerialCount(0);
      setErr("Failed to read CSV file");
    }
  }

  async function submit() {
    if (!file || !settingId) return;
    setUploading(true);
    setErr(null);
    try {
      const serialNumbers = parseBulkSerialCsv(await file.text());
      if (serialNumbers.length === 0) {
        setErr("CSV must contain a header row and at least one serial number");
        setUploading(false);
        return;
      }
      const body: TerminalBulkCreate = {
        term_setting_id: settingId,
        serial_numbers: serialNumbers,
        initial_location: location,
        sim_type: "WiFi only",
      };
      const result = await api.terminals.bulkCreate(body);
      onComplete(result);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Bulk upload failed");
      setUploading(false);
    }
  }

  return (
    <Modal
      title="Bulk Upload"
      sub="Create multiple terminals from a one-column CSV of serial numbers"
      icon="upload"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={!valid || uploading} onClick={submit}>
          {uploading ? "Uploading…" : "Create Terminals"}
        </Btn>
      </>}
    >
      <Field label="Terminal setting" hint="required">
        <select className="input" value={settingId} onChange={(e) => setSettingId(e.target.value)}>
          <option value="">Select model…</option>
          {settings.map((s) => (
            <option key={s.id} value={s.id}>
              {s.brand} {s.model} · {s.category} · RM {s.monthly_rental}/mo
            </option>
          ))}
        </select>
      </Field>
      {setting && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <Chip cls="chip-neutral">{setting.brand}</Chip>
          <Chip cls="chip-neutral">{setting.model}</Chip>
          <Chip cls="chip-info">{setting.category}</Chip>
          <Chip cls="chip-neutral">RM {setting.monthly_rental}/mo</Chip>
          {setting.deposit > 0 && <Chip cls="chip-neutral">Deposit RM {setting.deposit}</Chip>}
        </div>
      )}
      <Field label="Initial location">
        <select className="input" value={location} onChange={(e) => setLocation(e.target.value)}>
          {["KL Warehouse", "Repair Center", "In Transit"].map((l) => <option key={l}>{l}</option>)}
        </select>
      </Field>
      <Field label="Serial number CSV" hint="required">
        <input
          className="input"
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
        />
      </Field>
      <div style={{ padding: "10px 14px", background: "var(--bg-2, #f5f5f5)", borderRadius: 9, fontSize: 12.5, color: "var(--ink-2)" }}>
        CSV should contain exactly one column. The first row is treated as the header, and each following row is created as a terminal serial number.
      </div>
      {file && (
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Chip cls="chip-neutral">{file.name}</Chip>
          <Chip cls={serialCount > 0 ? "chip-ok" : "chip-warn"}>{serialCount} serial number{serialCount === 1 ? "" : "s"} detected</Chip>
        </div>
      )}
      {err && (
        <div style={{ marginTop: 12, padding: "8px 12px", background: "var(--bad-bg, #fef2f2)", border: "1px solid var(--bad)", borderRadius: 7, fontSize: 13, color: "var(--bad)" }}>
          {err}
        </div>
      )}
    </Modal>
  );
}

/* =================== SIM LINK MODAL =================== */
function SimLinkModal({ terminal, hasExisting, onClose, onLink }: {
  terminal: TerminalOut;
  hasExisting: boolean;
  onClose: () => void;
  onLink: (simId: string) => void;
}) {
  const [storedSims, setStoredSims] = useState<SimCardOut[]>([]);
  const [selected, setSelected] = useState("");

  useEffect(() => {
    api.simCards.list({ status: "In Storage" }).then((p) => setStoredSims(p.items)).catch(console.error);
  }, []);

  return (
    <Modal
      title={hasExisting ? "Replace SIM Card" : "Link SIM Card"}
      sub={terminalSerial(terminal) + " · " + terminal.brand + " " + terminal.model}
      icon="phone"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={!selected} onClick={() => onLink(selected)}>
          {hasExisting ? "Replace SIM" : "Link SIM"}
        </Btn>
      </>}
    >
      {storedSims.length === 0 ? (
        <Empty icon="phone" title="No SIM cards in storage" sub="All available SIMs are already linked to devices" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {storedSims.map((s) => {
            const sel = selected === s.id;
            return (
              <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", border: "1.5px solid " + (sel ? "var(--slate)" : "var(--line)"), borderRadius: 10, cursor: "pointer", background: sel ? "var(--bg-2, #f5f5f5)" : "transparent" }}>
                <input type="radio" name="simlink" checked={sel} onChange={() => setSelected(s.id)} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{s.carrier} — {s.plan}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{s.iccid} · {s.msisdn || "No MSISDN"} · {s.data_allowance}</div>
                </div>
              </label>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

/* =================== TERMINAL SETTINGS TAB =================== */
function TerminalSettingModal({ onClose, onSave, existing }: {
  onClose: () => void;
  onSave: (r: TermSettingOut) => void;
  existing?: TermSettingOut;
}) {
  const brandKeys = Object.keys(BRANDS);
  const [f, setF] = useState({
    brand: existing?.brand ?? brandKeys[0],
    model: existing?.model ?? "",
    category: existing?.category ?? "Countertop",
    bank: existing?.bank ?? BANKS[0],
    monthly_rental: existing?.monthly_rental?.toString() ?? "",
    deposit: existing?.deposit?.toString() ?? "",
    setup_fee: existing?.setup_fee?.toString() ?? "",
    active: existing?.active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  const valid = !!(f.model && f.monthly_rental);

  async function submit() {
    if (!valid) return;
    setSaving(true);
    setErr(null);
    const body: TermSettingCreate = {
      brand: f.brand, model: f.model, category: f.category, bank: f.bank,
      monthly_rental: +f.monthly_rental, deposit: +f.deposit || 0, setup_fee: +f.setup_fee || 0, active: f.active,
    };
    try {
      const result = existing
        ? await api.termSettings.update(existing.id, body)
        : await api.termSettings.create(body);
      onSave(result);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to save");
      setSaving(false);
    }
  }

  return (
    <Modal
      title={existing ? "Edit Terminal Setting" : "New Terminal Setting"}
      sub={existing ? `${existing.brand} ${existing.model}` : "Define a device model and its rental rate card"}
      icon="tag" onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={!valid || saving} onClick={submit}>
          {saving ? "Saving…" : existing ? "Save Changes" : "Create Setting"}
        </Btn>
      </>}
    >
      <div className="field-row">
        <Field label="Brand">
          <select className="input" value={f.brand} onChange={(e) => set("brand", e.target.value)}>
            {brandKeys.map((b) => <option key={b}>{b}</option>)}
          </select>
        </Field>
        <Field label="Category">
          <select className="input" value={f.category} onChange={(e) => set("category", e.target.value)}>
            {["Countertop","Portable","Mobile (mPOS)","SoftPOS"].map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      <div className="field-row">
        <Field label="Model name" hint="required">
          <input className="input" placeholder="e.g. A920 Pro" value={f.model} onChange={(e) => set("model", e.target.value)} />
        </Field>
        <Field label="Bank">
          <select className="input" value={f.bank} onChange={(e) => set("bank", e.target.value)}>
            {BANKS.map((b) => <option key={b}>{b}</option>)}
          </select>
        </Field>
      </div>
      <div className="field-row">
        <Field label="Monthly rental (RM)" hint="required">
          <input className="input" type="number" placeholder="0.00" value={f.monthly_rental} onChange={(e) => set("monthly_rental", e.target.value)} />
        </Field>
        <Field label="Deposit (RM)">
          <input className="input" type="number" placeholder="0.00" value={f.deposit} onChange={(e) => set("deposit", e.target.value)} />
        </Field>
        <Field label="Setup fee (RM)">
          <input className="input" type="number" placeholder="0.00" value={f.setup_fee} onChange={(e) => set("setup_fee", e.target.value)} />
        </Field>
      </div>
      <label style={{ display: "flex", gap: 9, alignItems: "center", fontSize: 13, fontWeight: 500 }}>
        <input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} />
        Active — available for new rentals
      </label>
      {err && (
        <div style={{ marginTop: 12, padding: "8px 12px", background: "var(--bad-bg, #fef2f2)", border: "1px solid var(--bad)", borderRadius: 7, fontSize: 13, color: "var(--bad)" }}>
          {err}
        </div>
      )}
    </Modal>
  );
}

function TerminalSettingsTab() {
  const [rows, setRows] = useState<TermSettingOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [editRow, setEditRow] = useState<TermSettingOut | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    api.termSettings.list()
      .then(setRows)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function handleSave(r: TermSettingOut) {
    if (editRow) {
      setRows((prev) => prev.map((x) => x.id === r.id ? r : x));
      setToast("Terminal setting updated");
    } else {
      setRows((prev) => [r, ...prev]);
      setToast("Terminal setting created");
    }
    setEditRow(null);
    setShowCreate(false);
    setTimeout(() => setToast(null), 2400);
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      await api.termSettings.remove(id);
      setRows((prev) => prev.filter((x) => x.id !== id));
      setDeleteId(null);
      setToast("Terminal setting removed");
      setTimeout(() => setToast(null), 2400);
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : "Delete failed");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setDeleting(false);
    }
  }

  const filtered = rows.filter((r) =>
    (r.brand + " " + r.model + " " + r.category).toLowerCase().includes(q.toLowerCase())
  );
  const isModalOpen = showCreate || editRow !== null;

  return (
    <>
      <Card>
        <Toolbar>
          <SearchBox value={q} onChange={setQ} placeholder="Search brand or model…" />
          <Btn variant="primary" icon="plus" onClick={() => { setShowCreate(true); setEditRow(null); }}>New Terminal Setting</Btn>
          <span className="tb-meta">{loading ? "Loading…" : `${filtered.length} rate cards`}</span>
        </Toolbar>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>{["Brand / Model","Bank","Category","Monthly Rental","Deposit","Setup Fee","Units","Status",""].map((h) => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {!loading && filtered.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="ent">
                      <div className="ent-ava slate" style={{ borderRadius: 7 }}><Icon name="terminal" size={15} /></div>
                      <div><div className="ent-name">{r.brand}</div><div className="ent-sub">{r.model}</div></div>
                    </div>
                  </td>
                  <td><span style={{ display: "flex", gap: 7, alignItems: "center" }}>
                    <Icon name="bank" size={14} style={{ color: "var(--ink-3)" }} />{r.bank}
                  </span></td>
                  <td><Chip cls={r.category === "Portable" ? "chip-info" : "chip-neutral"}>{r.category}</Chip></td>
                  <td className="td-strong">RM {r.monthly_rental}.00 <span className="td-mut" style={{ fontWeight: 400 }}>/mo</span></td>
                  <td className="td-mut">RM {r.deposit}</td>
                  <td className="td-mut">{r.setup_fee ? "RM " + r.setup_fee : "Waived"}</td>
                  <td className="td-mut">{r.units}</td>
                  <td>{r.active ? <Chip cls="chip-ok" dot>Active</Chip> : <Chip cls="chip-neutral" dot>Disabled</Chip>}</td>
                  <td>
                    {deleteId === r.id ? (
                      <div className="row-actions">
                        <Btn variant="ghost" sm style={{ color: "var(--bad)", fontSize: 12 }} disabled={deleting} onClick={() => handleDelete(r.id)}>
                          {deleting ? "…" : "Confirm"}
                        </Btn>
                        <Btn variant="ghost" sm onClick={() => setDeleteId(null)}>Cancel</Btn>
                      </div>
                    ) : (
                      <div className="row-actions">
                        <button className="icon-btn" title="Edit" onClick={() => { setEditRow(r); setShowCreate(false); }}><Icon name="edit" size={14} /></button>
                        <button className="icon-btn" title="Remove" style={{ color: "var(--bad)" }} onClick={() => setDeleteId(r.id)}><Icon name="trash" size={14} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {isModalOpen && (
        <TerminalSettingModal
          onClose={() => { setShowCreate(false); setEditRow(null); }}
          onSave={handleSave}
          existing={editRow ?? undefined}
        />
      )}
      {toast && <div className="toast"><span className="t-ico"><Icon name="checkCircle" size={17} /></span>{toast}</div>}
    </>
  );
}

/* =================== LISTING =================== */
const TERMINALS_PAGE_SIZE = 20;
const RENTED = ["Installed", "Assigned"];

export function Terminals({
  nav,
  initialFilter,
  initialRegister = false,
  initialTermSettingId,
}: {
  nav: NavFn;
  initialFilter?: string;
  initialRegister?: boolean;
  initialTermSettingId?: string;
}) {
  const [terminalList, setTerminalList] = useState<TerminalOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"inventory" | "settings">("inventory");
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("All");
  const [status, setStatus] = useState(initialFilter || "All");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showRegister, setShowRegister] = useState(initialRegister);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.terminals.list({
      page,
      per_page: TERMINALS_PAGE_SIZE,
      query: q || undefined,
      status: status !== "All" && status !== "Rented" ? status : undefined,
      brand: brand !== "All" ? brand : undefined,
    })
      .then((p) => {
        const items = status === "Rented" ? p.items.filter((t) => RENTED.includes(t.status)) : p.items;
        setTerminalList(items);
        setPages(p.pages);
        setTotal(p.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, q, brand, status]);

  function resetPage() { setPage(1); }

  const quick = [
    { id: "All",         label: "All" },
    { id: "Rented",      label: "Rented" },
    { id: "In Stock",    label: "In Stock" },
    { id: "Maintenance", label: "Maintenance" },
    { id: "Faulty",      label: "Faulty" },
  ];

  function handleRegister(t: TerminalOut) {
    setTerminalList((prev) => [t, ...prev]);
    setTotal((prev) => prev + 1);
    setToast("Device " + terminalSerial(t) + " registered");
    setTimeout(() => setToast(null), 2800);
  }

  async function refreshTerminalList() {
    setLoading(true);
    try {
      const p = await api.terminals.list({
        page,
        per_page: TERMINALS_PAGE_SIZE,
        query: q || undefined,
        status: status !== "All" && status !== "Rented" ? status : undefined,
        brand: brand !== "All" ? brand : undefined,
      });
      const items = status === "Rented" ? p.items.filter((t) => RENTED.includes(t.status)) : p.items;
      setTerminalList(items);
      setPages(p.pages);
      setTotal(p.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function handleBulkUpload(result: BulkCreateResult) {
    void refreshTerminalList();
    const summary = result.failed.length > 0
      ? `Bulk upload complete: ${result.created} created, ${result.failed.length} failed`
      : `Bulk upload complete: ${result.created} terminal${result.created === 1 ? "" : "s"} created`;
    setToast(summary);
    setTimeout(() => setToast(null), 3200);
  }

  return (
    <div>
      <PageHead
        title="Terminals"
        sub={tab === "inventory"
          ? total + " devices · search by serial, brand, model or assigned merchant"
          : "Device model templates · rental rates, deposit and setup fees"}
        actions={tab === "inventory" ? (
          <>
            <Btn variant="ghost" icon="download">Export</Btn>
            <Btn variant="ghost" icon="upload" onClick={() => setShowBulkUpload(true)}>Bulk Upload</Btn>
            <Btn variant="primary" icon="plus" onClick={() => setShowRegister(true)}>Register Device</Btn>
          </>
        ) : undefined}
      />

      <div className="tabs" style={{ marginBottom: 20 }}>
        {([["inventory", "Inventory"], ["settings", "Terminal Settings"]] as const).map(([id, label]) => (
          <div key={id} className={"tab" + (tab === id ? " active" : "")} onClick={() => setTab(id)}>{label}</div>
        ))}
      </div>

      {tab === "inventory" ? (
        <>
          <div className="seg" style={{ marginBottom: 14 }}>
            {quick.map((qk) => (
              <button key={qk.id} className={status === qk.id ? "active" : ""} onClick={() => { setStatus(qk.id); resetPage(); }}>
                {qk.label}
              </button>
            ))}
          </div>

          {status === "Rented" && (
            <div style={{ display: "flex", gap: 9, alignItems: "center", padding: "11px 14px", background: "var(--green-050)", border: "1px solid var(--green-100)", borderRadius: 10, marginBottom: 14, fontSize: 13 }}>
              <Icon name="link" size={16} style={{ color: "var(--green-700)" }} />
              <span><b>Rented view</b> — showing devices currently out on rental (Installed Active + Assigned).</span>
            </div>
          )}

          <Card>
            <Toolbar>
              <SearchBox value={q} onChange={(v) => { setQ(v); resetPage(); }} placeholder="Search serial, model, merchant…" />
              <select className="select" value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }}>
                <option value="All">All Statuses</option>
                <option value="Rented">Rented (out)</option>
                {TERMINAL_STATUS_ORDER.map((s) => <option key={s} value={s}>{TERMINAL_STATUS[s].label}</option>)}
              </select>
              <select className="select" value={brand} onChange={(e) => { setBrand(e.target.value); resetPage(); }}>
                {["All", ...Object.keys(BRANDS)].map((b) => <option key={b} value={b}>{b === "All" ? "All Brands" : b}</option>)}
              </select>
              <span className="tb-meta">{loading ? "Loading…" : `${total} devices`}</span>
            </Toolbar>
            {loading ? (
              <div style={{ padding: "24px 20px", fontSize: 13, color: "var(--ink-3)" }}>Loading…</div>
            ) : terminalList.length === 0 ? <Empty icon="terminal" title="No devices match" /> : (
              <ResponsiveTable
                rows={terminalList}
                getKey={(t) => terminalSerial(t)}
                onRowClick={(t) => nav("terminal-detail", terminalSerial(t))}
                columns={[
                  { key: "serial", header: "Serial", render: (t) => <div className="cell-2"><span className="td-mono td-strong">{terminalSerial(t)}</span>{t.tid && <span className="c2-sub mono">{t.tid}</span>}</div> },
                  { key: "device", header: "Brand / Model", mobileLabel: "Device", render: (t) => <div className="ent"><div className="ent-ava slate" style={{ borderRadius: 7 }}><Icon name="terminal" size={15} /></div><div><div className="ent-name">{t.brand}</div><div className="ent-sub">{t.model}</div></div></div> },
                  { key: "status", header: "Status", render: (t) => <TerminalStatus status={t.status} /> },
                  { key: "merchant", header: "Assigned Merchant", mobileLabel: "Merchant", render: (t) => <span className="td-mut">{t.merchant ? t.merchant.name : <span style={{ color: "var(--ink-4)" }}>Unassigned</span>}</span> },
                  { key: "location", header: "Location", render: (t) => <span style={{ display: "flex", gap: 6, alignItems: "center" }}><Icon name="mapPin" size={14} style={{ color: "var(--ink-3)" }} />{t.location}</span> },
                  { key: "movement", header: "Last Movement", render: (t) => <span className="td-mut td-mono">{t.last_movement.slice(5)}</span> },
                  { key: "rental", header: "Rental", render: (t) => <span className="td-mut">RM {t.rental_rate}</span> },
                ]}
                renderMobile={(t) => (
                  <MobileListItem
                    title={<span className="td-mono">{terminalSerial(t)}</span>}
                    sub={`${t.brand} · ${t.model}`}
                    status={<TerminalStatus status={t.status} />}
                    meta={[
                      { label: "TID", value: <span className="td-mono">{t.tid || "—"}</span> },
                      { label: "Merchant", value: t.merchant ? t.merchant.name : "Unassigned" },
                      { label: "Location", value: <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><Icon name="mapPin" size={14} style={{ color: "var(--ink-3)" }} />{t.location}</span> },
                      { label: "Rental", value: <>RM {t.rental_rate}</> },
                    ]}
                    onClick={() => nav("terminal-detail", terminalSerial(t))}
                    chevron
                  />
                )}
              />
            )}
            <Pagination total={total} shown={terminalList.length} page={page} pages={pages} onPageChange={setPage} />
          </Card>

          {showRegister && (
            <RegisterDeviceModal
              onClose={() => setShowRegister(false)}
              onRegister={handleRegister}
              initialSettingId={initialTermSettingId}
            />
          )}
          {showBulkUpload && <BulkUploadModal onClose={() => setShowBulkUpload(false)} onComplete={handleBulkUpload} />}
          {toast && <div className="toast"><span className="t-ico"><Icon name="checkCircle" size={17} /></span>{toast}</div>}
        </>
      ) : (
        <TerminalSettingsTab />
      )}
    </div>
  );
}

/* =================== DETAIL =================== */
export function TerminalDetail({
  id,
  nav,
  initialLinkedSim,
  simLoaded,
}: {
  id: string;
  nav: NavFn;
  initialLinkedSim: SimCardOut | null;
  simLoaded: boolean;
}) {
  const [terminal, setTerminal] = useState<TerminalOut | null>(null);
  const [termSetting, setTermSetting] = useState<TermSettingOut | null>(null);
  const [linkedSimOverride, setLinkedSimOverride] = useState<SimCardOut | null | undefined>(undefined);
  const [detailLoading, setDetailLoading] = useState(true);

  const [showStatus, setShowStatus] = useState(false);
  const [pendingStatus, setPendingStatus] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);
  const [showSimModal, setShowSimModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const linkedSim = linkedSimOverride === undefined ? initialLinkedSim : linkedSimOverride;

  useEffect(() => {
    api.terminals.get(id)
      .then((t) => {
        setTerminal(t);
        setPendingStatus(t.status);
        if (t.term_setting_id) {
          api.termSettings.get(t.term_setting_id).then(setTermSetting).catch(console.error);
        }
      })
      .catch(console.error)
      .finally(() => setDetailLoading(false));
  }, [id]);

  if (detailLoading) return (
    <div>
      <div className="back-link" onClick={() => nav("terminals")}><Icon name="arrowLeft" size={16} /> Back to Inventory</div>
      <div style={{ padding: 40, textAlign: "center", color: "var(--ink-3)" }}>Loading…</div>
    </div>
  );

  if (!terminal) return (
    <div>
      <PageHead title="Device not found" actions={<Btn variant="ghost" icon="arrowLeft" onClick={() => nav("terminals")}>Back</Btn>} />
      <Empty icon="terminal" title="Terminal not found" sub={"No device with serial " + id} />
    </div>
  );

  const linkedJobs = jobs.filter((j) => j.terminal && j.terminal.serial === terminalSerial(terminal)).slice(0, 4);

  async function applyStatus() {
    if (!terminal) return;
    setStatusSaving(true);
    try {
      const updated = await api.terminals.update(terminalSerial(terminal), { status: pendingStatus });
      setTerminal(prev => {return {
        ...prev,
        ...updated
      }});
      setShowStatus(false);
      setToast(`Status updated to "${TERMINAL_STATUS[pendingStatus]?.label || pendingStatus}"`);
      setTimeout(() => setToast(null), 2600);
    } catch {
      setToast("Failed to update status");
      setTimeout(() => setToast(null), 2600);
    } finally {
      setStatusSaving(false);
    }
  }

  async function handleLinkSim(simId: string) {
    if (!terminal) return;
    try {
      const serial = terminalSerial(terminal);
      if (linkedSim) {
        await api.terminals.unlinkSim(serial);
      }
      const updated = await api.terminals.linkSim({ terminal_serial: serial, simcard_id: simId });
      const newSim = await api.terminals.simCard(serial);
      setLinkedSimOverride(newSim);
      setTerminal(prev => {return {
        ...prev,
        ...updated
      }});
      setShowSimModal(false);
      setToast(linkedSim ? "SIM card replaced" : "SIM card linked");
      setTimeout(() => setToast(null), 2600);
    } catch {
      setToast("Failed to link SIM");
      setTimeout(() => setToast(null), 2600);
    }
  }

  async function handleUnlinkSim() {
    if (!linkedSim || !terminal) return;
    try {
      const updated = await api.terminals.unlinkSim(terminalSerial(terminal));
      setLinkedSimOverride(null);
      setTerminal(prev => {return {
        ...prev,
        ...updated
      }});
      setToast("SIM card unlinked — moved to storage");
      setTimeout(() => setToast(null), 2600);
    } catch {
      setToast("Failed to unlink SIM");
      setTimeout(() => setToast(null), 2600);
    }
  }

  console.log("details: ", terminal);

  return (
    <div>
      <div className="back-link" onClick={() => nav("terminals")}><Icon name="arrowLeft" size={16} /> Back to Inventory</div>

      <div className="page-head">
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: 13, background: "var(--dark-bg)", color: "var(--slate)", display: "grid", placeItems: "center" }}>
            <Icon name="terminal" size={26} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 className="page-title mono">{terminalSerial(terminal)}</h1>
              <TerminalStatus status={terminal.status} />
            </div>
            <p className="page-sub">{terminal.brand + " " + terminal.model + " · " + terminal.sim + (terminal.merchant ? " · " + terminal.merchant.name : " · Unassigned")}</p>
          </div>
        </div>
        <div className="page-head-actions">
          <Btn variant="ghost" icon="edit">Edit</Btn>
          <Btn variant="slate" icon="refresh" onClick={() => { setPendingStatus(terminal.status); setShowStatus(true); }}>Update Status</Btn>
        </div>
      </div>

      <div className="detail-grid">
        {/* LEFT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="Movement Timeline" icon="activity">
            <div className="card-pad">
              {!terminal.activity_log || terminal.activity_log.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--ink-3)" }}>No activity recorded yet.</div>
              ) : (
                <div className="timeline">
                  {terminal.activity_log.slice(0, 10).map((e, i) => (
                    <div className="tl-item" key={i}>
                      <div className="tl-dot" />
                      <div className="tl-time">{e.at.slice(0, 10)}</div>
                      <div className="tl-title">{e.event}</div>
                      {e.note && <div className="tl-desc">{e.note}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
          <Card title={"Linked Jobs" + (linkedJobs.length ? " (" + linkedJobs.length + ")" : "")} icon="jobs" actions={<Btn variant="ghost" sm iconRight="chevRight" onClick={() => nav("jobs")}>All jobs</Btn>}>
            {linkedJobs.length === 0 ? (
              <div style={{ padding: "16px 20px", fontSize: 13, color: "var(--ink-3)" }}>No jobs linked to this device yet.</div>
            ) : (
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead><tr>{["Job ID","Type","Status","SLA","Due"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {linkedJobs.map((j) => (
                      <tr key={j.id} className="clickable" onClick={() => nav("job-detail", j.id)}>
                        <td className="td-mono td-strong">{j.id}</td>
                        <td>{j.type}</td>
                        <td><JobStatus status={j.stage} /></td>
                        <td><SlaChip sla={j.sla} /></td>
                        <td className="td-mut td-mono">{j.due.slice(5)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          {/* <Card title="Photos & Inspection Forms" icon="image">
            <div className="card-pad">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
                {["device front","serial label","install site","signed form"].map((p, i) => (
                  <div key={i} className="ph" style={{ aspectRatio: "1", flexDirection: "column" }}>
                    <Icon name={i === 3 ? "file" : "image"} size={20} style={{ marginBottom: 5 }} />{p}
                  </div>
                ))}
              </div>
            </div>
          </Card> */}
        </div>

        {/* RIGHT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="Device Details" icon="terminal">
            <div className="card-pad">
              <dl className="kv" style={{ gridTemplateColumns: "118px 1fr" }}>
                <dt>Serial</dt><dd className="mono">{terminalSerial(terminal)}</dd>
                <dt>TID</dt><dd className="mono">{terminal.tid || "—"}</dd>
                <dt>Brand</dt><dd>{terminal.brand}</dd>
                <dt>Model</dt><dd>{terminal.model}</dd>
                <dt>Connectivity</dt><dd>{terminal.sim}</dd>
                <dt>Location</dt><dd>{terminal.location}</dd>
                <dt>Condition</dt><dd style={{ fontWeight: 400 }}>{terminal.condition_note}</dd>
              </dl>
            </div>
          </Card>

          <Card title="Terminal Setting" icon="settings">
            <div className="card-pad">
              {termSetting ? (
                <dl className="kv" style={{ gridTemplateColumns: "118px 1fr" }}>
                  <dt>Setting ID</dt><dd className="mono">{termSetting.id}</dd>
                  <dt>Category</dt><dd>{termSetting.category}</dd>
                  <dt>Bank</dt><dd>{termSetting.bank}</dd>
                  <dt>Monthly rate</dt><dd>RM {termSetting.monthly_rental}</dd>
                  <dt>Deposit</dt><dd>RM {termSetting.deposit}</dd>
                  {termSetting.setup_fee > 0 && <><dt>Setup fee</dt><dd>RM {termSetting.setup_fee}</dd></>}
                </dl>
              ) : (
                <div style={{ fontSize: 13, color: "var(--ink-3)" }}>No terminal setting linked.</div>
              )}
            </div>
          </Card>

          {/* SIM Card */}
          <Card title="SIM Card" icon="phone" actions={
            <Btn variant="ghost" sm icon="phone" onClick={() => setShowSimModal(true)}>
              {linkedSim ? "Replace SIM Card" : "Link SIM Card"}
            </Btn>
          }>
            <div className="card-pad">
              {!simLoaded ? (
                <div style={{ fontSize: 13, color: "var(--ink-3)" }}>Loading linked SIM card…</div>
              ) : linkedSim ? (
                <>
                  <dl className="kv" style={{ gridTemplateColumns: "100px 1fr" }}>
                    <dt>ICCID</dt><dd className="mono" style={{ fontSize: 12 }}>{linkedSim.iccid}</dd>
                    <dt>MSISDN</dt><dd className="mono">{linkedSim.msisdn || "—"}</dd>
                    <dt>Carrier</dt><dd>{linkedSim.carrier}</dd>
                    <dt>Plan</dt><dd>{linkedSim.plan}</dd>
                    <dt>Data</dt><dd>{linkedSim.data_allowance}</dd>
                    <dt>Status</dt><dd><Chip cls="chip-ok" dot>{linkedSim.status}</Chip></dd>
                  </dl>
                  <Btn
                    variant="ghost" sm icon="x"
                    style={{ marginTop: 12, color: "var(--bad)" }}
                    onClick={handleUnlinkSim}
                  >
                    Unlink SIM
                  </Btn>
                </>
              ) : (
                <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
                  No SIM card linked to this terminal.
                  <Btn variant="ghost" sm icon="plus" style={{ marginTop: 12, display: "flex" }} onClick={() => setShowSimModal(true)}>Link SIM Card</Btn>
                </div>
              )}
            </div>
          </Card>

          <Card title="Rental Setup" icon="tag">
            <div className="card-pad">
              <dl className="kv" style={{ gridTemplateColumns: "118px 1fr" }}>
                <dt>Plan</dt><dd>{terminal.rental_plan}</dd>
                <dt>Monthly</dt><dd>RM {terminal.rental_rate}.00</dd>
                <dt>Merchant</dt><dd>{terminal.merchant ? terminal.merchant.name : "—"}</dd>
              </dl>
              {terminal.merchant && (
                <Btn variant="ghost" sm iconRight="chevRight" style={{ marginTop: 14, width: "100%" }} onClick={() => nav("merchant-detail", terminal.merchant!.id)}>
                  View merchant
                </Btn>
              )}
            </div>
          </Card>

          <Card title="Replacement History" icon="swap">
            <div className="card-pad">
              {terminal.status === "Replacement Out" || terminal.status === "Faulty" ? (
                <div className="timeline">
                  <div className="tl-item">
                    <div className="tl-dot warn" />
                    <div className="tl-time">2026-05-28</div>
                    <div className="tl-title">Replacement dispatched</div>
                    <div className="tl-desc">Unit SNPA481xx sent · job JOB-24089</div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "var(--ink-3)", padding: "4px 0" }}>No replacements recorded for this device.</div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Status update modal */}
      {showStatus && (
        <Modal
          title="Update Terminal Status" sub={terminalSerial(terminal) + " · " + terminal.brand + " " + terminal.model} icon="refresh" size="slim"
          onClose={() => setShowStatus(false)}
          foot={<>
            <div className="mf-spacer" />
            <Btn variant="ghost" onClick={() => setShowStatus(false)}>Cancel</Btn>
            <Btn variant="primary" icon="check" onClick={applyStatus} disabled={statusSaving || pendingStatus === terminal.status}>
              {statusSaving ? "Saving…" : "Apply Status"}
            </Btn>
          </>}
        >
          <Field label="Current status">
            <div style={{ padding: "2px 0 4px" }}><TerminalStatus status={terminal.status} /></div>
          </Field>
          <Field label="Change to" hint="movement will be logged to timeline">
            <select className="input" value={pendingStatus} onChange={(e) => setPendingStatus(e.target.value)}>
              {TERMINAL_STATUS_ORDER.map((s) => <option key={s} value={s}>{TERMINAL_STATUS[s].label}</option>)}
            </select>
          </Field>
          <Field label="Note (optional)">
            <textarea className="textarea" placeholder="Reason or context for this status change…" />
          </Field>
        </Modal>
      )}

      {showSimModal && <SimLinkModal terminal={terminal} hasExisting={!!linkedSim} onClose={() => setShowSimModal(false)} onLink={handleLinkSim} />}

      {toast && <div className="toast"><span className="t-ico"><Icon name="checkCircle" size={17} /></span>{toast}</div>}
    </div>
  );
}
