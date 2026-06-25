/* PaidChain — shared UI components */
import { useState, useRef, useEffect, useCallback, ReactNode } from "react";
import { Icon } from "./icons";
import { TERMINAL_STATUS, MERCHANT_STATUS, JOB_STATUS, SLA, PAYOUT_STATUS, FINANCE } from "./data";

/* ---------- Chip ---------- */
interface ChipProps { cls?: string; children?: ReactNode; dot?: boolean; sq?: boolean }
export function Chip({ cls, children, dot, sq }: ChipProps) {
  return (
    <span className={"chip " + (cls || "chip-neutral") + (sq ? " sq" : "")}>
      {dot && <span className="chip-dot" />}
      {children}
    </span>
  );
}

/* Status helpers */
export function TerminalStatus({ status }: { status: string }) {
  const m = TERMINAL_STATUS[status] || {};
  return <Chip cls={m.chip} dot>{m.label || status}</Chip>;
}
export function MerchantStatus({ status }: { status: string }) {
  const m = MERCHANT_STATUS[status] || {};
  return <Chip cls={m.chip} dot>{status}</Chip>;
}
export function JobStatus({ status }: { status: string }) {
  const m = JOB_STATUS[status] || {};
  return <Chip cls={m.chip} dot>{status}</Chip>;
}
export function SlaChip({ sla }: { sla: string }) {
  const m = SLA[sla] || {};
  return <Chip cls={m.chip}>{sla}</Chip>;
}
export function PayoutStatus({ status }: { status: string }) {
  const m = PAYOUT_STATUS[status] || {};
  return <Chip cls={m.chip} dot>{status}</Chip>;
}

/* ---------- Button ---------- */
interface BtnProps {
  variant?: string; sm?: boolean; icon?: string; iconRight?: string;
  children?: ReactNode; onClick?: () => void; disabled?: boolean;
  className?: string; title?: string; style?: React.CSSProperties;
}
export function Btn({ variant = "ghost", sm, icon, iconRight, children, onClick, disabled, className = "", title, style }: BtnProps) {
  return (
    <button
      className={"btn btn-" + variant + (sm ? " btn-sm" : "") + (!children ? " btn-icon" : "") + " " + className}
      onClick={onClick} disabled={disabled} title={title} style={style}
    >
      {icon && <Icon name={icon} size={sm ? 15 : 16} />}
      {children}
      {iconRight && <Icon name={iconRight} size={sm ? 15 : 16} />}
    </button>
  );
}

/* ---------- Modal ---------- */
interface ModalProps {
  title: string; sub?: string; icon?: string; onClose?: () => void;
  children?: ReactNode; foot?: ReactNode; size?: string;
  mobileMode?: "sheet" | "fullscreen";
  className?: string;
  closeOnBackdrop?: boolean;
}
export function Modal({ title, sub, icon, onClose, children, foot, size, mobileMode = "sheet", className = "", closeOnBackdrop = true }: ModalProps) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => { if (closeOnBackdrop && e.target === e.currentTarget) onClose?.(); }}>
      <div
        className={
          "modal" +
          (size ? " " + size : "") +
          (mobileMode === "fullscreen" ? " modal-mobile-fullscreen" : "") +
          (className ? " " + className : "")
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-head">
          {icon && <div className="mh-ico"><Icon name={icon} size={20} /></div>}
          <div className="modal-title-block">
            <h2 id="modal-title">{title}</h2>
            {sub && <p>{sub}</p>}
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {foot && <div className="modal-foot">{foot}</div>}
      </div>
    </div>
  );
}

/* ---------- Field ---------- */
interface FieldProps { label?: string; hint?: string; children?: ReactNode }
export function Field({ label, hint, children }: FieldProps) {
  return (
    <div className="field">
      {label && <label>{label}{hint && <span className="hint">{hint}</span>}</label>}
      {children}
    </div>
  );
}

/* ---------- Searchbox ---------- */
export function SearchBox({ value, onChange, placeholder, fullWidth }: { value: string; onChange: (v: string) => void; placeholder?: string; fullWidth?: boolean }) {
  return (
    <div className="search-box" style={fullWidth ? { maxWidth: "none" } : undefined}>
      <Icon name="search" size={16} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder || "Search…"} />
    </div>
  );
}

/* ---------- Card ---------- */
interface CardProps { title?: string; actions?: ReactNode; children?: ReactNode; pad?: boolean; className?: string; icon?: string }
export function Card({ title, actions, children, pad, className = "", icon }: CardProps) {
  return (
    <div className={"card " + className}>
      {title && (
        <div className="card-head">
          {icon && <Icon name={icon} size={17} style={{ color: "var(--ink-2)" }} />}
          <h3>{title}</h3>
          {actions && <div className="ch-actions">{actions}</div>}
        </div>
      )}
      {pad ? <div className="card-pad">{children}</div> : children}
    </div>
  );
}

