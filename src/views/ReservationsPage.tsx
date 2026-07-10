import axios from "axios";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { listCurrencies } from "../api/currencies";
import { listOpportunities } from "../api/opportunities";
import {
  approveReservation,
  cancelReservation,
  createReservation,
  getReservation,
  listReservations,
  type Reservation
} from "../api/reservations";
import { useMoneyFormatter } from "../hooks/useCurrencyContext";
import { DEFAULT_LIST_PAGE_SIZE, DROPDOWN_LIST_LIMIT } from "../lib/list-pagination";
import { CurrencyBadge } from "../shared/CurrencyBadge";
import { DateField } from "../shared/DateField";
import { FormNoticeDialog } from "../shared/FormNoticeDialog";
import { ListPagination } from "../shared/ListPagination";
import { UnitPickerDialog } from "../shared/UnitPickerDialog";
import { WorkflowTracker, type WorkflowStep } from "../shared/WorkflowTracker";

type ReservationFormValues = {
  opportunityId: string;
  unitId: string;
  unitCode: string;
  reservationAmount: string;
  currencyCode: string;
  expiryDate: string;
  remarks: string;
};

type NoticeState = {
  open: boolean;
  title: string;
  message: string;
  variant: "error" | "success" | "info";
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

function defaultReservationExpiryDate() {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 30);
  return expiry.toISOString().slice(0, 10);
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)?.message;
    return message && message.trim() !== "" ? message : fallback;
  }

  return fallback;
}

