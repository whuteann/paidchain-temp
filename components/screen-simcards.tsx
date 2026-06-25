/* PaidChain — SIM card inventory listing + detail */
import { useState, useEffect } from "react";
import { Icon } from "./icons";
import { Card, Btn, PageHead, Toolbar, SearchBox, Pagination, Empty, Chip, Modal, Field } from "./components";
import { SIM_CARRIERS, SIM_PLANS, SIM_DATA_ALLOWANCES, SIM_STATUS } from "./data";
import { useTerminals } from "./terminals-context";
import { NavFn } from "./shell";
import { api, ApiError } from "@/lib/api";
import type { SimCardOut, SimCardCreate, SimCardDetails } from "@/lib/api";

function SimStatus({ status }: { status: string }) {
  const m = SIM_STATUS[status] || {};
  return <Chip cls={m.chip} dot>{status}</Chip>;
}

/* =================== CREATE MODAL =================== */
function CreateSimCardModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (s: SimCardOut) => void;
}) {
  const [form, setForm] = useState<SimCardCreate>({
    iccid: "", msisdn: "",
    carrier: SIM_CARRIERS[0], plan: SIM_PLANS[0], data_allowance: SIM_DATA_ALLOWANCES[0],
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof SimCardCreate, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.iccid.trim().length >= 10;

  async function submit() {
    if (!valid) return;
    setSaving(true); setErr(null);
    try {
      const result = await api.simCards.create(form);
      onCreate(result);
      onClose();
    } catch (e) {
      console.log("error: ", e);
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
      <div className="field-row">
        <Field label="Carrier">
          <select className="input" value={form.carrier} onChange={(e) => set("carrier", e.target.value)}>
            {SIM_CARRIERS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Plan">
          <select className="input" value={form.plan} onChange={(e) => set("plan", e.target.value)}>
            {SIM_PLANS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
      </div>
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

/* =================== LISTING =================== */
export function SimCards({ nav }: { nav: NavFn }) {
  const { terminals } = useTerminals();
  const [simCards, setSimCards] = useState<SimCardOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [details, setDetails] = useState<SimCardDetails | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.simCards.list({
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

  return (
    <div>
      <PageHead
        title="SIM Cards"
        sub="SIM card inventory · manage carrier assignments and terminal links"
        actions={<>
          <Btn variant="ghost" icon="download">Export</Btn>
          <Btn variant="primary" icon="plus" onClick={() => setShowCreate(true)}>Add SIM Card</Btn>
        </>}
      />

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
                  const t = s.terminal_serial ? terminals.find((t) => t.serial === s.terminal_serial) : null;
                  return (
                    <tr key={s.id}>
                      <td><span className="td-mono td-strong">{s.id}</span></td>
                      <td className="td-mono td-mut" style={{ fontSize: 12 }}>{s.iccid}</td>
                      <td className="td-mono">{s.msisdn || <span className="td-mut">—</span>}</td>
                      <td>{s.carrier}</td>
                      <td className="td-mut">{s.plan}</td>
                      <td>
                        {t ? (
                          <div className="cell-2">
                            <span className="td-strong">{t.brand} {t.model}</span>
                            <span className="c2-sub mono">{t.serial}</span>
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

      {showCreate && <CreateSimCardModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}
      {toast && <div className="toast"><span className="t-ico"><Icon name="checkCircle" size={17} /></span>{toast}</div>}
    </div>
  );
}

/* =================== DETAIL =================== */
export function SimCardDetail({ id, nav }: { id: string; nav: NavFn }) {
  const { terminals, updateTerminal } = useTerminals();
  const [sim, setSim] = useState<SimCardOut | null>(null);
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

  const linkedTerminal = sim.terminal_serial ? terminals.find((t) => t.serial === sim.terminal_serial) : null;
  const d = draft ?? sim;
  const draftLinkedTerminal = d.terminal_serial ? terminals.find((t) => t.serial === d.terminal_serial) : null;

  function startEdit() { setDraft(sim); setEditing(true); }
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

  function showToast(msg: string, ms = 2800) {
    setToast(msg);
    setTimeout(() => setToast(null), ms);
  }

  async function save() {
    if (!draft || !sim) return;
    setSaving(true);
    try {
      const nextStatus = draft.terminal_serial
        ? (draft.status === "In Storage" ? "Active" : draft.status)
        : (draft.status === "Active" ? "In Storage" : draft.status);

      if (sim.terminal_serial && sim.terminal_serial !== draft.terminal_serial) {
        updateTerminal(sim.terminal_serial, { sim: "WiFi only" });
      }
      if (draft.terminal_serial && draft.terminal_serial !== sim.terminal_serial) {
        updateTerminal(draft.terminal_serial, { sim: "4G + WiFi" });
      }

      const result = await api.simCards.update(id, {
        iccid: draft.iccid, msisdn: draft.msisdn,
        carrier: draft.carrier, plan: draft.plan,
        data_allowance: draft.data_allowance,
        status: nextStatus, terminal_serial: draft.terminal_serial,
      });
      setSim(result);
      setEditing(false);
      setDraft(null);
      showToast(draft.terminal_serial !== sim.terminal_serial
        ? (draft.terminal_serial ? "SIM card linked to " + draft.terminal_serial : "SIM card moved to storage")
        : "SIM card updated");
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Save failed", 3500);
    } finally {
      setSaving(false);
    }
  }

  async function quickLink(serial: string | null) {
    if (!sim) return;
    try {
      if (sim.terminal_serial && sim.terminal_serial !== serial) {
        updateTerminal(sim.terminal_serial, { sim: "WiFi only" });
      }
      if (serial) updateTerminal(serial, { sim: "4G + WiFi" });
      const result = await api.simCards.update(id, {
        terminal_serial: serial,
        status: serial ? "Active" : "In Storage",
      });
      setSim(result);
      showToast(serial ? "Linked to " + serial : "Unlinked — moved to storage");
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Link failed", 3500);
    }
  }

  async function handleDelete() {
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
    ["Carrier",        sim.carrier],
    ["Plan",           sim.plan],
    ["Data Allowance", sim.data_allowance],
  ];

  return (
    <div>
      <PageHead
        title={sim.id}
        sub={sim.carrier + " · " + sim.iccid}
        actions={<>
          <Btn variant="ghost" icon="arrowLeft" onClick={() => nav("simcards")}>Back</Btn>
          {!editing ? (
            <>
              <Btn variant="ghost" icon="edit" onClick={startEdit}>Edit</Btn>
              <Btn variant="ghost" icon="trash" style={{ color: "var(--bad)" }} disabled={deleting} onClick={handleDelete}>
                {deleting ? "Deleting…" : "Delete"}
              </Btn>
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
              <Field label="ICCID" hint="required">
                <input className="input" value={d.iccid} onChange={(e) => setDraftField("iccid", e.target.value)} />
              </Field>
              <Field label="MSISDN">
                <input className="input" placeholder="012-3456789" value={d.msisdn} onChange={(e) => setDraftField("msisdn", e.target.value)} />
              </Field>
              <div className="field-row">
                <Field label="Carrier">
                  <select className="input" value={d.carrier} onChange={(e) => setDraftField("carrier", e.target.value)}>
                    {SIM_CARRIERS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Plan">
                  <select className="input" value={d.plan} onChange={(e) => setDraftField("plan", e.target.value)}>
                    {SIM_PLANS.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </Field>
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

        {/* Linked Terminal */}
        <Card title="Linked Terminal" icon="terminal">
          <div style={{ padding: "4px 20px 16px" }}>
            {!editing ? (
              linkedTerminal ? (
                <>
                  {[
                    ["Serial",   linkedTerminal.serial],
                    ["Brand",    linkedTerminal.brand],
                    ["Model",    linkedTerminal.model],
                    ["TID",      linkedTerminal.tid || "—"],
                    ["Status",   linkedTerminal.status],
                    ["Location", linkedTerminal.location],
                  ].map(([l, v]) => (
                    <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                      <span style={{ color: "var(--ink-2)" }}>{l}</span>
                      <span style={{ fontWeight: 500 }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 14 }}>
                    <Btn variant="ghost" sm icon="x" onClick={() => quickLink(null)}>Unlink Terminal</Btn>
                  </div>
                </>
              ) : (
                <div style={{ padding: "16px 0" }}>
                  <div style={{ color: "var(--ink-3)", fontSize: 13, marginBottom: 14 }}>
                    This SIM is currently in storage and not linked to any terminal.
                  </div>
                  <Field label="Link to terminal">
                    <select className="input" defaultValue=""
                      onChange={(e) => { if (e.target.value) quickLink(e.target.value); }}>
                      <option value="">Select terminal to link…</option>
                      {terminals.map((t) => (
                        <option key={t.serial} value={t.serial}>
                          {t.brand} {t.model} · {t.serial} · {t.status}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              )
            ) : (
              <>
                <Field label="Terminal">
                  <select className="input" value={d.terminal_serial || ""}
                    onChange={(e) => setDraftField("terminal_serial", e.target.value || null)}>
                    <option value="">None — in storage</option>
                    {terminals.map((t) => (
                      <option key={t.serial} value={t.serial}>
                        {t.brand} {t.model} · {t.serial} · {t.status}
                      </option>
                    ))}
                  </select>
                </Field>
                {draftLinkedTerminal && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                    <Chip cls="chip-neutral">{draftLinkedTerminal.brand} {draftLinkedTerminal.model}</Chip>
                    <Chip cls="chip-info">{draftLinkedTerminal.status}</Chip>
                    {draftLinkedTerminal.merchant && <Chip cls="chip-neutral">{draftLinkedTerminal.merchant.name}</Chip>}
                  </div>
                )}
                <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 12 }}>
                  Selecting a terminal sets status to Active. Clearing it moves the SIM to In Storage.
                </p>
              </>
            )}
          </div>
        </Card>
      </div>

      {toast && <div className="toast"><span className="t-ico"><Icon name="checkCircle" size={17} /></span>{toast}</div>}
    </div>
  );
}
