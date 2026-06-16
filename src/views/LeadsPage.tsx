import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, type FieldValues, type Path, type UseFormRegister } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { assignLead, createLead, getLead, listLeads, qualifyLead, type CreateLeadPayload, type Lead, type QualifyLeadPayload } from "../api/leads";
import { convertLeadToOpportunity } from "../api/opportunities";
import { getReferenceFamily, type ReferenceDataItem } from "../api/reference-data";
import { WorkflowTracker, type WorkflowStep } from "../shared/WorkflowTracker";
import { useAuthStore } from "../store/auth-store";

type LeadFormValues = {
  leadTitle: string;
  contactName: string;
  mobileNo: string;
  whatsappNo: string;
  email: string;
  leadSourceRefId: string;
  captureChannelRefId: string;
  leadRatingRefId: string;
  buyerTypeRefId: string;
  fundingSourceRefId: string;
  budgetMin: string;
  budgetMax: string;
  preferredCurrencyCode: string;
  preferredProjectCode: string;
  preferredLocationCode: string;
  preferredUnitTypeRefId: string;
  purchaseTimelineRefId: string;
  qualificationNotes: string;
  scoreTotal: string;
  remarks: string;
};

type QualifyFormValues = {
  leadRatingRefId: string;
  buyerTypeRefId: string;
  fundingSourceRefId: string;
  purchaseTimelineRefId: string;
  budgetMin: string;
  budgetMax: string;
  scoreTotal: string;
  scoreEngagement: string;
  scoreBehavior: string;
  scoreFinancial: string;
  qualificationNotes: string;
};

function pickNumber(value: string) {
  const normalized = value.replace(/[% ,]/g, "").trim();
  return normalized === "" ? undefined : Number(normalized);
}

function pickString(value: string) {
  return value.trim() === "" ? undefined : value.trim();
}

function toCreatePayload(values: LeadFormValues): CreateLeadPayload {
  return {
    leadTitle: pickString(values.leadTitle),
    contactName: pickString(values.contactName),
    mobileNo: pickString(values.mobileNo),
    whatsappNo: pickString(values.whatsappNo),
    email: pickString(values.email),
    leadSourceRefId: pickString(values.leadSourceRefId),
    captureChannelRefId: pickString(values.captureChannelRefId),
    leadRatingRefId: pickString(values.leadRatingRefId),
    buyerTypeRefId: pickString(values.buyerTypeRefId),
    fundingSourceRefId: pickString(values.fundingSourceRefId),
    budgetMin: pickNumber(values.budgetMin),
    budgetMax: pickNumber(values.budgetMax),
    preferredCurrencyCode: pickString(values.preferredCurrencyCode),
    preferredProjectCode: pickString(values.preferredProjectCode),
    preferredLocationCode: pickString(values.preferredLocationCode),
    preferredUnitTypeRefId: pickString(values.preferredUnitTypeRefId),
    purchaseTimelineRefId: pickString(values.purchaseTimelineRefId),
    qualificationNotes: pickString(values.qualificationNotes),
    scoreTotal: pickNumber(values.scoreTotal),
    remarks: pickString(values.remarks)
  };
}

function toQualifyPayload(values: QualifyFormValues): QualifyLeadPayload {
  return {
    leadRatingRefId: pickString(values.leadRatingRefId),
    buyerTypeRefId: pickString(values.buyerTypeRefId),
    fundingSourceRefId: pickString(values.fundingSourceRefId),
    purchaseTimelineRefId: pickString(values.purchaseTimelineRefId),
    budgetMin: pickNumber(values.budgetMin),
    budgetMax: pickNumber(values.budgetMax),
    scoreTotal: pickNumber(values.scoreTotal),
    scoreEngagement: pickNumber(values.scoreEngagement),
    scoreBehavior: pickNumber(values.scoreBehavior),
    scoreFinancial: pickNumber(values.scoreFinancial),
    qualificationNotes: pickString(values.qualificationNotes)
  };
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "-";
}

