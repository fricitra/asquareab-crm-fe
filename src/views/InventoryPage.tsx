import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import {
  createProject,
  createUnit,
  getProject,
  getUnit,
  listProjects,
  listUnits,
  updateProject,
  updateUnit,
  type Project,
  type Unit
} from "../api/inventory";
import { listCurrencies } from "../api/currencies";
import { getReferenceFamily } from "../api/reference-data";

type InventoryTab = "projects" | "units" | "availability";

type ProjectFormValues = {
  projectCode: string;
  name: string;
  locationCode: string;
  legalEntityCode: string;
  currencyCode: string;
  description: string;
  remarks: string;
};

type UnitFormValues = {
  projectId: string;
  unitCode: string;
  unitName: string;
  blockCode: string;
  floorNo: string;
  unitTypeRefId: string;
  bedroomCount: string;
  grossArea: string;
  netArea: string;
  basePrice: string;
  currencyCode: string;
  availabilityStatusRefId: string;
  remarks: string;
};

function pickString(value: string) {
  return value.trim() === "" ? undefined : value.trim();
}

function pickNumber(value: string) {
  const normalized = value.replace(/[, ]/g, "").trim();
  return normalized === "" ? undefined : Number(normalized);
}

function money(value: number | null, currencyCode: string | null) {
  if (value === null) return "-";
  return `${value.toLocaleString()} ${currencyCode ?? ""}`.trim();
}

function area(value: number | null) {
  return value === null ? "-" : value.toLocaleString();
}

function projectPayload(values: ProjectFormValues) {
  return {
    projectCode: values.projectCode.trim(),
    name: values.name.trim(),
    locationCode: pickString(values.locationCode),
    legalEntityCode: pickString(values.legalEntityCode),
    currencyCode: pickString(values.currencyCode),
    description: pickString(values.description),
    remarks: pickString(values.remarks)
  };
}

function unitPayload(values: UnitFormValues) {
  return {
    projectId: values.projectId,
    unitCode: values.unitCode.trim(),
    unitName: pickString(values.unitName),
    blockCode: pickString(values.blockCode),
    floorNo: pickString(values.floorNo),
    unitTypeRefId: pickString(values.unitTypeRefId),
    bedroomCount: pickNumber(values.bedroomCount),
    grossArea: pickNumber(values.grossArea),
    netArea: pickNumber(values.netArea),
    basePrice: pickNumber(values.basePrice),
    currencyCode: pickString(values.currencyCode),
    availabilityStatusRefId: pickString(values.availabilityStatusRefId),
    remarks: pickString(values.remarks)
  };
}

