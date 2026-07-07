import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { listCurrencies } from "../api/currencies";
import { listUnits } from "../api/inventory";
import { listOpportunities } from "../api/opportunities";
import {
  acceptProposal,
  approveProposal,
  createProposal,
  getProposal,
  listProposals,
  rejectProposal,
  submitProposal,
  type Proposal
} from "../api/proposals";
import { useMoneyFormatter } from "../hooks/useCurrencyContext";
import { DEFAULT_LIST_PAGE_SIZE, DROPDOWN_LIST_LIMIT } from "../lib/list-pagination";
import { ListPagination } from "../shared/ListPagination";
import { WorkflowTracker, type WorkflowStep } from "../shared/WorkflowTracker";

type ProposalFormValues = {
  opportunityId: string;
  unitId: string;
  validUntil: string;
  currencyCode: string;
  listPrice: string;
  proposedPrice: string;
  discountAmount: string;
  discountPercent: string;
  approvalThresholdPercent: string;
  remarks: string;
};

type ActionFormValues = {
  remarks: string;
  rejectionReason: string;
};

function pickString(value: string) {
  return value.trim() === "" ? undefined : value.trim();
}

function pickNumber(value: string) {
  const normalized = value.replace(/[% ,]/g, "").trim();
  return normalized === "" ? undefined : Number(normalized);
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "-";
}

function proposalNextAction(proposal: Proposal) {
  const status = proposal.proposalStatus.code;
  if (status === "DRAFT") {
    return {
      title: "Submit proposal",
      summary: proposal.approvalRequired
        ? "Discount exceeds the threshold. Submit for approval before sharing acceptance."
        : "Submit the proposal for commercial review.",
      dataNeeded: "Confirm unit, price, discount, validity date, and remarks."
    };
  }
  if (status === "SUBMITTED") {
    return {
      title: "Approve or reject",
      summary: "Review proposed price and discount control before approving the proposal.",
      dataNeeded: proposal.approvalRequired ? "Approval decision is required." : "Commercial review decision."
    };
  }
  if (status === "APPROVED") {
    return {
      title: "Accept proposal",
      summary: "Mark accepted after the customer confirms the approved proposal.",
      dataNeeded: "Customer acceptance confirmation."
    };
  }
  if (status === "REJECTED") {
    return {
      title: "Revise and resubmit",
      summary: "Rejected proposals can be submitted again after commercial correction.",
      dataNeeded: "Updated price or discount justification."
    };
  }
  if (status === "ACCEPTED") {
    return {
      title: "Complete",
      summary: "Proposal has been accepted. Continue the customer journey toward reservation when ready.",
      dataNeeded: "No further proposal action required."
    };
  }
  return {
    title: "Closed",
    summary: "No active proposal action is available.",
    dataNeeded: "None."
  };
}

