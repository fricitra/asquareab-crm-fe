import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  addOpportunityNote,
  changeOpportunityStage,
  getOpportunity,
  listOpportunities,
  scheduleSiteVisit,
  type ChangeOpportunityStagePayload,
  type Opportunity,
  type OpportunityDetail
} from "../api/opportunities";
import { getReferenceFamily } from "../api/reference-data";
import { getUnit, listUnits, type Unit } from "../api/inventory";
import { createReservation, listReservations, type Reservation } from "../api/reservations";
import { useMoneyFormatter } from "../hooks/useCurrencyContext";
import { DEFAULT_LIST_PAGE_SIZE, DROPDOWN_LIST_LIMIT } from "../lib/list-pagination";
import { getApiErrorMessage } from "../lib/format-api-error";
import { useModalEscape } from "../hooks/useModalEscape";
import { CurrencyBadge } from "../shared/CurrencyBadge";
import { DateField } from "../shared/DateField";
import { DateTimeField } from "../shared/DateTimeField";
import { FormNoticeDialog } from "../shared/FormNoticeDialog";
import { ListPagination } from "../shared/ListPagination";
import { UnitPickerDialog } from "../shared/UnitPickerDialog";
import { WorkflowTracker, type WorkflowStep } from "../shared/WorkflowTracker";

type StageFormValues = {
  opportunityStageRefId: string;
  probabilityPercent: string;
  remarks: string;
};

type NoteFormValues = {
  noteText: string;
};

type SiteVisitFormValues = {
  visitDate: string;
  proposedUnitCode: string;
  remarks: string;
};

type LostFormValues = {
  lostReasonRefId: string;
  remarks: string;
};

type ReservationFormValues = {
  opportunityId: string;
  unitId: string;
  unitCode: string;
  reservationAmount: string;
  currencyCode: string;
  expiryDate: string;
  remarks: string;
};

function defaultReservationExpiryDate() {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 30);
  return expiry.toISOString().slice(0, 10);
}

async function resolveUnitReservationPricing(unit: Unit) {
  try {
    const detail = await getUnit(unit.id);
    const sales = detail.catalogue?.salesInformation;
    const amount = sales?.reservationAmount ?? sales?.approvedSellingPrice ?? detail.basePrice ?? unit.basePrice;
    return {
      amount: amount == null ? "" : String(amount),
      currencyCode: detail.currencyCode ?? unit.currencyCode ?? ""
    };
  } catch {
    return {
      amount: unit.basePrice == null ? "" : String(unit.basePrice),
      currencyCode: unit.currencyCode ?? ""
    };
  }
}

type NoticeState = {
  open: boolean;
  title: string;
  message: string;
  variant: "error" | "success" | "info";
};

const referenceQueryDefaults = {
  staleTime: 30 * 60 * 1000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchOnMount: false
} as const;

function pickString(value: string) {
  return value.trim() === "" ? undefined : value.trim();
}

function pickNumber(value: string) {
  const normalized = value.replace("%", "").replace(/,/g, "").trim();
  return normalized === "" ? undefined : Number(normalized);
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "-";
}

const opportunityForwardStages = ["Open", "Qualified", "Site Visit", "Negotiation", "Reservation Ready", "Proposal"] as const;