function reservationWorkflowSteps(
  reservation: Reservation,
  formatValue: (value: number | null, currencyCode?: string | null) => string
): WorkflowStep[] {
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
        { label: "Amount", value: formatValue(reservation.reservationAmount, reservation.currencyCode) },
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
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const processedHandoffRef = useRef<string | null>(null);
  const { formatInBase, defaultContractCurrency, toBase } = useMoneyFormatter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = DEFAULT_LIST_PAGE_SIZE;
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);
  const [reservationDetailModalOpen, setReservationDetailModalOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [noticeDialog, setNoticeDialog] = useState<NoticeState>({
    open: false,
    title: "",
    message: "",
    variant: "info"
  });

  const showNotice = (title: string, message: string, variant: NoticeState["variant"]) => {
    setNoticeDialog({ open: true, title, message, variant });
  };

  const closeNotice = () => {
    setNoticeDialog((current) => ({ ...current, open: false }));
  };

  const reservationForm = useForm<ReservationFormValues>({
    defaultValues: {
      opportunityId: "",
      unitId: "",
      unitCode: "",
      reservationAmount: "",
      currencyCode: defaultContractCurrency,
      expiryDate: "",
      remarks: ""
    }
  });

  const reservationsQuery = useQuery({
    queryKey: ["reservations", search, page],
    queryFn: () =>
      listReservations({
        search: search || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize
      }),
    staleTime: 10_000,
    refetchOnWindowFocus: false
  });

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    const selectedId = searchParams.get("selected");
    if (!selectedId || processedHandoffRef.current === selectedId) {
      return;
    }

    processedHandoffRef.current = selectedId;
    setSelectedReservationId(selectedId);
    setReservationDetailModalOpen(true);

    const createNotice = (location.state as { createNotice?: string } | null)?.createNotice;
    if (createNotice) {
      showNotice("Reservation Created", `Reservation ${createNotice} was created successfully.`, "success");
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("selected");
    setSearchParams(nextParams, { replace: true });
  }, [location.state, searchParams, setSearchParams]);

  const reservationDetailQuery = useQuery({
    queryKey: ["reservation", selectedReservationId],
    queryFn: () => getReservation(selectedReservationId ?? ""),
    enabled: Boolean(selectedReservationId && reservationDetailModalOpen),
    refetchOnWindowFocus: false
  });

  const opportunitiesQuery = useQuery({
    queryKey: ["opportunities", "reservation-select"],
    queryFn: () => listOpportunities({ limit: DROPDOWN_LIST_LIMIT }),
    enabled: createOpen,
    staleTime: 10_000,
    refetchOnWindowFocus: false
  });

  const currenciesQuery = useQuery({
    queryKey: ["currencies", "reservation-dropdown"],
    queryFn: () => listCurrencies({ dropdownOnly: true, activeOnly: true }),
    enabled: createOpen,
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
      setCreateOpen(false);
      setSelectedReservationId(reservation.id);
      setReservationDetailModalOpen(true);
      reservationForm.reset({
        opportunityId: "",
        unitId: "",
        unitCode: "",
        reservationAmount: "",
        currencyCode: defaultContractCurrency,
        expiryDate: "",
        remarks: ""
      });
      void queryClient.invalidateQueries({ queryKey: ["reservations"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory", "units"] });
      void queryClient.invalidateQueries({ queryKey: ["opportunity"] });
      showNotice("Reservation Created", `Reservation ${reservation.reservationNo} was created successfully.`, "success");
    },
    onError: (error) => {
      showNotice("Reservation Failed", getApiErrorMessage(error, "Reservation could not be created."), "error");
    }
  });

  const cancelMutation = useMutation({
    mutationFn: (reservationId: string) => cancelReservation(reservationId, "Cancelled from CRM workspace"),
    onSuccess: (reservation) => {
      void queryClient.invalidateQueries({ queryKey: ["reservations"] });
      void queryClient.invalidateQueries({ queryKey: ["reservation", reservation.id] });
      void queryClient.invalidateQueries({ queryKey: ["inventory", "units"] });
      showNotice("Reservation Cancelled", `Reservation ${reservation.reservationNo} was cancelled.`, "success");
    },
    onError: (error) => {
      showNotice("Cancellation Failed", getApiErrorMessage(error, "Reservation could not be cancelled."), "error");
    }
  });

  const approveMutation = useMutation({
    mutationFn: (reservationId: string) => approveReservation(reservationId, "Reservation approved from CRM workspace"),
    onSuccess: (reservation) => {
      void queryClient.invalidateQueries({ queryKey: ["reservations"] });
      void queryClient.invalidateQueries({ queryKey: ["reservation", reservation.id] });
      void queryClient.invalidateQueries({ queryKey: ["inventory", "units"] });
      void queryClient.invalidateQueries({ queryKey: ["opportunity"] });
      showNotice("Reservation Approved", `Reservation ${reservation.reservationNo} was approved.`, "success");
    },
    onError: (error) => {
      showNotice("Approval Failed", getApiErrorMessage(error, "Reservation could not be approved."), "error");
    }
  });

  const reservationRows = reservationsQuery.data?.items ?? [];
  const currencyRows = currenciesQuery.data?.items ?? [];
  const selectedReservation = reservationDetailQuery.data;
  const reservationReadyOpportunities = (opportunitiesQuery.data?.items ?? []).filter(
    (opportunity) => opportunity.opportunityStage.name === "Reservation Ready" && opportunity.status !== "LOST"
  );
  const selectedOpportunity = reservationReadyOpportunities.find(
    (opportunity) => opportunity.id === reservationForm.watch("opportunityId")
  );

  const stats = useMemo(() => {
    const summary = reservationsQuery.data?.summary;
    return {
      total: reservationsQuery.data?.pagination.total ?? 0,
      active: summary?.active ?? 0,
      cancelled: summary?.cancelled ?? 0,
      amount: summary?.amount ?? 0
    };
  }, [reservationsQuery.data]);

  const openCreateModal = () => {
    reservationForm.reset({
      opportunityId: "",
      unitId: "",
      unitCode: "",
      reservationAmount: "",
      currencyCode: defaultContractCurrency,
      expiryDate: defaultReservationExpiryDate(),
      remarks: ""
    });
    setCreateOpen(true);
  };

  const loadReservation = (reservationId: string) => {
    setSelectedReservationId(reservationId);
    setReservationDetailModalOpen(true);
  };

  const closeReservationDetailModal = () => {
    setReservationDetailModalOpen(false);
    setSelectedReservationId(null);
  };

  useEffect(() => {
    if (!reservationDetailModalOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !noticeDialog.open) {
        event.preventDefault();
        closeReservationDetailModal();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [noticeDialog.open, reservationDetailModalOpen]);

  useEffect(() => {
    if (!createOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !noticeDialog.open && !unitPickerOpen) {
        event.preventDefault();
        setCreateOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [createOpen, noticeDialog.open, unitPickerOpen]);

  const onReservationSubmit = reservationForm.handleSubmit((values) => {
    if (!values.opportunityId) {
      showNotice("Opportunity Required", "Select a reservation-ready opportunity.", "error");
      return;
    }

    if (!values.unitId) {
      showNotice("Unit Required", "Select an available unit before creating the reservation.", "error");
      return;
    }

    createMutation.mutate(values);
  });

  return (
    <div className="crm-workspace">
      <section className="crm-module-header">
        <div>
          <p className="crm-eyebrow">Reservations</p>
          <div className="crm-dashboard-title-row">
            <h2>Unit Reservations</h2>
            <CurrencyBadge />
          </div>
        </div>
        <button className="crm-primary-button" onClick={openCreateModal} type="button">
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
          <div className="crm-kpi">{formatInBase(stats.amount)}</div>
        </article>
      </section>

      {createOpen ? (
        <div className="crm-modal-backdrop" role="presentation">
          <section aria-modal="true" className="crm-modal crm-management-modal crm-reservation-modal" role="dialog">
            <div className="crm-panel-header">
              <div>
                <h3>Create Reservation</h3>
                <p className="crm-muted-text">Only opportunities at Reservation Ready stage can be reserved.</p>
              </div>
              <button className="crm-secondary-button crm-fit-button" onClick={() => setCreateOpen(false)} type="button">
                Close
              </button>
            </div>
            <form className="crm-reservation-modal-form" onSubmit={onReservationSubmit}>
              <div className="crm-reservation-modal-body">
                <div className="crm-reservation-modal-fields">
                  <label className="crm-field crm-form-wide">
                    <span className="crm-label">
                      Opportunity <span className="crm-label-required-inline">*</span>
                    </span>
                    <select className="crm-input" {...reservationForm.register("opportunityId")}>
                      <option value="">Select reservation-ready opportunity</option>
                      {reservationReadyOpportunities.map((opportunity) => (
                        <option key={opportunity.id} value={opportunity.id}>
                          {opportunity.opportunityNo} - {opportunity.customer.name ?? "Customer"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <input type="hidden" {...reservationForm.register("unitId")} />
                  <label className="crm-field crm-form-wide">
                    <span className="crm-label">
                      Unit <span className="crm-label-required-inline">*</span>
                    </span>
                    <div className="crm-opportunity-unit-picker-row">
                      <input
                        className="crm-input"
                        placeholder="Select an available unit"
                        readOnly
                        value={reservationForm.watch("unitCode") || ""}
                      />
                      <button className="crm-secondary-button crm-fit-button" onClick={() => setUnitPickerOpen(true)} type="button">
                        Choose Unit
                      </button>
                    </div>
                  </label>
                  <label className="crm-field">
                    <span className="crm-label">Amount</span>
                    <input className="crm-input" inputMode="decimal" {...reservationForm.register("reservationAmount")} />
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
                    <Controller
                      control={reservationForm.control}
                      name="expiryDate"
                      render={({ field }) => (
                        <DateField onBlur={field.onBlur} onChange={field.onChange} ref={field.ref} value={field.value} />
                      )}
                    />
                  </label>
                  <label className="crm-field crm-form-wide">
                    <span className="crm-label">Remarks</span>
                    <textarea className="crm-input crm-textarea crm-opportunity-textarea" {...reservationForm.register("remarks")} />
                  </label>
                </div>
              </div>
              <div className="crm-modal-actions crm-modal-actions-sticky">
                <button className="crm-secondary-button crm-fit-button" onClick={() => setCreateOpen(false)} type="button">
                  Close
                </button>
                <button className="crm-primary-button crm-fit-button" disabled={createMutation.isPending} type="submit">
                  {createMutation.isPending ? "Creating..." : "Create Reservation"}
                </button>
              </div>
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
                  onClick={() => loadReservation(reservation.id)}
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
                  <td>{formatInBase(reservation.reservationAmount, reservation.currencyCode)}</td>
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
        <ListPagination
          page={page}
          pageSize={pageSize}
          total={reservationsQuery.data?.pagination.total ?? 0}
          itemLabel="reservations"
          onPageChange={setPage}
        />
      </section>

      {reservationDetailModalOpen ? (
        <div className="crm-modal-backdrop" role="presentation">
          <section aria-modal="true" className="crm-modal crm-management-modal crm-opportunity-detail-modal" role="dialog">
            <div className="crm-panel-header">
              <div>
                <h3>Reservation Detail</h3>
                <p className="crm-muted-text">{selectedReservation?.reservationNo ?? "Loading reservation..."}</p>
              </div>
              <button className="crm-secondary-button crm-fit-button" onClick={closeReservationDetailModal} type="button">
                Close
              </button>
            </div>
            {selectedReservation ? (
              <div className="crm-opportunity-detail-body">
                <div className="crm-detail-title">
                  <div>
                    <strong>{selectedReservation.reservationNo}</strong>
                    <span>{selectedReservation.customer.name ?? "Customer"}</span>
                  </div>
                  <span className={`crm-status-pill crm-status-${selectedReservation.reservationStatus.code?.toLowerCase() ?? "default"}`}>
                    {selectedReservation.reservationStatus.name ?? selectedReservation.status}
                  </span>
                </div>
                <WorkflowTracker steps={reservationWorkflowSteps(selectedReservation, formatInBase)} />

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
                    <dd>{formatInBase(selectedReservation.reservationAmount, selectedReservation.currencyCode)}</dd>
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

                <div className="crm-opportunity-action-card-footer">
                  <button
                    className="crm-secondary-button crm-opportunity-action-button"
                    disabled={!selectedReservation.isActive || cancelMutation.isPending}
                    onClick={() => cancelMutation.mutate(selectedReservation.id)}
                    type="button"
                  >
                    {cancelMutation.isPending ? "Cancelling..." : "Cancel Reservation"}
                  </button>
                  {selectedReservation.reservationStatus.code === "APPROVED" &&
                  selectedReservation.opportunity.id ? (
                    <button
                      className="crm-primary-button crm-opportunity-action-button"
                      onClick={() =>
                        navigate(`/proposals?createFor=${selectedReservation.opportunity.id}`, {
                          state: { fromReservation: selectedReservation.reservationNo }
                        })
                      }
                      type="button"
                    >
                      Create Proposal
                    </button>
                  ) : (
                    <button
                      className="crm-primary-button crm-opportunity-action-button"
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
                  )}
                </div>

                <section className="crm-activity-list">
                  <h4>Remarks</h4>
                  <p className="crm-muted-text">{selectedReservation.remarks ?? "No remarks recorded."}</p>
                </section>
              </div>
            ) : (
              <p className="crm-muted-text crm-opportunity-detail-body">Reservation details could not be loaded.</p>
            )}
          </section>
        </div>
      ) : null}

      <FormNoticeDialog
        confirmLabel="OK"
        message={noticeDialog.message}
        onClose={closeNotice}
        open={noticeDialog.open}
        title={noticeDialog.title}
        variant={noticeDialog.variant}
      />

      <UnitPickerDialog
        onClose={() => setUnitPickerOpen(false)}
        onSelect={(unit) => {
          reservationForm.setValue("unitId", unit.id);
          reservationForm.setValue("unitCode", unit.unitCode);
        }}
        open={unitPickerOpen}
        projectCode={selectedOpportunity?.projectCode}
      />
    </div>
  );
}