function proposalWorkflowSteps(
  proposal: Proposal,
  formatValue: (value: number | null | undefined, currencyCode?: string | null) => string
): WorkflowStep[] {
  const status = proposal.proposalStatus.code;
  const history = proposal.approvalHistory ?? [];
  const historyByToStatus = new Map(history.map((item) => [item.toStatus.code, item]));
  const isRejected = status === "REJECTED";
  const isAccepted = status === "ACCEPTED";
  const isApproved = status === "APPROVED" || isAccepted;
  const isSubmitted = status === "SUBMITTED" || isApproved || isRejected;

  return [
    {
      id: "draft",
      title: "Draft",
      status: isSubmitted ? "completed" : "current",
      timestamp: proposal.createdAt,
      user: proposal.createdBy.name,
      role: null,
      summary: proposal.remarks ?? "Proposal created from opportunity and unit pricing.",
      details: [
        { label: "Proposal", value: proposal.proposalNo },
        { label: "Opportunity", value: proposal.opportunity.opportunityNo },
        { label: "Customer", value: proposal.customer.name },
        { label: "Unit", value: proposal.unit.unitCode },
        { label: "Proposed", value: formatValue(proposal.proposedPrice, proposal.currencyCode) }
      ]
    },
    {
      id: "submitted",
      title: "Submitted",
      status: isRejected ? "blocked" : isApproved ? "completed" : status === "SUBMITTED" ? "current" : "next",
      timestamp: historyByToStatus.get("SUBMITTED")?.changedAt ?? null,
      user: historyByToStatus.get("SUBMITTED")?.changedByUser.name ?? null,
      role: historyByToStatus.get("SUBMITTED")?.approvalRoleCode ?? null,
      summary: isSubmitted ? historyByToStatus.get("SUBMITTED")?.remarks ?? "Proposal submitted for approval." : "Submit after price and validity are confirmed.",
      details: [
        { label: "Approval Required", value: proposal.approvalRequired ? "Yes" : "No" },
        { label: "Discount", value: proposal.discountPercent === null ? "-" : `${proposal.discountPercent}%` },
        { label: "Threshold", value: proposal.approvalThresholdPercent === null ? "-" : `${proposal.approvalThresholdPercent}%` }
      ]
    },
    {
      id: "approved",
      title: "Approved",
      status: isRejected ? "blocked" : isAccepted ? "completed" : status === "APPROVED" ? "current" : "next",
      timestamp: proposal.approvedAt ?? historyByToStatus.get("APPROVED")?.changedAt ?? null,
      user: proposal.approvedBy.name ?? historyByToStatus.get("APPROVED")?.changedByUser.name ?? null,
      role: historyByToStatus.get("APPROVED")?.approvalRoleCode ?? null,
      summary: isApproved ? historyByToStatus.get("APPROVED")?.remarks ?? "Proposal approved for customer acceptance." : "Approve after validating discount and commercial terms.",
      details: [
        { label: "List Price", value: formatValue(proposal.listPrice, proposal.currencyCode) },
        { label: "Discount Amount", value: formatValue(proposal.discountAmount, proposal.currencyCode) },
        { label: "Proposed Price", value: formatValue(proposal.proposedPrice, proposal.currencyCode) }
      ]
    },
    {
      id: "accepted",
      title: "Accepted",
      status: isRejected ? "blocked" : isAccepted ? "current" : "next",
      timestamp: proposal.acceptedAt,
      user: proposal.acceptedBy.name,
      role: null,
      summary: isAccepted ? "Customer accepted the approved proposal." : "Accept after customer confirmation.",
      details: [
        { label: "Accepted At", value: formatDate(proposal.acceptedAt) },
        { label: "Price Basis", value: proposal.priceBasis.name },
        { label: "Status", value: proposal.proposalStatus.name }
      ]
    }
  ];
}

