/* Bumipay — shared confirmation modal for the Merchant/Customer hard-delete feature */
import { useState } from "react";
import { Icon } from "./icons";
import { Modal, Btn } from "./components";
import { ApiError, hardDeleteBlockers, type DeleteBlocker, type HardDeleteResult } from "@/lib/api";

function BlockerList({ blockers }: { blockers: DeleteBlocker[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
      {blockers.map((b) => (
        <div key={b.entity_type} style={{ border: "1px solid var(--bad-line)", background: "var(--bad-bg)", borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: "var(--bad)" }}>
            {b.count} {b.entity_type}{b.count === 1 ? "" : "s"}
          </div>
          <div className="mono" style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 4, wordBreak: "break-word" }}>
            {b.ids.join(", ")}
            {b.count > b.ids.length ? `, +${b.count - b.ids.length} more` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Generic hard-delete confirm modal. `run` performs the actual DELETE call — the
 * caller supplies it so this component stays entity-agnostic (Merchant vs Customer).
 * On a 409 (blockers present) it switches to a read-only "cannot delete" view instead
 * of closing, so the user sees exactly what's still linked.
 */
export function HardDeleteModal({
  entityLabel,
  name,
  id,
  run,
  onClose,
  onDeleted,
}: {
  entityLabel: string;
  name: string;
  id: string;
  run: () => Promise<HardDeleteResult>;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockMessage, setBlockMessage] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<DeleteBlocker[] | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await run();
      onDeleted();
    } catch (e) {
      const blocked = hardDeleteBlockers(e);
      if (blocked) {
        setBlockMessage(blocked.message);
        setBlockers(blocked.blockers);
      } else {
        setError(e instanceof ApiError ? e.message : `Failed to delete ${entityLabel.toLowerCase()}`);
      }
    } finally {
      setBusy(false);
    }
  }

  if (blockers) {
    return (
      <Modal
        title={`Can't delete this ${entityLabel.toLowerCase()}`}
        sub={`${name} · ${id}`}
        icon="alert"
        onClose={onClose}
        foot={<>
          <div className="mf-spacer" />
          <Btn variant="ghost" onClick={onClose}>Close</Btn>
        </>}
      >
        <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>{blockMessage}</div>
        <BlockerList blockers={blockers} />
      </Modal>
    );
  }

  return (
    <Modal
      title={`Delete ${entityLabel}?`}
      sub={`${name} · ${id}`}
      icon="trash"
      onClose={onClose}
      foot={<>
        <div className="mf-spacer" />
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="danger" icon="trash" disabled={busy} onClick={confirm}>
          {busy ? "Deleting…" : `Delete ${entityLabel}`}
        </Btn>
      </>}
    >
      <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
        This permanently deletes this {entityLabel.toLowerCase()} — this cannot be undone. Its addresses
        {entityLabel === "Merchant" ? " and commercial profile" : ""} will be deleted along with it.
        Use this only to clean up an erroneously-created record; it will be blocked if any real activity is linked to it.
      </div>
      {error && <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--bad)", marginTop: 12 }}><Icon name="alert" size={15} />{error}</div>}
    </Modal>
  );
}
