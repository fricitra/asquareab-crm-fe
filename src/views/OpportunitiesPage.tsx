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
  updateSiteVisit,
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
import { ContinuePanel, MOVE_TO_CTA, SalesPipelineStrip } from "../shared/SalesPipeline";

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
  visitType: "IN_PERSON" | "VIRTUAL";
  proposedUnitCode: string;
  remarks: string;
};

type CompleteVisitFormValues = {
  visitId: string;
  outcomeNotes: string;
};

function toFormDateTime(value: string | null | undefined) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

function visitTypeLabel(visitType: string | null | undefined) {
  return visitType === "VIRTUAL" ? "Virtual" : "In-person";
}

function visitStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "COMPLETED":
      return "Completed";
    case "CANCELLED":
      return "Cancelled";
    case "NO_SHOW":
      return "No show";
    default:
      return "Scheduled";
  }
}

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
          ? stageName === "Qualified" || stageName === "Open"
            ? "Schedule an in-person or virtual site visit to continue. Manual move to Site Visit is not used."
            : stageName === "Site Visit"
              ? "Complete the site visit with outcome notes before moving to Negotiation."
            : stageName === "Reservation Ready" && !hasActiveReservation
            ? "Select an available unit and create the reservation from the action below."
            : opportunity.remarks
          : forwardIndex === currentForwardIndex + 1
            ? stageName === "Site Visit"
              ? "Schedule a site visit (in-person or virtual) to enter this stage."
              : stageName === "Negotiation"
                ? "Complete at least one site visit, then move to Negotiation."
              : "This is the next suggested workflow stage."
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
          ? `Create a reservation using ${MOVE_TO_CTA.reservation}.`
          : "This becomes available after Reservation Ready.",
      details: [
        { label: "Action", value: hasActiveReservation ? "View / approve reservation" : MOVE_TO_CTA.reservation },
        { label: "Reservation", value: activeReservation?.reservationNo },
        { label: "Unit", value: activeReservation?.unit.unitCode ?? opportunity.proposedUnitCode },
        { label: "Inventory Result", value: hasActiveReservation ? "Unit is Reserved" : "Selected unit becomes Reserved" }
      ]
    },
    buildForwardStageStep("Proposal", opportunityForwardStages.indexOf("Proposal")),
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
  const [actionNotes, setActionNotes] = useState("");
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null);
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
      visitType: "IN_PERSON",
      proposedUnitCode: "",
      remarks: ""
    }
  });

  const completeVisitForm = useForm<CompleteVisitFormValues>({
    defaultValues: {
      visitId: "",
      outcomeNotes: ""
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
        openProposalHandoff(opportunity.id, opportunity.opportunityNo, variables.payload.remarks);
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
    mutationFn: ({ id, values }: { id: string; values: SiteVisitFormValues }) => {
      const payload = {
        visitDate: new Date(values.visitDate).toISOString(),
        visitType: values.visitType,
        proposedUnitCode: pickString(values.proposedUnitCode),
        remarks: pickString(values.remarks)
      };
      if (editingVisitId) {
        return updateSiteVisit(id, editingVisitId, payload);
      }
      return scheduleSiteVisit(id, payload);
    },
    onSuccess: (opportunity) => {
      const wasEdit = Boolean(editingVisitId);
      setEditingVisitId(null);
      siteVisitForm.reset({ visitDate: "", visitType: "IN_PERSON", proposedUnitCode: "", remarks: "" });
      void queryClient.invalidateQueries({ queryKey: ["opportunity", opportunity.id] });
      queryClient.setQueryData(["opportunity", opportunity.id], opportunity);
      showNotice(
        wasEdit ? "Site Visit Updated" : "Site Visit Scheduled",
        wasEdit
          ? "Site visit details were updated successfully."
          : "Site visit was scheduled successfully. The opportunity moves to Site Visit when this is the first visit.",
        "success"
      );
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, "Site visit could not be saved.");
      showNotice("Site Visit Failed", message, "error");
    }
  });

  const completeVisitMutation = useMutation({
    mutationFn: ({
      id,
      visitId,
      outcomeNotes
    }: {
      id: string;
      visitId: string;
      outcomeNotes: string;
    }) =>
      updateSiteVisit(id, visitId, {
        status: "COMPLETED",
        remarks: outcomeNotes
      }),
    onSuccess: (opportunity) => {
      completeVisitForm.reset({ visitId: "", outcomeNotes: "" });
      void queryClient.invalidateQueries({ queryKey: ["opportunity", opportunity.id] });
      queryClient.setQueryData(["opportunity", opportunity.id], opportunity);
      showNotice(
        "Site Visit Completed",
        "Visit outcome was saved. You can now move to Negotiation.",
        "success"
      );
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, "Site visit could not be completed.");
      showNotice("Complete Visit Failed", message, "error");
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
  const hasCompletedSiteVisit = (selectedOpportunity?.siteVisits ?? []).some((visit) => visit.status === "COMPLETED");
  const scheduledSiteVisits = (selectedOpportunity?.siteVisits ?? []).filter((visit) => visit.status === "SCHEDULED");
  const rawNextStageName = isSelectedOpportunityLost ? null : nextOpportunityStageName(selectedOpportunity?.opportunityStage.name);
  const nextStageName =
    rawNextStageName === "Proposal" && !hasActiveOpportunityReservation
      ? null
      : rawNextStageName === "Site Visit"
        ? null
        : rawNextStageName === "Negotiation" &&
            selectedOpportunity?.opportunityStage.name === "Site Visit" &&
            !hasCompletedSiteVisit
          ? null
          : rawNextStageName;
  const awaitsSiteVisitSchedule =
    !isSelectedOpportunityLost &&
    (selectedOpportunity?.opportunityStage.name === "Open" || selectedOpportunity?.opportunityStage.name === "Qualified");
  const awaitsSiteVisitCompletion =
    !isSelectedOpportunityLost &&
    selectedOpportunity?.opportunityStage.name === "Site Visit" &&
    !hasCompletedSiteVisit;
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

  useEffect(() => {
    if (!awaitsSiteVisitCompletion) return;
    const preferred =
      scheduledSiteVisits[0] ??
      selectedOpportunity?.siteVisits.find((visit) => visit.status !== "COMPLETED") ??
      selectedOpportunity?.siteVisits[0];
    if (!preferred) return;
    if (completeVisitForm.getValues("visitId")) return;
    completeVisitForm.reset({
      visitId: preferred.id,
      outcomeNotes: preferred.remarks ?? ""
    });
  }, [awaitsSiteVisitCompletion, completeVisitForm, scheduledSiteVisits, selectedOpportunity?.siteVisits]);

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
    setActionNotes("");
    setOpportunityDetailModalOpen(true);
  };

  const closeOpportunityDetailModal = () => {
    setOpportunityDetailModalOpen(false);
    setSelectedOpportunityId(null);
    setActionNotes("");
    setEditingVisitId(null);
    siteVisitForm.reset({ visitDate: "", visitType: "IN_PERSON", proposedUnitCode: "", remarks: "" });
    completeVisitForm.reset({ visitId: "", outcomeNotes: "" });
  };

  const requireActionNotes = (existingRemarks: string | null | undefined, actionLabel: string) => {
    const typed = actionNotes.trim();
    const notes = typed || existingRemarks?.trim() || "";
    if (!notes) {
      showNotice(
        "Quick Notes Required",
        `Enter a short note before ${actionLabel}. Existing opportunity remarks can also be used if already recorded.`,
        "error"
      );
      return null;
    }
    return notes;
  };

  const openProposalHandoff = (opportunityId: string, opportunityNo?: string | null, handoffNotes?: string) => {
    closeOpportunityDetailModal();
    navigate(`/proposals?createFor=${opportunityId}`, {
      state: {
        fromOpportunity: opportunityNo ?? undefined,
        ...(handoffNotes ? { handoffNotes } : {})
      }
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

  const onCompleteVisitSubmit = completeVisitForm.handleSubmit((values) => {
    if (!selectedOpportunityId) return;
    if (!values.visitId) {
      showNotice("Visit Required", "Select the site visit to complete.", "error");
      return;
    }
    if (!values.outcomeNotes.trim()) {
      showNotice("Outcome Notes Required", "Enter site visit outcome notes before marking the visit completed.", "error");
      return;
    }
    completeVisitMutation.mutate({
      id: selectedOpportunityId,
      visitId: values.visitId,
      outcomeNotes: values.outcomeNotes.trim()
    });
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
                <SalesPipelineStrip current="opportunity" />
                <WorkflowTracker
                  steps={opportunityWorkflowSteps(selectedOpportunity, formatInBase, activeOpportunityReservation)}
                />

                {!isSelectedOpportunityLost && awaitsSiteVisitSchedule ? (
                  <ContinuePanel
                    nowLabel={selectedOpportunity.opportunityStage.name ?? "Opportunity"}
                    nowSummary="Schedule the first site visit to continue. In-person and virtual visits both advance the stage."
                    nextLabel="Schedule Visit & Continue"
                    nextSummary="Creates the visit record and moves this opportunity to Site Visit."
                    dataNeeded="Visit date/time and visit type (in-person or virtual). Unit is optional."
                  />
                ) : !isSelectedOpportunityLost && awaitsSiteVisitCompletion ? (
                  <ContinuePanel
                    nowLabel="Site Visit"
                    nowSummary="A visit is scheduled. Capture outcome notes and mark it completed before negotiation."
                    nextLabel="Complete Site Visit"
                    nextSummary="Save visit comments and status as Completed, then Move to Negotiation becomes available."
                    dataNeeded="Outcome notes for the selected visit."
                  />
                ) : !isSelectedOpportunityLost && selectedOpportunity.opportunityStage.name === "Proposal" && hasActiveOpportunityReservation ? (
                  <ContinuePanel
                    nowLabel="Proposal stage"
                    nowSummary={`Active reservation on unit ${activeOpportunityReservation?.unit.unitCode ?? "-"}.`}
                    nextLabel={MOVE_TO_CTA.proposal}
                    nextSummary="Open the proposal form with reservation pricing pre-filled."
                    notesHint={
                      selectedOpportunity.remarks?.trim()
                        ? "Existing remarks will be used if you leave this blank."
                        : "Required before moving to proposal."
                    }
                    notesPlaceholder="Why is this ready for proposal? Buyer confirmation, commercial points…"
                    notesValue={actionNotes}
                    onNotesChange={setActionNotes}
                  >
                    <button
                      className="crm-secondary-button crm-fit-button"
                      onClick={() => navigate(`/reservations?selected=${activeOpportunityReservation?.id}`)}
                      type="button"
                    >
                      View Reservation
                    </button>
                    <button
                      className="crm-primary-button crm-fit-button"
                      onClick={() => {
                        const notes = requireActionNotes(selectedOpportunity.remarks, MOVE_TO_CTA.proposal);
                        if (!notes) return;
                        openProposalHandoff(selectedOpportunity.id, selectedOpportunity.opportunityNo, notes);
                      }}
                      type="button"
                    >
                      {MOVE_TO_CTA.proposal}
                    </button>
                  </ContinuePanel>
                ) : !isSelectedOpportunityLost && selectedOpportunity.opportunityStage.name === "Reservation Ready" ? (
                  hasActiveOpportunityReservation ? (
                    <ContinuePanel
                      nowLabel="Reservation created"
                      nowSummary={`${activeOpportunityReservation?.reservationNo} · Unit ${activeOpportunityReservation?.unit.unitCode ?? "-"} is reserved.`}
                      nextLabel={nextStageName ? `Move to ${nextStageName}` : MOVE_TO_CTA.proposal}
                      nextSummary="Approve the reservation if needed, then continue to proposal."
                      notesHint={
                        selectedOpportunity.remarks?.trim()
                          ? "Existing remarks will be used if you leave this blank."
                          : "Required before moving to the next stage."
                      }
                      notesPlaceholder="Stage move notes…"
                      notesValue={actionNotes}
                      onNotesChange={setActionNotes}
                    >
                      <button
                        className="crm-secondary-button crm-fit-button"
                        onClick={() => navigate(`/reservations?selected=${activeOpportunityReservation?.id}`)}
                        type="button"
                      >
                        View Reservation
                      </button>
                      {nextStageName && nextStage ? (
                        <button
                          className="crm-primary-button crm-fit-button"
                          disabled={stageMutation.isPending}
                          onClick={() => {
                            if (!selectedOpportunityId || !nextStage) return;
                            const notes = requireActionNotes(
                              selectedOpportunity.remarks,
                              `moving to ${nextStageName}`
                            );
                            if (!notes) return;
                            stageMutation.mutate({
                              id: selectedOpportunityId,
                              payload: {
                                opportunityStageRefId: nextStage.id,
                                probabilityPercent: pickNumber(suggestedProbability(nextStage.level2Name)),
                                remarks: notes
                              }
                            });
                          }}
                          type="button"
                        >
                          {stageMutation.isPending ? "Moving..." : `Move to ${nextStageName}`}
                        </button>
                      ) : null}
                    </ContinuePanel>
                  ) : (
                    <ContinuePanel
                      nowLabel="Reservation Ready"
                      nowSummary="Select an available unit and hold it for this buyer."
                      nextLabel={MOVE_TO_CTA.reservation}
                      nextSummary="Creates the reservation and blocks the unit."
                      dataNeeded="Available unit, reservation amount, and expiry."
                    >
                      <button className="crm-primary-button crm-fit-button" onClick={openReservationModal} type="button">
                        {MOVE_TO_CTA.reservation}
                      </button>
                    </ContinuePanel>
                  )
                ) : null}

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
                    {awaitsSiteVisitSchedule ? (
                      <form className="crm-opportunity-action-card crm-opportunity-action-card-wide" onSubmit={onSiteVisitSubmit}>
                        <div className="crm-opportunity-action-card-header">
                          <h4>{editingVisitId ? "Update Site Visit" : "1. Schedule Visit & Continue"}</h4>
                          <p className="crm-muted-text">
                            Choose in-person or virtual. The first scheduled visit moves this opportunity to Site Visit. More visits can be added later.
                          </p>
                        </div>
                        <div className="crm-opportunity-action-card-fields crm-opportunity-visit-fields">
                          <label className="crm-field">
                            <span className="crm-label">Visit Type</span>
                            <select className="crm-input" {...siteVisitForm.register("visitType")}>
                              <option value="IN_PERSON">In-person</option>
                              <option value="VIRTUAL">Virtual</option>
                            </select>
                          </label>
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
                                placeholder="Optional — choose from available units"
                                readOnly
                                value={siteVisitForm.watch("proposedUnitCode")}
                              />
                              <button
                                className="crm-secondary-button crm-opportunity-unit-picker-button"
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
                          {editingVisitId ? (
                            <button
                              className="crm-secondary-button crm-opportunity-action-button"
                              onClick={() => {
                                setEditingVisitId(null);
                                siteVisitForm.reset({ visitDate: "", visitType: "IN_PERSON", proposedUnitCode: "", remarks: "" });
                              }}
                              type="button"
                            >
                              Cancel Edit
                            </button>
                          ) : null}
                          <button className="crm-primary-button crm-opportunity-action-button" disabled={siteVisitMutation.isPending} type="submit">
                            {siteVisitMutation.isPending
                              ? "Saving..."
                              : editingVisitId
                                ? "Update Visit"
                                : "Schedule Visit & Continue"}
                          </button>
                        </div>
                      </form>
                    ) : awaitsSiteVisitCompletion ? (
                      <form className="crm-opportunity-action-card crm-opportunity-action-card-wide" onSubmit={onCompleteVisitSubmit}>
                        <div className="crm-opportunity-action-card-header">
                          <h4>1. Complete Site Visit</h4>
                          <p className="crm-muted-text">
                            Record outcome notes and mark the visit Completed. Move to Negotiation unlocks after at least one completed visit.
                          </p>
                        </div>
                        <div className="crm-opportunity-action-card-fields">
                          <label className="crm-field">
                            <span className="crm-label">Visit to Complete</span>
                            <select className="crm-input" {...completeVisitForm.register("visitId")}>
                              <option value="">Select visit</option>
                              {(selectedOpportunity.siteVisits ?? []).map((visit) => (
                                <option key={visit.id} value={visit.id}>
                                  {formatDate(visit.visitDate)} · {visitTypeLabel(visit.visitType)} · {visitStatusLabel(visit.status)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="crm-field">
                            <span className="crm-label">Visit Outcome Notes</span>
                            <textarea
                              className="crm-input crm-textarea crm-opportunity-textarea"
                              placeholder="What happened on the visit? Interest, objections, preferred unit, next commercial points..."
                              {...completeVisitForm.register("outcomeNotes")}
                            />
                          </label>
                        </div>
                        <div className="crm-opportunity-action-card-footer">
                          <button
                            className="crm-primary-button crm-opportunity-action-button"
                            disabled={completeVisitMutation.isPending || (selectedOpportunity.siteVisits ?? []).length === 0}
                            type="submit"
                          >
                            {completeVisitMutation.isPending ? "Completing..." : "Complete Site Visit"}
                          </button>
                        </div>
                      </form>
                    ) : selectedOpportunity.opportunityStage.name === "Proposal" && !isSelectedOpportunityLost && hasActiveOpportunityReservation ? null : selectedOpportunity.opportunityStage.name === "Reservation Ready" && !isSelectedOpportunityLost ? null : (
                      <form className="crm-opportunity-action-card" onSubmit={onStageSubmit}>
                        <div className="crm-opportunity-action-card-header">
                          <h4>{nextStageName ? `1. Move to ${nextStageName}` : "Stage Complete"}</h4>
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
                        <p className="crm-muted-text">Supporting activity — does not change the opportunity stage.</p>
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

                    {!awaitsSiteVisitSchedule && !isSelectedOpportunityLost ? (
                      <form className="crm-opportunity-action-card" onSubmit={onSiteVisitSubmit}>
                        <div className="crm-opportunity-action-card-header">
                          <h4>{editingVisitId ? "Update Site Visit" : "Schedule Another Visit"}</h4>
                          <p className="crm-muted-text">
                            Supporting activity — add or change in-person/virtual visits. Multiple visits are allowed.
                          </p>
                        </div>
                        <div className="crm-opportunity-action-card-fields crm-opportunity-visit-fields">
                          <label className="crm-field">
                            <span className="crm-label">Visit Type</span>
                            <select className="crm-input" {...siteVisitForm.register("visitType")}>
                              <option value="IN_PERSON">In-person</option>
                              <option value="VIRTUAL">Virtual</option>
                            </select>
                          </label>
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
                                placeholder="Optional — choose from available units"
                                readOnly
                                value={siteVisitForm.watch("proposedUnitCode")}
                              />
                              <button
                                className="crm-secondary-button crm-opportunity-unit-picker-button"
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
                          {editingVisitId ? (
                            <button
                              className="crm-secondary-button crm-opportunity-action-button"
                              onClick={() => {
                                setEditingVisitId(null);
                                siteVisitForm.reset({ visitDate: "", visitType: "IN_PERSON", proposedUnitCode: "", remarks: "" });
                              }}
                              type="button"
                            >
                              Cancel Edit
                            </button>
                          ) : null}
                          <button className="crm-secondary-button crm-opportunity-action-button" disabled={siteVisitMutation.isPending} type="submit">
                            {siteVisitMutation.isPending ? "Saving..." : editingVisitId ? "Update Visit" : "Schedule Visit"}
                          </button>
                        </div>
                      </form>
                    ) : null}
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
                      <strong>
                        {formatDate(visit.visitDate)} · {visitTypeLabel(visit.visitType)} · {visitStatusLabel(visit.status)}
                      </strong>
                      <span>{visit.proposedUnitCode ?? "No unit selected"}</span>
                      <p>{visit.remarks ?? "No outcome notes yet."}</p>
                      {!isSelectedOpportunityLost ? (
                        <div className="crm-opportunity-action-card-footer" style={{ marginTop: 8, paddingTop: 0 }}>
                          {visit.status === "SCHEDULED" ? (
                            <button
                              className="crm-primary-button crm-fit-button"
                              onClick={() => {
                                completeVisitForm.reset({
                                  visitId: visit.id,
                                  outcomeNotes: visit.remarks ?? ""
                                });
                              }}
                              type="button"
                            >
                              Complete This Visit
                            </button>
                          ) : null}
                          <button
                            className="crm-secondary-button crm-fit-button"
                            onClick={() => {
                              setEditingVisitId(visit.id);
                              siteVisitForm.reset({
                                visitDate: toFormDateTime(visit.visitDate),
                                visitType: visit.visitType === "VIRTUAL" ? "VIRTUAL" : "IN_PERSON",
                                proposedUnitCode: visit.proposedUnitCode ?? "",
                                remarks: visit.remarks ?? ""
                              });
                            }}
                            type="button"
                          >
                            Edit Visit
                          </button>
                        </div>
                      ) : null}
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