export function ProposalsPage() {
  const queryClient = useQueryClient();
  const { formatInBase, defaultContractCurrency, toBase } = useMoneyFormatter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = DEFAULT_LIST_PAGE_SIZE;
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const proposalForm = useForm<ProposalFormValues>({
    defaultValues: {
      opportunityId: "",
      unitId: "",
      validUntil: "",
      currencyCode: defaultContractCurrency,
      listPrice: "",
      proposedPrice: "",
      discountAmount: "",
      discountPercent: "",
      approvalThresholdPercent: "5",
      remarks: ""
    }
  });
  const actionForm = useForm<ActionFormValues>({
    defaultValues: { remarks: "", rejectionReason: "" }
  });

  const proposalsQuery = useQuery({
    queryKey: ["proposals", search, page],
    queryFn: () =>
      listProposals({
        search: search || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize
      }),
    staleTime: 10_000
  });

  useEffect(() => {
    setPage(1);
  }, [search]);
  const proposalDetailQuery = useQuery({
    queryKey: ["proposal", selectedProposalId],
    queryFn: () => getProposal(selectedProposalId ?? ""),
    enabled: Boolean(selectedProposalId)
  });
  const opportunitiesQuery = useQuery({
    queryKey: ["opportunities", "proposal-select"],
    queryFn: () => listOpportunities({ limit: DROPDOWN_LIST_LIMIT }),
    staleTime: 10_000
  });
  const unitsQuery = useQuery({
    queryKey: ["units", "proposal-select"],
    queryFn: () => listUnits({ limit: DROPDOWN_LIST_LIMIT }),
    staleTime: 10_000
  });
  const currenciesQuery = useQuery({
    queryKey: ["currencies", "proposal-dropdown"],
    queryFn: () => listCurrencies({ dropdownOnly: true, activeOnly: true }),
    staleTime: 60_000
  });

  const proposalRows = proposalsQuery.data?.items ?? [];
  const currencyRows = currenciesQuery.data?.items ?? [];
  const selectedProposal = proposalDetailQuery.data ?? proposalRows.find((proposal) => proposal.id === selectedProposalId) ?? null;
  const selectedOpportunityId = proposalForm.watch("opportunityId");
  const selectedUnitId = proposalForm.watch("unitId");
  const selectedOpportunity = (opportunitiesQuery.data?.items ?? []).find((opportunity) => opportunity.id === selectedOpportunityId);
  const selectedUnit = (unitsQuery.data?.items ?? []).find((unit) => unit.id === selectedUnitId);
  const selectedProposalNextAction = selectedProposal ? proposalNextAction(selectedProposal) : null;
  const selectedProposalIsClosed =
    selectedProposal?.proposalStatus.code === "ACCEPTED" ||
    selectedProposal?.proposalStatus.code === "CANCELLED" ||
    selectedProposal?.proposalStatus.code === "EXPIRED";

  const stats = useMemo(() => {
    const total = proposalsQuery.data?.pagination.total ?? proposalRows.length;
    const approvalRequired = proposalRows.filter((proposal) => proposal.approvalRequired).length;
    const approved = proposalRows.filter((proposal) => ["APPROVED", "ACCEPTED"].includes(proposal.proposalStatus.code ?? "")).length;
    const value = proposalRows.reduce(
      (sum, proposal) => sum + toBase(proposal.proposedPrice, proposal.currencyCode),
      0
    );
    return { total, approvalRequired, approved, value };
  }, [proposalRows, proposalsQuery.data?.pagination.total, toBase]);

  const refreshProposal = (proposal: Proposal, successMessage: string) => {
    setMessage(successMessage);
    setSelectedProposalId(proposal.id);
    queryClient.setQueryData(["proposal", proposal.id], proposal);
    void queryClient.invalidateQueries({ queryKey: ["proposals"] });
    void queryClient.invalidateQueries({ queryKey: ["proposal", proposal.id] });
  };

  const createMutation = useMutation({
    mutationFn: (values: ProposalFormValues) =>
      createProposal({
        opportunityId: values.opportunityId,
        unitId: pickString(values.unitId),
        validUntil: pickString(values.validUntil),
        currencyCode: pickString(values.currencyCode),
        listPrice: pickNumber(values.listPrice),
        proposedPrice: pickNumber(values.proposedPrice),
        discountAmount: pickNumber(values.discountAmount),
        discountPercent: pickNumber(values.discountPercent),
        approvalThresholdPercent: pickNumber(values.approvalThresholdPercent),
        remarks: pickString(values.remarks)
      }),
    onSuccess: (proposal) => {
      setCreateOpen(false);
      proposalForm.reset({
        opportunityId: "",
        unitId: "",
        validUntil: "",
        currencyCode: defaultContractCurrency,
        listPrice: "",
        proposedPrice: "",
        discountAmount: "",
        discountPercent: "",
        approvalThresholdPercent: "5",
        remarks: ""
      });
      refreshProposal(proposal, "Proposal created.");
    },
    onError: () => setMessage("Proposal could not be created.")
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => submitProposal(id, pickString(actionForm.getValues("remarks"))),
    onSuccess: (proposal) => refreshProposal(proposal, "Proposal submitted."),
    onError: () => setMessage("Proposal could not be submitted.")
  });
  const approveMutation = useMutation({
    mutationFn: (id: string) => approveProposal(id, pickString(actionForm.getValues("remarks"))),
    onSuccess: (proposal) => refreshProposal(proposal, "Proposal approved."),
    onError: () => setMessage("Proposal could not be approved.")
  });
  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectProposal(id, actionForm.getValues("rejectionReason")),
    onSuccess: (proposal) => {
      actionForm.reset({ remarks: "", rejectionReason: "" });
      refreshProposal(proposal, "Proposal rejected.");
    },
    onError: () => setMessage("Proposal could not be rejected.")
  });
  const acceptMutation = useMutation({
    mutationFn: (id: string) => acceptProposal(id, pickString(actionForm.getValues("remarks"))),
    onSuccess: (proposal) => refreshProposal(proposal, "Proposal accepted."),
    onError: () => setMessage("Proposal could not be accepted.")
  });

  const onProposalSubmit = proposalForm.handleSubmit((values) => {
    if (!values.opportunityId) {
      setMessage("Select an opportunity.");
      return;
    }
    createMutation.mutate(values);
  });

  return (
    <div className="crm-workspace">
      <section className="crm-module-header">
        <div>
          <p className="crm-eyebrow">Pricing</p>
          <h2>Proposal Workspace</h2>
        </div>
        <button className="crm-primary-button" onClick={() => setCreateOpen(true)} type="button">
          New Proposal
        </button>
      </section>

      <section className="crm-grid crm-metric-grid">
        <article className="crm-card">
          <h3>Total</h3>
          <div className="crm-kpi">{stats.total}</div>
        </article>
        <article className="crm-card">
          <h3>Needs Approval</h3>
          <div className="crm-kpi">{stats.approvalRequired}</div>
        </article>
        <article className="crm-card">
          <h3>Approved</h3>
          <div className="crm-kpi">{stats.approved}</div>
        </article>
        <article className="crm-card">
          <h3>Proposal Value</h3>
          <div className="crm-kpi">{formatInBase(stats.value)}</div>
        </article>
      </section>

      {message ? <div className={message.includes("could not") ? "crm-error-banner" : "crm-info-banner"}>{message}</div> : null}

      {createOpen ? (
        <div className="crm-modal-backdrop" role="presentation">
      <section aria-modal="true" className="crm-modal crm-management-modal" role="dialog">
        <div className="crm-panel-header">
          <h3>Create Proposal</h3>
          <button className="crm-secondary-button" onClick={() => setCreateOpen(false)} type="button">Close</button>
        </div>
        <form className="crm-form crm-reservation-form" onSubmit={onProposalSubmit}>
          <label className="crm-field">
            <span className="crm-label">Opportunity</span>
            <select className="crm-input" {...proposalForm.register("opportunityId")}>
              <option value="">Select opportunity</option>
              {(opportunitiesQuery.data?.items ?? []).map((opportunity) => (
                <option key={opportunity.id} value={opportunity.id}>
                  {opportunity.opportunityNo} - {opportunity.customer.name}
                </option>
              ))}
            </select>
          </label>
          <label className="crm-field">
            <span className="crm-label">Unit</span>
            <select
              className="crm-input"
              {...proposalForm.register("unitId", {
                onChange: (event) => {
                  const unit = (unitsQuery.data?.items ?? []).find((item) => item.id === event.target.value);
                  if (unit) {
                    proposalForm.setValue("listPrice", String(unit.basePrice ?? ""));
                    proposalForm.setValue("currencyCode", unit.currencyCode ?? "USD");
                  }
                }
              })}
            >
              <option value="">Select unit</option>
              {(unitsQuery.data?.items ?? []).map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.unitCode} - {formatInBase(unit.basePrice, unit.currencyCode)}
                </option>
              ))}
            </select>
          </label>
          <label className="crm-field">
            <span className="crm-label">Valid Until</span>
            <input className="crm-input" type="date" {...proposalForm.register("validUntil")} />
          </label>
          <label className="crm-field">
            <span className="crm-label">Currency</span>
            <select className="crm-input" {...proposalForm.register("currencyCode")}>
              <option value="">Select currency</option>
              {currencyRows.map((currency) => (
                <option key={currency.id} value={currency.currencyCode}>
                  {currency.currencyCode} - {currency.currencyName}
                </option>
              ))}
            </select>
          </label>
          <label className="crm-field">
            <span className="crm-label">List Price</span>
            <input className="crm-input" {...proposalForm.register("listPrice")} />
          </label>
          <label className="crm-field">
            <span className="crm-label">Proposed Price</span>
            <input className="crm-input" {...proposalForm.register("proposedPrice")} />
          </label>
          <label className="crm-field">
            <span className="crm-label">Discount Amount</span>
            <input className="crm-input" {...proposalForm.register("discountAmount")} />
          </label>
          <label className="crm-field">
            <span className="crm-label">Discount %</span>
            <input className="crm-input" {...proposalForm.register("discountPercent")} />
          </label>
          <label className="crm-field">
            <span className="crm-label">Approval Threshold %</span>
            <input className="crm-input" {...proposalForm.register("approvalThresholdPercent")} />
          </label>
          <label className="crm-field crm-form-wide">
            <span className="crm-label">Remarks</span>
            <input className="crm-input" {...proposalForm.register("remarks")} />
          </label>
          <button className="crm-primary-button crm-form-action" disabled={createMutation.isPending} type="submit">
            {createMutation.isPending ? "Creating..." : "Create Proposal"}
          </button>
        </form>
        <dl className="crm-detail-list crm-inline-preview">
          <div>
            <dt>Opportunity</dt>
            <dd>{selectedOpportunity?.opportunityNo ?? "-"}</dd>
          </div>
          <div>
            <dt>Customer</dt>
            <dd>{selectedOpportunity?.customer.name ?? "-"}</dd>
          </div>
          <div>
            <dt>Unit Price</dt>
            <dd>{formatInBase(selectedUnit?.basePrice, selectedUnit?.currencyCode)}</dd>
          </div>
          <div>
            <dt>Unit Status</dt>
            <dd>{selectedUnit?.availabilityStatus.name ?? "-"}</dd>
          </div>
        </dl>
      </section>
        </div>
      ) : null}

      <section className="crm-panel">
        <div className="crm-panel-header">
          <h3>Proposal Register</h3>
          <input
            className="crm-input crm-search-input"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search proposal, opportunity, customer, unit"
            value={search}
          />
        </div>
        <div className="crm-table-wrap">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Proposal</th>
                <th>Customer</th>
                <th>Unit</th>
                <th>Status</th>
                <th>Discount</th>
                <th>Proposed</th>
              </tr>
            </thead>
            <tbody>
              {proposalRows.map((proposal) => (
                <tr
                  className={selectedProposalId === proposal.id ? "is-selected" : ""}
                  key={proposal.id}
                  onClick={() => setSelectedProposalId(proposal.id)}
                >
                  <td>
                    <strong>{proposal.proposalNo}</strong>
                    <span>{proposal.opportunity.opportunityNo}</span>
                  </td>
                  <td>{proposal.customer.name}</td>
                  <td>{proposal.unit.unitCode ?? "-"}</td>
                  <td>{proposal.proposalStatus.name}</td>
                  <td>{proposal.discountPercent === null ? "-" : `${proposal.discountPercent}%`}</td>
                  <td>{formatInBase(proposal.proposedPrice, proposal.currencyCode)}</td>
                </tr>
              ))}
              {proposalRows.length === 0 ? (
                <tr>
                  <td className="crm-empty-cell" colSpan={6}>
                    No proposals found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <ListPagination
          page={page}
          pageSize={pageSize}
          total={proposalsQuery.data?.pagination.total ?? 0}
          itemLabel="proposals"
          onPageChange={setPage}
        />
      </section>

      <section className="crm-panel crm-lead-detail-wide">
        <h3>Proposal Detail</h3>
        {selectedProposal ? (
          <>
            <div className="crm-detail-title">
              <div>
                <strong>{selectedProposal.customer.name}</strong>
                <span>{selectedProposal.proposalNo}</span>
              </div>
              <span className="crm-status-pill">{selectedProposal.proposalStatus.name}</span>
            </div>
            <WorkflowTracker steps={proposalWorkflowSteps(selectedProposal, formatInBase)} />
            <dl className="crm-detail-list">
              <div>
                <dt>Opportunity</dt>
                <dd>{selectedProposal.opportunity.opportunityNo}</dd>
              </div>
              <div>
                <dt>Unit</dt>
                <dd>{selectedProposal.unit.unitCode ?? "-"}</dd>
              </div>
              <div>
                <dt>List Price</dt>
                <dd>{formatInBase(selectedProposal.listPrice, selectedProposal.currencyCode)}</dd>
              </div>
              <div>
                <dt>Proposed Price</dt>
                <dd>{formatInBase(selectedProposal.proposedPrice, selectedProposal.currencyCode)}</dd>
              </div>
              <div>
                <dt>Discount</dt>
                <dd>
                  {formatInBase(selectedProposal.discountAmount, selectedProposal.currencyCode)} /{" "}
                  {selectedProposal.discountPercent === null ? "-" : `${selectedProposal.discountPercent}%`}
                </dd>
              </div>
              <div>
                <dt>Valid Until</dt>
                <dd>{selectedProposal.validUntil ?? "-"}</dd>
              </div>
            </dl>

            {selectedProposalNextAction ? (
              <section className="crm-next-action">
                <div>
                  <span className="crm-label">Next Action</span>
                  <strong>{selectedProposalNextAction.title}</strong>
                  <p>{selectedProposalNextAction.summary}</p>
                </div>
                <div>
                  <span className="crm-label">Data Needed</span>
                  <p>{selectedProposalNextAction.dataNeeded}</p>
                </div>
              </section>
            ) : null}

            {!selectedProposalIsClosed ? (
              <section className="crm-action-grid">
                <form className="crm-form crm-compact-form">
                  <h4>Workflow Actions</h4>
                  <label className="crm-field">
                    <span className="crm-label">Action Remarks</span>
                    <textarea className="crm-input crm-textarea" {...actionForm.register("remarks")} />
                  </label>
                  <button
                    className={`crm-full-button ${["DRAFT", "REJECTED"].includes(selectedProposal.proposalStatus.code ?? "") ? "crm-primary-button" : "crm-secondary-button"}`}
                    disabled={!["DRAFT", "REJECTED"].includes(selectedProposal.proposalStatus.code ?? "") || submitMutation.isPending}
                    onClick={() => submitMutation.mutate(selectedProposal.id)}
                    type="button"
                  >
                    Submit Proposal
                  </button>
                  <button
                    className={`crm-full-button ${selectedProposal.proposalStatus.code === "SUBMITTED" ? "crm-primary-button" : "crm-secondary-button"}`}
                    disabled={selectedProposal.proposalStatus.code !== "SUBMITTED" || approveMutation.isPending}
                    onClick={() => approveMutation.mutate(selectedProposal.id)}
                    type="button"
                  >
                    Approve Proposal
                  </button>
                  <button
                    className={`crm-full-button ${selectedProposal.proposalStatus.code === "APPROVED" ? "crm-primary-button" : "crm-secondary-button"}`}
                    disabled={selectedProposal.proposalStatus.code !== "APPROVED" || acceptMutation.isPending}
                    onClick={() => acceptMutation.mutate(selectedProposal.id)}
                    type="button"
                  >
                    Accept Proposal
                  </button>
                </form>

                <form className="crm-form crm-compact-form">
                  <h4>Rejection Control</h4>
                  <label className="crm-field">
                    <span className="crm-label">Rejection Reason</span>
                    <textarea className="crm-input crm-textarea" {...actionForm.register("rejectionReason")} />
                  </label>
                  <button
                    className="crm-secondary-button"
                    disabled={selectedProposal.proposalStatus.code !== "SUBMITTED" || rejectMutation.isPending}
                    onClick={() => {
                      if (actionForm.getValues("rejectionReason").trim() === "") {
                        setMessage("Enter rejection reason.");
                        return;
                      }
                      rejectMutation.mutate(selectedProposal.id);
                    }}
                    type="button"
                  >
                    Reject Proposal
                  </button>
                </form>

                <section className="crm-activity-list">
                  <h4>Approval History</h4>
                  {(selectedProposal.approvalHistory ?? []).map((item) => (
                    <article key={item.id}>
                      <strong>{item.approvalOutcome.name}</strong>
                      <span>{formatDate(item.changedAt)}</span>
                      <p>{item.remarks ?? "No remarks captured."}</p>
                    </article>
                  ))}
                  {(selectedProposal.approvalHistory ?? []).length === 0 ? (
                    <p className="crm-muted-text">No approval action captured.</p>
                  ) : null}
                </section>
              </section>
            ) : (
              <section className="crm-next-action">
                <div>
                  <span className="crm-label">Close-Off Stage</span>
                  <strong>Accepted</strong>
                  <p>Proposal workflow is complete for this baseline.</p>
                </div>
                <div>
                  <span className="crm-label">Accepted By</span>
                  <p>{selectedProposal.acceptedBy.name ?? "-"}</p>
                </div>
              </section>
            )}
          </>
        ) : (
          <p className="crm-muted-text">Select a proposal to review pricing, approval status, and workflow actions.</p>
        )}
      </section>
    </div>
  );
}
