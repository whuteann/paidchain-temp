import { useMemo, useState, type ReactNode } from "react";
import { sortRows, toggleSort, type SortState, type SortValue, type SortParams } from "@/lib/table-sort";

export interface SortColumn<T> {
  key: string;
  header: ReactNode;
  sortValue?: (row: T) => SortValue;
  sortLabel?: string;
}

export interface ServerSortProps {
  sort: SortState;
  onSortChange: (sort: SortState) => void;
}

/** Page owners keep server sort state even while the table shows a loading state. */
export function useServerSort(setPage: (page: number) => void, onRequest?: () => void) {
  const [sort, setSort] = useState<SortState>(null);
  const sortParams = useMemo<SortParams>(() => sort ? { sort_by: sort.key, sort_order: sort.direction } : {}, [sort]);
  function onSortChange(next: SortState) {
    onRequest?.();
    setPage(1);
    setSort(next);
  }
  function refreshSort() {
    if (sort) {
      onRequest?.();
      setSort({ ...sort });
    }
  }
  return { sort, onSortChange, sortParams, refreshSort };
}

/** Shared header controls for responsive tables and existing custom table bodies. */
export function SortableTable<T>({ rows, columns, sort: controlledSort, onSortChange, children }: {
  rows: T[];
  columns: SortColumn<T>[];
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  children: (rows: T[], headers: ReactNode) => ReactNode;
}) {
  const [localSort, setLocalSort] = useState<SortState>(null);
  const sort = controlledSort === undefined ? localSort : controlledSort;
  const change = onSortChange ?? setLocalSort;
  const sortable = columns.filter((column) => column.sortValue);
  const selected = columns.find((column) => column.key === sort?.key);
  const displayed = onSortChange ? rows : sortRows(rows, sort, selected?.sortValue);
  const label = (column: SortColumn<T>) => column.sortLabel ?? (typeof column.header === "string" ? column.header : column.key);
  const headers = columns.map((column) => (
    <th key={column.key} scope="col" aria-sort={column.sortValue ? sort?.key === column.key ? sort.direction === "asc" ? "ascending" : "descending" : "none" : undefined}>
      {column.sortValue ? (
        <button type="button" className="table-sort-button" onClick={() => change(toggleSort(sort, column.key))}
          aria-label={`Sort by ${label(column)}, ${sort?.key === column.key && sort.direction === "asc" ? "descending" : "ascending"}`}>
          {column.header}<span className="table-sort-arrow" aria-hidden="true">{sort?.key === column.key ? sort.direction === "asc" ? "↑" : "↓" : "↕"}</span>
        </button>
      ) : column.header}
    </th>
  ));
  return <>
    {sortable.length > 0 && <div className="table-mobile-sort">
      <label>Sort by <select className="select" value={sort?.key ?? ""} onChange={(e) => change(e.target.value ? { key: e.target.value, direction: "asc" } : null)}>
        <option value="">Default order</option>
        {sortable.map((column) => <option key={column.key} value={column.key}>{label(column)}</option>)}
      </select></label>
      {sort && <button type="button" className="table-sort-button" onClick={() => change(toggleSort(sort, sort.key))}
        aria-label={`Sort ${sort.direction === "asc" ? "descending" : "ascending"}`}>{sort.direction === "asc" ? "Ascending ↑" : "Descending ↓"}</button>}
    </div>}
    {children(displayed, headers)}
  </>;
}
