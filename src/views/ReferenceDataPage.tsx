import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import {
  createReferenceData,
  getReferenceDataMetadata,
  listReferenceData,
  updateReferenceData,
  type ReferenceDataItem,
  type ReferenceDataPayload
} from "../api/reference-data";
import { DEFAULT_LIST_PAGE_SIZE } from "../lib/list-pagination";
import { nextListSort, type ListSortState } from "../lib/list-sort";
import { useModalEscape } from "../hooks/useModalEscape";
import { ListPagination } from "../shared/ListPagination";
import { SortableTh } from "../shared/SortableTh";

type ReferenceModalMode = "value" | "category" | "group" | "edit" | null;

type ReferenceFormValues = {
  referenceCategory: string;
  level1Code: string;
  level1Name: string;
  level2Code: string;
  level2Name: string;
  description: string;
  sortOrder: string;
  status: "ACTIVE" | "INACTIVE";
  isActive: boolean;
  remarks: string;
};

const pageSize = DEFAULT_LIST_PAGE_SIZE;

const blankForm: ReferenceFormValues = {
  referenceCategory: "",
  level1Code: "",
  level1Name: "",
  level2Code: "",
  level2Name: "",
  description: "",
  sortOrder: "0",
  status: "ACTIVE",
  isActive: true,
  remarks: ""
};

function pickString(value: string) {
  return value.trim() === "" ? undefined : value.trim();
}

function pickNumber(value: string) {
  const normalized = value.replace(/[, ]/g, "").trim();
  return normalized === "" ? undefined : Number(normalized);
}

function payload(values: ReferenceFormValues): ReferenceDataPayload {
  return {
    referenceCategory: values.referenceCategory.trim(),
    level1Code: values.level1Code.trim(),
    level1Name: values.level1Name.trim(),
    level2Code: values.level2Code.trim(),
    level2Name: values.level2Name.trim(),
    description: pickString(values.description),
    sortOrder: pickNumber(values.sortOrder),
    status: values.status,
    isActive: values.isActive,
    remarks: pickString(values.remarks)
  };
}

function formValues(item: ReferenceDataItem): ReferenceFormValues {
  return {
    referenceCategory: item.referenceCategory,
    level1Code: item.level1Code,
    level1Name: item.level1Name,
    level2Code: item.level2Code,
    level2Name: item.level2Name,
    description: item.description ?? "",
    sortOrder: String(item.sortOrder ?? 0),
    status: item.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    isActive: item.isActive,
    remarks: item.remarks ?? ""
  };
}

function modalTitle(mode: ReferenceModalMode) {
  if (mode === "category") return "New Category";
  if (mode === "group") return "New Group";
  if (mode === "edit") return "Edit Reference Value";
  return "New Reference Value";
}

function formatDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "-";
}

