/* PaidChain — SIM card inventory listing + detail */
import { useState, useEffect, useCallback } from "react";
import { Icon } from "./icons";
import { Card, Btn, PageHead, Toolbar, SearchBox, Pagination, Empty, Chip, Modal, Field } from "./components";
import { SIM_CARRIERS, SIM_PLANS, SIM_DATA_ALLOWANCES, SIM_STATUS } from "./data";
import { NavFn } from "./shell";
import { api, ApiError } from "@/lib/api";
import type { BulkCreateResult, SimCardOut, SimCardCreate, SimCardDetails, SimSettingCreate, SimSettingOut } from "@/lib/api";
import { useCan } from "@/lib/use-permissions";

function SimStatus({ status }: { status: string }) {
  const m = SIM_STATUS[status] || {};
  return <Chip cls={m.chip} dot>{status}</Chip>;
}

function simSettingLabel(setting: SimSettingOut) {
  return `${setting.carrier} · ${setting.plan}`;
}

/* =================== CREATE MODAL =================== */
function CreateSimCardModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (s: SimCardOut) => void;
}) {
  const [settings, setSettings] = useState<SimSettingOut[]>([]);
  const [form, setForm] = useState<SimCardCreate>({
    iccid: "", msisdn: "",
    sim_setting_id: "", data_allowance: SIM_DATA_ALLOWANCES[0],
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof SimCardCreate, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    api.simSettings.list({ active: true }).then(setSettings).catch(console.error);
  }, []);

  const setting = settings.find((s) => s.id === form.sim_setting_id);
  const valid = form.iccid.trim().length >= 10 && !!form.sim_setting_id;

  async function submit() {
    if (!valid) return;
    setSaving(true); setErr(null);
    try {
      const result = await api.simCards.create({
        iccid: form.iccid.trim(),
        msisdn: form.msisdn.trim(),
        sim_setting_id: form.sim_setting_id,
        data_allowance: form.data_allowance,
      });
      onCreate(result);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to add SIM card");
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Add SIM Card" sub="Register a new SIM card into the inventory" icon="phone"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={!valid || saving} onClick={submit}>
          {saving ? "Adding…" : "Add SIM Card"}
        </Btn>
      </>}
    >
      <Field label="ICCID" hint="required · min 19 digits">
        <input className="input" placeholder="e.g. 89601100001234567890"
          value={form.iccid} onChange={(e) => set("iccid", e.target.value)} />
      </Field>
      <Field label="MSISDN (phone number)">
        <input className="input" placeholder="e.g. 012-3456789"
          value={form.msisdn} onChange={(e) => set("msisdn", e.target.value)} />
      </Field>
      <Field label="SIM setting" hint="required">
        <select className="input" value={form.sim_setting_id ?? ""} onChange={(e) => set("sim_setting_id", e.target.value)}>
          <option value="">Select carrier plan…</option>
          {settings.map((s) => (
            <option key={s.id} value={s.id}>{simSettingLabel(s)}</option>
          ))}
        </select>
      </Field>
      {setting && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <Chip cls="chip-neutral">{setting.carrier}</Chip>
          <Chip cls="chip-info">{setting.plan}</Chip>
        </div>
      )}
      <Field label="Data allowance">
        <select className="input" value={form.data_allowance} onChange={(e) => set("data_allowance", e.target.value)}>
          {SIM_DATA_ALLOWANCES.map((d) => <option key={d}>{d}</option>)}
        </select>
      </Field>
      {err && (
        <div style={{ padding: "8px 12px", background: "var(--bad-bg, #fef2f2)", border: "1px solid var(--bad)", borderRadius: 7, fontSize: 13, color: "var(--bad)" }}>
          {err}
        </div>
      )}
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-3)" }}>
        New SIM cards are added into storage first. Link or replace them later from terminal device details.
      </p>
    </Modal>
  );
}

const SIMCARDS_PAGE_SIZE = 20;

