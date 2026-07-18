export type SortDirection = "asc" | "desc";

export type ListSortState = {
  sortBy: string;
  sortDir: SortDirection;
};

export function toggleSortDir(current: SortDirection): SortDirection {
  return current === "asc" ? "desc" : "asc";
}

export function nextListSort(
  current: ListSortState,
  column: string,
  defaultDir: SortDirection = "asc"
): ListSortState {
  if (current.sortBy === column) {
    return { sortBy: column, sortDir: toggleSortDir(current.sortDir) };
  }
  return { sortBy: column, sortDir: defaultDir };
}