function moneyRange(min: number | null, max: number | null, currency: string | null) {
  return `${min ?? "-"} - ${max ?? "-"} ${currency ?? ""}`.trim();
}

function leadNextAction(lead: Lead) {
  if (!lead.assignedAt && !lead.assignedToUser.id) {
    return {
      title: "Assign lead",
      summary: "Assign this lead to yourself before qualification so ownership and audit history are clear.",
      dataNeeded: "No extra data required."
    };
  }

  if (!lead.qualifiedAt) {
    return {
      title: "Qualify lead",
      summary: "Capture buyer type, funding, budget, timeline, score, and qualification notes.",
      dataNeeded: "Rating, buyer type, funding, timeline, budget, score, and notes."
    };
  }

  if (!lead.convertedAt) {
    return {
      title: "Convert to opportunity",
      summary: "Create the opportunity once the buyer details are qualified.",
      dataNeeded: "No extra data required. Conversion creates the opportunity record."
    };
  }

  return {
    title: "Continue in Opportunities",
    summary: "Lead work is complete. Continue the customer journey in the Opportunity module.",
    dataNeeded: "Stage, probability, notes, and site visits."
  };
}

function leadWorkflowSteps(lead: Lead): WorkflowStep[] {
  const isAssigned = Boolean(lead.assignedAt || lead.assignedToUser.id);
  const isQualified = Boolean(lead.qualifiedAt);
  const isConverted = Boolean(lead.convertedAt);

  return [
    {
      id: "captured",
      title: "Lead Captured",
      status: isAssigned || isQualified || isConverted ? "completed" : "current",
      timestamp: lead.capturedAt,
      user: lead.capturedByUser.name,
      role: "CRM User",
      summary: lead.remarks ?? lead.qualificationNotes,
      details: [
        { label: "Lead No", value: lead.leadNo },
        { label: "Contact", value: lead.contactName },
        { label: "Mobile", value: lead.mobileNo },
        { label: "Email", value: lead.email },
        { label: "Source", value: lead.leadSource.name },
        { label: "Channel", value: lead.captureChannel.name },
        { label: "Budget", value: moneyRange(lead.budgetMin, lead.budgetMax, lead.preferredCurrencyCode) },
        { label: "Project", value: lead.preferredProjectCode },
        { label: "Unit Type", value: lead.preferredUnitType.name }
      ]
    },
    {
      id: "assigned",
      title: "Assigned",
      status: isConverted || isQualified ? "completed" : isAssigned ? "current" : "next",
      timestamp: lead.assignedAt,
      user: lead.assignedByUser.name ?? lead.assignedToUser.name,
      role: "CRM User",
      summary: isAssigned ? "Lead is assigned for follow-up." : "Assign the lead to the current user.",
      details: [
        { label: "Assigned To", value: lead.assignedToUser.name },
        { label: "Assigned By", value: lead.assignedByUser.name }
      ]
    },
    {
      id: "qualified",
      title: "Qualified",
      status: isConverted ? "completed" : isQualified ? "current" : isAssigned ? "next" : "next",
      timestamp: lead.qualifiedAt,
      user: lead.qualifiedByUser.name,
      role: "CRM User",
      summary: lead.qualificationNotes,
      details: [
        { label: "Rating", value: lead.leadRating.name },
        { label: "Buyer Type", value: lead.buyerType.name },
        { label: "Funding", value: lead.fundingSource.name },
        { label: "Timeline", value: lead.purchaseTimeline.name },
        { label: "Score", value: lead.scoreTotal }
      ]
    },
    {
      id: "converted",
      title: "Converted",
      status: isConverted ? "completed" : isQualified ? "current" : "next",
      timestamp: lead.convertedAt,
      user: lead.convertedByUser.name,
      role: "CRM User",
      summary: isConverted ? "Lead has been converted to an opportunity." : "Convert the qualified lead into an opportunity.",
      details: [
        { label: "Customer", value: lead.customer.name },
        { label: "Lead Status", value: lead.leadStatus.name }
      ]
    },
    {
      id: "opportunity",
      title: "Opportunity",
      status: isConverted ? "current" : "next",
      timestamp: null,
      user: null,
      role: null,
      summary: isConverted ? "Continue this customer journey in Opportunities." : "This becomes available after conversion.",
      details: [
        { label: "Next Screen", value: "/opportunities" },
        { label: "Next Data", value: "Stage, probability, notes, and site visits" }
      ]
    },
    {
      id: "site-visit",
      title: "Site Visit",
      status: "next",
      timestamp: null,
      user: null,
      role: null,
      summary: "Schedule and complete the customer visit from Opportunity Detail.",
      details: [
        { label: "Required Before", value: "Opportunity" },
        { label: "Next Data", value: "Visit date, proposed unit, remarks" }
      ]
    },
    {
      id: "negotiation",
      title: "Negotiation",
      status: "next",
      timestamp: null,
      user: null,
      role: null,
      summary: "Move the opportunity stage when commercial discussion starts.",
      details: [
        { label: "Required Before", value: "Site Visit" },
        { label: "Next Data", value: "Probability and remarks" }
      ]
    },
    {
      id: "reservation-ready",
      title: "Reservation Ready",
      status: "next",
      timestamp: null,
      user: null,
      role: null,
      summary: "Move the opportunity to reservation-ready before selecting a unit.",
      details: [
        { label: "Required Before", value: "Proposal or negotiation" },
        { label: "Next Screen", value: "/reservations" }
      ]
    },
    {
      id: "reserved",
      title: "Reserved",
      status: "next",
      timestamp: null,
      user: null,
      role: null,
      summary: "Create the reservation from the Reservations screen using this opportunity and an available unit.",
      details: [
        { label: "Required Data", value: "Opportunity, available unit, amount, expiry" },
        { label: "Inventory Result", value: "Unit becomes Reserved" }
      ]
    }
  ];
}

