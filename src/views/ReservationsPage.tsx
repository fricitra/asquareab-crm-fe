import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { listCurrencies } from "../api/currencies";
import { listUnits } from "../api/inventory";
import { listOpportunities } from "../api/opportunities";
import {
  approveReservation,
  cancelReservation,
  createReservation,
  getReservation,
  listReservations,
  type Reservation
} from "../api/reservations";
import { WorkflowTracker, type WorkflowStep } from "../shared/WorkflowTracker";

type ReservationFormValues = {
  opportunityId: string;
  unitId: string;
  reservationAmount: string;
  currencyCode: string;
  expiryDate: string;
  remarks: string;
};

function pickString(value: string) {
  return value.trim() === "" ? undefined : value.trim();
}

function pickNumber(value: string) {
  return value.trim() === "" ? undefined : Number(value);
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value)) : "-";
}

function money(value: number | null, currencyCode: string | null) {
  if (value === null) return "-";
  return `${value.toLocaleString()} ${currencyCode ?? ""}`.trim();
}

function reservationWorkflowSteps(reservation: Reservation): WorkflowStep[] {
  const isCancelled = reservation.reservationStatus.code === "CANCELLED";
  const isApproved = reservation.reservationStatus.code === "APPROVED";
  return [
    {
      id: "requested",
      title: "Requested",
      status: isCancelled || isApproved ? "completed" : "current",
      timestamp: reservation.createdAt,
      user: reservation.createdBy.name,
      role: reservation.createdBy.role,
      summary: reservation.remarks ?? "Reservation was created for the selected opportunity and unit.",
      details: [
        { label: "Reservation No", value: reservation.reservationNo },
        { label: "Customer", value: reservation.customer.name },
        { label: "Opportunity", value: reservation.opportunity.opportunityNo },
        { label: "Project", value: reservation.project.projectCode },
        { label: "Unit", value: reservation.unit.unitCode },
        { label: "Amount", value: money(reservation.reservationAmount, reservation.currencyCode) },
        { label: "Expiry", value: reservation.expiryDate }
      ]
    },
    {
      id: "approved",
      title: "Approved",
      status: isCancelled ? "blocked" : isApproved ? "current" : "next",
      timestamp: isApproved ? reservation.updatedAt : null,
      user: isApproved ? reservation.updatedBy.name : null,
      role: isApproved ? reservation.updatedBy.role : null,
      summary: isApproved ? reservation.remarks ?? "Reservation has been approved." : "Approve the reservation after verifying buyer and unit details.",
      details: [
        { label: "Current Status", value: reservation.reservationStatus.name },
        { label: "Active", value: reservation.isActive ? "Yes" : "No" }
      ]
    },
    {
      id: "cancelled",
      title: "Cancelled",
      status: isCancelled ? "current" : "next",
      timestamp: isCancelled ? reservation.updatedAt : null,
      user: isCancelled ? reservation.updatedBy.name : null,
      role: isCancelled ? reservation.updatedBy.role : null,
      summary: isCancelled ? reservation.remarks : "Use this action only when reservation should be released.",
      details: [
        { label: "Status", value: reservation.reservationStatus.name },
        { label: "Unit Released", value: isCancelled ? "Yes" : "No" }
      ]
    }
  ];
}

