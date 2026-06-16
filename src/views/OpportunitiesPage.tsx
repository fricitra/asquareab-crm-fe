import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
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

const opportunityStageOrder = ["Open", "Qualified", "Site Visit", "Negotiation", "Proposal", "Reservation Ready"];

function opportunityWorkflowSteps(opportunity: OpportunityDetail): WorkflowStep[] {
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
        { label: "Budget", value: opportunity.budgetAmount ? `${opportunity.budgetAmount.toLocaleString()} ${opportunity.currencyCode ?? ""}` : null },
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stagesQuery = useQuery({
    queryKey: ["reference", "OPPORTUNITY", "STAGE"],
    queryFn: () => getReferenceFamily("OPPORTUNITY", "STAGE")
  });

  const lostReasonsQuery = useQuery({
    queryKey: ["reference", "OPPORTUNITY", "LOST_REASON"],
    queryFn: () => getReferenceFamily("OPPORTUNITY", "LOST_REASON")
  });

  const opportunitiesQuery = useQuery({
    queryKey: ["opportunities", search],
    queryFn: () => listOpportunities(search),
    staleTime: 10_000
  });

  const opportunityDetailQuery = useQuery({
    queryKey: ["opportunity", selectedOpportunityId],
    queryFn: () => getOpportunity(selectedOpportunityId ?? ""),
    enabled: Boolean(selectedOpportunityId)
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
    onSuccess: (opportunity) => {
      setErrorMessage(null);
      void queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      void queryClient.invalidateQueries({ queryKey: ["opportunity", opportunity.id] });
    },
    onError: () => setErrorMessage("Opportunity stage could not be updated.")
  });

  const noteMutation = useMutation({
    mutationFn: ({ id, noteText }: { id: string; noteText: string }) => addOpportunityNote(id, noteText, "SALES_NOTE"),
    onSuccess: (opportunity) => {
      setErrorMessage(null);
      noteForm.reset();
      void queryClient.invalidateQueries({ queryKey: ["opportunity", opportunity.id] });
    },
    onError: () => setErrorMessage("Opportunity note could not be added.")
  });

  const siteVisitMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: SiteVisitFormValues }) =>
      scheduleSiteVisit(id, new Date(values.visitDate).toISOString(), pickString(values.proposedUnitCode), pickString(values.remarks)),
    onSuccess: (opportunity) => {
      setErrorMessage(null);
      siteVisitForm.reset();
      void queryClient.invalidateQueries({ queryKey: ["opportunity", opportunity.id] });
    },
    onError: () => setErrorMessage("Site visit could not be scheduled.")
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
    const totalBudget = opportunityRows.reduce((sum, opportunity) => sum + (opportunity.budgetAmount ?? 0), 0);
    const avgProbability =
      opportunityRows.length === 0
        ? 0
        : Math.round(opportunityRows.reduce((sum, opportunity) => sum + (opportunity.probabilityPercent ?? 0), 0) / opportunityRows.length);

    return { total: opportunitiesQuery.data?.pagination.total ?? 0, open, totalBudget, avgProbability };
  }, [opportunitiesQuery.data?.pagination.total, opportunityRows]);

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
    if (!selectedOpportunityId || !values.visitDate) return;
    siteVisitMutation.mutate({ id: selectedOpportunityId, values });
  });

  const onLostSubmit = lostForm.handleSubmit((values) => {
    if (!selectedOpportunityId || !lostStage || !values.lostReasonRefId) return;

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
          <h2>Opportunities</h2>
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
          <div className="crm-kpi">{stats.totalBudget.toLocaleString()}</div>
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
                  className={selectedOpportunityId === opportunity.id ? "is-selected" : ""}
                  key={opportunity.id}
                  onClick={() => setSelectedOpportunityId(opportunity.id)}
                >
                  <td>
                    <strong>{opportunity.opportunityNo}</strong>
                    <span>{opportunity.lead.leadNo ?? "Manual opportunity"}</span>
                  </td>
                  <td>{opportunity.customer.name ?? "-"}</td>
                  <td>{opportunity.opportunityStage.name ?? "-"}</td>
                  <td>{opportunity.probabilityPercent ?? "-"}%</td>
                  <td>
                    {opportunity.budgetAmount?.toLocaleString() ?? "-"} {opportunity.currencyCode ?? ""}
                  </td>
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
      </section>

      <section className="crm-panel crm-lead-detail-wide">
          <h3>Opportunity Detail</h3>
          {selectedOpportunity ? (
            <>
              <div className="crm-detail-title">
                <div>
                  <strong>{selectedOpportunity.customer.name ?? selectedOpportunity.opportunityNo}</strong>
                  <span>{selectedOpportunity.opportunityNo}</span>
                </div>
                <span className="crm-status-pill">{selectedOpportunity.opportunityStage.name ?? selectedOpportunity.status}</span>
              </div>
              <WorkflowTracker steps={opportunityWorkflowSteps(selectedOpportunity)} />

              <dl className="crm-detail-list">
                <div>
                  <dt>Lead</dt>
                  <dd>{selectedOpportunity.lead.leadNo ?? "-"}</dd>
                </div>
                <div>
                  <dt>Budget</dt>
                  <dd>
                    {selectedOpportunity.budgetAmount?.toLocaleString() ?? "-"} {selectedOpportunity.currencyCode ?? ""}
                  </dd>
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

              <div className="crm-action-grid">
                {selectedOpportunity.opportunityStage.name === "Reservation Ready" && !isSelectedOpportunityLost ? (
                  <section className="crm-form crm-compact-form">
                    <h4>Continue to Reservation</h4>
                    <p className="crm-muted-text">
                      This opportunity is reservation-ready. Select an available unit and create the reservation from Reservations.
                    </p>
                    <button className="crm-primary-button" onClick={() => navigate("/reservations")} type="button">
                      Continue to Reservations
                    </button>
                  </section>
                ) : (
                  <form className="crm-form crm-compact-form" onSubmit={onStageSubmit}>
                    <h4>{nextStageName ? `Move to ${nextStageName}` : "Stage Complete"}</h4>
                    <p className="crm-muted-text">
                      Current stage: {selectedOpportunity.opportunityStage.name ?? "-"}
                      {nextStageName ? `. Next stage: ${nextStageName}.` : ". No further forward stage is configured."}
                    </p>
                    <label className="crm-field">
                      <span className="crm-label">Stage</span>
                      <select className="crm-input" {...stageForm.register("opportunityStageRefId")}>
                        <option value="">Select</option>
                        {(stagesQuery.data ?? [])
                          .filter((stage) => stage.level2Name !== "Lost" && opportunityStageOrder.includes(stage.level2Name))
                          .map((stage) => (
                            <option key={stage.id} value={stage.id}>
                              {stage.level2Name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="crm-field">
                      <span className="crm-label">Probability</span>
                      <input className="crm-input" {...stageForm.register("probabilityPercent")} />
                    </label>
                    <label className="crm-field">
                      <span className="crm-label">Remarks</span>
                      <textarea className="crm-input crm-textarea" {...stageForm.register("remarks")} />
                    </label>
                    <button className="crm-primary-button" disabled={stageMutation.isPending || !nextStageName} type="submit">
                      {stageMutation.isPending ? "Moving..." : nextStageName ? `Move to ${nextStageName}` : "Stage Complete"}
                    </button>
                  </form>
                )}

                <form className="crm-form crm-compact-form" onSubmit={onNoteSubmit}>
                  <h4>Add Note</h4>
                  <textarea className="crm-input crm-textarea" {...noteForm.register("noteText")} />
                  <button className="crm-secondary-button crm-full-button" disabled={noteMutation.isPending} type="submit">
                    {noteMutation.isPending ? "Adding..." : "Add Note"}
                  </button>
                </form>

                <form className="crm-form crm-compact-form" onSubmit={onSiteVisitSubmit}>
                  <h4>Schedule Visit</h4>
                  <p className="crm-muted-text">Multiple visits are allowed and recorded as activity history.</p>
                  <input className="crm-input" type="datetime-local" {...siteVisitForm.register("visitDate")} />
                  <input className="crm-input" placeholder="Proposed unit" {...siteVisitForm.register("proposedUnitCode")} />
                  <textarea className="crm-input crm-textarea" placeholder="Visit remarks" {...siteVisitForm.register("remarks")} />
                  <button className="crm-secondary-button crm-full-button" disabled={siteVisitMutation.isPending} type="submit">
                    {siteVisitMutation.isPending ? "Scheduling..." : "Schedule Visit"}
                  </button>
                </form>

                <form className="crm-form crm-compact-form" onSubmit={onLostSubmit}>
                  <h4>Mark Lost</h4>
                  <p className="crm-muted-text">Use this if the customer drops out at any stage.</p>
                  <label className="crm-field">
                    <span className="crm-label">Lost Reason</span>
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
                    <textarea className="crm-input crm-textarea" {...lostForm.register("remarks")} disabled={isSelectedOpportunityLost} />
                  </label>
                  <button
                    className="crm-secondary-button crm-full-button"
                    disabled={stageMutation.isPending || isSelectedOpportunityLost || !lostStage}
                    type="submit"
                  >
                    {isSelectedOpportunityLost ? "Marked Lost" : "Mark Lost"}
                  </button>
                </form>
              </div>

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
            </>
          ) : (
            <p className="crm-muted-text">Select an opportunity to manage stage, notes, and site visits.</p>
          )}
      </section>
    </div>
  );
}
