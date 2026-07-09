import axios from "axios";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
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
import { useMoneyFormatter } from "../hooks/useCurrencyContext";
import { formatAmount } from "../lib/format-money";
import { DEFAULT_LIST_PAGE_SIZE } from "../lib/list-pagination";
import { CurrencyBadge } from "../shared/CurrencyBadge";
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

function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)?.message;
    return message && message.trim() !== "" ? message : fallback;
  }

  return fallback;
}

const opportunityStageOrder = ["Open", "Qualified", "Site Visit", "Negotiation", "Proposal", "Reservation Ready"];

function opportunityWorkflowSteps(
  opportunity: OpportunityDetail,
  formatBudget: (amount: number | null | undefined, currencyCode?: string | null) => string
): WorkflowStep[] {
  const historyByStage = new Map(opportunity.stageHistory.map((entry) => [entry.opportunityStage.name ?? "", entry]));
  const currentStageName = opportunity.opportunityStage.name ?? "Qualified";
  const currentIndex = Math.max(opportunityStageOrder.indexOf(currentStageName), 0);
  const isLost = opportunity.status === "LOST" || opportunity.opportunityStage.name === "Lost" || Boolean(opportunity.lostReason.id);

  const normalSteps = opportunityStageOrder.map((stageName, index) => {
    const history = historyByStage.get(stageName);
    const isCompleted = Boolean(history) || index < currentIndex;
    const isCurrent = !isLost && stageName === currentStageName;
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
        (isCurrent ? opportunity.remarks : index === currentIndex + 1 ? "This is the next suggested workflow stage." : null),
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
  });

  return [
    ...normalSteps,
    {
      id: "Reserved",
      title: "Reserved",
      status: isLost ? "blocked" : currentStageName === "Reservation Ready" ? "current" : "next",
      timestamp: null,
      user: null,
      role: null,
      summary:
        currentStageName === "Reservation Ready"
          ? "Create a reservation from the Reservations screen using this opportunity and an available unit."
          : "This becomes available after Reservation Ready.",
      details: [
        { label: "Next Screen", value: "/reservations" },
        { label: "Required Data", value: "Opportunity, available unit, amount, expiry" },
        { label: "Inventory Result", value: "Selected unit becomes Reserved" }
      ]
    },
    {
      id: "Won",
      title: "Won",
      status: isLost ? "blocked" : "next",
      timestamp: null,
      user: null,
      role: null,
      summary: "Winning/closure should happen after reservation and contract baseline in later packages.",
      details: [
        { label: "Current Package", value: "Package 5 stops at reservation" },
        { label: "Future Package", value: "Contract and ERP handoff" }
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
  const currentIndex = opportunityStageOrder.indexOf(currentStageName ?? "");
  if (currentIndex < 0) return "Site Visit";
  return opportunityStageOrder[currentIndex + 1] ?? null;
}

function suggestedProbability(stageName: string | null) {
  switch (stageName) {
    case "Site Visit":
      return "45";
    case "Negotiation":
      return "60";
    case "Proposal":
      return "75";
    case "Reservation Ready":
      return "85";
    case "Won":
      return "100";
    default:
      return "";
  }
}

export function OpportunitiesPage() {
  const { toBase } = useMoneyFormatter();
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

  const formatBaseAmount = (value: number | null | undefined, currencyCode?: string | null) =>
    formatAmount(toBase(value, currencyCode));

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

    const convertNotice = (location.state as { convertNotice?: string } | null)?.convertNotice;
    if (convertNotice) {
      showNotice("Lead Converted", `Lead converted successfully. Opportunity ${convertNotice} is ready.`, "success");
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

  const stageMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ChangeOpportunityStagePayload }) => changeOpportunityStage(id, payload),
    onSuccess: (opportunity, variables) => {
      setErrorMessage(null);
      void queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      void queryClient.invalidateQueries({ queryKey: ["opportunity", opportunity.id] });
      queryClient.setQueryData(["opportunity", opportunity.id], opportunity);

      if (variables.payload.lostReasonRefId) {
        showNotice("Opportunity Marked Lost", `Opportunity ${opportunity.opportunityNo} was marked as lost.`, "success");
        return;
      }

      const stageName = opportunity.opportunityStage.name ?? "updated stage";
      showNotice("Stage Updated", `Opportunity moved to ${stageName}.`, "success");
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, "Opportunity stage could not be updated.");
      setErrorMessage(message);
      showNotice("Stage Update Failed", message, "error");
    }
  });

  const noteMutation = useMutation({
    mutationFn: ({ id, noteText }: { id: string; noteText: string }) => addOpportunityNote(id, noteText, "SALES_NOTE"),
    onSuccess: (opportunity) => {
      setErrorMessage(null);
      noteForm.reset();
      void queryClient.invalidateQueries({ queryKey: ["opportunity", opportunity.id] });
      queryClient.setQueryData(["opportunity", opportunity.id], opportunity);
      showNotice("Note Added", "Opportunity note was saved successfully.", "success");
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, "Opportunity note could not be added.");
      setErrorMessage(message);
      showNotice("Note Not Added", message, "error");
    }
  });

  const siteVisitMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: SiteVisitFormValues }) =>
      scheduleSiteVisit(id, new Date(values.visitDate).toISOString(), pickString(values.proposedUnitCode), pickString(values.remarks)),
    onSuccess: (opportunity) => {
      setErrorMessage(null);
      siteVisitForm.reset();
      void queryClient.invalidateQueries({ queryKey: ["opportunity", opportunity.id] });
      queryClient.setQueryData(["opportunity", opportunity.id], opportunity);
      showNotice("Site Visit Scheduled", "Site visit was scheduled successfully.", "success");
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, "Site visit could not be scheduled.");
      setErrorMessage(message);
      showNotice("Site Visit Failed", message, "error");
    }
  });

  const selectedOpportunity = opportunityDetailQuery.data;
  const opportunityRows = opportunitiesQuery.data?.items ?? [];
  const isSelectedOpportunityLost =
    selectedOpportunity?.status === "LOST" || selectedOpportunity?.opportunityStage.name === "Lost" || Boolean(selectedOpportunity?.lostReason.id);
  const nextStageName = isSelectedOpportunityLost ? null : nextOpportunityStageName(selectedOpportunity?.opportunityStage.name);
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
    const open = opportunityRows.filter((opportunity) => opportunity.status === "OPEN").length;
    const totalBudget = opportunityRows.reduce(
      (sum, opportunity) => sum + toBase(opportunity.budgetAmount, opportunity.currencyCode),
      0
    );
    const avgProbability =
      opportunityRows.length === 0
        ? 0
        : Math.round(opportunityRows.reduce((sum, opportunity) => sum + (opportunity.probabilityPercent ?? 0), 0) / opportunityRows.length);

    return { total: opportunitiesQuery.data?.pagination.total ?? 0, open, totalBudget, avgProbability };
  }, [opportunitiesQuery.data?.pagination.total, opportunityRows, toBase]);

  const loadOpportunity = (opportunityId: string) => {
    setSelectedOpportunityId(opportunityId);
    setOpportunityDetailModalOpen(true);
  };

  const closeOpportunityDetailModal = () => {
    setOpportunityDetailModalOpen(false);
    setSelectedOpportunityId(null);
  };

  useEffect(() => {
    if (!opportunityDetailModalOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !noticeDialog.open) {
        event.preventDefault();
        closeOpportunityDetailModal();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [noticeDialog.open, opportunityDetailModalOpen]);

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
      setErrorMessage(message);
      showNotice("Visit Date Required", message, "error");
      return;
    }

    siteVisitMutation.mutate({ id: selectedOpportunityId, values });
  });

  const onLostSubmit = lostForm.handleSubmit((values) => {
    if (!selectedOpportunityId || !lostStage) return;

    if (!values.lostReasonRefId) {
      const message = "Lost reason is required when marking an opportunity as lost.";
      setErrorMessage(message);
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
          <div className="crm-kpi">{formatBaseAmount(stats.totalBudget)}</div>
        </article>
        <article className="crm-card">
          <h3>Avg Probability</h3>
          <div className="crm-kpi">{stats.avgProbability}%</div>
        </article>
      </section>

      {errorMessage ? <div className="crm-error-banner">{errorMessage}</div> : null}

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
                  <td>{formatBaseAmount(opportunity.budgetAmount, opportunity.currencyCode)}</td>
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
                <WorkflowTracker steps={opportunityWorkflowSteps(selectedOpportunity, formatBaseAmount)} />

                <dl className="crm-detail-list">
                  <div>
                    <dt>Lead</dt>
                    <dd>{selectedOpportunity.lead.leadNo ?? "-"}</dd>
                  </div>
                  <div>
                    <dt>Budget</dt>
                    <dd>{formatBaseAmount(selectedOpportunity.budgetAmount, selectedOpportunity.currencyCode)}</dd>
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
                    {selectedOpportunity.opportunityStage.name === "Reservation Ready" && !isSelectedOpportunityLost ? (
                      <section className="crm-opportunity-action-card crm-opportunity-action-card-wide">
                        <div className="crm-opportunity-action-card-header">
                          <h4>Continue to Reservation</h4>
                          <p className="crm-muted-text">
                            This opportunity is reservation-ready. Select an available unit and create the reservation from Reservations.
                          </p>
                        </div>
                        <div className="crm-opportunity-action-card-footer">
                          <button className="crm-primary-button crm-opportunity-action-button" onClick={() => navigate("/reservations")} type="button">
                            Continue to Reservations
                          </button>
                        </div>
                      </section>
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
                          <input className="crm-input crm-datetime-input" type="datetime-local" {...siteVisitForm.register("visitDate")} />
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

      <UnitPickerDialog
        onClose={() => setUnitPickerOpen(false)}
        onSelect={(unit) => siteVisitForm.setValue("proposedUnitCode", unit.unitCode)}
        open={unitPickerOpen}
        projectCode={selectedOpportunity?.projectCode}
      />
    </div>
  );
}
