import { getTotalPages } from "../lib/list-pagination";

type ListPaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  itemLabel?: string;
  onPageChange: (page: number) => void;
};

export function ListPagination({
  page,
  pageSize,
  total,
  itemLabel = "records",
  onPageChange
}: ListPaginationProps) {
  const totalPages = getTotalPages(total, pageSize);

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="crm-pagination">
      <span>
        Page {page} of {totalPages} · {total.toLocaleString()} {itemLabel}
      </span>
      <div>
        <button
          className="crm-secondary-button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          type="button"
        >
          Previous
        </button>
        <button
          className="crm-secondary-button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          type="button"
        >
          Next
        </button>
      </div>
    </div>
  );
}