/* =================== BULK UPLOAD MODAL =================== */
function SimBulkUploadModal({ onClose, onComplete }: {
  onClose: () => void;
  onComplete: (result: BulkCreateResult) => void;
}) {
  const [settings, setSettings] = useState<SimSettingOut[]>([]);
  const [settingId, setSettingId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.simSettings.list({ active: true }).then(setSettings).catch(console.error);
  }, []);

  const setting = settings.find((s) => s.id === settingId);
  const valid = !!settingId && !!file;

  async function submit() {
    if (!file || !settingId) return;
    setUploading(true);
    setErr(null);
    try {
      const result = await api.simCards.bulkUpload(file, settingId);
      onComplete(result);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Bulk upload failed");
      setUploading(false);
    }
  }

  return (
    <Modal
      title="Bulk Upload SIM Cards"
      sub="Upload a CSV or XLSX file and apply one SIM setting to the batch"
      icon="upload"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={!valid || uploading} onClick={submit}>
          {uploading ? "Uploading…" : "Upload SIM Cards"}
        </Btn>
      </>}
    >
      <Field label="SIM setting" hint="required">
        <select className="input" value={settingId} onChange={(e) => setSettingId(e.target.value)}>
          <option value="">Select carrier plan…</option>
          {settings.map((s) => (
            <option key={s.id} value={s.id}>{simSettingLabel(s)}</option>
          ))}
        </select>
      </Field>
      {setting && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <Chip cls="chip-neutral">{setting.carrier}</Chip>
          <Chip cls="chip-info">{setting.plan}</Chip>
          <Chip cls="chip-neutral">{setting.id}</Chip>
        </div>
      )}
      <Field label="SIM card file" hint="required">
        <input
          className="input"
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => { setFile(e.target.files?.[0] ?? null); setErr(null); }}
        />
      </Field>
      <div style={{ padding: "10px 14px", background: "var(--bg-2, #f5f5f5)", borderRadius: 9, fontSize: 12.5, color: "var(--ink-2)" }}>
        File columns should include iccid, msisdn, and data_allowance. If this modal setting is not selected, each row must include sim_setting_id.
      </div>
      {file && (
        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Chip cls="chip-neutral">{file.name}</Chip>
          <Chip cls="chip-neutral">{(file.size / 1024).toFixed(0)} KB</Chip>
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

/* =================== SIM SETTINGS TAB =================== */
function SimSettingModal({ onClose, onSave, existing }: {
  onClose: () => void;
  onSave: (r: SimSettingOut) => void;
  existing?: SimSettingOut;
}) {
  const OTHER = "__other";
  const knownCarrier = !existing?.carrier || SIM_CARRIERS.includes(existing.carrier);
  const knownPlan = !existing?.plan || SIM_PLANS.includes(existing.plan);
  const [carrierChoice, setCarrierChoice] = useState(knownCarrier ? existing?.carrier ?? SIM_CARRIERS[0] : OTHER);
  const [planChoice, setPlanChoice] = useState(knownPlan ? existing?.plan ?? SIM_PLANS[0] : OTHER);
  const [customCarrier, setCustomCarrier] = useState(knownCarrier ? "" : existing?.carrier ?? "");
  const [customPlan, setCustomPlan] = useState(knownPlan ? "" : existing?.plan ?? "");
  const [active, setActive] = useState(existing?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const carrier = carrierChoice === OTHER ? customCarrier.trim() : carrierChoice;
  const plan = planChoice === OTHER ? customPlan.trim() : planChoice;
  const valid = !!(carrier && plan);

  async function submit() {
    if (!valid) return;
    setSaving(true);
    setErr(null);
    const body: SimSettingCreate = {
      carrier,
      plan,
      active,
    };
    try {
      const result = existing
        ? await api.simSettings.update(existing.id, body)
        : await api.simSettings.create(body);
      onSave(result);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to save");
      setSaving(false);
    }
  }

  return (
    <Modal
      title={existing ? "Edit SIM Setting" : "New SIM Setting"}
      sub={existing ? simSettingLabel(existing) : "Define a reusable carrier and plan template"}
      icon="tag"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={!valid || saving} onClick={submit}>
          {saving ? "Saving…" : existing ? "Save Changes" : "Create Setting"}
        </Btn>
      </>}
    >
      <div className="field-row">
        <Field label="Carrier">
          <select className="input" value={carrierChoice} onChange={(e) => setCarrierChoice(e.target.value)}>
            {SIM_CARRIERS.map((c) => <option key={c}>{c}</option>)}
            <option value={OTHER}>Other</option>
          </select>
        </Field>
        <Field label="Plan">
          <select className="input" value={planChoice} onChange={(e) => setPlanChoice(e.target.value)}>
            {SIM_PLANS.map((p) => <option key={p}>{p}</option>)}
            <option value={OTHER}>Other</option>
          </select>
        </Field>
      </div>
      {(carrierChoice === OTHER || planChoice === OTHER) && (
        <div className="field-row">
          {carrierChoice === OTHER && (
            <Field label="Custom carrier" hint="required">
              <input className="input" placeholder="Enter carrier name" value={customCarrier} onChange={(e) => setCustomCarrier(e.target.value)} />
            </Field>
          )}
          {planChoice === OTHER && (
            <Field label="Custom plan" hint="required">
              <input className="input" placeholder="Enter plan name" value={customPlan} onChange={(e) => setCustomPlan(e.target.value)} />
            </Field>
          )}
        </div>
      )}
      {existing && (
        <label style={{ display: "flex", gap: 9, alignItems: "center", fontSize: 13, fontWeight: 500 }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active — available for new SIM cards
        </label>
      )}
      {err && (
        <div style={{ marginTop: 12, padding: "8px 12px", background: "var(--bad-bg, #fef2f2)", border: "1px solid var(--bad)", borderRadius: 7, fontSize: 13, color: "var(--bad)" }}>
          {err}
        </div>
      )}
    </Modal>
  );
}

function SimSettingsTab() {
  const can = useCan();
  const [rows, setRows] = useState<SimSettingOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [carrier, setCarrier] = useState("");
  const [active, setActive] = useState<"" | "true" | "false">("");
  const [editRow, setEditRow] = useState<SimSettingOut | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    api.simSettings.list({
      carrier: carrier || undefined,
      active: active === "" ? undefined : active === "true",
    })
      .then(setRows)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [carrier, active]);

  function flash(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2400);
  }

  function handleSave(r: SimSettingOut) {
    if (editRow) {
      setRows((prev) => prev.map((x) => x.id === r.id ? r : x));
      flash("SIM setting updated");
    } else {
      setRows((prev) => [r, ...prev]);
      flash("SIM setting created");
    }
    setEditRow(null);
    setShowCreate(false);
  }

  async function handleDelete(row: SimSettingOut) {
    if (!can("SIM Cards.Delete")) return;
    try {
      await api.simSettings.remove(row.id);
      setRows((prev) => prev.filter((x) => x.id !== row.id));
      flash("SIM setting deleted");
    } catch (e) {
      flash(e instanceof ApiError ? e.message : "Delete failed");
    }
  }

  const filtered = rows.filter((r) =>
    (r.id + " " + r.carrier + " " + r.plan).toLowerCase().includes(q.toLowerCase())
  );
  const isModalOpen = showCreate || editRow !== null;

  return (
    <>
      <Card>
        <Toolbar>
          <SearchBox value={q} onChange={setQ} placeholder="Search carrier or plan…" />
          <select className="input" style={{ width: 150 }} value={carrier} onChange={(e) => setCarrier(e.target.value)}>
            <option value="">All Carriers</option>
            {SIM_CARRIERS.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="input" style={{ width: 120 }} value={active} onChange={(e) => setActive(e.target.value as "" | "true" | "false")}>
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          {can("SIM Cards.Edit") && <Btn variant="primary" icon="plus" onClick={() => { setShowCreate(true); setEditRow(null); }}>New SIM Setting</Btn>}
          <span className="tb-meta">{loading ? "Loading…" : `${filtered.length} setting${filtered.length === 1 ? "" : "s"}`}</span>
        </Toolbar>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>{["Setting ID", "Carrier", "Plan", "Status", "Created", ""].map((h) => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {!loading && filtered.map((r) => (
                <tr key={r.id}>
                  <td><span className="td-mono td-strong">{r.id}</span></td>
                  <td>
                    <div className="ent">
                      <div className="ent-ava slate" style={{ borderRadius: 7 }}><Icon name="phone" size={15} /></div>
                      <div><div className="ent-name">{r.carrier}</div><div className="ent-sub">{r.plan}</div></div>
                    </div>
                  </td>
                  <td><Chip cls="chip-info">{r.plan}</Chip></td>
                  <td>{r.active ? <Chip cls="chip-ok" dot>Active</Chip> : <Chip cls="chip-neutral" dot>Disabled</Chip>}</td>
                  <td className="td-mut">{r.created_at ? r.created_at.slice(0, 10) : "—"}</td>
                  <td>
                    <div className="row-actions">
                      {can("SIM Cards.Edit") && <button className="icon-btn" title="Edit" onClick={() => { setEditRow(r); setShowCreate(false); }}><Icon name="edit" size={14} /></button>}
                      {can("SIM Cards.Edit") && (
                        <button
                          className="icon-btn"
                          title={r.active ? "Deactivate" : "Activate"}
                          style={{ color: r.active ? "var(--ok)" : "var(--ink-3)" }}
                          onClick={() => api.simSettings.update(r.id, { active: !r.active }).then((updated) => setRows((prev) => prev.map((x) => x.id === r.id ? updated : x))).catch(console.error)}
                        >
                          <Icon name={r.active ? "checkCircle" : "clock"} size={14} />
                        </button>
                      )}
                      {can("SIM Cards.Delete") && <button className="icon-btn" title="Delete" style={{ color: "var(--bad)" }} onClick={() => void handleDelete(r)}><Icon name="trash" size={14} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {isModalOpen && can("SIM Cards.Edit") && (
        <SimSettingModal
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
export function SimCards({ nav }: { nav: NavFn }) {
  const can = useCan();
  const [simCards, setSimCards] = useState<SimCardOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"inventory" | "settings">("inventory");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [details, setDetails] = useState<SimCardDetails | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const refreshSimCards = useCallback(() => {
    return api.simCards.list({
      page,
      per_page: SIMCARDS_PAGE_SIZE,
      query: q || undefined,
      status: status !== "All" ? status : undefined,
    })
      .then((p) => {
        setSimCards(p.items);
        setPages(p.pages);
        setTotal(p.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, q, status]);

  useEffect(() => {
    void refreshSimCards();
  }, [refreshSimCards]);

  useEffect(() => {
    api.simCards.details().then(setDetails).catch(console.error);
  }, []);

  function resetPage() { setPage(1); }

  function handleCreate(s: SimCardOut) {
    setSimCards((prev) => [s, ...prev]);
    setTotal((prev) => prev + 1);
    setToast(s.id + " added to inventory");
    setTimeout(() => setToast(null), 2800);
    api.simCards.details().then(setDetails).catch(console.error);
  }

  function handleBulkUpload(result: BulkCreateResult) {
    void refreshSimCards();
    api.simCards.details().then(setDetails).catch(console.error);
    const summary = result.failed.length > 0
      ? `Bulk upload complete: ${result.created} created, ${result.failed.length} failed`
      : `Bulk upload complete: ${result.created} SIM card${result.created === 1 ? "" : "s"} created`;
    setToast(summary);
    setTimeout(() => setToast(null), 3200);
  }

  return (
    <div>
      <PageHead
        title="SIM Cards"
        sub={tab === "inventory"
          ? "SIM card inventory · manage carrier assignments and terminal links"
          : "Reusable carrier and plan templates for SIM cards"}
        actions={tab === "inventory" ? <>
          {/* <Btn variant="ghost" icon="download">Export</Btn> */}
          {can("SIM Cards.Create") && <Btn variant="ghost" icon="upload" onClick={() => setShowBulkUpload(true)}>Bulk Upload</Btn>}
          {can("SIM Cards.Create") && <Btn variant="primary" icon="plus" onClick={() => setShowCreate(true)}>Add SIM Card</Btn>}
        </> : undefined}
      />

      <div className="tabs" style={{ marginBottom: 20 }}>
        {([["inventory", "Inventory"], ["settings", "SIM Settings"]] as const).map(([id, label]) => (
          <div key={id} className={"tab" + (tab === id ? " active" : "")} onClick={() => setTab(id)}>{label}</div>
        ))}
      </div>

      {tab === "inventory" ? (
        <>
          <div className="stat-grid" style={{ marginBottom: 16 }}>
            {[
              { l: "Total SIMs", v: details?.total_sims ?? 0,        ico: "phone", c: "var(--ink-2)", bg: "var(--bg-2, #f5f5f5)" },
              { l: "Active",     v: details?.total_active ?? 0,      ico: "check", c: "var(--ok)",   bg: "var(--green-050)" },
              { l: "In Storage", v: details?.total_in_storage ?? 0,  ico: "box",   c: "var(--info)", bg: "var(--info-bg)" },
              { l: "Suspended",  v: details?.total_suspended ?? 0,   ico: "alert", c: "var(--warn)", bg: "var(--warn-bg)" },
            ].map((s, i) => (
              <div key={i} className="stat">
                <div className="stat-top">
                  <div className="stat-ico" style={{ background: s.bg, color: s.c }}><Icon name={s.ico} size={17} /></div>
                  <div className="stat-label">{s.l}</div>
                </div>
                <div className="stat-val">{s.v}</div>
              </div>
            ))}
          </div>

          <Card>
            <Toolbar>
              <SearchBox value={q} onChange={(v) => { setQ(v); resetPage(); }} placeholder="Search ICCID, MSISDN, carrier, terminal…" />
              <select className="select" value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }}>
                {["All", "Active", "In Storage", "Suspended", "Retired"].map((s) => (
                  <option key={s} value={s}>{s === "All" ? "All Statuses" : s}</option>
                ))}
              </select>
              <span className="tb-meta">{loading ? "Loading…" : `${total} SIM cards`}</span>
            </Toolbar>
            {!loading && simCards.length === 0 ? <Empty icon="phone" title="No SIM cards match" /> : (
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>{["SIM ID","ICCID","MSISDN","Carrier","Plan","Linked Terminal","Status",""].map((h) => <th key={h}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {!loading && simCards.map((s) => {
                      const t = s.terminal;
                      const terminalId = t?.serial ?? s.terminal_serial;
                      return (
                        <tr key={s.id} onClick={() => nav("simcard-detail", s.id)}>
                          <td><span className="td-mono td-strong">{s.id}</span></td>
                          <td className="td-mono td-mut" style={{ fontSize: 12 }}>{s.iccid}</td>
                          <td className="td-mono">{s.msisdn || <span className="td-mut">—</span>}</td>
                          <td>{s.carrier}</td>
                          <td className="td-mut">{s.plan}</td>
                          <td>
                            {terminalId ? (
                              <div className="cell-2">
                                <span className="td-strong">{[t?.brand, t?.model].filter(Boolean).join(" ") || "Linked terminal"}</span>
                                <span className="c2-sub mono">{terminalId}</span>
                              </div>
                            ) : (
                              <span className="td-mut">In Storage</span>
                            )}
                          </td>
                          <td><SimStatus status={s.status} /></td>
                          <td><Btn variant="ghost" sm icon="eye" onClick={() => nav("simcard-detail", s.id)}>View</Btn></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination total={total} shown={simCards.length} page={page} pages={pages} onPageChange={setPage} />
          </Card>

          {showCreate && can("SIM Cards.Create") && <CreateSimCardModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
          {showBulkUpload && can("SIM Cards.Create") && <SimBulkUploadModal onClose={() => setShowBulkUpload(false)} onComplete={handleBulkUpload} />}
        </>
      ) : (
        <SimSettingsTab />
      )}
      {toast && <div className="toast"><span className="t-ico"><Icon name="checkCircle" size={17} /></span>{toast}</div>}
    </div>
  );
}

/* =================== DETAIL =================== */
export function SimCardDetail({ id, nav }: { id: string; nav: NavFn }) {
  const can = useCan();
  const [sim, setSim] = useState<SimCardOut | null>(null);
  const [simSettings, setSimSettings] = useState<SimSettingOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SimCardOut | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  
  useEffect(() => {
    api.simCards.get(id)
      .then(setSim)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!editing) return;
    api.simSettings.list().then(setSimSettings).catch(console.error);
  }, [editing]);

  if (loading) return (
    <div>
      <PageHead title="Loading…" actions={<Btn variant="ghost" icon="arrowLeft" onClick={() => nav("simcards")}>Back</Btn>} />
    </div>
  );
  if (!sim) return (
    <div>
      <PageHead title="SIM not found" actions={<Btn variant="ghost" icon="arrowLeft" onClick={() => nav("simcards")}>Back</Btn>} />
      <Empty icon="phone" title="SIM card not found" sub={"No SIM card with ID " + id} />
    </div>
  );

  const d = draft ?? sim;

  function startEdit() {
    setDraft(sim ? { ...sim, sim_setting_id: sim.sim_setting_id ?? sim.sim_setting?.id ?? null } : sim);
    setEditing(true);
  }
  function cancelEdit() { setDraft(null); setEditing(false); }

  function setDraftField(k: keyof SimCardOut, v: string | null) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [k]: v } as SimCardOut;
      if (k === "terminal_serial") {
        next.status = v ? "Active" : (prev.status === "Active" ? "In Storage" : prev.status);
      }
      return next;
    });
  }

  function setDraftSetting(settingId: string) {
    setDraft((prev) => {
      if (!prev) return prev;
      const setting = simSettings.find((s) => s.id === settingId);
      return {
        ...prev,
        sim_setting_id: settingId,
        carrier: setting?.carrier ?? prev.carrier,
        plan: setting?.plan ?? prev.plan,
      };
    });
  }

  function showToast(msg: string, ms = 2800) {
    setToast(msg);
    setTimeout(() => setToast(null), ms);
  }

  async function save() {
    if (!draft || !sim) return;
    if (!can("SIM Cards.Edit")) return;
    setSaving(true);
    try {
      const result = await api.simCards.update(id, {
        msisdn: draft.msisdn,
        sim_setting_id: draft.sim_setting_id,
        data_allowance: draft.data_allowance,
        status: draft.status,
      });
      setSim(result);
      setEditing(false);
      setDraft(null);
      showToast("SIM card updated");
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Save failed", 3500);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!can("SIM Cards.Delete")) return;
    setDeleting(true);
    try {
      await api.simCards.remove(id);
      nav("simcards");
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Delete failed", 3500);
      setDeleting(false);
    }
  }

  const infoRows: [string, string][] = [
    ["SIM ID",         sim.id],
    ["ICCID",          sim.iccid],
    ["MSISDN",         sim.msisdn || "—"],
    ["SIM Setting",    sim.sim_setting_id || sim.sim_setting?.id || "—"],
    ["Carrier",        sim.carrier],
    ["Plan",           sim.plan],
    ["Data Allowance", sim.data_allowance],
  ];
  const connectedTerminalId = sim.terminal?.serial ?? sim.terminal_serial;
  const connectedMerchant = sim.merchant ?? sim.terminal?.merchant ?? null;
  const connectedCustomer = sim.customer ?? connectedMerchant?.customer ?? sim.terminal?.customer ?? null;

  return (
    <div>
      <PageHead
        title={sim.id}
        sub={sim.carrier + " · " + sim.iccid}
        actions={<>
          <Btn variant="ghost" icon="arrowLeft" onClick={() => nav("simcards")}>Back</Btn>
          {!editing || !can("SIM Cards.Edit") ? (
            <>
              {can("SIM Cards.Edit") && <Btn variant="ghost" icon="edit" onClick={startEdit}>Edit</Btn>}
              {can("SIM Cards.Delete") && (
                <Btn variant="ghost" icon="trash" style={{ color: "var(--bad)" }} disabled={deleting} onClick={handleDelete}>
                  {deleting ? "Deleting…" : "Delete"}
                </Btn>
              )}
            </>
          ) : (
            <>
              <Btn variant="ghost" onClick={cancelEdit}>Cancel</Btn>
              <Btn variant="primary" icon="check" disabled={saving} onClick={save}>
                {saving ? "Saving…" : "Save Changes"}
              </Btn>
            </>
          )}
        </>}
      />

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}>
        <SimStatus status={sim.status} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* SIM Details */}
        <Card title="SIM Details" icon="phone">
          {!editing ? (
            <div style={{ padding: "4px 20px 16px" }}>
              {infoRows.map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                  <span style={{ color: "var(--ink-2)" }}>{l}</span>
                  <span style={{ fontWeight: 500, fontFamily: ["ICCID","MSISDN"].includes(l) ? "var(--mono)" : undefined }}>{v}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: "4px 20px 16px" }}>
              <Field label="MSISDN">
                <input className="input" placeholder="012-3456789" value={d.msisdn} onChange={(e) => setDraftField("msisdn", e.target.value)} />
              </Field>
              <Field label="SIM setting">
                <select className="input" value={d.sim_setting_id ?? ""} onChange={(e) => setDraftSetting(e.target.value)}>
                  <option value="">Select carrier plan…</option>
                  {simSettings.map((s) => (
                    <option key={s.id} value={s.id}>{simSettingLabel(s)}</option>
                  ))}
                </select>
              </Field>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                <Chip cls="chip-neutral">{d.carrier}</Chip>
                <Chip cls="chip-info">{d.plan}</Chip>
              </div>
              <Field label="Data allowance">
                <select className="input" value={d.data_allowance} onChange={(e) => setDraftField("data_allowance", e.target.value)}>
                  {SIM_DATA_ALLOWANCES.map((da) => <option key={da}>{da}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select className="input" value={d.status} onChange={(e) => setDraftField("status", e.target.value)}>
                  {Object.keys(SIM_STATUS).map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
            </div>
          )}
        </Card>

        {/* Terminal */}
        {connectedTerminalId && (
          <Card title="Connected Terminal" icon="terminal" actions={<Btn variant="ghost" sm icon="chevRight" onClick={() => nav("terminal-detail", connectedTerminalId)}>View</Btn>}>
            <div style={{ padding: "4px 20px 16px" }}>
              {[
                ["Serial", connectedTerminalId],
                ["Brand",  sim.terminal?.brand],
                ["Model",  sim.terminal?.model],
                ["Status", sim.terminal?.status],
              ].filter((row): row is [string, string] => Boolean(row[1])).map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                  <span style={{ color: "var(--ink-2)" }}>{l}</span>
                  <span style={{ fontWeight: 500, fontFamily: l === "Serial" ? "var(--mono)" : undefined }}>{v}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
        {(connectedMerchant || connectedCustomer) && (
          <Card title="Assignment" icon="merchants">
            <div style={{ padding: "4px 20px 16px" }}>
              {[
                ["Merchant", connectedMerchant?.name],
                ["Merchant ID", connectedMerchant?.id],
                ["MID", connectedMerchant?.mid],
                ["Customer", connectedCustomer?.name],
                ["Customer ID", connectedCustomer?.id],
              ].filter((row): row is [string, string] => Boolean(row[1])).map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                  <span style={{ color: "var(--ink-2)" }}>{l}</span>
                  <span style={{ fontWeight: 500, fontFamily: ["Merchant ID","MID","Customer ID"].includes(l) ? "var(--mono)" : undefined }}>{v}</span>
                </div>
              ))}
              {connectedMerchant?.id && (
                <Btn variant="ghost" sm iconRight="chevRight" style={{ marginTop: 14, width: "100%" }} onClick={() => nav("merchant-detail", connectedMerchant.id)}>
                  View merchant
                </Btn>
              )}
            </div>
          </Card>
        )}
      </div>

      {toast && <div className="toast"><span className="t-ico"><Icon name="checkCircle" size={17} /></span>{toast}</div>}
    </div>
  );
}