export function ReservationsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const reservationForm = useForm<ReservationFormValues>({
    defaultValues: {
      opportunityId: "",
      unitId: "",
      reservationAmount: "",
      currencyCode: "USD",
      expiryDate: "",
      remarks: ""
    }
  });

  const reservationsQuery = useQuery({
    queryKey: ["reservations", search],
    queryFn: () => listReservations(search),
    staleTime: 10_000
  });

  const reservationDetailQuery = useQuery({
    queryKey: ["reservation", selectedReservationId],
    queryFn: () => getReservation(selectedReservationId ?? ""),
    enabled: Boolean(selectedReservationId)
  });

  const opportunitiesQuery = useQuery({
    queryKey: ["opportunities", "reservation-select"],
    queryFn: () => listOpportunities(),
    staleTime: 10_000
  });

  const unitsQuery = useQuery({
    queryKey: ["inventory", "units", "reservation-select"],
    queryFn: () => listUnits(),
    staleTime: 10_000
  });
  const currenciesQuery = useQuery({
    queryKey: ["currencies", "reservation-dropdown"],
    queryFn: () => listCurrencies({ dropdownOnly: true, activeOnly: true }),
    staleTime: 60_000
  });

  const createMutation = useMutation({
    mutationFn: (values: ReservationFormValues) =>
      createReservation({
        opportunityId: values.opportunityId,
        unitId: values.unitId,
        reservationAmount: pickNumber(values.reservationAmount),
        currencyCode: pickString(values.currencyCode),
        expiryDate: pickString(values.expiryDate),
        remarks: pickString(values.remarks)
      }),
    onSuccess: (reservation) => {
      setMessage("Reservation created.");
      setCreateOpen(false);
      setSelectedReservationId(reservation.id);
      reservationForm.reset({ opportunityId: "", unitId: "", reservationAmount: "", currencyCode: "USD", expiryDate: "", remarks: "" });
      void queryClient.invalidateQueries({ queryKey: ["reservations"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory", "units"] });
    },
    onError: () => setMessage("Reservation could not be created.")
  });

  const cancelMutation = useMutation({
    mutationFn: (reservationId: string) => cancelReservation(reservationId, "Cancelled from CRM workspace"),
    onSuccess: (reservation) => {
      setMessage("Reservation cancelled.");
      void queryClient.invalidateQueries({ queryKey: ["reservations"] });
      void queryClient.invalidateQueries({ queryKey: ["reservation", reservation.id] });
      void queryClient.invalidateQueries({ queryKey: ["inventory", "units"] });
    },
    onError: () => setMessage("Reservation could not be cancelled.")
  });

  const approveMutation = useMutation({
    mutationFn: (reservationId: string) => approveReservation(reservationId, "Reservation approved from CRM workspace"),
    onSuccess: (reservation) => {
      setMessage("Reservation approved.");
      void queryClient.invalidateQueries({ queryKey: ["reservations"] });
      void queryClient.invalidateQueries({ queryKey: ["reservation", reservation.id] });
      void queryClient.invalidateQueries({ queryKey: ["inventory", "units"] });
    },
    onError: () => setMessage("Reservation could not be approved.")
  });

  const reservationRows = reservationsQuery.data?.items ?? [];
  const availableUnits = (unitsQuery.data?.items ?? []).filter((unit) => unit.availabilityStatus.code === "AVAILABLE");
  const currencyRows = currenciesQuery.data?.items ?? [];
  const selectedReservation = reservationDetailQuery.data;

  const stats = useMemo(() => {
    const total = reservationsQuery.data?.pagination.total ?? 0;
    const active = reservationRows.filter((reservation) => reservation.isActive).length;
    const cancelled = reservationRows.filter((reservation) => reservation.reservationStatus.code === "CANCELLED").length;
    const amount = reservationRows.reduce((sum, reservation) => sum + (reservation.reservationAmount ?? 0), 0);
    return { total, active, cancelled, amount };
  }, [reservationRows, reservationsQuery.data?.pagination.total]);

  const onReservationSubmit = reservationForm.handleSubmit((values) => {
    if (!values.opportunityId || !values.unitId) {
      setMessage("Select an opportunity and an available unit.");
      return;
    }
    createMutation.mutate(values);
  });

  return (
    <div className="crm-workspace">
      <section className="crm-module-header">
        <div>
          <p className="crm-eyebrow">Reservations</p>
          <h2>Unit Reservations</h2>
        </div>
        <button className="crm-primary-button" onClick={() => setCreateOpen(true)} type="button">
          New Reservation
        </button>
      </section>

      <section className="crm-grid crm-metric-grid">
        <article className="crm-card">
          <h3>Total</h3>
          <div className="crm-kpi">{stats.total}</div>
        </article>
        <article className="crm-card">
          <h3>Active</h3>
          <div className="crm-kpi">{stats.active}</div>
        </article>
        <article className="crm-card">
          <h3>Cancelled</h3>
          <div className="crm-kpi">{stats.cancelled}</div>
        </article>
        <article className="crm-card">
          <h3>Amount</h3>
          <div className="crm-kpi">{stats.amount.toLocaleString()}</div>
        </article>
      </section>

      {message ? <div className="crm-error-banner">{message}</div> : null}

      {createOpen ? (
        <div className="crm-modal-backdrop" role="presentation">
      <section aria-modal="true" className="crm-modal crm-management-modal" role="dialog">
        <div className="crm-panel-header">
          <h3>Create Reservation</h3>
          <button className="crm-secondary-button" onClick={() => setCreateOpen(false)} type="button">Close</button>
        </div>
        <form className="crm-form crm-reservation-form" onSubmit={onReservationSubmit}>
          <label className="crm-field">
            <span className="crm-label">Opportunity</span>
            <select className="crm-input" {...reservationForm.register("opportunityId")}>
              <option value="">Select opportunity</option>
              {(opportunitiesQuery.data?.items ?? []).map((opportunity) => (
                <option key={opportunity.id} value={opportunity.id}>
                  {opportunity.opportunityNo} - {opportunity.customer.name ?? "Customer"}
                </option>
              ))}
            </select>
          </label>
          <label className="crm-field">
            <span className="crm-label">Available Unit</span>
            <select className="crm-input" {...reservationForm.register("unitId")}>
              <option value="">Select unit</option>
              {availableUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.unitCode} - {money(unit.basePrice, unit.currencyCode)}
                </option>
              ))}
            </select>
          </label>
          <label className="crm-field">
            <span className="crm-label">Amount</span>
            <input className="crm-input" {...reservationForm.register("reservationAmount")} />
          </label>
          <label className="crm-field">
            <span className="crm-label">Currency</span>
            <select className="crm-input" {...reservationForm.register("currencyCode")}>
              <option value="">Select currency</option>
              {currencyRows.map((currency) => (
                <option key={currency.id} value={currency.currencyCode}>
                  {currency.currencyCode} - {currency.currencyName}
                </option>
              ))}
            </select>
          </label>
          <label className="crm-field">
            <span className="crm-label">Expiry</span>
            <input className="crm-input" type="date" {...reservationForm.register("expiryDate")} />
          </label>
          <label className="crm-field crm-form-wide">
            <span className="crm-label">Remarks</span>
            <input className="crm-input" {...reservationForm.register("remarks")} />
          </label>
          <button className="crm-primary-button crm-form-action" disabled={createMutation.isPending} type="submit">
            {createMutation.isPending ? "Creating..." : "Create Reservation"}
          </button>
        </form>
      </section>
        </div>
      ) : null}

      <section className="crm-panel">
        <div className="crm-panel-header">
          <h3>Reservation Register</h3>
          <input
            className="crm-input crm-search-input"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search reservation, customer, unit"
            value={search}
          />
        </div>

        <div className="crm-table-wrap">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Reservation</th>
                <th>Customer</th>
                <th>Unit</th>
                <th>Status</th>
                <th>Date</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {reservationRows.map((reservation: Reservation) => (
                <tr
                  className={selectedReservationId === reservation.id ? "is-selected" : ""}
                  key={reservation.id}
                  onClick={() => setSelectedReservationId(reservation.id)}
                >
                  <td>
                    <strong>{reservation.reservationNo}</strong>
                    <span>{reservation.opportunity.opportunityNo ?? "-"}</span>
                  </td>
                  <td>{reservation.customer.name ?? "-"}</td>
                  <td>{reservation.unit.unitCode ?? "-"}</td>
                  <td>
                    <span className={`crm-status-pill crm-status-${reservation.reservationStatus.code?.toLowerCase() ?? "default"}`}>
                      {reservation.reservationStatus.name ?? reservation.status}
                    </span>
                  </td>
                  <td>{formatDate(reservation.reservationDate)}</td>
                  <td>{money(reservation.reservationAmount, reservation.currencyCode)}</td>
                </tr>
              ))}
              {reservationRows.length === 0 ? (
                <tr>
                  <td className="crm-empty-cell" colSpan={6}>
                    No reservations found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="crm-panel crm-lead-detail-wide">
        <h3>Reservation Detail</h3>
        {selectedReservation ? (
          <>
            <div className="crm-detail-title">
              <div>
                <strong>{selectedReservation.reservationNo}</strong>
                <span>{selectedReservation.customer.name ?? "Customer"}</span>
              </div>
              <span className={`crm-status-pill crm-status-${selectedReservation.reservationStatus.code?.toLowerCase() ?? "default"}`}>
                {selectedReservation.reservationStatus.name ?? selectedReservation.status}
              </span>
            </div>
            <WorkflowTracker steps={reservationWorkflowSteps(selectedReservation)} />

            <dl className="crm-detail-list">
              <div>
                <dt>Opportunity</dt>
                <dd>{selectedReservation.opportunity.opportunityNo ?? "-"}</dd>
              </div>
              <div>
                <dt>Unit</dt>
                <dd>{selectedReservation.unit.unitCode ?? "-"}</dd>
              </div>
              <div>
                <dt>Project</dt>
                <dd>{selectedReservation.project.projectCode ?? "-"}</dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd>{money(selectedReservation.reservationAmount, selectedReservation.currencyCode)}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{formatDate(selectedReservation.reservationDate)}</dd>
              </div>
              <div>
                <dt>Expiry</dt>
                <dd>{formatDate(selectedReservation.expiryDate)}</dd>
              </div>
            </dl>

            <button
              className="crm-secondary-button crm-full-button"
              disabled={!selectedReservation.isActive || cancelMutation.isPending}
              onClick={() => cancelMutation.mutate(selectedReservation.id)}
              type="button"
            >
              {cancelMutation.isPending ? "Cancelling..." : "Cancel Reservation"}
            </button>

            <button
              className="crm-primary-button crm-fit-button"
              disabled={
                !selectedReservation.isActive ||
                selectedReservation.reservationStatus.code === "APPROVED" ||
                selectedReservation.reservationStatus.code === "CANCELLED" ||
                approveMutation.isPending
              }
              onClick={() => approveMutation.mutate(selectedReservation.id)}
              type="button"
            >
              {selectedReservation.reservationStatus.code === "APPROVED"
                ? "Approved"
                : approveMutation.isPending
                  ? "Approving..."
                  : "Approve Reservation"}
            </button>

            <section className="crm-activity-list">
              <h4>Remarks</h4>
              <p className="crm-muted-text">{selectedReservation.remarks ?? "No remarks recorded."}</p>
            </section>
          </>
        ) : (
          <p className="crm-muted-text">Select a reservation to review status, unit, expiry, and cancellation action.</p>
        )}
      </section>
    </div>
  );
}