export function InventoryPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<InventoryTab>("projects");
  const [search, setSearch] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const projectForm = useForm<ProjectFormValues>({
    defaultValues: {
      projectCode: "",
      name: "",
      locationCode: "",
      legalEntityCode: "",
      currencyCode: "USD",
      description: "",
      remarks: ""
    }
  });
  const unitForm = useForm<UnitFormValues>({
    defaultValues: {
      projectId: "",
      unitCode: "",
      unitName: "",
      blockCode: "",
      floorNo: "",
      unitTypeRefId: "",
      bedroomCount: "",
      grossArea: "",
      netArea: "",
      basePrice: "",
      currencyCode: "USD",
      availabilityStatusRefId: "",
      remarks: ""
    }
  });

  const projectsQuery = useQuery({
    queryKey: ["inventory", "projects", search],
    queryFn: () => listProjects(search),
    staleTime: 10_000
  });
  const unitsQuery = useQuery({
    queryKey: ["inventory", "units", search],
    queryFn: () => listUnits(search),
    staleTime: 10_000
  });
  const selectedProjectQuery = useQuery({
    queryKey: ["inventory", "project", selectedProjectId],
    queryFn: () => getProject(selectedProjectId ?? ""),
    enabled: Boolean(selectedProjectId)
  });
  const selectedUnitQuery = useQuery({
    queryKey: ["inventory", "unit", selectedUnitId],
    queryFn: () => getUnit(selectedUnitId ?? ""),
    enabled: Boolean(selectedUnitId)
  });
  const unitTypesQuery = useQuery({
    queryKey: ["reference", "inventory-unit-types"],
    queryFn: () => getReferenceFamily("INVENTORY", "UNIT_TYPE"),
    staleTime: 60_000
  });
  const availabilityStatusesQuery = useQuery({
    queryKey: ["reference", "inventory-statuses"],
    queryFn: () => getReferenceFamily("INVENTORY", "STATUS"),
    staleTime: 60_000
  });
  const blocksQuery = useQuery({
    queryKey: ["reference", "inventory-blocks"],
    queryFn: () => getReferenceFamily("INVENTORY", "BLOCK"),
    staleTime: 60_000
  });
  const floorsQuery = useQuery({
    queryKey: ["reference", "inventory-floors"],
    queryFn: () => getReferenceFamily("INVENTORY", "FLOOR"),
    staleTime: 60_000
  });
  const currenciesQuery = useQuery({
    queryKey: ["currencies", "inventory-dropdown"],
    queryFn: () => listCurrencies({ dropdownOnly: true, activeOnly: true }),
    staleTime: 60_000
  });

  const projectRows = projectsQuery.data?.items ?? [];
  const unitRows = unitsQuery.data?.items ?? [];
  const currencyRows = currenciesQuery.data?.items ?? [];
  const selectedProject = selectedProjectQuery.data;
  const selectedUnit = selectedUnitQuery.data;

  const stats = useMemo(() => {
    const totalUnits = unitsQuery.data?.pagination.total ?? 0;
    const available = unitRows.filter((unit) => unit.availabilityStatus.code === "AVAILABLE").length;
    const reserved = unitRows.filter((unit) => unit.availabilityStatus.code === "RESERVED").length;
    const value = unitRows.reduce((sum, unit) => sum + (unit.basePrice ?? 0), 0);
    return {
      projects: projectsQuery.data?.pagination.total ?? 0,
      units: totalUnits,
      available,
      reserved,
      value
    };
  }, [projectRows, projectsQuery.data?.pagination.total, unitRows, unitsQuery.data?.pagination.total]);

  const refreshInventory = (successMessage: string) => {
    setMessage(successMessage);
    void queryClient.invalidateQueries({ queryKey: ["inventory"] });
  };

  const createProjectMutation = useMutation({
    mutationFn: (values: ProjectFormValues) => createProject(projectPayload(values)),
    onSuccess: (project) => {
      setSelectedProjectId(project.id);
      projectForm.reset({ projectCode: "", name: "", locationCode: "", legalEntityCode: "", currencyCode: "USD", description: "", remarks: "" });
      refreshInventory("Project saved.");
    },
    onError: () => setMessage("Project could not be saved. Check code and required fields.")
  });
  const updateProjectMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: ProjectFormValues }) => updateProject(id, projectPayload(values)),
    onSuccess: (project) => {
      setSelectedProjectId(project.id);
      refreshInventory("Project updated.");
    },
    onError: () => setMessage("Project could not be updated.")
  });
  const createUnitMutation = useMutation({
    mutationFn: (values: UnitFormValues) => createUnit(unitPayload(values)),
    onSuccess: (unit) => {
      setSelectedUnitId(unit.id);
      unitForm.reset({ projectId: "", unitCode: "", unitName: "", blockCode: "", floorNo: "", unitTypeRefId: "", bedroomCount: "", grossArea: "", netArea: "", basePrice: "", currencyCode: "USD", availabilityStatusRefId: "", remarks: "" });
      refreshInventory("Unit saved.");
    },
    onError: () => setMessage("Unit could not be saved. Check project, unit code, and status.")
  });
  const updateUnitMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: UnitFormValues }) => updateUnit(id, unitPayload(values)),
    onSuccess: (unit) => {
      setSelectedUnitId(unit.id);
      refreshInventory("Unit updated.");
    },
    onError: () => setMessage("Unit could not be updated.")
  });

  const onProjectSubmit = projectForm.handleSubmit((values) => {
    if (!values.projectCode.trim() || !values.name.trim()) {
      setMessage("Project code and name are required.");
      return;
    }
    if (selectedProject && activeTab === "projects") {
      updateProjectMutation.mutate({ id: selectedProject.id, values });
    } else {
      createProjectMutation.mutate(values);
    }
  });

  const onUnitSubmit = unitForm.handleSubmit((values) => {
    if (!values.projectId || !values.unitCode.trim()) {
      setMessage("Project and unit code are required.");
      return;
    }
    if (selectedUnit && activeTab === "units") {
      updateUnitMutation.mutate({ id: selectedUnit.id, values });
    } else {
      createUnitMutation.mutate(values);
    }
  });

  const loadProjectForm = (project: Project) => {
    setSelectedProjectId(project.id);
    projectForm.reset({
      projectCode: project.projectCode,
      name: project.name,
      locationCode: project.locationCode ?? "",
      legalEntityCode: project.legalEntityCode ?? "",
      currencyCode: project.currencyCode ?? "USD",
      description: project.description ?? "",
      remarks: project.remarks ?? ""
    });
  };

  const loadUnitForm = (unit: Unit) => {
    setSelectedUnitId(unit.id);
    unitForm.reset({
      projectId: unit.project.id,
      unitCode: unit.unitCode,
      unitName: unit.unitName ?? "",
      blockCode: unit.blockCode ?? "",
      floorNo: unit.floorNo ?? "",
      unitTypeRefId: unit.unitType.id ?? "",
      bedroomCount: unit.bedroomCount?.toString() ?? "",
      grossArea: unit.grossArea?.toString() ?? "",
      netArea: unit.netArea?.toString() ?? "",
      basePrice: unit.basePrice?.toString() ?? "",
      currencyCode: unit.currencyCode ?? "USD",
      availabilityStatusRefId: unit.availabilityStatus.id,
      remarks: unit.remarks ?? ""
    });
  };

  const resetUnitForm = () => {
    setSelectedUnitId(null);
    unitForm.reset({
      projectId: "",
      unitCode: "",
      unitName: "",
      blockCode: "",
      floorNo: "",
      unitTypeRefId: "",
      bedroomCount: "",
      grossArea: "",
      netArea: "",
      basePrice: "",
      currencyCode: "USD",
      availabilityStatusRefId: "",
      remarks: ""
    });
  };

  return (
    <div className="crm-workspace">
      <section className="crm-module-header">
        <div>
          <p className="crm-eyebrow">Inventory</p>
          <h2>Projects and Units</h2>
        </div>
      </section>

      <section className="crm-grid crm-metric-grid">
        <article className="crm-card">
          <h3>Projects</h3>
          <div className="crm-kpi">{stats.projects}</div>
        </article>
        <article className="crm-card">
          <h3>Units</h3>
          <div className="crm-kpi">{stats.units}</div>
        </article>
        <article className="crm-card">
          <h3>Available</h3>
          <div className="crm-kpi">{stats.available}</div>
        </article>
        <article className="crm-card">
          <h3>Value</h3>
          <div className="crm-kpi">{stats.value.toLocaleString()}</div>
        </article>
      </section>

      {message ? <div className={message.includes("could not") ? "crm-error-banner" : "crm-info-banner"}>{message}</div> : null}

      <section className="crm-tabs" aria-label="Inventory management tabs">
        {[
          { id: "projects", label: "Projects" },
          { id: "units", label: "Units" },
          { id: "availability", label: "Availability" }
        ].map((tab) => (
          <button
            className={`crm-tab-button${activeTab === tab.id ? " is-active" : ""}`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id as InventoryTab)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </section>

      {activeTab === "projects" ? (
        <section className="crm-action-grid crm-inventory-grid">
          <section className="crm-panel">
            <div className="crm-panel-header">
              <h3>Project Register</h3>
              <input className="crm-input crm-search-input" onChange={(event) => setSearch(event.target.value)} placeholder="Search project, location" value={search} />
            </div>
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Location</th>
                    <th>Currency</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {projectRows.map((project) => (
                    <tr className={selectedProjectId === project.id ? "is-selected" : ""} key={project.id} onClick={() => loadProjectForm(project)}>
                      <td>
                        <strong>{project.projectCode}</strong>
                        <span>{project.name}</span>
                      </td>
                      <td>{project.locationCode ?? "-"}</td>
                      <td>{project.currencyCode ?? "-"}</td>
                      <td>{project.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <form className="crm-panel crm-form" onSubmit={onProjectSubmit}>
            <div className="crm-panel-header">
              <h3>{selectedProject ? "Edit Project" : "Create Project"}</h3>
              <button
                className="crm-secondary-button crm-fit-button"
                onClick={() => {
                  setSelectedProjectId(null);
                  projectForm.reset({ projectCode: "", name: "", locationCode: "", legalEntityCode: "", currencyCode: "USD", description: "", remarks: "" });
                }}
                type="button"
              >
                New
              </button>
            </div>
            <label className="crm-field">
              <span className="crm-label">Project Code</span>
              <input className="crm-input" {...projectForm.register("projectCode")} />
            </label>
            <label className="crm-field">
              <span className="crm-label">Project Name</span>
              <input className="crm-input" {...projectForm.register("name")} />
            </label>
            <div className="crm-two-col">
              <label className="crm-field">
                <span className="crm-label">Location</span>
                <input className="crm-input" {...projectForm.register("locationCode")} />
              </label>
              <label className="crm-field">
                <span className="crm-label">Currency</span>
                <select className="crm-input" {...projectForm.register("currencyCode")}>
                  <option value="">Select currency</option>
                  {currencyRows.map((item) => (
                    <option key={item.id} value={item.currencyCode}>
                      {item.currencyCode} - {item.currencyName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="crm-field">
              <span className="crm-label">Legal Entity</span>
              <input className="crm-input" {...projectForm.register("legalEntityCode")} />
            </label>
            <label className="crm-field">
              <span className="crm-label">Description</span>
              <textarea className="crm-input crm-textarea" {...projectForm.register("description")} />
            </label>
            <button className="crm-primary-button" disabled={createProjectMutation.isPending || updateProjectMutation.isPending} type="submit">
              {selectedProject ? "Update Project" : "Create Project"}
            </button>
          </form>
        </section>
      ) : null}

      {activeTab === "units" || activeTab === "availability" ? (
        <section className="crm-action-grid crm-inventory-grid">
          <section className="crm-panel">
            <div className="crm-panel-header">
              <h3>{activeTab === "units" ? "Unit Register" : "Availability Register"}</h3>
              <input className="crm-input crm-search-input" onChange={(event) => setSearch(event.target.value)} placeholder="Search unit, project, status" value={search} />
            </div>
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Unit</th>
                    <th>Project</th>
                    <th>Type</th>
                    <th>Price</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {unitRows.map((unit) => (
                    <tr className={selectedUnitId === unit.id ? "is-selected" : ""} key={unit.id} onClick={() => loadUnitForm(unit)}>
                      <td>
                        <strong>{unit.unitCode}</strong>
                        <span>{unit.unitName ?? "Unit"}</span>
                      </td>
                      <td>
                        <strong>{unit.project.projectCode}</strong>
                        <span>{unit.project.name ?? "-"}</span>
                      </td>
                      <td>{unit.unitType.name ?? "-"}</td>
                      <td>{money(unit.basePrice, unit.currencyCode)}</td>
                      <td>
                        <span className={`crm-status-pill crm-status-${unit.availabilityStatus.code?.toLowerCase() ?? "default"}`}>
                          {unit.availabilityStatus.name ?? unit.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="crm-panel">
            <div className="crm-panel-header">
              <h3>{activeTab === "units" ? (selectedUnit ? "Edit Unit" : "Create Unit") : "Unit Detail"}</h3>
              {activeTab === "units" ? (
                <button className="crm-secondary-button crm-fit-button" onClick={resetUnitForm} type="button">
                  New
                </button>
              ) : null}
            </div>
            {activeTab === "units" ? (
              <form className="crm-form" onSubmit={onUnitSubmit}>
                <label className="crm-field">
                  <span className="crm-label">Project</span>
                  <select className="crm-input" {...unitForm.register("projectId")}>
                    <option value="">Select project</option>
                    {projectRows.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.projectCode} - {project.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="crm-two-col">
                  <label className="crm-field">
                    <span className="crm-label">Unit Code</span>
                    <input className="crm-input" {...unitForm.register("unitCode")} />
                  </label>
                  <label className="crm-field">
                    <span className="crm-label">Unit Name</span>
                    <input className="crm-input" {...unitForm.register("unitName")} />
                  </label>
                </div>
                <div className="crm-two-col">
                  <label className="crm-field">
                    <span className="crm-label">Block</span>
                    <select className="crm-input" {...unitForm.register("blockCode")}>
                      <option value="">Select block</option>
                      {(blocksQuery.data ?? []).map((item) => (
                        <option key={item.id} value={item.level2Code}>
                          {item.level2Name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="crm-field">
                    <span className="crm-label">Floor</span>
                    <select className="crm-input" {...unitForm.register("floorNo")}>
                      <option value="">Select floor</option>
                      {(floorsQuery.data ?? []).map((item) => (
                        <option key={item.id} value={item.level2Code}>
                          {item.level2Name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="crm-two-col">
                  <label className="crm-field">
                    <span className="crm-label">Unit Type</span>
                    <select className="crm-input" {...unitForm.register("unitTypeRefId")}>
                      <option value="">Select type</option>
                      {(unitTypesQuery.data ?? []).map((item) => (
                        <option key={item.id} value={item.id}>{item.level2Name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="crm-field">
                    <span className="crm-label">Availability</span>
                    <select className="crm-input" {...unitForm.register("availabilityStatusRefId")}>
                      <option value="">Default available</option>
                      {(availabilityStatusesQuery.data ?? []).map((item) => (
                        <option key={item.id} value={item.id}>{item.level2Name}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="crm-two-col">
                  <label className="crm-field">
                    <span className="crm-label">Bedrooms</span>
                    <input className="crm-input" {...unitForm.register("bedroomCount")} />
                  </label>
                  <label className="crm-field">
                    <span className="crm-label">Net Area</span>
                    <input className="crm-input" {...unitForm.register("netArea")} />
                  </label>
                </div>
                <div className="crm-two-col">
                  <label className="crm-field">
                    <span className="crm-label">Gross Area</span>
                    <input className="crm-input" {...unitForm.register("grossArea")} />
                  </label>
                  <label className="crm-field">
                    <span className="crm-label">Base Price</span>
                    <input className="crm-input" {...unitForm.register("basePrice")} />
                  </label>
                </div>
                <label className="crm-field">
                  <span className="crm-label">Currency</span>
                  <select className="crm-input" {...unitForm.register("currencyCode")}>
                    <option value="">Default project currency</option>
                    {currencyRows.map((item) => (
                      <option key={item.id} value={item.currencyCode}>
                        {item.currencyCode} - {item.currencyName}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="crm-primary-button" disabled={createUnitMutation.isPending || updateUnitMutation.isPending} type="submit">
                  {selectedUnit ? "Update Unit" : "Create Unit"}
                </button>
              </form>
            ) : selectedUnit ? (
              <dl className="crm-detail-list">
                <div><dt>Unit</dt><dd>{selectedUnit.unitCode}</dd></div>
                <div><dt>Project</dt><dd>{selectedUnit.project.projectCode}</dd></div>
                <div><dt>Type</dt><dd>{selectedUnit.unitType.name ?? "-"}</dd></div>
                <div><dt>Bedrooms</dt><dd>{selectedUnit.bedroomCount ?? "-"}</dd></div>
                <div><dt>Net Area</dt><dd>{area(selectedUnit.netArea)}</dd></div>
                <div><dt>Gross Area</dt><dd>{area(selectedUnit.grossArea)}</dd></div>
                <div><dt>Base Price</dt><dd>{money(selectedUnit.basePrice, selectedUnit.currencyCode)}</dd></div>
                <div><dt>Reservation</dt><dd>{selectedUnit.reservationStatus.name ?? "-"}</dd></div>
              </dl>
            ) : (
              <p className="crm-muted-text">Select a unit to review availability, pricing, and reservation state.</p>
            )}
          </section>
        </section>
      ) : null}
    </div>
  );
}
