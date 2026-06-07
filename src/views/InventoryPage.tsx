import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getUnit, listProjects, listUnits, type Unit } from "../api/inventory";

function money(value: number | null, currencyCode: string | null) {
  if (value === null) return "-";
  return `${value.toLocaleString()} ${currencyCode ?? ""}`.trim();
}

function area(value: number | null) {
  return value === null ? "-" : value.toLocaleString();
}

export function InventoryPage() {
  const [search, setSearch] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

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

  const unitDetailQuery = useQuery({
    queryKey: ["inventory", "unit", selectedUnitId],
    queryFn: () => getUnit(selectedUnitId ?? ""),
    enabled: Boolean(selectedUnitId)
  });

  const unitRows = unitsQuery.data?.items ?? [];
  const selectedUnit = unitDetailQuery.data;

  const stats = useMemo(() => {
    const total = unitsQuery.data?.pagination.total ?? 0;
    const available = unitRows.filter((unit) => unit.availabilityStatus.code === "AVAILABLE").length;
    const reserved = unitRows.filter((unit) => unit.availabilityStatus.code === "RESERVED").length;
    const value = unitRows.reduce((sum, unit) => sum + (unit.basePrice ?? 0), 0);
    return { total, available, reserved, value };
  }, [unitRows, unitsQuery.data?.pagination.total]);

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
          <div className="crm-kpi">{projectsQuery.data?.pagination.total ?? 0}</div>
        </article>
        <article className="crm-card">
          <h3>Units</h3>
          <div className="crm-kpi">{stats.total}</div>
        </article>
        <article className="crm-card">
          <h3>Available</h3>
          <div className="crm-kpi">{stats.available}</div>
        </article>
        <article className="crm-card">
          <h3>Reserved</h3>
          <div className="crm-kpi">{stats.reserved}</div>
        </article>
      </section>

      <div className="crm-lead-layout">
        <section className="crm-panel">
          <div className="crm-panel-header">
            <h3>Unit Availability</h3>
            <input
              className="crm-input crm-search-input"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search unit, project, location"
              value={search}
            />
          </div>

          <div className="crm-table-wrap">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>Project</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Price</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {unitRows.map((unit: Unit) => (
                  <tr
                    className={selectedUnitId === unit.id ? "is-selected" : ""}
                    key={unit.id}
                    onClick={() => setSelectedUnitId(unit.id)}
                  >
                    <td>
                      <strong>{unit.unitCode}</strong>
                      <span>{unit.unitName ?? "Unit"}</span>
                    </td>
                    <td>
                      <strong>{unit.project.projectCode}</strong>
                      <span>{unit.project.name ?? "-"}</span>
                    </td>
                    <td>{unit.unitType.name ?? "-"}</td>
                    <td>{area(unit.netArea)}</td>
                    <td>{money(unit.basePrice, unit.currencyCode)}</td>
                    <td>
                      <span className={`crm-status-pill crm-status-${unit.availabilityStatus.code?.toLowerCase() ?? "default"}`}>
                        {unit.availabilityStatus.name ?? unit.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {unitRows.length === 0 ? (
                  <tr>
                    <td className="crm-empty-cell" colSpan={6}>
                      No units found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="crm-panel crm-detail-panel">
          <h3>Unit Detail</h3>
          {selectedUnit ? (
            <>
              <div className="crm-detail-title">
                <div>
                  <strong>{selectedUnit.unitCode}</strong>
                  <span>{selectedUnit.project.name ?? selectedUnit.project.projectCode}</span>
                </div>
                <span className={`crm-status-pill crm-status-${selectedUnit.availabilityStatus.code?.toLowerCase() ?? "default"}`}>
                  {selectedUnit.availabilityStatus.name ?? selectedUnit.status}
                </span>
              </div>

              <dl className="crm-detail-list">
                <div>
                  <dt>Block</dt>
                  <dd>{selectedUnit.blockCode ?? "-"}</dd>
                </div>
                <div>
                  <dt>Floor</dt>
                  <dd>{selectedUnit.floorNo ?? "-"}</dd>
                </div>
                <div>
                  <dt>Bedrooms</dt>
                  <dd>{selectedUnit.bedroomCount ?? "-"}</dd>
                </div>
                <div>
                  <dt>Type</dt>
                  <dd>{selectedUnit.unitType.name ?? "-"}</dd>
                </div>
                <div>
                  <dt>Gross Area</dt>
                  <dd>{area(selectedUnit.grossArea)}</dd>
                </div>
                <div>
                  <dt>Net Area</dt>
                  <dd>{area(selectedUnit.netArea)}</dd>
                </div>
                <div>
                  <dt>Base Price</dt>
                  <dd>{money(selectedUnit.basePrice, selectedUnit.currencyCode)}</dd>
                </div>
                <div>
                  <dt>Reservation</dt>
                  <dd>{selectedUnit.reservationStatus.name ?? "-"}</dd>
                </div>
              </dl>

              <section className="crm-activity-list">
                <h4>Commercial Notes</h4>
                <p className="crm-muted-text">{selectedUnit.remarks ?? "No remarks recorded for this unit."}</p>
              </section>
            </>
          ) : (
            <p className="crm-muted-text">Select a unit to review availability, pricing, and reservation state.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
