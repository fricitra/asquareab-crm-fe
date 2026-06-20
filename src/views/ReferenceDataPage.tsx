import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import {
  createReferenceData,
  listReferenceData,
  updateReferenceData,
  type ReferenceDataItem,
  type ReferenceDataPayload
} from "../api/reference-data";

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

export function ReferenceDataPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [level1Filter, setLevel1Filter] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const form = useForm<ReferenceFormValues>({
    defaultValues: blankForm
  });

  const referenceQuery = useQuery({
    queryKey: ["reference-data", "management", search, categoryFilter, level1Filter, activeOnly],
    queryFn: () =>
      listReferenceData({
        search,
        category: categoryFilter,
        level1: level1Filter,
        activeOnly
      }),
    staleTime: 10_000
  });

  const rows = referenceQuery.data ?? [];
  const selectedItem = rows.find((item) => item.id === selectedId) ?? null;
  const categories = useMemo(() => Array.from(new Set(rows.map((item) => item.referenceCategory))).sort(), [rows]);
  const level1Options = useMemo(
    () =>
      Array.from(
        new Set(rows.filter((item) => !categoryFilter || item.referenceCategory === categoryFilter).map((item) => item.level1Code))
      ).sort(),
    [categoryFilter, rows]
  );
  const stats = useMemo(() => {
    const families = new Set(rows.map((item) => `${item.referenceCategory}/${item.level1Code}`));
    const active = rows.filter((item) => item.status === "ACTIVE" && item.isActive).length;
    const inactive = rows.length - active;
    return { values: rows.length, categories: categories.length, families: families.size, inactive };
  }, [categories.length, rows]);

  useEffect(() => {
    if (selectedItem) {
      form.reset(formValues(selectedItem));
    }
  }, [form, selectedItem]);

  const refresh = (successMessage: string, item?: ReferenceDataItem) => {
    setMessage(successMessage);
    if (item) setSelectedId(item.id);
    void queryClient.invalidateQueries({ queryKey: ["reference-data"] });
    void queryClient.invalidateQueries({ queryKey: ["reference"] });
  };

  const createMutation = useMutation({
    mutationFn: (values: ReferenceFormValues) => createReferenceData(payload(values)),
    onSuccess: (item) => {
      form.reset(formValues(item));
      refresh("Reference value created.", item);
    },
    onError: () => setMessage("Reference value could not be created. Check duplicate code and required fields.")
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: ReferenceFormValues }) => updateReferenceData(id, payload(values)),
    onSuccess: (item) => refresh("Reference value updated.", item),
    onError: () => setMessage("Reference value could not be updated.")
  });

  const onSubmit = form.handleSubmit((values) => {
    if (!values.referenceCategory.trim() || !values.level1Code.trim() || !values.level2Code.trim() || !values.level2Name.trim()) {
      setMessage("Category, group code, value code, and value name are required.");
      return;
    }

    if (selectedItem) {
      updateMutation.mutate({ id: selectedItem.id, values });
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
      </section>

      <section className="crm-grid crm-metric-grid">
        <article className="crm-card">
          <h3>Values</h3>
          <div className="crm-kpi">{stats.values}</div>
        </article>
        <article className="crm-card">
          <h3>Categories</h3>
          <div className="crm-kpi">{stats.categories}</div>
        </article>
        <article className="crm-card">
          <h3>Families</h3>
          <div className="crm-kpi">{stats.families}</div>
        </article>
        <article className="crm-card">
          <h3>Inactive</h3>
          <div className="crm-kpi">{stats.inactive}</div>
        </article>
      </section>

      {message ? <div className={message.includes("could not") ? "crm-error-banner" : "crm-info-banner"}>{message}</div> : null}

      <section className="crm-action-grid">
        <section className="crm-panel">
          <div className="crm-panel-header">
            <h3>Reference Register</h3>
            <input
              className="crm-input crm-search-input"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search category, group, code, name"
              value={search}
            />
          </div>

          <div className="crm-filter-row">
            <label className="crm-field">
              <span className="crm-label">Category</span>
              <select
                className="crm-input"
                onChange={(event) => {
                  setCategoryFilter(event.target.value);
                  setLevel1Filter("");
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
              <span className="crm-label">Family</span>
              <select className="crm-input" onChange={(event) => setLevel1Filter(event.target.value)} value={level1Filter}>
                <option value="">All families</option>
                {level1Options.map((level1) => (
                  <option key={level1} value={level1}>
                    {level1}
                  </option>
                ))}
              </select>
            </label>
            <label className="crm-check-field">
              <input checked={activeOnly} onChange={(event) => setActiveOnly(event.target.checked)} type="checkbox" />
              <span>Active only</span>
            </label>
          </div>

          <div className="crm-table-wrap">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Family</th>
                  <th>Value</th>
                  <th>Name</th>
                  <th>Order</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr className={selectedId === item.id ? "is-selected" : ""} key={item.id} onClick={() => setSelectedId(item.id)}>
                    <td>
                      <strong>{item.referenceCategory}</strong>
                      <span>{item.level1Code}</span>
                    </td>
                    <td>{item.level2Code}</td>
                    <td>{item.level2Name}</td>
                    <td>{item.sortOrder}</td>
                    <td>
                      <span className={`crm-status-pill ${item.isActive && item.status === "ACTIVE" ? "crm-status-available" : "crm-status-cancelled"}`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td className="crm-empty-cell" colSpan={5}>
                      No reference values found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="crm-panel">
          <div className="crm-panel-header">
            <h3>{selectedItem ? "Edit Reference Value" : "New Reference Value"}</h3>
            <button
              className="crm-secondary-button"
              onClick={() => {
                setSelectedId(null);
                form.reset(blankForm);
              }}
              type="button"
            >
              New
            </button>
          </div>

          <form className="crm-form" onSubmit={onSubmit}>
            <div className="crm-two-col">
              <label className="crm-field">
                <span className="crm-label">Category</span>
                <input className="crm-input" placeholder="INVENTORY" {...form.register("referenceCategory")} />
              </label>
              <label className="crm-field">
                <span className="crm-label">Group Code</span>
                <input className="crm-input" placeholder="UNIT_TYPE" {...form.register("level1Code")} />
              </label>
            </div>
            <label className="crm-field">
              <span className="crm-label">Group Name</span>
              <input className="crm-input" placeholder="Unit Type" {...form.register("level1Name")} />
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
              {selectedItem ? "Update Reference Value" : "Create Reference Value"}
            </button>
          </form>
        </section>
      </section>
    </div>
  );
}