/* ---------- Stepper ---------- */
export function Stepper({ stages, current }: { stages: string[]; current: number }) {
  return (
    <div className="stepper">
      {stages.map((s, i) => {
        const cls = i < current ? "done" : i === current ? "active" : "";
        return (
          <div className={"step " + cls} key={s}>
            <div className="step-line" />
            <div className="step-dot">
              {i < current ? <Icon name="check" size={16} /> : (i + 1)}
            </div>
            <div className="step-label">{s}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Dropzone ---------- */
export interface DropzoneFile {
  file: File;
  name: string;
  sizeLabel: string;
}

export function Dropzone({ files, setFiles, hint }: { files: DropzoneFile[]; setFiles: React.Dispatch<React.SetStateAction<DropzoneFile[]>>; hint?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const add = (list: FileList) => {
    const next = Array.from(list).map((file) => ({
      file,
      name: file.name,
      sizeLabel: (file.size / 1024).toFixed(0) + " KB",
    }));
    setFiles((prev) => [...prev, ...next]);
  };
  return (
    <div>
      <div
        className={"dropzone" + (files.length ? " has" : "")}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); add(e.dataTransfer.files); }}
      >
        <Icon name="upload" size={22} style={{ marginBottom: 6 }} />
        <div style={{ fontWeight: 600, fontSize: 13 }}>Drop files or click to upload</div>
        <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>{hint || "JPG, PNG or PDF · up to 10 MB"}</div>
        <input ref={inputRef} type="file" multiple hidden onChange={(e) => e.target.files && add(e.target.files)} />
      </div>
      {files.length > 0 && (
        <div className="dz-files">
          {files.map((f, i) => (
            <div className="dz-file" key={i}>
              <Icon name="fileCheck" size={16} className="dzf-ico" />
              <span className="dzf-name">{f.name}</span>
              <span className="dzf-size">{f.sizeLabel}</span>
              <button className="modal-close" style={{ width: 24, height: 24 }} onClick={(e) => { e.stopPropagation(); setFiles((prev) => prev.filter((_, j) => j !== i)); }}>
                <Icon name="x" size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Entity cell ---------- */
export function Entity({ name, sub, slate, ava }: { name: string; sub?: string; slate?: boolean; ava?: string }) {
  const initials = ava || name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="ent">
      <div className={"ent-ava" + (slate ? " slate" : "")}>{initials}</div>
      <div>
        <div className="ent-name">{name}</div>
        {sub && <div className="ent-sub">{sub}</div>}
      </div>
    </div>
  );
}

/* ---------- Readiness bar ---------- */
export function Readiness({ value }: { value: string }) {
  const m = FINANCE[value] || { chip: "chip-neutral", pct: 0 };
  const barColor = value === "Not Ready" ? "var(--bad)" : value === "Pending Docs" ? "var(--warn)" : "var(--green)";
  return (
    <div className="readiness">
      <div className="progress-mini"><span style={{ width: m.pct + "%", background: barColor }} /></div>
      <Chip cls={m.chip}>{value}</Chip>
    </div>
  );
}

/* ---------- Pagination ---------- */
export function Pagination({ total, shown, page, pages, onPageChange, compact = false }: {
  total: number;
  shown: number;
  page?: number;
  pages?: number;
  onPageChange?: (page: number) => void;
  compact?: boolean;
}) {
  if (page === undefined || pages === undefined || !onPageChange) {
    return (
      <div className={"pagination" + (compact ? " pagination-compact" : "")}>
        <span className="tb-meta pagination-meta" style={{ marginRight: "auto" }}>Showing 1–{shown} of {total}</span>
        <button type="button" className="pg-btn" aria-label="Previous page"><Icon name="chevLeft" size={14} /></button>
        <button className="pg-btn active">1</button>
        <button className="pg-btn">2</button>
        <button className="pg-btn">3</button>
        <button type="button" className="pg-btn" aria-label="Next page"><Icon name="chevRight" size={14} /></button>
      </div>
    );
  }

  const nums: number[] = [];
  const pageSpread = compact ? 1 : 2;
  for (let p = Math.max(1, page - pageSpread); p <= Math.min(pages, page + pageSpread); p++) nums.push(p);

  return (
    <div className={"pagination" + (compact ? " pagination-compact" : "")}>
      <span className="tb-meta pagination-meta" style={{ marginRight: "auto" }}>Page {page} of {pages} · {shown} shown of {total}</span>
      <button type="button" className="pg-btn" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page"><Icon name="chevLeft" size={14} /></button>
      {nums.map((n) => (
        <button type="button" key={n} className={"pg-btn" + (n === page ? " active" : "")} onClick={() => onPageChange(n)} aria-current={n === page ? "page" : undefined}>{n}</button>
      ))}
      <button type="button" className="pg-btn" disabled={page >= pages} onClick={() => onPageChange(page + 1)} aria-label="Next page"><Icon name="chevRight" size={14} /></button>
    </div>
  );
}

/* ---------- Toast ---------- */
export function useToast(): [ReactNode, (msg: string) => void] {
  const [toast, setToast] = useState<string | null>(null);
  const show = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }, []);
  const node = toast ? (
    <div className="toast">
      <span className="t-ico"><Icon name="checkCircle" size={17} /></span>
      {toast}
    </div>
  ) : null;
  return [node, show];
}

/* ---------- Empty state ---------- */
export function Empty({ icon, title, sub }: { icon?: string; title?: string; sub?: string }) {
  return (
    <div className="empty">
      <Icon name={icon || "search"} size={30} />
      <div style={{ fontWeight: 600, color: "var(--ink-2)", fontSize: 14 }}>{title || "No results"}</div>
      {sub && <div style={{ fontSize: 12.5, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

/* ---------- Mobile list / responsive tables ---------- */
export interface MobileListMeta {
  label: string;
  value: ReactNode;
}

interface MobileListItemProps {
  title: ReactNode;
  sub?: ReactNode;
  status?: ReactNode;
  meta?: MobileListMeta[];
  actions?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  className?: string;
}

export function MobileListItem({ title, sub, status, meta = [], actions, onClick, chevron, className = "" }: MobileListItemProps) {
  const clickable = Boolean(onClick);
  const content = (
    <>
      <div className="mobile-list-main">
        <div className="mobile-list-title-block">
          <div className="mobile-list-title">{title}</div>
          {sub && <div className="mobile-list-sub">{sub}</div>}
        </div>
        {(status || chevron) && (
          <div className="mobile-list-aside">
            {status}
            {chevron && <Icon name="chevRight" size={16} />}
          </div>
        )}
      </div>
      {meta.length > 0 && (
        <dl className="mobile-list-meta">
          {meta.map((item) => (
            <div key={item.label} className="mobile-list-meta-row">
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {actions && <div className="mobile-list-actions">{actions}</div>}
    </>
  );

  if (clickable) {
    return (
      <button type="button" className={"mobile-list-item clickable " + className} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={"mobile-list-item " + className}>{content}</div>;
}

interface ResponsiveTableColumn<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  mobileLabel?: string;
  hideOnMobile?: boolean;
}

interface ResponsiveTableProps<T> {
  rows: T[];
  columns: ResponsiveTableColumn<T>[];
  getKey: (row: T, index: number) => string | number;
  onRowClick?: (row: T) => void;
  renderMobile?: (row: T, index: number) => ReactNode;
  empty?: ReactNode;
  className?: string;
}

export function ResponsiveTable<T>({ rows, columns, getKey, onRowClick, renderMobile, empty, className = "" }: ResponsiveTableProps<T>) {
  if (!rows.length && empty) return <>{empty}</>;

  return (
    <div className={"responsive-table " + className}>
      <div className="tbl-wrap responsive-table-desktop">
        <table className="tbl">
          <thead>
            <tr>
              {columns.map((column) => <th key={column.key}>{column.header}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={getKey(row, index)} className={onRowClick ? "clickable" : ""} onClick={() => onRowClick?.(row)}>
                {columns.map((column) => (
                  <td key={column.key} data-label={typeof column.mobileLabel === "string" ? column.mobileLabel : typeof column.header === "string" ? column.header : undefined}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mobile-list responsive-table-mobile">
        {rows.map((row, index) => (
          <div key={getKey(row, index)}>
            {renderMobile ? renderMobile(row, index) : (
              <MobileListItem
                title={columns[0]?.render(row)}
                meta={columns.slice(1).filter((column) => !column.hideOnMobile).map((column) => ({
                  label: column.mobileLabel || (typeof column.header === "string" ? column.header : column.key),
                  value: column.render(row),
                }))}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                chevron={Boolean(onRowClick)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Toolbar ---------- */
export function Toolbar({ children, className = "", compact = false }: { children?: ReactNode; className?: string; compact?: boolean }) {
  return <div className={"toolbar" + (compact ? " toolbar-compact" : "") + (className ? " " + className : "")}>{children}</div>;
}

/* ---------- Page header ---------- */
export function PageHead({ title, sub, actions, eyebrow, meta, className = "" }: { title: string; sub?: string; actions?: ReactNode; eyebrow?: ReactNode; meta?: ReactNode; className?: string }) {
  return (
    <div className={"page-head" + (className ? " " + className : "")}>
      <div className="page-head-copy">
        {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
        {meta && <div className="page-head-meta">{meta}</div>}
      </div>
      {actions && <div className="page-head-actions">{actions}</div>}
    </div>
  );
}