function opportunityWorkflowSteps(
  opportunity: OpportunityDetail,
  formatBudget: (amount: number | null | undefined, currencyCode?: string | null) => string,
  activeReservation: Reservation | null | undefined
): WorkflowStep[] {
  const historyByStage = new Map(opportunity.stageHistory.map((entry) => [entry.opportunityStage.name ?? "", entry]));
  const currentStageName = opportunity.opportunityStage.name ?? "Qualified";
  const currentForwardIndex = opportunityForwardStages.indexOf(
    currentStageName as (typeof opportunityForwardStages)[number]
  );
  const isLost = opportunity.status === "LOST" || opportunity.opportunityStage.name === "Lost" || Boolean(opportunity.lostReason.id);
  const hasActiveReservation = Boolean(
    activeReservation?.isActive && activeReservation.reservationStatus.code !== "CANCELLED"
  );

  const buildForwardStageStep = (stageName: (typeof opportunityForwardStages)[number], forwardIndex: number): WorkflowStep => {
    const history = historyByStage.get(stageName);
    const isCurrent = !isLost && stageName === currentStageName;
    const isPast = currentForwardIndex > forwardIndex;
    const isCompleted = isPast || Boolean(history);
    const status: WorkflowStep["status"] = isCurrent ? "current" : isCompleted ? "completed" : isLost ? "blocked" : "next";

    return {
      id: stageName,
      title: stageName,
      status,
      timestamp: history?.changedAt ?? (isCurrent ? opportunity.updatedAt : null),
      user: history?.changedByUser.name ?? (isCurrent ? opportunity.updatedBy.name : null),
      role: history?.changedByRole ?? "CRM User",
      summary:
        history?.remarks ??
        (isCurrent
          ? stageName === "Reservation Ready" && !hasActiveReservation
            ? "Select an available unit and create the reservation from the action below."
            : opportunity.remarks
          : forwardIndex === currentForwardIndex + 1
            ? "This is the next suggested workflow stage."
            : null),
      details: [
        { label: "Probability", value: history?.probabilityPercent ?? (isCurrent ? opportunity.probabilityPercent : null) },
        { label: "Budget", value: opportunity.budgetAmount ? formatBudget(opportunity.budgetAmount, opportunity.currencyCode) : null },
        { label: "Project", value: opportunity.projectCode },
        { label: "Unit", value: opportunity.proposedUnitCode },
        { label: "Expected Close", value: opportunity.expectedCloseDate },
        { label: "Customer", value: opportunity.customer.name },
        { label: "Opportunity", value: opportunity.opportunityNo }
      ]
    };
  };

  const reservationReadyIndex = opportunityForwardStages.indexOf("Reservation Ready");
  const reservedIsCurrent = !isLost && currentStageName === "Reservation Ready" && hasActiveReservation;
  const reservedIsCompleted = hasActiveReservation && (currentForwardIndex > reservationReadyIndex || currentStageName === "Proposal");
  const reservedStatus: WorkflowStep["status"] = isLost
    ? "blocked"
    : reservedIsCurrent
      ? "current"
      : reservedIsCompleted
        ? "completed"
        : currentForwardIndex >= reservationReadyIndex
          ? "next"
          : "next";

  return [
    ...opportunityForwardStages.slice(0, reservationReadyIndex + 1).map((stageName, index) => buildForwardStageStep(stageName, index)),
    {
      id: "Reserved",
      title: "Reserved",
      status: reservedStatus,
      timestamp: activeReservation?.createdAt ?? null,
      user: activeReservation?.createdBy.name ?? null,
      role: activeReservation?.createdBy.role ?? "CRM User",
      summary: hasActiveReservation
        ? `Unit ${activeReservation?.unit.unitCode ?? "-"} reserved (${activeReservation?.reservationNo ?? "pending"}).`
        : currentForwardIndex >= reservationReadyIndex
          ? "Create a reservation for this opportunity using the Create Reservation action below."
          : "This becomes available after Reservation Ready.",
      details: [
        { label: "Action", value: hasActiveReservation ? "View / approve reservation" : "Create Reservation" },
        { label: "Reservation", value: activeReservation?.reservationNo },
        { label: "Unit", value: activeReservation?.unit.unitCode ?? opportunity.proposedUnitCode },
        { label: "Inventory Result", value: hasActiveReservation ? "Unit is Reserved" : "Selected unit becomes Reserved" }
      ]
    },
    buildForwardStageStep("Proposal", opportunityForwardStages.indexOf("Proposal")),
    {
      id: "Won",
      title: "Won",
      status: isLost ? "blocked" : currentStageName === "Proposal" && hasActiveReservation ? "next" : "next",
      timestamp: null,
      user: null,
      role: null,
      summary: "Winning/closure should happen after reservation, proposal acceptance, and contract baseline.",
      details: [
        { label: "Current Package", value: "Reservation integrated; contract in later package" },
        { label: "Future Package", value: "Contract, KYC, collections, and ERP handoff" }
      ]
    },
    {
      id: "Lost",
      title: "Lost",
      status: isLost ? "current" : "next",
      timestamp: isLost ? opportunity.updatedAt : null,
      user: isLost ? opportunity.updatedBy.name : null,
      role: "CRM User",
      summary: isLost ? opportunity.remarks : "Customer can be marked lost from any stage using the Mark Lost action.",
      details: [
        { label: "Lost Reason", value: opportunity.lostReason.name },
        { label: "Status", value: opportunity.status }
      ]
    }
  ];
}

function nextOpportunityStageName(currentStageName: string | null | undefined) {
  const currentIndex = opportunityForwardStages.indexOf(currentStageName as (typeof opportunityForwardStages)[number]);
  if (currentIndex < 0) return "Site Visit";
  return opportunityForwardStages[currentIndex + 1] ?? null;
}

function suggestedProbability(stageName: string | null) {
  switch (stageName) {
    case "Site Visit":
      return "45";
    case "Negotiation":
      return "60";
    case "Reservation Ready":
      return "75";
    case "Proposal":
      return "85";
    case "Won":
      return "100";
    default:
      return "";
  }
}

