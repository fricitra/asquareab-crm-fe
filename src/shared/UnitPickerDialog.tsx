import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listUnits, type Unit } from "../api/inventory";
import { useModalEscape } from "../hooks/useModalEscape";
import { DROPDOWN_LIST_LIMIT } from "../lib/list-pagination";

type UnitPickerDialogProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (unit: Unit) => void;
  projectCode?: string | null;
};

export function UnitPickerDialog({ open, onClose, onSelect, projectCode }: UnitPickerDialogProps) {
  const [search, setSearch] = useState("");
  const [matchProjectOnly, setMatchProjectOnly] = useState(Boolean(projectCode));

  useModalEscape(open, onClose);

  const unitsQuery = useQuery({
    queryKey: ["inventory", "units", "picker"],
    queryFn: () => listUnits({ limit: DROPDOWN_LIST_LIMIT }),
    enabled: open,
    staleTime: 30_000,
    refetchOnWindowFocus: false
  });

  const availableUnits = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return (unitsQuery.data?.items ?? []).filter((unit) => {
      if (unit.availabilityStatus.code !== "AVAILABLE") {
        return false;
      }

      if (matchProjectOnly && projectCode && unit.project.projectCode !== projectCode) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        unit.unitCode,
        unit.unitName,
        unit.project.projectCode,
        unit.project.name,
        unit.buildingName,
        unit.unitType.name
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [matchProjectOnly, projectCode, search, unitsQuery.data?.items]);

  if (!open) {
    return null;
  }

  return (
    <div className="crm-modal-backdrop crm-notice-backdrop" role="presentation">
      <section aria-modal="true" className="crm-modal crm-unit-picker-dialog" role="dialog">
        <div className="crm-panel-header">
          <div>
            <h3>Select Available Unit</h3>
            <p className="crm-muted-text">Choose a unit from inventory marked as available.</p>
          </div>
          <button className="crm-secondary-button crm-fit-button" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="crm-unit-picker-toolbar">
          <input
            className="crm-input crm-search-input"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search unit code, project, type..."
            value={search}
          />
          {projectCode ? (
            <label className="crm-check-field crm-unit-picker-filter">
              <input checked={matchProjectOnly} onChange={(event) => setMatchProjectOnly(event.target.checked)} type="checkbox" />
              <span>Only project {projectCode}</span>
            </label>
          ) : null}
        </div>

        {unitsQuery.isLoading ? <p className="crm-muted-text">Loading available units...</p> : null}
        {unitsQuery.isError ? <p className="crm-muted-text">Available units could not be loaded. Check inventory access.</p> : null}

        <div className="crm-table-wrap crm-unit-picker-table-wrap">
          <table className="crm-table crm-unit-picker-table">
            <thead>
              <tr>
                <th>Unit</th>
                <th>Project</th>
                <th>Type</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {availableUnits.map((unit) => (
                <tr key={unit.id}>
                  <td>
                    <strong>{unit.unitCode}</strong>
                    <span>{unit.unitName ?? unit.buildingName ?? "-"}</span>
                  </td>
                  <td>{unit.project.projectCode ?? "-"}</td>
                  <td>{unit.unitType.name ?? "-"}</td>
                  <td>
                    <button
                      className="crm-secondary-button crm-small-button"
                      onClick={() => {
                        onSelect(unit);
                        onClose();
                      }}
                      type="button"
                    >
                      Select
                    </button>
                  </td>
                </tr>
              ))}
              {!unitsQuery.isLoading && availableUnits.length === 0 ? (
                <tr>
                  <td className="crm-empty-cell" colSpan={4}>
                    No available units found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