export function ReferenceDataPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [level1Filter, setLevel1Filter] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [listSort, setListSort] = useState<ListSortState>({ sortBy: "createdAt", sortDir: "desc" });
  const [modalMode, setModalMode] = useState<ReferenceModalMode>(null);
  const [editingItem, setEditingItem] = useState<ReferenceDataItem | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const form = useForm<ReferenceFormValues>({ defaultValues: blankForm });
  const watchedCategory = form.watch("referenceCategory");
  const watchedLevel1 = form.watch("level1Code");

  const metadataQuery = useQuery({
    queryKey: ["reference-data", "metadata"],
    queryFn: getReferenceDataMetadata,
    staleTime: 10_000
  });

  const referenceQuery = useQuery({
    queryKey: ["reference-data", "management", search, categoryFilter, level1Filter, activeOnly, page, listSort.sortBy, listSort.sortDir],
    queryFn: () =>
      listReferenceData({
        search,
        category: categoryFilter,
        level1: level1Filter,
        activeOnly,
        page,
        pageSize,
        sortBy: listSort.sortBy,
        sortDir: listSort.sortDir
      }),
    staleTime: 10_000
  });

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, level1Filter, activeOnly, listSort.sortBy, listSort.sortDir]);

  const onSortColumn = (column: string) => {
    const preferDesc = column === "createdAt" || column === "order";
    setListSort((current) => nextListSort(current, column, preferDesc ? "desc" : "asc"));
  };

  const rows = referenceQuery.data?.items ?? [];
  const pagination = referenceQuery.data?.pagination ?? { page, pageSize, totalItems: 0, totalPages: 1 };
  const metadata = metadataQuery.data;
  const categories = metadata?.categories ?? [];

  const filterFamilies = useMemo(
    () => (metadata?.families ?? []).filter((family) => !categoryFilter || family.referenceCategory === categoryFilter),
    [categoryFilter, metadata?.families]
  );

  const modalFamilies = useMemo(
    () => (metadata?.families ?? []).filter((family) => family.referenceCategory === watchedCategory),
    [metadata?.families, watchedCategory]
  );

  useEffect(() => {
    const family = modalFamilies.find((item) => item.level1Code === watchedLevel1);
    if (family && modalMode === "value") {
      form.setValue("level1Name", family.level1Name);
    }
  }, [form, modalFamilies, modalMode, watchedLevel1]);

  const refresh = (successMessage: string) => {
    setMessage(successMessage);
    setModalMode(null);
    setEditingItem(null);
    form.reset(blankForm);
    void queryClient.invalidateQueries({ queryKey: ["reference-data"] });
    void queryClient.invalidateQueries({ queryKey: ["reference"] });
  };

  const closeReferenceModal = () => {
    setModalMode(null);
    setEditingItem(null);
  };

  useModalEscape(Boolean(modalMode), closeReferenceModal);

  const createMutation = useMutation({
    mutationFn: (values: ReferenceFormValues) => createReferenceData(payload(values)),
    onSuccess: () => refresh("Reference value created."),
    onError: () => setMessage("Reference value could not be created. Check duplicate code and required fields.")
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: ReferenceFormValues }) => updateReferenceData(id, payload(values)),
    onSuccess: () => refresh("Reference value updated."),
    onError: () => setMessage("Reference value could not be updated.")
  });

  const resetPaging = () => setPage(1);

  const openModal = (mode: Exclude<ReferenceModalMode, null>, item?: ReferenceDataItem) => {
    setMessage(null);
    setModalMode(mode);
    setEditingItem(item ?? null);
    form.reset(item ? formValues(item) : blankForm);
  };

  const onSubmit = form.handleSubmit((values) => {
    if (!values.referenceCategory.trim() || !values.level1Code.trim() || !values.level1Name.trim() || !values.level2Code.trim() || !values.level2Name.trim()) {
      setMessage("Category, group code, group name, value code, and value name are required.");
      return;
    }

    if (modalMode === "edit" && editingItem) {
      updateMutation.mutate({ id: editingItem.id, values });
      return;
    }

    createMutation.mutate(values);
  });

  return (
    <div className="crm-workspace">
      <section className="crm-module-header">
        <div>
          <p className="crm-eyebrow">Administration</p>
          <h2>Reference Data Management</h2>
        </div>
        <div className="crm-dashboard-actions">
          <button className="crm-secondary-button" onClick={() => openModal("category")} type="button">
            New Category
          </button>
          <button className="crm-secondary-button" onClick={() => openModal("group")} type="button">
            New Group
          </button>
          <button className="crm-primary-button" onClick={() => openModal("value")} type="button">
            New Reference Value
          </button>
        </div>
      </section>

      <section className="crm-grid crm-metric-grid">
        <article className="crm-card">
          <h3>Values</h3>
          <div className="crm-kpi">{metadata?.stats.values ?? 0}</div>
        </article>
        <article className="crm-card">
          <h3>Categories</h3>
          <div className="crm-kpi">{metadata?.stats.categories ?? 0}</div>
        </article>
        <article className="crm-card">
          <h3>Families</h3>
          <div className="crm-kpi">{metadata?.stats.families ?? 0}</div>
        </article>
        <article className="crm-card">
          <h3>Inactive</h3>
          <div className="crm-kpi">{metadata?.stats.inactive ?? 0}</div>
        </article>
      </section>

      {message ? <div className={message.includes("could not") || message.includes("required") ? "crm-error-banner" : "crm-info-banner"}>{message}</div> : null}

      <section className="crm-panel crm-reference-register-panel">
        <div className="crm-panel-header">
          <h3>Reference Register</h3>
          <input
            className="crm-input crm-search-input"
            onChange={(event) => {
              setSearch(event.target.value);
              resetPaging();
            }}
            placeholder="Search category, group, code, name"
            value={search}
          />
        </div>

        <div className="crm-filter-row crm-reference-filter-row">
          <label className="crm-field">
            <span className="crm-label">Category</span>
            <select
              className="crm-input"
              onChange={(event) => {
                setCategoryFilter(event.target.value);
                setLevel1Filter("");
                resetPaging();
              }}
              value={categoryFilter}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="crm-field">
            <span className="crm-label">Group</span>
            <select
              className="crm-input"
              onChange={(event) => {
                setLevel1Filter(event.target.value);
                resetPaging();
              }}
              value={level1Filter}
            >
              <option value="">All groups</option>
              {filterFamilies.map((family) => (
                <option key={`${family.referenceCategory}-${family.level1Code}`} value={family.level1Code}>
                  {family.referenceCategory} / {family.level1Code}
                </option>
              ))}
            </select>
          </label>
          <label className="crm-check-field">
            <input
              checked={activeOnly}
              onChange={(event) => {
                setActiveOnly(event.target.checked);
                resetPaging();
              }}
              type="checkbox"
            />
            <span>Active only</span>
          </label>
        </div>

        <div className="crm-table-wrap">
          <table className="crm-table crm-reference-table">
            <thead>
              <tr>
                <SortableTh column="category" label="Category" onSort={onSortColumn} sortBy={listSort.sortBy} sortDir={listSort.sortDir} />
                <SortableTh column="group" label="Group" onSort={onSortColumn} sortBy={listSort.sortBy} sortDir={listSort.sortDir} />
                <SortableTh column="valueCode" label="Value Code" onSort={onSortColumn} sortBy={listSort.sortBy} sortDir={listSort.sortDir} />
                <SortableTh column="valueName" label="Value Name" onSort={onSortColumn} sortBy={listSort.sortBy} sortDir={listSort.sortDir} />
                <SortableTh column="order" label="Order" onSort={onSortColumn} sortBy={listSort.sortBy} sortDir={listSort.sortDir} />
                <SortableTh column="status" label="Status" onSort={onSortColumn} sortBy={listSort.sortBy} sortDir={listSort.sortDir} />
                <SortableTh column="createdAt" label="Created Date" onSort={onSortColumn} sortBy={listSort.sortBy} sortDir={listSort.sortDir} />
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id}>
                  <td>{item.referenceCategory}</td>
                  <td>
                    <strong>{item.level1Code}</strong>
                    <span>{item.level1Name}</span>
                  </td>
                  <td>{item.level2Code}</td>
                  <td>{item.level2Name}</td>
                  <td>{item.sortOrder}</td>
                  <td>
                    <span className={`crm-status-pill ${item.isActive && item.status === "ACTIVE" ? "crm-status-available" : "crm-status-cancelled"}`}>
                      {item.status}
                    </span>
                  </td>
                  <td>{formatDate(item.createdAt)}</td>
                  <td>
                    <button className="crm-secondary-button crm-small-button" onClick={() => openModal("edit", item)} type="button">
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="crm-empty-cell" colSpan={8}>
                    No reference values found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <ListPagination
          page={page}
          pageSize={pageSize}
          total={pagination.totalItems}
          itemLabel="values"
          onPageChange={setPage}
        />
      </section>

      {modalMode ? (
        <div className="crm-modal-backdrop" role="presentation">
          <section aria-modal="true" className="crm-modal crm-reference-modal" role="dialog">
            <div className="crm-panel-header">
              <h3>{modalTitle(modalMode)}</h3>
              <button
                className="crm-secondary-button"
                onClick={() => {
                  setModalMode(null);
                  setEditingItem(null);
                  form.reset(blankForm);
                }}
                type="button"
              >
                Close
              </button>
            </div>

            <form className="crm-form crm-compact-form" onSubmit={onSubmit}>
              <div className="crm-two-col">
                <label className="crm-field">
                  <span className="crm-label">Category</span>
                  {modalMode === "value" || modalMode === "group" ? (
                    <select className="crm-input" {...form.register("referenceCategory")}>
                      <option value="">Select category</option>
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input className="crm-input" placeholder="INVENTORY" {...form.register("referenceCategory")} />
                  )}
                </label>
                <label className="crm-field">
                  <span className="crm-label">Group Code</span>
                  {modalMode === "value" ? (
                    <select className="crm-input" {...form.register("level1Code")}>
                      <option value="">Select group</option>
                      {modalFamilies.map((family) => (
                        <option key={family.level1Code} value={family.level1Code}>
                          {family.level1Code} - {family.level1Name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input className="crm-input" placeholder="UNIT_TYPE" {...form.register("level1Code")} />
                  )}
                </label>
              </div>

              <label className="crm-field">
                <span className="crm-label">Group Name</span>
                <input className="crm-input" placeholder="Unit Type" readOnly={modalMode === "value"} {...form.register("level1Name")} />
              </label>

              <div className="crm-two-col">
                <label className="crm-field">
                  <span className="crm-label">Value Code</span>
                  <input className="crm-input" placeholder="APARTMENT" {...form.register("level2Code")} />
                </label>
                <label className="crm-field">
                  <span className="crm-label">Value Name</span>
                  <input className="crm-input" placeholder="Apartment" {...form.register("level2Name")} />
                </label>
              </div>

              <div className="crm-two-col">
                <label className="crm-field">
                  <span className="crm-label">Sort Order</span>
                  <input className="crm-input" {...form.register("sortOrder")} />
                </label>
                <label className="crm-field">
                  <span className="crm-label">Status</span>
                  <select className="crm-input" {...form.register("status")}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </label>
              </div>

              <label className="crm-check-field">
                <input type="checkbox" {...form.register("isActive")} />
                <span>Available for application use</span>
              </label>
              <label className="crm-field">
                <span className="crm-label">Description</span>
                <textarea className="crm-input crm-textarea" {...form.register("description")} />
              </label>
              <label className="crm-field">
                <span className="crm-label">Remarks</span>
                <textarea className="crm-input crm-textarea" {...form.register("remarks")} />
              </label>
              <button className="crm-primary-button" disabled={createMutation.isPending || updateMutation.isPending} type="submit">
                {modalMode === "edit" ? "Update Reference Value" : "Create Reference Value"}
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