function SelectField<TFormValues extends FieldValues>({
  label,
  name,
  options,
  register
}: {
  label: string;
  name: Path<TFormValues>;
  options: ReferenceDataItem[];
  register: UseFormRegister<TFormValues>;
}) {
  return (
    <label className="crm-field">
      <span className="crm-label">{label}</span>
      <select className="crm-input" {...register(name)}>
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.level2Name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function LeadsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [search, setSearch] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const leadSourcesQuery = useQuery({ queryKey: ["reference", "LEAD", "SOURCE"], queryFn: () => getReferenceFamily("LEAD", "SOURCE") });
  const leadRatingsQuery = useQuery({ queryKey: ["reference", "LEAD", "RATING"], queryFn: () => getReferenceFamily("LEAD", "RATING") });
  const buyerTypesQuery = useQuery({ queryKey: ["reference", "CUSTOMER", "BUYER_TYPE"], queryFn: () => getReferenceFamily("CUSTOMER", "BUYER_TYPE") });
  const fundingSourcesQuery = useQuery({ queryKey: ["reference", "CUSTOMER", "FUNDING_SOURCE"], queryFn: () => getReferenceFamily("CUSTOMER", "FUNDING_SOURCE") });
  const unitTypesQuery = useQuery({ queryKey: ["reference", "INVENTORY", "UNIT_TYPE"], queryFn: () => getReferenceFamily("INVENTORY", "UNIT_TYPE") });
  const timelinesQuery = useQuery({ queryKey: ["reference", "LEAD", "PURCHASE_TIMELINE"], queryFn: () => getReferenceFamily("LEAD", "PURCHASE_TIMELINE") });
  const channelsQuery = useQuery({ queryKey: ["reference", "COMMUNICATION", "CHANNEL"], queryFn: () => getReferenceFamily("COMMUNICATION", "CHANNEL") });

  const leadsQuery = useQuery({
    queryKey: ["leads", search],
    queryFn: () => listLeads(search),
    staleTime: 10_000
  });

  const leadDetailQuery = useQuery({
    queryKey: ["lead", selectedLeadId],
    queryFn: () => getLead(selectedLeadId ?? ""),
    enabled: Boolean(selectedLeadId)
  });

  const createForm = useForm<LeadFormValues>({
    defaultValues: {
      leadTitle: "",
      contactName: "",
      mobileNo: "",
      whatsappNo: "",
      email: "",
      leadSourceRefId: "",
      captureChannelRefId: "",
      leadRatingRefId: "",
      buyerTypeRefId: "",
      fundingSourceRefId: "",
      budgetMin: "",
      budgetMax: "",
      preferredCurrencyCode: "AED",
      preferredProjectCode: "",
      preferredLocationCode: "",
      preferredUnitTypeRefId: "",
      purchaseTimelineRefId: "",
      qualificationNotes: "",
      scoreTotal: "",
      remarks: ""
    }
  });

  const qualifyForm = useForm<QualifyFormValues>({
    defaultValues: {
      leadRatingRefId: "",
      buyerTypeRefId: "",
      fundingSourceRefId: "",
      purchaseTimelineRefId: "",
      budgetMin: "",
      budgetMax: "",
      scoreTotal: "",
      scoreEngagement: "",
      scoreBehavior: "",
      scoreFinancial: "",
      qualificationNotes: ""
    }
  });

  const createMutation = useMutation({
    mutationFn: createLead,
    onSuccess: (lead) => {
      setErrorMessage(null);
      setSelectedLeadId(lead.id);
      createForm.reset();
      setIsCreateOpen(false);
      queryClient.setQueryData(["lead", lead.id], lead);
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: () => setErrorMessage("Lead could not be created. Check required contact fields and reference values.")
  });

  const qualifyMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: QualifyLeadPayload }) => qualifyLead(id, payload),
    onSuccess: (lead) => {
      setErrorMessage(null);
      setSelectedLeadId(lead.id);
      queryClient.setQueryData(["lead", lead.id], lead);
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
      void queryClient.invalidateQueries({ queryKey: ["lead", lead.id] });
    },
    onError: () => setErrorMessage("Lead could not be qualified. Check budget, score, and reference values.")
  });

  const assignMutation = useMutation({
    mutationFn: (id: string) => {
      if (!user?.id) {
        throw new Error("Signed-in user is missing");
      }

      return assignLead(id, user.id, "Assigned from lead detail");
    },
    onSuccess: (lead) => {
      setErrorMessage(null);
      setSelectedLeadId(lead.id);
      queryClient.setQueryData(["lead", lead.id], lead);
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
      void queryClient.invalidateQueries({ queryKey: ["lead", lead.id] });
    },
    onError: () => setErrorMessage("Lead could not be assigned to the signed-in user.")
  });

  const convertMutation = useMutation({
    mutationFn: (id: string) =>
      convertLeadToOpportunity(id, {
        probabilityPercent: 35,
        remarks: "Converted from Lead module"
      }),
    onSuccess: (opportunity) => {
      setErrorMessage(null);
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
      void queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      navigate("/opportunities", { replace: false });
      window.setTimeout(() => {
        setSearch(opportunity.opportunityNo);
      }, 0);
    },
    onError: () => setErrorMessage("Lead could not be converted. Qualify the lead before conversion.")
  });

  const selectedLead = leadDetailQuery.data;
  const selectedLeadNextAction = selectedLead ? leadNextAction(selectedLead) : null;

  const stats = useMemo(() => {
    const leads = leadsQuery.data?.items ?? [];
    const assigned = leads.filter((lead) => lead.assignedToUser.id).length;
    const qualified = leads.filter((lead) => lead.qualifiedAt).length;
    const averageScore =
      leads.length === 0
        ? 0
        : Math.round(leads.reduce((sum, lead) => sum + (lead.scoreTotal ?? 0), 0) / leads.length);

    return { total: leadsQuery.data?.pagination.total ?? 0, assigned, qualified, averageScore };
  }, [leadsQuery.data]);

  const onCreate = createForm.handleSubmit((values) => createMutation.mutate(toCreatePayload(values)));
  const onQualify = qualifyForm.handleSubmit((values) => {
    if (!selectedLeadId || !selectedLead?.assignedToUser.id) {
      setErrorMessage("Assign the lead before completing qualification.");
      return;
    }

    qualifyMutation.mutate({ id: selectedLeadId, payload: toQualifyPayload(values) });
  });

  const leadRows = leadsQuery.data?.items ?? [];

  return (
    <div className="crm-workspace">
      <section className="crm-module-header">
        <div>
          <p className="crm-eyebrow">Lead Management</p>
          <h2>Lead Inbox</h2>
        </div>
        <button className="crm-primary-button crm-fit-button" onClick={() => setIsCreateOpen((value) => !value)} type="button">
          {isCreateOpen ? "Close Form" : "Create Lead"}
        </button>
      </section>

      <section className="crm-grid crm-metric-grid">
        <article className="crm-card">
          <h3>Total Leads</h3>
          <div className="crm-kpi">{stats.total}</div>
        </article>
        <article className="crm-card">
          <h3>Assigned</h3>
          <div className="crm-kpi">{stats.assigned}</div>
        </article>
        <article className="crm-card">
          <h3>Qualified</h3>
          <div className="crm-kpi">{stats.qualified}</div>
        </article>
        <article className="crm-card">
          <h3>Avg Score</h3>
          <div className="crm-kpi">{stats.averageScore}</div>
        </article>
      </section>

      {errorMessage ? <div className="crm-error-banner">{errorMessage}</div> : null}

      <section className="crm-panel">
        <div className="crm-panel-header">
          <h3>Inbox</h3>
          <input
            className="crm-input crm-search-input"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search lead, contact, phone, email"
            value={search}
          />
        </div>

        <div className="crm-table-wrap">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Rating</th>
                <th>Score</th>
                <th>Captured</th>
              </tr>
            </thead>
            <tbody>
              {leadRows.map((lead: Lead) => (
                <tr
                  className={selectedLeadId === lead.id ? "is-selected" : ""}
                  key={lead.id}
                  onClick={() => setSelectedLeadId(lead.id)}
                >
                  <td>
                    <strong>{lead.leadNo}</strong>
                    <span>{lead.leadSource.name ?? "No source"}</span>
                  </td>
                  <td>
                    <strong>{lead.contactName ?? "Unnamed lead"}</strong>
                    <span>{lead.mobileNo ?? lead.email ?? "-"}</span>
                  </td>
                  <td>{lead.leadStatus.name ?? "-"}</td>
                  <td>{lead.leadRating.name ?? "-"}</td>
                  <td>{lead.scoreTotal ?? "-"}</td>
                  <td>{formatDate(lead.capturedAt)}</td>
                </tr>
              ))}
              {leadRows.length === 0 ? (
                <tr>
                  <td className="crm-empty-cell" colSpan={6}>
                    No leads found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="crm-panel crm-lead-detail-wide">
          <h3>Lead Detail</h3>
          {selectedLead ? (
            <>
              <div className="crm-detail-title">
                <div>
                  <strong>{selectedLead.contactName ?? selectedLead.leadNo}</strong>
                  <span>{selectedLead.leadNo}</span>
                </div>
                <span className="crm-status-pill">{selectedLead.leadStatus.name ?? selectedLead.status}</span>
              </div>
              <WorkflowTracker steps={leadWorkflowSteps(selectedLead)} />
              <dl className="crm-detail-list">
                <div>
                  <dt>Phone</dt>
                  <dd>{selectedLead.mobileNo ?? "-"}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{selectedLead.email ?? "-"}</dd>
                </div>
                <div>
                  <dt>Budget</dt>
                  <dd>
                    {selectedLead.budgetMin ?? "-"} - {selectedLead.budgetMax ?? "-"} {selectedLead.preferredCurrencyCode ?? ""}
                  </dd>
                </div>
                <div>
                  <dt>Timeline</dt>
                  <dd>{selectedLead.purchaseTimeline.name ?? "-"}</dd>
                </div>
                <div>
                  <dt>Assigned</dt>
                  <dd>{selectedLead.assignedToUser.name ?? "Unassigned"}</dd>
                </div>
                <div>
                  <dt>Qualified</dt>
                  <dd>{formatDate(selectedLead.qualifiedAt)}</dd>
                </div>
              </dl>

              {selectedLeadNextAction ? (
                <section className="crm-next-action">
                  <div>
                    <span className="crm-label">Next Action</span>
                    <strong>{selectedLeadNextAction.title}</strong>
                    <p>{selectedLeadNextAction.summary}</p>
                  </div>
                  <div>
                    <span className="crm-label">Data Needed</span>
                    <p>{selectedLeadNextAction.dataNeeded}</p>
                  </div>
                </section>
              ) : null}

              <button
                className={`crm-full-button ${!selectedLead.assignedToUser.id ? "crm-primary-button" : "crm-secondary-button"}`}
                disabled={assignMutation.isPending || !user?.id || Boolean(selectedLead.assignedToUser.id)}
                onClick={() => assignMutation.mutate(selectedLead.id)}
                type="button"
              >
                {selectedLead.assignedToUser.id ? "Assigned" : assignMutation.isPending ? "Assigning..." : "Assign to me"}
              </button>

              <button
                className={`crm-full-button ${selectedLead.qualifiedAt && !selectedLead.convertedAt ? "crm-primary-button" : "crm-secondary-button"}`}
                disabled={convertMutation.isPending || !selectedLead.qualifiedAt || Boolean(selectedLead.convertedAt)}
                onClick={() => convertMutation.mutate(selectedLead.id)}
                type="button"
              >
                {selectedLead.convertedAt ? "Converted" : convertMutation.isPending ? "Converting..." : "Convert to Opportunity"}
              </button>
              {!selectedLead.qualifiedAt ? (
                <p className="crm-action-note">Convert is available after this lead is qualified.</p>
              ) : null}

              {selectedLead.convertedAt ? (
                <button className="crm-primary-button crm-fit-button" onClick={() => navigate("/opportunities")} type="button">
                  Continue in Opportunities
                </button>
              ) : null}

              {selectedLead.qualifiedAt ? (
                <section className="crm-activity-list">
                  <h4>Qualification Completed</h4>
                  <p className="crm-muted-text">
                    Qualified by {selectedLead.qualifiedByUser.name ?? "CRM user"} on {formatDate(selectedLead.qualifiedAt)}.
                  </p>
                </section>
              ) : (
                <form className="crm-form crm-compact-form" onSubmit={onQualify}>
                  <h4>Qualify</h4>
                  {!selectedLead.assignedToUser.id ? (
                    <p className="crm-action-note">Assign the lead first, then qualification can be completed.</p>
                  ) : null}
                  <SelectField label="Rating" name="leadRatingRefId" options={leadRatingsQuery.data ?? []} register={qualifyForm.register} />
                  <SelectField label="Buyer Type" name="buyerTypeRefId" options={buyerTypesQuery.data ?? []} register={qualifyForm.register} />
                  <SelectField label="Funding" name="fundingSourceRefId" options={fundingSourcesQuery.data ?? []} register={qualifyForm.register} />
                  <SelectField label="Timeline" name="purchaseTimelineRefId" options={timelinesQuery.data ?? []} register={qualifyForm.register} />
                  <div className="crm-two-col">
                    <label className="crm-field">
                      <span className="crm-label">Budget Min</span>
                      <input className="crm-input" {...qualifyForm.register("budgetMin")} />
                    </label>
                    <label className="crm-field">
                      <span className="crm-label">Budget Max</span>
                      <input className="crm-input" {...qualifyForm.register("budgetMax")} />
                    </label>
                  </div>
                  <label className="crm-field">
                    <span className="crm-label">Score</span>
                    <input className="crm-input" {...qualifyForm.register("scoreTotal")} />
                  </label>
                  <label className="crm-field">
                    <span className="crm-label">Notes</span>
                    <textarea className="crm-input crm-textarea" {...qualifyForm.register("qualificationNotes")} />
                  </label>
                  <button className="crm-primary-button" disabled={qualifyMutation.isPending || !selectedLead.assignedToUser.id} type="submit">
                    {qualifyMutation.isPending ? "Qualifying..." : "Qualify Lead"}
                  </button>
                </form>
              )}
            </>
          ) : (
            <p className="crm-muted-text">Select a lead to view details and qualification actions.</p>
          )}
      </section>

      {isCreateOpen ? (
        <section className="crm-panel">
          <div className="crm-panel-header">
            <h3>Create Lead</h3>
            <span className="crm-muted-text">Contact name, mobile, email, or existing customer is required.</span>
          </div>
          <form className="crm-form crm-lead-form" onSubmit={onCreate}>
            <label className="crm-field">
              <span className="crm-label">Lead Title</span>
              <input className="crm-input" {...createForm.register("leadTitle")} />
            </label>
            <label className="crm-field">
              <span className="crm-label">Contact Name</span>
              <input className="crm-input" {...createForm.register("contactName")} />
            </label>
            <label className="crm-field">
              <span className="crm-label">Mobile</span>
              <input className="crm-input" {...createForm.register("mobileNo")} />
            </label>
            <label className="crm-field">
              <span className="crm-label">WhatsApp</span>
              <input className="crm-input" {...createForm.register("whatsappNo")} />
            </label>
            <label className="crm-field">
              <span className="crm-label">Email</span>
              <input className="crm-input" {...createForm.register("email")} />
            </label>
            <SelectField label="Source" name="leadSourceRefId" options={leadSourcesQuery.data ?? []} register={createForm.register} />
            <SelectField label="Channel" name="captureChannelRefId" options={channelsQuery.data ?? []} register={createForm.register} />
            <SelectField label="Rating" name="leadRatingRefId" options={leadRatingsQuery.data ?? []} register={createForm.register} />
            <SelectField label="Buyer Type" name="buyerTypeRefId" options={buyerTypesQuery.data ?? []} register={createForm.register} />
            <SelectField label="Funding" name="fundingSourceRefId" options={fundingSourcesQuery.data ?? []} register={createForm.register} />
            <SelectField label="Unit Type" name="preferredUnitTypeRefId" options={unitTypesQuery.data ?? []} register={createForm.register} />
            <SelectField label="Timeline" name="purchaseTimelineRefId" options={timelinesQuery.data ?? []} register={createForm.register} />
            <label className="crm-field">
              <span className="crm-label">Budget Min</span>
              <input className="crm-input" {...createForm.register("budgetMin")} />
            </label>
            <label className="crm-field">
              <span className="crm-label">Budget Max</span>
              <input className="crm-input" {...createForm.register("budgetMax")} />
            </label>
            <label className="crm-field">
              <span className="crm-label">Currency</span>
              <input className="crm-input" {...createForm.register("preferredCurrencyCode")} />
            </label>
            <label className="crm-field">
              <span className="crm-label">Project Code</span>
              <input className="crm-input" {...createForm.register("preferredProjectCode")} />
            </label>
            <label className="crm-field crm-form-wide">
              <span className="crm-label">Qualification Notes</span>
              <textarea className="crm-input crm-textarea" {...createForm.register("qualificationNotes")} />
            </label>
            <label className="crm-field">
              <span className="crm-label">Score</span>
              <input className="crm-input" {...createForm.register("scoreTotal")} />
            </label>
            <button className="crm-primary-button crm-form-action" disabled={createMutation.isPending} type="submit">
              {createMutation.isPending ? "Creating..." : "Create Lead"}
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
