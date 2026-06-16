/* PaidChain — Audit Logs */
import { useState } from "react";
import { Icon } from "./icons";
import { Card, Btn, PageHead, Toolbar, SearchBox, Chip, Pagination, Empty } from "./components";
import { auditLogs } from "./data";
import type { AuditLog } from "./data";

const TYPE_META: Record<AuditLog["type"], { cls: string; icon: string }> = {
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
  const [q, setQ]         = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [page, setPage]   = useState(1);

  const filtered = auditLogs.filter((log) => {
    if (typeFilter !== "All" && log.type !== typeFilter) return false;
    if (q) {
      const hay = [log.id, log.user.name, log.user.role, log.description, log.entityType || "", log.entityId || ""]
        .join(" ").toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageRows   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function resetPage() { setPage(1); }

  const types = ["All", "Create", "Update", "Delete", "Auth", "Export", "System"] as const;

  return (
    <div>
      <PageHead
        title="Audit Logs"
        sub={auditLogs.length + " events · full activity trail across all modules"}
        actions={<Btn variant="ghost" icon="download">Export</Btn>}
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
          <span className="tb-meta">{filtered.length} events</span>
        </Toolbar>

        {pageRows.length === 0 ? (
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
                {pageRows.map((log) => {
                  const tm = TYPE_META[log.type];
                  return (
                    <tr key={log.id}>
                      <td>
                        <div className="cell-2">
                          <span className="td-mono td-strong">{log.id}</span>
                          {log.entityId && (
                            <span className="c2-sub mono">{log.entityType} · {log.entityId}</span>
                          )}
                          {!log.entityId && log.entityType && (
                            <span className="c2-sub mono">{log.entityType}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="cell-2">
                          <span className="td-mono td-strong">{log.actionAt.slice(0, 10)}</span>
                          <span className="c2-sub mono">{log.actionAt.slice(11)}</span>
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

        <Pagination total={filtered.length} shown={pageRows.length} />
      </Card>
    </div>
  );
}
