import type { SortDirection } from "../lib/list-sort";

type SortableThProps = {
  label: string;
  column: string;
  sortBy: string;
  sortDir: SortDirection;
  onSort: (column: string) => void;
};

export function SortableTh({ label, column, sortBy, sortDir, onSort }: SortableThProps) {
  const active = sortBy === column;
  const ariaSort = active ? (sortDir === "asc" ? "ascending" : "descending") : "none";

  return (
    <th aria-sort={ariaSort} className={`crm-sortable-th${active ? " is-sorted" : ""}`} scope="col">
      <button className="crm-sortable-th-button" onClick={() => onSort(column)} type="button">
        <span>{label}</span>
        <span aria-hidden className="crm-sortable-th-indicator">
          {active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}
