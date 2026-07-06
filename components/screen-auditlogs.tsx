/* PaidChain — Audit Logs */
import { useState, useEffect } from "react";
import { Icon } from "./icons";
import { Card, Btn, PageHead, Toolbar, SearchBox, Chip, Pagination, Empty } from "./components";
import { api } from "@/lib/api";
import type { AuditLogOut } from "@/lib/api";
import { useCan } from "@/lib/use-permissions";

const TYPE_META: Record<string, { cls: string; icon: string }> = {
  Create: { cls: "chip-ok",      icon: "plus" },
  Update: { cls: "chip-info",    icon: "edit" },
  Delete: { cls: "chip-bad",     icon: "x" },
  Auth:   { cls: "chip-indigo",  icon: "user" },
  Export: { cls: "chip-neutral", icon: "download" },
  System: { cls: "chip-dark",    icon: "settings" },
};

const ROLE_CLS: Record<string, string> = {
  Admin:      "chip-bad",
  Operations: "chip-info",
  Warehouse:  "chip-orange",
  Finance:    "chip-indigo",
  Viewer:     "chip-neutral",
};

const PAGE_SIZE = 15;

export function AuditLogs() {
  const can = useCan();
  const [logs, setLogs]       = useState<AuditLogOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ]             = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [page, setPage]       = useState(1);
  const [pages, setPages]     = useState(1);
  const [total, setTotal]     = useState(0);

  useEffect(() => {
    setLoading(true);
    api.auditLogs.list({
      page,
      size: PAGE_SIZE,
      query: q || undefined,
      type: typeFilter !== "All" ? typeFilter : undefined,
    })
      .then((p) => {
        setLogs(p.items);
        setPages(p.pages);
        setTotal(p.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, q, typeFilter]);

  function resetPage() { setPage(1); }

  const types = ["All", "Create", "Update", "Delete", "Auth", "Export", "System"] as const;

  return (
    <div>
      <PageHead
        title="Audit Logs"
        sub={total + " events · full activity trail across all modules"}
        actions={can("Audit Logs.Export") ? <Btn variant="ghost" icon="download">Export</Btn> : undefined}
      />

      <Card>
        <Toolbar>
          <SearchBox
            value={q}
            onChange={(v) => { setQ(v); resetPage(); }}
            placeholder="Search user, description, entity ID…"
          />
          <select
            className="select"
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); resetPage(); }}
          >
            {types.map((t) => (
              <option key={t} value={t}>{t === "All" ? "All Types" : t}</option>
            ))}
          </select>
          <span className="tb-meta">{total} events</span>
        </Toolbar>

        {loading ? (
          <div style={{ padding: "24px 20px", fontSize: 13, color: "var(--ink-3)" }}>Loading…</div>
        ) : logs.length === 0 ? (
          <Empty icon="activity" title="No audit events match" sub="Try adjusting your search or filter" />
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  {["ID", "Timestamp", "User", "Description", "Type"].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const tm = TYPE_META[log.type] ?? { cls: "chip-neutral", icon: "activity" };
                  return (
                    <tr key={log.id}>
                      <td>
                        <div className="cell-2">
                          <span className="td-mono td-strong">{log.id}</span>
                          {log.entity_id && (
                            <span className="c2-sub mono">{log.entity_type} · {log.entity_id}</span>
                          )}
                          {!log.entity_id && log.entity_type && (
                            <span className="c2-sub mono">{log.entity_type}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="cell-2">
                          <span className="td-mono td-strong">{log.action_at.slice(0, 10)}</span>
                          <span className="c2-sub mono">{log.action_at.slice(11)}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{log.user.name}</span>
                          <Chip cls={ROLE_CLS[log.user.role] || "chip-neutral"}>{log.user.role}</Chip>
                        </div>
                      </td>
                      <td style={{ maxWidth: 380 }}>
                        <span style={{ fontSize: 13 }}>{log.description}</span>
                      </td>
                      <td>
                        <Chip cls={tm.cls}>
                          <Icon name={tm.icon} size={12} />
                          {log.type}
                        </Chip>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Pagination total={total} shown={logs.length} page={page} pages={pages} onPageChange={setPage} />
      </Card>
    </div>
  );
}
