import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import {
  addOpportunityNote,
  changeOpportunityStage,
  getOpportunity,
  listOpportunities,
  scheduleSiteVisit,
  type ChangeOpportunityStagePayload,
  type Opportunity
} from "../api/opportunities";
import { getReferenceFamily } from "../api/reference-data";

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

function pickString(value: string) {
  return value.trim() === "" ? undefined : value.trim();
}

function pickNumber(value: string) {
  return value.trim() === "" ? undefined : Number(value);
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "-";
}

export function OpportunitiesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stagesQuery = useQuery({
    queryKey: ["reference", "OPPORTUNITY", "STAGE"],
    queryFn: () => getReferenceFamily("OPPORTUNITY", "STAGE")
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

      <div className="crm-lead-layout">
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

        <aside className="crm-panel crm-detail-panel">
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

              <form className="crm-form crm-compact-form" onSubmit={onStageSubmit}>
                <h4>Move Stage</h4>
                <label className="crm-field">
                  <span className="crm-label">Stage</span>
                  <select className="crm-input" {...stageForm.register("opportunityStageRefId")}>
                    <option value="">Select</option>
                    {(stagesQuery.data ?? []).map((stage) => (
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
                <button className="crm-primary-button" disabled={stageMutation.isPending} type="submit">
                  {stageMutation.isPending ? "Moving..." : "Move Stage"}
                </button>
              </form>

              <form className="crm-form crm-compact-form" onSubmit={onNoteSubmit}>
                <h4>Add Note</h4>
                <textarea className="crm-input crm-textarea" {...noteForm.register("noteText")} />
                <button className="crm-secondary-button crm-full-button" disabled={noteMutation.isPending} type="submit">
                  {noteMutation.isPending ? "Adding..." : "Add Note"}
                </button>
              </form>

              <form className="crm-form crm-compact-form" onSubmit={onSiteVisitSubmit}>
                <h4>Schedule Visit</h4>
                <input className="crm-input" type="datetime-local" {...siteVisitForm.register("visitDate")} />
                <input className="crm-input" placeholder="Proposed unit" {...siteVisitForm.register("proposedUnitCode")} />
                <textarea className="crm-input crm-textarea" placeholder="Visit remarks" {...siteVisitForm.register("remarks")} />
                <button className="crm-secondary-button crm-full-button" disabled={siteVisitMutation.isPending} type="submit">
                  {siteVisitMutation.isPending ? "Scheduling..." : "Schedule Visit"}
                </button>
              </form>

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
        </aside>
      </div>
    </div>
  );
}
