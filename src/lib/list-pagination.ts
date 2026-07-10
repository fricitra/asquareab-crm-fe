export const DEFAULT_LIST_PAGE_SIZE = 25;

/** Use for dropdowns / pickers that need more than one page of reference data. */
export const DROPDOWN_LIST_LIMIT = 100;

export type OffsetPagination = {
  limit: number;
  offset: number;
  total: number;
};

export type ListQueryParams = {
  search?: string;
  limit?: number;
  offset?: number;
  opportunityId?: string;
};

export function buildListQueryParams(params?: ListQueryParams) {
  if (!params) {
    return undefined;
  }

  const query: Record<string, string | number> = {};

  if (params.search?.trim()) {
    query.search = params.search.trim();
  }
  if (params.limit != null) {
    query.limit = params.limit;
  }
  if (params.offset != null) {
    query.offset = params.offset;
  }
  if (params.opportunityId) {
    query.opportunityId = params.opportunityId;
  }

  return Object.keys(query).length ? query : undefined;
}

export function getTotalPages(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function getRowSerialNumber(page: number, pageSize: number, index: number) {
  return (page - 1) * pageSize + index + 1;
}