export function OpportunitiesPage() {
  const { formatInBase } = useMoneyFormatter();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const processedHandoffRef = useRef<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = DEFAULT_LIST_PAGE_SIZE;
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
  const [opportunityDetailModalOpen, setOpportunityDetailModalOpen] = useState(false);
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [reservationModalOpen, setReservationModalOpen] = useState(false);
  const [reservationUnitPickerOpen, setReservationUnitPickerOpen] = useState(false);
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

  const stagesQuery = useQuery({
    queryKey: ["reference", "OPPORTUNITY", "STAGE"],
    queryFn: () => getReferenceFamily("OPPORTUNITY", "STAGE"),
    ...referenceQueryDefaults
  });

  const lostReasonsQuery = useQuery({
    queryKey: ["reference", "OPPORTUNITY", "LOST_REASON"],
    queryFn: () => getReferenceFamily("OPPORTUNITY", "LOST_REASON"),
    ...referenceQueryDefaults
  });

  const opportunitiesQuery = useQuery({
    queryKey: ["opportunities", search, page],
    queryFn: () =>
      listOpportunities({
        search: search || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize
      }),
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
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
    setSelectedOpportunityId(selectedId);
    setOpportunityDetailModalOpen(true);

    const convertedLeadName = (location.state as { convertedLeadName?: string } | null)?.convertedLeadName;
    if (convertedLeadName) {
      showNotice("Lead Converted", `${convertedLeadName} was converted successfully. The opportunity is ready.`, "success");
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("selected");
    setSearchParams(nextParams, { replace: true });
  }, [location.state, searchParams, setSearchParams]);

  const opportunityDetailQuery = useQuery({
    queryKey: ["opportunity", selectedOpportunityId],
    queryFn: () => getOpportunity(selectedOpportunityId ?? ""),
    enabled: Boolean(selectedOpportunityId && opportunityDetailModalOpen),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });

  const opportunityReservationsQuery = useQuery({
    queryKey: ["reservations", "opportunity", selectedOpportunityId],
    queryFn: () =>
      listReservations({
        opportunityId: selectedOpportunityId ?? "",
        limit: 5,
        offset: 0
      }),
    enabled: Boolean(selectedOpportunityId && opportunityDetailModalOpen),
    staleTime: 10_000,
    refetchOnWindowFocus: false
  });

  const stageForm = useForm<StageFormValues>({
    defaultValues: {
      opportunityStageRefId: "",
      probabilityPercent: "",
      remarks: ""
    }
  });

  const noteForm = useForm<NoteFormValues>({
    defaultValues: {
      noteText: ""
    }
  });

  const siteVisitForm = useForm<SiteVisitFormValues>({
    defaultValues: {
      visitDate: "",
      proposedUnitCode: "",
      remarks: ""
    }
  });

  const lostForm = useForm<LostFormValues>({
    defaultValues: {
      lostReasonRefId: "",
      remarks: ""
    }
  });

  const reservationForm = useForm<ReservationFormValues>({
    defaultValues: {
      opportunityId: "",
      unitId: "",
      unitCode: "",
      reservationAmount: "",
      currencyCode: "",
      expiryDate: "",
      remarks: ""
    }
  });

  const reservationUnitsQuery = useQuery({
    queryKey: ["inventory", "units", "reservation-prefill"],
    queryFn: () => listUnits({ limit: DROPDOWN_LIST_LIMIT }),
    enabled: reservationModalOpen,
    staleTime: 30_000,
    refetchOnWindowFocus: false
  });

  const stageMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ChangeOpportunityStagePayload }) => changeOpportunityStage(id, payload),
    onSuccess: (opportunity, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      void queryClient.invalidateQueries({ queryKey: ["opportunity", opportunity.id] });
      queryClient.setQueryData(["opportunity", opportunity.id], opportunity);

      if (variables.payload.lostReasonRefId) {
        showNotice(
          "Opportunity Marked Lost",
          `${opportunity.customer.name ?? "Customer"}'s opportunity was marked as lost.`,
          "success"
        );
        return;
      }

      const stageName = opportunity.opportunityStage.name ?? "updated stage";
      if (stageName === "Proposal") {
        showNotice("Stage Updated", `Opportunity moved to ${stageName}. Opening proposal form.`, "success");
        openProposalHandoff(opportunity.id, opportunity.opportunityNo);
        return;
      }

      showNotice("Stage Updated", `Opportunity moved to ${stageName}.`, "success");
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, "Opportunity stage could not be updated.");
      showNotice("Stage Update Failed", message, "error");
    }
  });

  const noteMutation = useMutation({
    mutationFn: ({ id, noteText }: { id: string; noteText: string }) => addOpportunityNote(id, noteText, "SALES_NOTE"),
    onSuccess: (opportunity) => {
      noteForm.reset();
      void queryClient.invalidateQueries({ queryKey: ["opportunity", opportunity.id] });
      queryClient.setQueryData(["opportunity", opportunity.id], opportunity);
      showNotice("Note Added", "Opportunity note was saved successfully.", "success");
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, "Opportunity note could not be added.");
      showNotice("Note Not Added", message, "error");
    }
  });

  const siteVisitMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: SiteVisitFormValues }) =>
      scheduleSiteVisit(id, new Date(values.visitDate).toISOString(), pickString(values.proposedUnitCode), pickString(values.remarks)),
    onSuccess: (opportunity) => {
      siteVisitForm.reset();
      void queryClient.invalidateQueries({ queryKey: ["opportunity", opportunity.id] });
      queryClient.setQueryData(["opportunity", opportunity.id], opportunity);
      showNotice("Site Visit Scheduled", "Site visit was scheduled successfully.", "success");
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, "Site visit could not be scheduled.");
      showNotice("Site Visit Failed", message, "error");
    }
  });

  const createReservationMutation = useMutation({
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
      setReservationModalOpen(false);
      reservationForm.reset();
      void queryClient.invalidateQueries({ queryKey: ["reservations"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory", "units"] });
      if (selectedOpportunityId) {
        void queryClient.invalidateQueries({ queryKey: ["opportunity", selectedOpportunityId] });
        void queryClient.invalidateQueries({ queryKey: ["reservations", "opportunity", selectedOpportunityId] });
      }
      closeOpportunityDetailModal();
      navigate(`/reservations?selected=${reservation.id}`, {
        state: { createdForName: reservation.customer.name ?? selectedOpportunity?.customer.name ?? "Customer" }
      });
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, "Reservation could not be created.");
      showNotice("Reservation Failed", message, "error");
    }
  });

  const selectedOpportunity = opportunityDetailQuery.data;
  const opportunityRows = opportunitiesQuery.data?.items ?? [];
  const activeOpportunityReservation =
    (opportunityReservationsQuery.data?.items ?? []).find(
      (reservation) => reservation.isActive && reservation.reservationStatus.code !== "CANCELLED"
    ) ?? null;
  const hasActiveOpportunityReservation = Boolean(activeOpportunityReservation);
  const isSelectedOpportunityLost =
    selectedOpportunity?.status === "LOST" || selectedOpportunity?.opportunityStage.name === "Lost" || Boolean(selectedOpportunity?.lostReason.id);
  const rawNextStageName = isSelectedOpportunityLost ? null : nextOpportunityStageName(selectedOpportunity?.opportunityStage.name);
  const nextStageName =
    rawNextStageName === "Proposal" && !hasActiveOpportunityReservation ? null : rawNextStageName;
  const nextStage = (stagesQuery.data ?? []).find((stage) => stage.level2Name === nextStageName);
  const lostStage = (stagesQuery.data ?? []).find((stage) => stage.level2Name === "Lost");

  useEffect(() => {
    if (!selectedOpportunity || !nextStage) return;

    stageForm.reset({
      opportunityStageRefId: nextStage.id,
      probabilityPercent: suggestedProbability(nextStage.level2Name),
      remarks: ""
    });
  }, [nextStage, selectedOpportunity?.id, selectedOpportunity, stageForm]);

  const stats = useMemo(() => {
    const summary = opportunitiesQuery.data?.summary;
    return {
      total: opportunitiesQuery.data?.pagination.total ?? 0,
      open: summary?.open ?? 0,
      totalBudget: summary?.totalBudget ?? 0,
      avgProbability: summary?.avgProbability ?? 0
    };
  }, [opportunitiesQuery.data]);

  const loadOpportunity = (opportunityId: string) => {
    setSelectedOpportunityId(opportunityId);
    setOpportunityDetailModalOpen(true);
  };

  const closeOpportunityDetailModal = () => {
    setOpportunityDetailModalOpen(false);
    setSelectedOpportunityId(null);
  };

  const openProposalHandoff = (opportunityId: string, opportunityNo?: string | null) => {
    closeOpportunityDetailModal();
    navigate(`/proposals?createFor=${opportunityId}`, {
      state: { fromOpportunity: opportunityNo ?? undefined }
    });
  };

  useModalEscape(opportunityDetailModalOpen, closeOpportunityDetailModal, {
    disabled: noticeDialog.open || reservationModalOpen || unitPickerOpen || reservationUnitPickerOpen
  });

  useModalEscape(reservationModalOpen, () => setReservationModalOpen(false), {
    disabled: noticeDialog.open || reservationUnitPickerOpen
  });

  const onStageSubmit = stageForm.handleSubmit((values) => {
    if (!selectedOpportunityId || !values.opportunityStageRefId) return;
    stageMutation.mutate({
      id: selectedOpportunityId,
      payload: {
        opportunityStageRefId: values.opportunityStageRefId,
        probabilityPercent: pickNumber(values.probabilityPercent),
        remarks: pickString(values.remarks)
      }
    });
  });

  const onNoteSubmit = noteForm.handleSubmit((values) => {
    if (!selectedOpportunityId || !values.noteText.trim()) return;
    noteMutation.mutate({ id: selectedOpportunityId, noteText: values.noteText });
  });

  const onSiteVisitSubmit = siteVisitForm.handleSubmit((values) => {
    if (!selectedOpportunityId) return;

    if (!values.visitDate) {
      const message = "Select a visit date and time before scheduling.";
      showNotice("Visit Date Required", message, "error");
      return;
    }

    siteVisitMutation.mutate({ id: selectedOpportunityId, values });
  });

  const onLostSubmit = lostForm.handleSubmit((values) => {
    if (!selectedOpportunityId || !lostStage) return;

    if (!values.lostReasonRefId) {
      const message = "Lost reason is required when marking an opportunity as lost.";
      showNotice("Lost Reason Required", message, "error");
      return;
    }

    stageMutation.mutate({
      id: selectedOpportunityId,
      payload: {
        opportunityStageRefId: lostStage.id,
        lostReasonRefId: values.lostReasonRefId,
        probabilityPercent: 0,
        remarks: pickString(values.remarks) ?? "Customer marked lost"
      }
    });
  });

  const openReservationModal = () => {
    if (!selectedOpportunity) return;

    reservationForm.reset({
      opportunityId: selectedOpportunity.id,
      unitId: "",
      unitCode: selectedOpportunity.proposedUnitCode ?? "",
      reservationAmount: selectedOpportunity.budgetAmount?.toString() ?? "",
      currencyCode: selectedOpportunity.currencyCode ?? "",
      expiryDate: defaultReservationExpiryDate(),
      remarks: ""
    });
    setReservationModalOpen(true);
  };

  useEffect(() => {
    if (!reservationModalOpen || !selectedOpportunity || !reservationUnitsQuery.data) {
      return;
    }

    if (reservationForm.getValues("unitId")) {
      return;
    }

    const proposedUnit = reservationUnitsQuery.data.items.find(
      (unit) =>
        unit.unitCode === selectedOpportunity.proposedUnitCode && unit.availabilityStatus.code === "AVAILABLE"
    );

    if (!proposedUnit) {
      return;
    }

    reservationForm.setValue("unitId", proposedUnit.id);
    reservationForm.setValue("unitCode", proposedUnit.unitCode);
  }, [reservationForm, reservationModalOpen, reservationUnitsQuery.data, selectedOpportunity]);

  const onReservationSubmit = reservationForm.handleSubmit((values) => {
    if (!values.unitId) {
      const message = "Select an available unit before creating the reservation.";
      showNotice("Unit Required", message, "error");
      return;
    }

    createReservationMutation.mutate(values);
  });

  return (
    <div className="crm-workspace">
      <section className="crm-module-header">
        <div>
          <p className="crm-eyebrow">Sales Pipeline</p>
          <div className="crm-dashboard-title-row">
            <h2>Opportunities</h2>
            <CurrencyBadge />
          </div>
        </div>
      </section>

      <section className="crm-grid crm-metric-grid">
        <article className="crm-card">
          <h3>Total</h3>
          <div className="crm-kpi">{stats.total}</div>
        </article>
        <article className="crm-card">
          <h3>Open</h3>
          <div className="crm-kpi">{stats.open}</div>
        </article>
        <article className="crm-card">
          <h3>Pipeline Value</h3>
          <div className="crm-kpi">{formatInBase(stats.totalBudget)}</div>
        </article>
        <article className="crm-card">
          <h3>Avg Probability</h3>
          <div className="crm-kpi">{stats.avgProbability}%</div>
        </article>
      </section>

      <section className="crm-panel">
        <div className="crm-panel-header">
          <h3>Pipeline</h3>
          <input
            className="crm-input crm-search-input"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search opportunity, customer, lead, project"
            value={search}
          />
        </div>

        <div className="crm-table-wrap">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Opportunity</th>
                <th>Customer</th>
                <th>Stage</th>
                <th>Probability</th>
                <th>Budget</th>
                <th>Project</th>
              </tr>
            </thead>
            <tbody>
              {opportunityRows.map((opportunity: Opportunity) => (
                <tr
                  className={selectedOpportunityId === opportunity.id && opportunityDetailModalOpen ? "is-selected" : ""}
                  key={opportunity.id}
                  onClick={() => loadOpportunity(opportunity.id)}
                >
                  <td>
                    <strong>{opportunity.opportunityNo}</strong>
                    <span>{opportunity.lead.leadNo ?? "Manual opportunity"}</span>
                  </td>
                  <td>{opportunity.customer.name ?? "-"}</td>
                  <td>{opportunity.opportunityStage.name ?? "-"}</td>
                  <td>{opportunity.probabilityPercent ?? "-"}%</td>
                  <td>{formatInBase(opportunity.budgetAmount, opportunity.currencyCode)}</td>
                  <td>{opportunity.projectCode ?? "-"}</td>
                </tr>
              ))}
              {opportunityRows.length === 0 ? (
                <tr>
                  <td className="crm-empty-cell" colSpan={6}>
                    No opportunities found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <ListPagination
          page={page}
          pageSize={pageSize}
          total={opportunitiesQuery.data?.pagination.total ?? 0}
          itemLabel="opportunities"
          onPageChange={setPage}
        />
      </section>

      {opportunityDetailModalOpen ? (
        <div className="crm-modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="crm-modal crm-management-modal crm-lead-detail-modal crm-opportunity-detail-modal"
            role="dialog"
          >
            <div className="crm-panel-header">
              <div>
                <h3>Opportunity Detail</h3>
                {selectedOpportunity ? (
                  <p className="crm-muted-text">
                    {selectedOpportunity.opportunityNo} · {selectedOpportunity.customer.name ?? "Unnamed customer"}
                  </p>
                ) : null}
              </div>
              <button className="crm-secondary-button crm-fit-button" onClick={closeOpportunityDetailModal} type="button">
                Close
              </button>
            </div>

            {opportunityDetailQuery.isLoading ? (
              <p className="crm-muted-text crm-opportunity-detail-body">Loading opportunity details...</p>
            ) : selectedOpportunity ? (
              <div className="crm-opportunity-detail-body">
                <div className="crm-detail-title">
                  <div>
                    <strong>{selectedOpportunity.customer.name ?? selectedOpportunity.opportunityNo}</strong>
                    <span>{selectedOpportunity.opportunityNo}</span>
                  </div>
                  <span className="crm-status-pill">{selectedOpportunity.opportunityStage.name ?? selectedOpportunity.status}</span>
                </div>
                <WorkflowTracker
                  steps={opportunityWorkflowSteps(selectedOpportunity, formatInBase, activeOpportunityReservation)}
                />

                <dl className="crm-detail-list">
                  <div>
                    <dt>Lead</dt>
                    <dd>{selectedOpportunity.lead.leadNo ?? "-"}</dd>
                  </div>
                  <div>
                    <dt>Budget</dt>
                    <dd>{formatInBase(selectedOpportunity.budgetAmount, selectedOpportunity.currencyCode)}</dd>
                  </div>
                  <div>
                    <dt>Unit</dt>
                    <dd>{selectedOpportunity.proposedUnitCode ?? "-"}</dd>
                  </div>
                  <div>
                    <dt>Expected Close</dt>
                    <dd>{selectedOpportunity.expectedCloseDate ?? "-"}</dd>
                  </div>
                </dl>

                <section className="crm-opportunity-actions">
                  <div className="crm-opportunity-actions-primary">
                    {selectedOpportunity.opportunityStage.name === "Proposal" && !isSelectedOpportunityLost && hasActiveOpportunityReservation ? (
                      <section className="crm-opportunity-action-card crm-opportunity-action-card-wide">
                        <div className="crm-opportunity-action-card-header">
                          <h4>Create Proposal</h4>
                          <p className="crm-muted-text">
                            Opportunity is at Proposal stage with an active reservation on unit{" "}
                            {activeOpportunityReservation?.unit.unitCode ?? "-"}. Open the proposal form with pricing pre-filled.
                          </p>
                        </div>
                        <div className="crm-opportunity-action-card-footer">
                          <button
                            className="crm-secondary-button crm-opportunity-action-button"
                            onClick={() =>
                              navigate(`/reservations?selected=${activeOpportunityReservation?.id}`)
                            }
                            type="button"
                          >
                            View Reservation
                          </button>
                          <button
                            className="crm-primary-button crm-opportunity-action-button"
                            onClick={() => openProposalHandoff(selectedOpportunity.id, selectedOpportunity.opportunityNo)}
                            type="button"
                          >
                            Create Proposal
                          </button>
                        </div>
                      </section>
                    ) : selectedOpportunity.opportunityStage.name === "Reservation Ready" && !isSelectedOpportunityLost ? (
                      hasActiveOpportunityReservation ? (
                        <section className="crm-opportunity-action-card crm-opportunity-action-card-wide">
                          <div className="crm-opportunity-action-card-header">
                            <h4>Reservation Created</h4>
                            <p className="crm-muted-text">
                              {activeOpportunityReservation?.reservationNo} · Unit{" "}
                              {activeOpportunityReservation?.unit.unitCode ?? "-"} is reserved. Continue to Proposal when ready.
                            </p>
                          </div>
                          <div className="crm-opportunity-action-card-footer">
                            <button
                              className="crm-secondary-button crm-opportunity-action-button"
                              onClick={() =>
                                navigate(`/reservations?selected=${activeOpportunityReservation?.id}`)
                              }
                              type="button"
                            >
                              View Reservation
                            </button>
                            {nextStageName ? (
                              <button
                                className="crm-primary-button crm-opportunity-action-button"
                                disabled={stageMutation.isPending}
                                onClick={() => {
                                  if (!selectedOpportunityId || !nextStage) return;
                                  stageMutation.mutate({
                                    id: selectedOpportunityId,
                                    payload: {
                                      opportunityStageRefId: nextStage.id,
                                      probabilityPercent: pickNumber(suggestedProbability(nextStage.level2Name)),
                                      remarks: "Moved to Proposal after unit reservation."
                                    }
                                  });
                                }}
                                type="button"
                              >
                                {stageMutation.isPending ? "Moving..." : `Move to ${nextStageName}`}
                              </button>
                            ) : null}
                          </div>
                        </section>
                      ) : (
                        <section className="crm-opportunity-action-card crm-opportunity-action-card-wide">
                          <div className="crm-opportunity-action-card-header">
                            <h4>Create Reservation</h4>
                            <p className="crm-muted-text">
                              This opportunity is reservation-ready. Select an available unit and create the reservation before moving to Proposal.
                            </p>
                          </div>
                          <div className="crm-opportunity-action-card-footer">
                            <button
                              className="crm-primary-button crm-opportunity-action-button"
                              onClick={openReservationModal}
                              type="button"
                            >
                              Create Reservation
                            </button>
                          </div>
                        </section>
                      )
                    ) : (
                      <form className="crm-opportunity-action-card" onSubmit={onStageSubmit}>
                        <div className="crm-opportunity-action-card-header">
                          <h4>{nextStageName ? `Move to ${nextStageName}` : "Stage Complete"}</h4>
                          <p className="crm-muted-text">
                            Current: {selectedOpportunity.opportunityStage.name ?? "-"}
                            {nextStageName ? ` · Next: ${nextStageName}` : ""}
                          </p>
                        </div>
                        <div className="crm-opportunity-action-card-fields">
                          <div className="crm-two-col">
                            <label className="crm-field">
                              <span className="crm-label">Current Stage</span>
                              <input className="crm-input" disabled readOnly value={selectedOpportunity.opportunityStage.name ?? "-"} />
                            </label>
                            <label className="crm-field">
                              <span className="crm-label">Next Stage</span>
                              <input
                                className="crm-input"
                                disabled
                                readOnly
                                value={nextStage?.level2Name ?? nextStageName ?? "No further stage"}
                              />
                              <input type="hidden" {...stageForm.register("opportunityStageRefId")} />
                            </label>
                          </div>
                          <label className="crm-field">
                            <span className="crm-label">Probability</span>
                            <input className="crm-input" inputMode="numeric" {...stageForm.register("probabilityPercent")} />
                          </label>
                          <label className="crm-field">
                            <span className="crm-label">Remarks</span>
                            <textarea className="crm-input crm-textarea crm-opportunity-textarea" {...stageForm.register("remarks")} />
                          </label>
                        </div>
                        <div className="crm-opportunity-action-card-footer">
                          <button
                            className="crm-primary-button crm-opportunity-action-button"
                            disabled={stageMutation.isPending || !nextStageName || isSelectedOpportunityLost}
                            type="submit"
                          >
                            {stageMutation.isPending ? "Moving..." : nextStageName ? `Move to ${nextStageName}` : "Stage Complete"}
                          </button>
                        </div>
                      </form>
                    )}

                    <form className="crm-opportunity-action-card" onSubmit={onNoteSubmit}>
                      <div className="crm-opportunity-action-card-header">
                        <h4>Add Note</h4>
                        <p className="crm-muted-text">Record sales notes for this opportunity.</p>
                      </div>
                      <div className="crm-opportunity-action-card-fields">
                        <label className="crm-field">
                          <span className="crm-label">Note</span>
                          <textarea className="crm-input crm-textarea crm-opportunity-textarea" {...noteForm.register("noteText")} />
                        </label>
                      </div>
                      <div className="crm-opportunity-action-card-footer">
                        <button className="crm-secondary-button crm-opportunity-action-button" disabled={noteMutation.isPending} type="submit">
                          {noteMutation.isPending ? "Adding..." : "Add Note"}
                        </button>
                      </div>
                    </form>

                    <form className="crm-opportunity-action-card" onSubmit={onSiteVisitSubmit}>
                      <div className="crm-opportunity-action-card-header">
                        <h4>Schedule Visit</h4>
                        <p className="crm-muted-text">Multiple visits are recorded in activity history.</p>
                      </div>
                      <div className="crm-opportunity-action-card-fields crm-opportunity-visit-fields">
                        <label className="crm-field">
                          <span className="crm-label">Visit Date</span>
                          <Controller
                            control={siteVisitForm.control}
                            name="visitDate"
                            render={({ field }) => (
                              <DateTimeField
                                className="crm-datetime-input"
                                onBlur={field.onBlur}
                                onChange={field.onChange}
                                ref={field.ref}
                                value={field.value}
                              />
                            )}
                          />
                        </label>
                        <label className="crm-field">
                          <span className="crm-label">Proposed Unit</span>
                          <div className="crm-opportunity-unit-picker-row">
                            <input type="hidden" {...siteVisitForm.register("proposedUnitCode")} />
                            <input
                              className="crm-input"
                              placeholder="Choose from available units"
                              readOnly
                              value={siteVisitForm.watch("proposedUnitCode")}
                            />
                            <button
                              className="crm-secondary-button crm-opportunity-unit-picker-button"
                              disabled={isSelectedOpportunityLost}
                              onClick={() => setUnitPickerOpen(true)}
                              type="button"
                            >
                              Choose Unit
                            </button>
                          </div>
                          {siteVisitForm.watch("proposedUnitCode") ? (
                            <button
                              className="crm-inline-clear-button"
                              onClick={() => siteVisitForm.setValue("proposedUnitCode", "")}
                              type="button"
                            >
                              Clear selection
                            </button>
                          ) : null}
                        </label>
                        <label className="crm-field">
                          <span className="crm-label">Visit Remarks</span>
                          <textarea
                            className="crm-input crm-textarea crm-opportunity-textarea"
                            placeholder="Visit remarks"
                            {...siteVisitForm.register("remarks")}
                          />
                        </label>
                      </div>
                      <div className="crm-opportunity-action-card-footer">
                        <button className="crm-secondary-button crm-opportunity-action-button" disabled={siteVisitMutation.isPending || isSelectedOpportunityLost} type="submit">
                          {siteVisitMutation.isPending ? "Scheduling..." : "Schedule Visit"}
                        </button>
                      </div>
                    </form>
                  </div>

                  <form className="crm-opportunity-action-card crm-opportunity-lost-card" onSubmit={onLostSubmit}>
                    <div className="crm-opportunity-action-card-header">
                      <h4>Mark Lost</h4>
                      <p className="crm-muted-text">Use this if the customer drops out at any stage.</p>
                    </div>
                    <div className="crm-opportunity-lost-fields">
                      <label className="crm-field">
                        <span className="crm-label">
                          Lost Reason <span className="crm-label-required-inline">*</span>
                        </span>
                        <select className="crm-input" {...lostForm.register("lostReasonRefId")} disabled={isSelectedOpportunityLost}>
                          <option value="">Select reason</option>
                          {(lostReasonsQuery.data ?? []).map((reason) => (
                            <option key={reason.id} value={reason.id}>
                              {reason.level2Name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="crm-field">
                        <span className="crm-label">Remarks</span>
                        <textarea
                          className="crm-input crm-textarea crm-opportunity-textarea"
                          {...lostForm.register("remarks")}
                          disabled={isSelectedOpportunityLost}
                        />
                      </label>
                      <div className="crm-opportunity-action-card-footer crm-opportunity-lost-footer">
                        <button
                          className="crm-secondary-button crm-opportunity-action-button"
                          disabled={stageMutation.isPending || isSelectedOpportunityLost || !lostStage}
                          type="submit"
                        >
                          {isSelectedOpportunityLost ? "Marked Lost" : "Mark Lost"}
                        </button>
                      </div>
                    </div>
                  </form>
                </section>

                <section className="crm-activity-list">
                  <h4>Notes</h4>
                  {selectedOpportunity.notes.map((note) => (
                    <article key={note.id}>
                      <strong>{note.noteType ?? "Note"}</strong>
                      <span>{formatDate(note.createdAt)}</span>
                      <p>{note.noteText}</p>
                    </article>
                  ))}
                  {selectedOpportunity.notes.length === 0 ? <p className="crm-muted-text">No notes yet.</p> : null}
                </section>

                <section className="crm-activity-list">
                  <h4>Site Visits</h4>
                  {selectedOpportunity.siteVisits.map((visit) => (
                    <article key={visit.id}>
                      <strong>{formatDate(visit.visitDate)}</strong>
                      <span>{visit.proposedUnitCode ?? "No unit selected"}</span>
                      <p>{visit.remarks ?? visit.status}</p>
                    </article>
                  ))}
                  {selectedOpportunity.siteVisits.length === 0 ? <p className="crm-muted-text">No visits scheduled.</p> : null}
                </section>
              </div>
            ) : (
              <p className="crm-muted-text crm-opportunity-detail-body">Opportunity details could not be loaded.</p>
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

      {reservationModalOpen && selectedOpportunity ? (
        <div className="crm-modal-backdrop" role="presentation">
          <section aria-modal="true" className="crm-modal crm-management-modal crm-reservation-modal" role="dialog">
            <div className="crm-panel-header">
              <div>
                <h3>Create Reservation</h3>
                <p className="crm-muted-text">
                  {selectedOpportunity.opportunityNo} · {selectedOpportunity.customer.name ?? "Customer"}
                </p>
              </div>
              <button className="crm-secondary-button crm-fit-button" onClick={() => setReservationModalOpen(false)} type="button">
                Close
              </button>
            </div>
            <form className="crm-reservation-modal-form" onSubmit={onReservationSubmit}>
              <div className="crm-reservation-modal-body">
                <div className="crm-reservation-modal-fields">
                  <input type="hidden" {...reservationForm.register("opportunityId")} />
                  <input type="hidden" {...reservationForm.register("unitId")} />
                  <label className="crm-field">
                    <span className="crm-label">Customer</span>
                    <input className="crm-input" disabled readOnly value={selectedOpportunity.customer.name ?? "-"} />
                  </label>
                  <label className="crm-field">
                    <span className="crm-label">Project</span>
                    <input className="crm-input" disabled readOnly value={selectedOpportunity.projectCode ?? "-"} />
                  </label>
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
                      <button
                        className="crm-secondary-button crm-fit-button"
                        onClick={() => setReservationUnitPickerOpen(true)}
                        type="button"
                      >
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
                    <input className="crm-input" {...reservationForm.register("currencyCode")} />
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
                <button className="crm-secondary-button crm-fit-button" onClick={() => setReservationModalOpen(false)} type="button">
                  Close
                </button>
                <button className="crm-primary-button crm-fit-button" disabled={createReservationMutation.isPending} type="submit">
                  {createReservationMutation.isPending ? "Creating..." : "Create Reservation"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      <UnitPickerDialog
        onClose={() => setUnitPickerOpen(false)}
        onSelect={(unit) => siteVisitForm.setValue("proposedUnitCode", unit.unitCode)}
        open={unitPickerOpen}
        projectCode={selectedOpportunity?.projectCode}
      />

      <UnitPickerDialog
        onClose={() => setReservationUnitPickerOpen(false)}
        onSelect={(unit) => {
          reservationForm.setValue("unitId", unit.id);
          reservationForm.setValue("unitCode", unit.unitCode);
          void resolveUnitReservationPricing(unit).then((pricing) => {
            reservationForm.setValue("reservationAmount", pricing.amount);
            reservationForm.setValue(
              "currencyCode",
              pricing.currencyCode || selectedOpportunity?.currencyCode || ""
            );
          });
        }}
        open={reservationUnitPickerOpen}
        projectCode={selectedOpportunity?.projectCode}
      />
    </div>
  );
}
