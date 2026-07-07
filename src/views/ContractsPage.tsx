import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { listCurrencies } from "../api/currencies";
import {
  cancelContract,
  createContract,
  createPaymentPlan,
  getContract,
  issueContract,
  listContracts,
  markErpHandoffCompleted,
  markErpHandoffFailed,
  markErpHandoffReady,
  signContract,
  type Contract
} from "../api/contracts";
import { listReservations } from "../api/reservations";
import { useMoneyFormatter } from "../hooks/useCurrencyContext";
import { DEFAULT_LIST_PAGE_SIZE, DROPDOWN_LIST_LIMIT } from "../lib/list-pagination";
import { ListPagination } from "../shared/ListPagination";
import { WorkflowTracker, type WorkflowStep } from "../shared/WorkflowTracker";

type ContractFormValues = {
  reservationId: string;
  contractValue: string;
  currencyCode: string;
  remarks: string;
};

type PaymentPlanFormValues = {
  planName: string;
  line1Label: string;
  line1DueDate: string;
  line1Amount: string;
  line1Percent: string;
  line2Label: string;
  line2DueDate: string;
  line2Amount: string;
  line2Percent: string;
  remarks: string;
};

type ErpFormValues = {
  erpContractId: string;
  errorMessage: string;
  remarks: string;
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

function contractNextAction(contract: Contract) {
  if (contract.contractStatus.code === "CANCELLED") {
    return {
      title: "Contract cancelled",
      summary: "No further workflow action is available for this contract.",
      dataNeeded: "None."
    };
  }
  if (contract.contractStatus.code === "DRAFT") {
    return {
      title: "Issue contract",
      summary: "Issue the contract after confirming the reservation, unit, buyer, and contract value.",
      dataNeeded: "No additional data required."
    };
  }
  if (contract.contractStatus.code === "ISSUED") {
    return {
      title: "Sign contract",
      summary: "Mark the contract signed after the buyer and authorized team complete the agreement.",
      dataNeeded: "No additional data required for baseline signing."
    };
  }
  if (contract.erpHandoffStatus === "HANDED_OFF") {
    return {
      title: "Complete",
      summary: "The contract has reached the CRM baseline close-off stage. ERP has accepted the handoff.",
      dataNeeded: "None."
    };
  }
  if (contract.erpHandoffStatus === "READY") {
    return {
      title: "Mark handed off",
      summary: "The CRM payload is ready. Mark handed off once ERP accepts the contract payload. This moves the workflow to the close-off stage.",
      dataNeeded: "ERP Contract ID is optional in this baseline."
    };
  }
  if (contract.erpHandoffStatus === "FAILED") {
    return {
      title: "Resolve ERP handoff",
      summary: "Review the ERP error, correct the payload or external issue, then mark ready again or hand off after ERP accepts it.",
      dataNeeded: contract.erpHandoff?.errorMessage ?? "ERP failure reason."
    };
  }
  if ((contract.paymentPlans ?? []).length === 0) {
    return {
      title: "Save payment plan",
      summary: "Create the commercial payment schedule before preparing the ERP handoff.",
      dataNeeded: "Milestones, due dates, amounts, and percentages."
    };
  }
  return {
    title: "Mark ERP ready",
    summary: "Prepare the signed contract and payment-plan payload for ERP handoff.",
    dataNeeded: "No additional data required."
  };
}

function contractWorkflowSteps(
  contract: Contract,
  formatValue: (value: number | null, currencyCode: string | null) => string
): WorkflowStep[] {
  const status = contract.contractStatus.code;
  const history = contract.statusHistory ?? [];
  const historyByCode = new Map(history.map((item) => [item.contractStatus.code, item]));
  const isCancelled = status === "CANCELLED";
  const isIssued = status === "ISSUED" || status === "SIGNED";
  const isSigned = status === "SIGNED";
  const handoffStarted = ["READY", "HANDED_OFF", "FAILED"].includes(contract.erpHandoffStatus);
  const handoffReady = contract.erpHandoffStatus === "READY" || contract.erpHandoffStatus === "HANDED_OFF";
  const handoffFailed = contract.erpHandoffStatus === "FAILED";
  const handedOff = contract.erpHandoffStatus === "HANDED_OFF";

  return [
    {
      id: "draft",
      title: "Draft",
      status: isCancelled || isIssued || isSigned ? "completed" : "current",
      timestamp: contract.createdAt,
      user: contract.createdBy.name,
      role: contract.createdBy.role,
      summary: contract.remarks ?? "Contract baseline created from approved reservation.",
      details: [
        { label: "Contract", value: contract.contractNo },
        { label: "Reservation", value: contract.reservation.reservationNo },
        { label: "Customer", value: contract.customer.name },
        { label: "Unit", value: contract.unit.unitCode },
        { label: "Value", value: formatValue(contract.contractValue, contract.currencyCode) }
      ]
    },
    {
      id: "issued",
      title: "Issued",
      status: isCancelled ? "blocked" : isSigned ? "completed" : status === "ISSUED" ? "current" : "next",
      timestamp: historyByCode.get("ISSUED")?.changedAt ?? null,
      user: historyByCode.get("ISSUED")?.changedByUser.name ?? null,
      role: historyByCode.get("ISSUED")?.changedByUser.role ?? null,
      summary: isIssued ? historyByCode.get("ISSUED")?.remarks ?? "Contract has been issued for signing." : "Issue the draft contract after checking buyer and unit details.",
      details: [{ label: "Current Status", value: contract.contractStatus.name }]
    },
    {
      id: "signed",
      title: "Signed",
      status: isCancelled ? "blocked" : isSigned && handoffStarted ? "completed" : isSigned ? "current" : "next",
      timestamp: contract.signedAt,
      user: contract.signedBy.name,
      role: null,
      summary: isSigned ? "Contract is signed and can be prepared for ERP handoff." : "Sign after final agreement is confirmed.",
      details: [
        { label: "Signed At", value: formatDate(contract.signedAt) },
        { label: "ERP Handoff", value: contract.erpHandoffStatus }
      ]
    },
    {
      id: "erp-ready",
      title: "ERP Ready",
      status: isCancelled ? "blocked" : handedOff ? "completed" : handoffReady || handoffFailed ? "current" : "next",
      timestamp: contract.erpHandoff?.lastAttemptedAt ?? null,
      user: contract.updatedBy.name,
      role: contract.updatedBy.role,
      summary: handoffFailed
        ? contract.erpHandoff?.errorMessage ?? "ERP handoff failed and needs correction."
        : handoffReady
          ? "Contract payload is prepared for ERP handoff."
          : "Mark ready only after contract signing and payment plan preparation.",
      details: [
        { label: "Handoff Status", value: contract.erpHandoffStatus },
        { label: "Retry Count", value: contract.erpHandoff?.retryCount ?? 0 }
      ]
    },
    {
      id: "handed-off",
      title: "Handed Off",
      status: isCancelled ? "blocked" : handedOff ? "current" : "next",
      timestamp: contract.erpHandoff?.handedOffAt ?? null,
      user: contract.updatedBy.name,
      role: contract.updatedBy.role,
      summary: handedOff ? "ERP handoff has been marked complete." : "Mark complete after ERP accepts the contract payload.",
      details: [
        { label: "ERP Contract", value: contract.erpContractId },
        { label: "Last Error", value: contract.erpHandoff?.errorMessage }
      ]
    }
  ];
}

export function ContractsPage() {
  const queryClient = useQueryClient();
  const { formatInBase, defaultContractCurrency, toBase } = useMoneyFormatter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = DEFAULT_LIST_PAGE_SIZE;
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const contractForm = useForm<ContractFormValues>({
    defaultValues: { reservationId: "", contractValue: "", currencyCode: defaultContractCurrency, remarks: "" }
  });
  const paymentPlanForm = useForm<PaymentPlanFormValues>({
    defaultValues: {
      planName: "Standard Payment Plan",
      line1Label: "Booking",
      line1DueDate: "",
      line1Amount: "",
      line1Percent: "",
      line2Label: "Handover",
      line2DueDate: "",
      line2Amount: "",
      line2Percent: "",
      remarks: ""
    }
  });
  const erpForm = useForm<ErpFormValues>({
    defaultValues: { erpContractId: "", errorMessage: "", remarks: "" }
  });

  const contractsQuery = useQuery({
    queryKey: ["contracts", search, page],
    queryFn: () =>
      listContracts({
        search: search || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize
      }),
    staleTime: 10_000
  });

  useEffect(() => {
    setPage(1);
  }, [search]);
  const contractDetailQuery = useQuery({
    queryKey: ["contract", selectedContractId],
    queryFn: () => getContract(selectedContractId ?? ""),
    enabled: Boolean(selectedContractId)
  });
  const reservationsQuery = useQuery({
    queryKey: ["reservations", "contract-select"],
    queryFn: () => listReservations({ limit: DROPDOWN_LIST_LIMIT }),
    staleTime: 10_000
  });
  const currenciesQuery = useQuery({
    queryKey: ["currencies", "contract-dropdown"],
    queryFn: () => listCurrencies({ contractAllowed: true, activeOnly: true }),
    staleTime: 60_000
  });

  const refreshContract = (contract: Contract, successMessage: string) => {
    setMessage(successMessage);
    setSelectedContractId(contract.id);
    queryClient.setQueryData(["contract", contract.id], contract);
    void queryClient.invalidateQueries({ queryKey: ["contracts"] });
    void queryClient.invalidateQueries({ queryKey: ["contract", contract.id] });
    void queryClient.invalidateQueries({ queryKey: ["reservations"] });
  };

  const createMutation = useMutation({
    mutationFn: (values: ContractFormValues) =>
      createContract({
        reservationId: values.reservationId,
        contractValue: pickNumber(values.contractValue),
        currencyCode: pickString(values.currencyCode),
        remarks: pickString(values.remarks)
      }),
    onSuccess: (contract) => {
      setCreateOpen(false);
      refreshContract(contract, "Contract draft is ready.");
      contractForm.reset({ reservationId: "", contractValue: "", currencyCode: defaultContractCurrency, remarks: "" });
    },
    onError: () => setMessage("Contract could not be created. Use an approved reservation.")
  });

  const issueMutation = useMutation({
    mutationFn: (contractId: string) => issueContract(contractId, "Contract issued from CRM workspace"),
    onSuccess: (contract) => refreshContract(contract, "Contract issued."),
    onError: () => setMessage("Contract could not be issued.")
  });
  const signMutation = useMutation({
    mutationFn: (contractId: string) => signContract(contractId, "Contract signed from CRM workspace"),
    onSuccess: (contract) => refreshContract(contract, "Contract signed."),
    onError: () => setMessage("Contract could not be signed.")
  });
  const cancelMutation = useMutation({
    mutationFn: (contractId: string) => cancelContract(contractId, "Contract cancelled from CRM workspace"),
    onSuccess: (contract) => refreshContract(contract, "Contract cancelled."),
    onError: () => setMessage("Contract could not be cancelled.")
  });
  const paymentPlanMutation = useMutation({
    mutationFn: ({ contractId, currencyCode, values }: { contractId: string; currencyCode: string | null; values: PaymentPlanFormValues }) => {
      const firstAmount = pickNumber(values.line1Amount);
      const secondAmount = pickNumber(values.line2Amount);
      return createPaymentPlan(contractId, {
        planName: values.planName,
        currencyCode: currencyCode ?? "USD",
        remarks: pickString(values.remarks),
        lines: [
          {
            sequenceNo: 1,
            milestoneLabel: pickString(values.line1Label),
            dueDate: pickString(values.line1DueDate),
            amount: firstAmount ?? 0,
            percentageOfContract: pickNumber(values.line1Percent)
          },
          {
            sequenceNo: 2,
            milestoneLabel: pickString(values.line2Label),
            dueDate: pickString(values.line2DueDate),
            amount: secondAmount ?? 0,
            percentageOfContract: pickNumber(values.line2Percent)
          }
        ].filter((line) => line.amount > 0)
      });
    },
    onSuccess: (contract) => refreshContract(contract, "Payment plan saved."),
    onError: () => setMessage("Payment plan could not be saved. Check total amount and required lines.")
  });
  const readyMutation = useMutation({
    mutationFn: (contractId: string) => markErpHandoffReady(contractId, "Contract payload prepared for ERP"),
    onSuccess: (contract) => refreshContract(contract, "ERP handoff marked ready."),
    onError: () => setMessage("ERP handoff could not be marked ready. Sign the contract first.")
  });
  const completeMutation = useMutation({
    mutationFn: ({ contractId, values }: { contractId: string; values: ErpFormValues }) =>
      markErpHandoffCompleted(contractId, pickString(values.erpContractId), pickString(values.remarks)),
    onSuccess: (contract) => refreshContract(contract, "ERP handoff marked complete."),
    onError: () => setMessage("ERP handoff could not be marked complete.")
  });
  const failedMutation = useMutation({
    mutationFn: ({ contractId, values }: { contractId: string; values: ErpFormValues }) =>
      markErpHandoffFailed(contractId, values.errorMessage, pickString(values.remarks)),
    onSuccess: (contract) => refreshContract(contract, "ERP handoff marked failed."),
    onError: () => setMessage("ERP handoff failure could not be recorded.")
  });

  const contractRows = contractsQuery.data?.items ?? [];
  const currencyRows = currenciesQuery.data?.items ?? [];
  const selectedContract = contractDetailQuery.data;
  const selectedContractNextAction = selectedContract ? contractNextAction(selectedContract) : null;
  const selectedContractIsClosed = selectedContract?.erpHandoffStatus === "HANDED_OFF";
  const availableReservations =
    reservationsQuery.data?.items.filter((reservation) =>
      ["APPROVED", "CONVERTED_TO_CONTRACT"].includes(reservation.reservationStatus.code ?? "")
    ) ?? [];

  const stats = useMemo(() => {
    const total = contractsQuery.data?.pagination.total ?? 0;
    const draft = contractRows.filter((contract) => contract.contractStatus.code === "DRAFT").length;
    const signed = contractRows.filter((contract) => contract.contractStatus.code === "SIGNED").length;
    const value = contractRows.reduce(
      (sum, contract) => sum + toBase(contract.contractValue, contract.currencyCode),
      0
    );
    return { total, draft, signed, value };
  }, [contractRows, contractsQuery.data?.pagination.total, toBase]);

  const onContractSubmit = contractForm.handleSubmit((values) => {
    if (!values.reservationId) {
      setMessage("Select an approved reservation.");
      return;
    }
    createMutation.mutate(values);
  });
  const onPaymentPlanSubmit = paymentPlanForm.handleSubmit((values) => {
    if (!selectedContract) return;
    paymentPlanMutation.mutate({ contractId: selectedContract.id, currencyCode: selectedContract.currencyCode, values });
  });
  const onErpComplete = erpForm.handleSubmit((values) => {
    if (!selectedContract) return;
    completeMutation.mutate({ contractId: selectedContract.id, values });
  });
  const onErpFailed = erpForm.handleSubmit((values) => {
    if (!selectedContract || values.errorMessage.trim() === "") {
      setMessage("Enter ERP failure message.");
      return;
    }
    failedMutation.mutate({ contractId: selectedContract.id, values });
  });

  return (
    <div className="crm-workspace">
      <section className="crm-module-header">
        <div>
          <p className="crm-eyebrow">Contracts</p>
          <h2>Contract Workspace</h2>
        </div>
        <button className="crm-primary-button" onClick={() => setCreateOpen(true)} type="button">
          New Contract
        </button>
      </section>

      <section className="crm-grid crm-metric-grid">
        <article className="crm-card">
          <h3>Total</h3>
          <div className="crm-kpi">{stats.total}</div>
        </article>
        <article className="crm-card">
          <h3>Draft</h3>
          <div className="crm-kpi">{stats.draft}</div>
        </article>
        <article className="crm-card">
          <h3>Signed</h3>
          <div className="crm-kpi">{stats.signed}</div>
        </article>
        <article className="crm-card">
          <h3>Value</h3>
          <div className="crm-kpi">{formatInBase(stats.value)}</div>
        </article>
      </section>

      {message ? <div className={message.includes("could not") ? "crm-error-banner" : "crm-info-banner"}>{message}</div> : null}

      {createOpen ? (
        <div className="crm-modal-backdrop" role="presentation">
      <section aria-modal="true" className="crm-modal crm-management-modal" role="dialog">
        <div className="crm-panel-header">
          <h3>Create Contract</h3>
          <button className="crm-secondary-button" onClick={() => setCreateOpen(false)} type="button">Close</button>
        </div>
        <form className="crm-form crm-reservation-form" onSubmit={onContractSubmit}>
          <label className="crm-field">
            <span className="crm-label">Approved Reservation</span>
            <select className="crm-input" {...contractForm.register("reservationId")}>
              <option value="">Select reservation</option>
              {availableReservations.map((reservation) => (
                <option key={reservation.id} value={reservation.id}>
                  {reservation.reservationNo} - {reservation.customer.name}
                </option>
              ))}
            </select>
          </label>
          <label className="crm-field">
            <span className="crm-label">Contract Value</span>
            <input className="crm-input" {...contractForm.register("contractValue")} />
          </label>
          <label className="crm-field">
            <span className="crm-label">Currency</span>
            <select className="crm-input" {...contractForm.register("currencyCode")}>
              <option value="">Select currency</option>
              {currencyRows.map((currency) => (
                <option key={currency.id} value={currency.currencyCode}>
                  {currency.currencyCode} - {currency.currencyName}
                </option>
              ))}
            </select>
          </label>
          <label className="crm-field crm-form-wide">
            <span className="crm-label">Remarks</span>
            <input className="crm-input" {...contractForm.register("remarks")} />
          </label>
          <button className="crm-primary-button crm-form-action" disabled={createMutation.isPending} type="submit">
            {createMutation.isPending ? "Creating..." : "Create Contract"}
          </button>
        </form>
      </section>
        </div>
      ) : null}

      <section className="crm-panel">
        <div className="crm-panel-header">
          <h3>Contract Register</h3>
          <input
            className="crm-input crm-search-input"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search contract, reservation, customer, unit"
            value={search}
          />
        </div>
        <div className="crm-table-wrap">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Contract</th>
                <th>Customer</th>
                <th>Unit</th>
                <th>Status</th>
                <th>Value</th>
                <th>ERP</th>
              </tr>
            </thead>
            <tbody>
              {contractRows.map((contract) => (
                <tr
                  className={selectedContractId === contract.id ? "is-selected" : ""}
                  key={contract.id}
                  onClick={() => setSelectedContractId(contract.id)}
                >
                  <td>
                    <strong>{contract.contractNo}</strong>
                    <span>{contract.reservation.reservationNo}</span>
                  </td>
                  <td>{contract.customer.name}</td>
                  <td>{contract.unit.unitCode}</td>
                  <td>{contract.contractStatus.name}</td>
                  <td>{formatInBase(contract.contractValue, contract.currencyCode)}</td>
                  <td>{contract.erpHandoffStatus}</td>
                </tr>
              ))}
              {contractRows.length === 0 ? (
                <tr>
                  <td className="crm-empty-cell" colSpan={6}>
                    No contracts found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <ListPagination
          page={page}
          pageSize={pageSize}
          total={contractsQuery.data?.pagination.total ?? 0}
          itemLabel="contracts"
          onPageChange={setPage}
        />
      </section>

      <section className="crm-panel crm-lead-detail-wide">
        <h3>Contract Detail</h3>
        {selectedContract ? (
          <>
            <div className="crm-detail-title">
              <div>
                <strong>{selectedContract.customer.name}</strong>
                <span>{selectedContract.contractNo}</span>
              </div>
              <span className="crm-status-pill">{selectedContract.contractStatus.name}</span>
            </div>
            <WorkflowTracker steps={contractWorkflowSteps(selectedContract, formatInBase)} />
            <dl className="crm-detail-list">
              <div>
                <dt>Reservation</dt>
                <dd>{selectedContract.reservation.reservationNo}</dd>
              </div>
              <div>
                <dt>Opportunity</dt>
                <dd>{selectedContract.opportunity.opportunityNo ?? "-"}</dd>
              </div>
              <div>
                <dt>Project</dt>
                <dd>{selectedContract.project.projectCode}</dd>
              </div>
              <div>
                <dt>Unit</dt>
                <dd>{selectedContract.unit.unitCode}</dd>
              </div>
              <div>
                <dt>Value</dt>
                <dd>{formatInBase(selectedContract.contractValue, selectedContract.currencyCode)}</dd>
              </div>
              <div>
                <dt>ERP Handoff</dt>
                <dd>{selectedContract.erpHandoffStatus}</dd>
              </div>
            </dl>

            {selectedContractNextAction ? (
              <section className="crm-next-action">
                <div>
                  <span className="crm-label">Next Action</span>
                  <strong>{selectedContractNextAction.title}</strong>
                  <p>{selectedContractNextAction.summary}</p>
                </div>
                <div>
                  <span className="crm-label">Data Needed</span>
                  <p>{selectedContractNextAction.dataNeeded}</p>
                </div>
              </section>
            ) : null}

            {!selectedContractIsClosed ? (
              <>
                <button
                  className={`crm-full-button ${selectedContract.contractStatus.code === "DRAFT" ? "crm-primary-button" : "crm-secondary-button"}`}
                  disabled={selectedContract.contractStatus.code !== "DRAFT" || issueMutation.isPending}
                  onClick={() => issueMutation.mutate(selectedContract.id)}
                  type="button"
                >
                  Issue Contract
                </button>
                <button
                  className={`crm-full-button ${selectedContract.contractStatus.code === "ISSUED" ? "crm-primary-button" : "crm-secondary-button"}`}
                  disabled={selectedContract.contractStatus.code !== "ISSUED" || signMutation.isPending}
                  onClick={() => signMutation.mutate(selectedContract.id)}
                  type="button"
                >
                  Sign Contract
                </button>
                <button
                  className="crm-secondary-button crm-full-button"
                  disabled={selectedContract.contractStatus.code === "CANCELLED" || cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate(selectedContract.id)}
                  type="button"
                >
                  Cancel Contract
                </button>
              </>
            ) : null}

            <section className="crm-action-grid">
              {!selectedContractIsClosed ? (
                <form className="crm-form crm-compact-form" onSubmit={onPaymentPlanSubmit}>
                  <h4>Payment Plan</h4>
                  <label className="crm-field">
                    <span className="crm-label">Plan Name</span>
                    <input className="crm-input" {...paymentPlanForm.register("planName")} />
                  </label>
                  <div className="crm-two-col">
                    <label className="crm-field">
                      <span className="crm-label">Line 1</span>
                      <input className="crm-input" {...paymentPlanForm.register("line1Label")} />
                    </label>
                    <label className="crm-field">
                      <span className="crm-label">Amount</span>
                      <input className="crm-input" {...paymentPlanForm.register("line1Amount")} />
                    </label>
                  </div>
                  <div className="crm-two-col">
                    <label className="crm-field">
                      <span className="crm-label">Due Date</span>
                      <input className="crm-input" type="date" {...paymentPlanForm.register("line1DueDate")} />
                    </label>
                    <label className="crm-field">
                      <span className="crm-label">Percent</span>
                      <input className="crm-input" {...paymentPlanForm.register("line1Percent")} />
                    </label>
                  </div>
                  <div className="crm-two-col">
                    <label className="crm-field">
                      <span className="crm-label">Line 2</span>
                      <input className="crm-input" {...paymentPlanForm.register("line2Label")} />
                    </label>
                    <label className="crm-field">
                      <span className="crm-label">Amount</span>
                      <input className="crm-input" {...paymentPlanForm.register("line2Amount")} />
                    </label>
                  </div>
                  <div className="crm-two-col">
                    <label className="crm-field">
                      <span className="crm-label">Due Date</span>
                      <input className="crm-input" type="date" {...paymentPlanForm.register("line2DueDate")} />
                    </label>
                    <label className="crm-field">
                      <span className="crm-label">Percent</span>
                      <input className="crm-input" {...paymentPlanForm.register("line2Percent")} />
                    </label>
                  </div>
                  <button className="crm-primary-button" disabled={paymentPlanMutation.isPending} type="submit">
                    Save Payment Plan
                  </button>
                </form>
              ) : null}

              <section className="crm-activity-list">
                <h4>Saved Payment Plans</h4>
                {(selectedContract.paymentPlans ?? []).map((plan) => (
                  <article key={plan.id}>
                    <strong>{plan.planName}</strong>
                    <span>{plan.planCode}</span>
                    {plan.lines.map((line) => (
                      <p key={line.id}>
                        {line.sequenceNo}. {line.milestoneLabel ?? "Milestone"} - {formatInBase(line.amount, plan.currencyCode)}
                      </p>
                    ))}
                  </article>
                ))}
                {(selectedContract.paymentPlans ?? []).length === 0 ? <p className="crm-muted-text">No payment plan saved.</p> : null}
              </section>

              <form className="crm-form crm-compact-form">
                <h4>ERP Handoff</h4>
                <p className="crm-muted-text">Status: {selectedContract.erpHandoffStatus}</p>
                {selectedContract.erpHandoffStatus === "HANDED_OFF" ? (
                  <section className="crm-next-action">
                    <div>
                      <span className="crm-label">Close-Off Stage</span>
                      <strong>Handed Off</strong>
                      <p>ERP has accepted the contract payload. CRM contract workflow is complete.</p>
                    </div>
                    <div>
                      <span className="crm-label">ERP Contract</span>
                      <p>{selectedContract.erpContractId ?? "Not captured"}</p>
                    </div>
                  </section>
                ) : null}

                {selectedContract.erpHandoffStatus === "NOT_READY" || selectedContract.erpHandoffStatus === "FAILED" ? (
                  <button
                    className="crm-primary-button"
                    disabled={selectedContract.contractStatus.code !== "SIGNED" || readyMutation.isPending}
                    onClick={() => readyMutation.mutate(selectedContract.id)}
                    type="button"
                  >
                    Mark Ready
                  </button>
                ) : null}

                {selectedContract.erpHandoffStatus === "READY" ? (
                  <>
                    <label className="crm-field">
                      <span className="crm-label">ERP Contract ID</span>
                      <input className="crm-input" {...erpForm.register("erpContractId")} />
                    </label>
                    <button className="crm-primary-button" disabled={completeMutation.isPending} onClick={onErpComplete} type="button">
                      Mark Handed Off
                    </button>
                    <label className="crm-field">
                      <span className="crm-label">Failure Message</span>
                      <textarea className="crm-input crm-textarea" {...erpForm.register("errorMessage")} />
                    </label>
                    <button className="crm-secondary-button" disabled={failedMutation.isPending} onClick={onErpFailed} type="button">
                      Mark Failed
                    </button>
                  </>
                ) : null}

                {selectedContract.erpHandoffStatus === "FAILED" ? (
                  <>
                    <label className="crm-field">
                      <span className="crm-label">Failure Message</span>
                      <textarea className="crm-input crm-textarea" {...erpForm.register("errorMessage")} />
                    </label>
                    <button className="crm-secondary-button" disabled={failedMutation.isPending} onClick={onErpFailed} type="button">
                      Update Failure
                    </button>
                  </>
                ) : null}
              </form>
            </section>
          </>
        ) : (
          <p className="crm-muted-text">Select a contract to manage status, payment plan, and ERP handoff.</p>
        )}
      </section>
    </div>
  );
}
