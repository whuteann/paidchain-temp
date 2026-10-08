export type SortValue = string | number | boolean | null | undefined;
export type SortState = { key: string; direction: "asc" | "desc" } | null;
export interface SortParams { sort_by?: string; sort_order?: "asc" | "desc" }

const collator = new Intl.Collator("en", { sensitivity: "base" });

/** Keep empty values last in either direction; never mutate the source rows. */
export function sortRows<T>(rows: T[], sort: SortState, value?: (row: T) => SortValue): T[] {
  if (!sort || !value) return rows;
  return [...rows].sort((a, b) => {
    const left = value(a), right = value(b);
    const leftEmpty = left == null || left === "" || (typeof left === "number" && Number.isNaN(left));
    const rightEmpty = right == null || right === "" || (typeof right === "number" && Number.isNaN(right));
    if (leftEmpty || rightEmpty) return leftEmpty === rightEmpty ? 0 : leftEmpty ? 1 : -1;
    const result = typeof left === "number" && typeof right === "number"
      ? left - right
      : typeof left === "boolean" && typeof right === "boolean"
        ? Number(left) - Number(right)
        : collator.compare(String(left), String(right));
    return sort.direction === "asc" ? result : -result;
  });
}

export function toggleSort(sort: SortState, key: string): SortState {
  return { key, direction: sort?.key === key && sort.direction === "asc" ? "desc" : "asc" };
}
