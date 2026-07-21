import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useLocation, useSearchParams } from "react-router-dom";
import { getApiErrorMessage } from "../api/auth";
import { getContractAgreedPack } from "../api/agreed-pack";
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
  supersedeContract,
  type Contract
} from "../api/contracts";
import { listReservations } from "../api/reservations";
import { useMoneyFormatter } from "../hooks/useCurrencyContext";
import { DEFAULT_LIST_PAGE_SIZE, DROPDOWN_LIST_LIMIT } from "../lib/list-pagination";
import { useModalEscape } from "../hooks/useModalEscape";
import { AgreedPackView } from "../shared/AgreedPackView";
import { CurrencyBadge } from "../shared/CurrencyBadge";
import { FormNoticeDialog } from "../shared/FormNoticeDialog";
import { ListPagination } from "../shared/ListPagination";
import { PaymentPlanDialog, type PaymentPlanFormValues } from "../shared/PaymentPlanDialog";
import { SortableTh } from "../shared/SortableTh";
import { WorkflowTracker, type WorkflowStep } from "../shared/WorkflowTracker";
import { ContinuePanel, MOVE_TO_CTA, SalesPipelineStrip } from "../shared/SalesPipeline";
import { nextListSort, type ListSortState } from "../lib/list-sort";

type ContractFormValues = {
  reservationId: string;
  contractValue: string;
  currencyCode: string;
  remarks: string;
};

type ErpFormValues = {
  erpContractId: string;
  errorMessage: string;
  remarks: string;
};

type ContractHandoffState = {
  fromProposal?: string;
  contractValue?: number;
  currencyCode?: string;
  remarks?: string;
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
  const normalized = value.replace(/[% ,]/g, "").trim();
  return normalized === "" ? undefined : Number(normalized);
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "-";
}

function contractNextAction(contract: Contract) {
  if (contract.contractStatus.code === "CANCELLED" || contract.contractStatus.code === "SUPERSEDED") {
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
    if (!contract.commercialSummary?.hasCompletePaymentPlan) {
      return {
        title: "Complete payment plan",
        summary: "Open Save Payment Plan to configure SPA installment stages, then save before signing.",
        dataNeeded: "Configured stages must total 100% of the SPA contract value."
      };
    }
    return {
      title: "Sign contract",
      summary: "The payment plan is complete. Sign after the buyer and authorized team confirm the agreement.",
      dataNeeded: "No additional payment-plan data required."
    };
  }
  if (contract.erpHandoffStatus === "HANDED_OFF") {
    return {
      title: "Moved to ERP",
      summary: "Contract chapter is complete. ERP has accepted the handoff.",
      dataNeeded: "None."
    };
  }
  if (contract.erpHandoffStatus === "READY") {
    return {
      title: MOVE_TO_CTA.erp,
      summary: "Handoff payload is ready. Move to ERP once the external system accepts the contract.",
      dataNeeded: "ERP Contract ID is optional in this baseline."
    };
  }
  if (contract.erpHandoffStatus === "FAILED") {
    return {
      title: "Resolve ERP handoff",
      summary: "Review the ERP error, correct the payload or external issue, then move to handoff again.",
      dataNeeded: contract.erpHandoff?.errorMessage ?? "ERP failure reason."
    };
  }
  return {
    title: MOVE_TO_CTA.handoff,
    summary: "Prepare the signed contract and payment-plan payload for ERP.",
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
  const isCancelled = status === "CANCELLED" || status === "SUPERSEDED";
  const isIssued = status === "ISSUED" || status === "SIGNED";
  const isSigned = status === "SIGNED";
  const hasPaymentPlan = contract.commercialSummary?.hasCompletePaymentPlan ?? false;
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
      id: "payment-plan",
      title: "Payment Plan",
      status: isCancelled ? "blocked" : hasPaymentPlan ? "completed" : isIssued ? "current" : "next",
      timestamp: contract.paymentPlans?.find((plan) => plan.isActive)?.updatedAt ?? null,
      user: contract.updatedBy.name,
      role: contract.updatedBy.role,
      summary: hasPaymentPlan
        ? "Reservation, configured installment stages, and taxes have been captured."
        : "Complete the payment plan before signing.",
      details: [
        { label: "Reservation Stage", value: formatValue(contract.commercialSummary?.reservationAmount ?? 0, contract.currencyCode) },
        { label: "SPA Schedule Base", value: formatValue(contract.commercialSummary?.contractValue ?? 0, contract.currencyCode) }
      ]
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
      title: "Moved to ERP",
      status: isCancelled ? "blocked" : handedOff ? "completed" : "next",
      timestamp: contract.erpHandoff?.handedOffAt ?? null,
      user: contract.updatedBy.name,
      role: contract.updatedBy.role,
      summary: handedOff
        ? "Contract chapter is complete. ERP handoff has been marked complete."
        : `Complete ERP handoff using ${MOVE_TO_CTA.erp}.`,
      details: [
        { label: "Next", value: MOVE_TO_CTA.erp },
        { label: "ERP Contract", value: contract.erpContractId },
        { label: "Last Error", value: contract.erpHandoff?.errorMessage }
      ]
    }
  ];
}

export function ContractsPage() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const processedHandoffRef = useRef<string | null>(null);
  const handoffNoteRef = useRef<string | null>(null);
  const { formatInBase, formatMoney, defaultContractCurrency } = useMoneyFormatter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [listSort, setListSort] = useState<ListSortState>({ sortBy: "createdAt", sortDir: "desc" });
  const pageSize = DEFAULT_LIST_PAGE_SIZE;
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [contractDetailModalOpen, setContractDetailModalOpen] = useState(false);
  const [paymentPlanModalOpen, setPaymentPlanModalOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [supersedingContractId, setSupersedingContractId] = useState<string | null>(null);
  const [noticeDialog, setNoticeDialog] = useState<NoticeState>({
    open: false,
    title: "",
    message: "",
    variant: "info"
  });

  const showNotice = (title: string, message: string, variant: NoticeState["variant"]) => {
    setNoticeDialog({ open: true, title, message, variant });
  };
  const closeNotice = () => setNoticeDialog((current) => ({ ...current, open: false }));

  const contractForm = useForm<ContractFormValues>({
    defaultValues: { reservationId: "", contractValue: "", currencyCode: defaultContractCurrency, remarks: "" }
  });
  const erpForm = useForm<ErpFormValues>({
    defaultValues: { erpContractId: "", errorMessage: "", remarks: "" }
  });

  const contractsQuery = useQuery({
    queryKey: ["contracts", search, page, listSort.sortBy, listSort.sortDir],
    queryFn: () =>
      listContracts({
        search: search || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        sortBy: listSort.sortBy,
        sortDir: listSort.sortDir
      }),
    staleTime: 10_000
  });

  useEffect(() => {
    setPage(1);
  }, [search, listSort.sortBy, listSort.sortDir]);

  const onSortColumn = (column: string) => {
    const preferDesc = column === "value" || column === "createdAt" || column === "contractNo";
    setListSort((current) => nextListSort(current, column, preferDesc ? "desc" : "asc"));
  };
  const contractDetailQuery = useQuery({
    queryKey: ["contract", selectedContractId],
    queryFn: () => getContract(selectedContractId ?? ""),
    enabled: Boolean(selectedContractId && contractDetailModalOpen),
    refetchOnWindowFocus: false
  });
  const agreedPackQuery = useQuery({
    queryKey: ["contract", selectedContractId, "agreed-pack"],
    queryFn: () => getContractAgreedPack(selectedContractId ?? ""),
    enabled: Boolean(selectedContractId && contractDetailModalOpen),
    refetchOnWindowFocus: false
  });
  const reservationsQuery = useQuery({
    queryKey: ["reservations", "contract-select"],
    queryFn: () => listReservations({ limit: DROPDOWN_LIST_LIMIT }),
    enabled: createOpen,
    staleTime: 10_000,
    refetchOnWindowFocus: false
  });
  const currenciesQuery = useQuery({
    queryKey: ["currencies", "contract-dropdown"],
    queryFn: () => listCurrencies({ contractAllowed: true, activeOnly: true }),
    staleTime: 60_000
  });
  const refreshContract = (contract: Contract, successTitle: string, successMessage: string) => {
    showNotice(successTitle, successMessage, "success");
    setSelectedContractId(contract.id);
    setContractDetailModalOpen(true);
    queryClient.setQueryData(["contract", contract.id], contract);
    void queryClient.invalidateQueries({ queryKey: ["contracts"] });
    void queryClient.invalidateQueries({ queryKey: ["contract", contract.id] });
    void queryClient.invalidateQueries({ queryKey: ["contract", contract.id, "agreed-pack"] });
    void queryClient.invalidateQueries({ queryKey: ["reservations"] });
  };

  const loadContract = (contractId: string) => {
    setSelectedContractId(contractId);
    setContractDetailModalOpen(true);
  };

  const closeContractDetailModal = () => {
    setPaymentPlanModalOpen(false);
    setContractDetailModalOpen(false);
    setSelectedContractId(null);
  };

  const openCreateModal = (
    reservationId?: string,
    prefill?: { contractValue?: number; currencyCode?: string; remarks?: string; fromProposal?: string }
  ) => {
    setSupersedingContractId(null);
    handoffNoteRef.current = prefill?.fromProposal
      ? `Opened from accepted proposal ${prefill.fromProposal}.`
      : null;
    contractForm.reset({
      reservationId: reservationId ?? "",
      contractValue: prefill?.contractValue != null ? String(prefill.contractValue) : "",
      currencyCode: prefill?.currencyCode ?? defaultContractCurrency,
      remarks: prefill?.remarks ?? ""
    });
    setCreateOpen(true);
  };

  const openReplaceModal = (contract: Contract) => {
    if (!contract.reservation.id) {
      showNotice("Replace Unavailable", "This contract has no linked reservation to recreate from.", "error");
      return;
    }
    setSupersedingContractId(contract.id);
    handoffNoteRef.current = null;
    contractForm.reset({
      reservationId: contract.reservation.id,
      contractValue: contract.contractValue == null ? "" : String(contract.contractValue),
      currencyCode: contract.currencyCode ?? defaultContractCurrency,
      remarks: `Replacement for ${contract.contractNo}`
    });
    setContractDetailModalOpen(false);
    setCreateOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: (values: ContractFormValues) => {
      const payload = {
        reservationId: values.reservationId,
        contractValue: pickNumber(values.contractValue),
        currencyCode: pickString(values.currencyCode),
        remarks: pickString(values.remarks)
      };
      if (supersedingContractId) {
        return supersedeContract(supersedingContractId, payload);
      }
      return createContract(payload);
    },
    onSuccess: (contract) => {
      const wasReplace = Boolean(supersedingContractId);
      setCreateOpen(false);
      setSupersedingContractId(null);
      handoffNoteRef.current = null;
      refreshContract(
        contract,
        wasReplace ? "Contract Replaced" : "Contract Created",
        wasReplace
          ? `Prior contract superseded. ${contract.contractNo} is the active draft.`
          : `Contract ${contract.contractNo} draft is ready. Next: issue the contract (Step 1).`
      );
      contractForm.reset({ reservationId: "", contractValue: "", currencyCode: defaultContractCurrency, remarks: "" });
    },
    onError: (error) =>
      showNotice(
        supersedingContractId ? "Replace Failed" : "Contract Not Created",
        getApiErrorMessage(
          error,
          supersedingContractId
            ? "Contract could not be replaced. Signed contracts must be cancelled first."
            : "Contract could not be created. Use an approved reservation."
        ),
        "error"
      )
  });

  const issueMutation = useMutation({
    mutationFn: (contractId: string) => issueContract(contractId, "Contract issued from CRM workspace"),
    onSuccess: (contract) =>
      refreshContract(contract, "Contract Issued", "Contract issued. Next: save the payment plan (Step 2), then sign (Step 3)."),
    onError: (error) => showNotice("Issue Failed", getApiErrorMessage(error, "Contract could not be issued."), "error")
  });
  const signMutation = useMutation({
    mutationFn: (contractId: string) => signContract(contractId, "Contract signed from CRM workspace"),
    onSuccess: (contract) =>
      refreshContract(contract, "Contract Signed", "Contract signed. Next: prepare the ERP handoff when ready."),
    onError: (error) => showNotice("Sign Failed", getApiErrorMessage(error, "Contract could not be signed."), "error")
  });
  const cancelMutation = useMutation({
    mutationFn: (contractId: string) => cancelContract(contractId, "Contract cancelled from CRM workspace"),
    onSuccess: (contract) => refreshContract(contract, "Contract Cancelled", "The contract was cancelled."),
    onError: (error) => showNotice("Cancel Failed", getApiErrorMessage(error, "Contract could not be cancelled."), "error")
  });
  const paymentPlanMutation = useMutation({
    mutationFn: ({ contractId, currencyCode, values }: { contractId: string; currencyCode: string | null; values: PaymentPlanFormValues }) => {
      return createPaymentPlan(contractId, {
        planName: values.planName,
        currencyCode: currencyCode ?? "USD",
        remarks: pickString(values.remarks),
        lines: values.stages.map((stage, index) => ({
          sequenceNo: index + 1,
          milestoneRefId: stage.milestoneRefId,
          milestoneLabel: pickString(stage.milestoneLabel),
          dueDate: pickString(stage.dueDate),
          percentageOfContract: pickNumber(stage.percentage) ?? 0
        }))
      });
    },
    onSuccess: (contract) => {
      setPaymentPlanModalOpen(false);
      refreshContract(contract, "Payment Plan Saved", "Payment plan saved. Next: sign the contract (Step 3).");
    },
    onError: (error) => showNotice("Payment Plan Not Saved", getApiErrorMessage(error, "Payment plan could not be saved."), "error")
  });
  const readyMutation = useMutation({
    mutationFn: (contractId: string) => markErpHandoffReady(contractId, "Contract payload prepared for ERP"),
    onSuccess: (contract) => refreshContract(contract, "ERP Handoff Ready", "ERP handoff marked ready."),
    onError: (error) =>
      showNotice("ERP Handoff Failed", getApiErrorMessage(error, "ERP handoff could not be marked ready. Sign the contract first."), "error")
  });
  const completeMutation = useMutation({
    mutationFn: ({ contractId, values }: { contractId: string; values: ErpFormValues }) =>
      markErpHandoffCompleted(contractId, pickString(values.erpContractId), pickString(values.remarks)),
    onSuccess: (contract) => refreshContract(contract, "ERP Handoff Complete", "ERP handoff marked complete."),
    onError: (error) => showNotice("ERP Handoff Failed", getApiErrorMessage(error, "ERP handoff could not be marked complete."), "error")
  });
  const failedMutation = useMutation({
    mutationFn: ({ contractId, values }: { contractId: string; values: ErpFormValues }) =>
      markErpHandoffFailed(contractId, values.errorMessage, pickString(values.remarks)),
    onSuccess: (contract) => refreshContract(contract, "ERP Handoff Failure Recorded", "The ERP handoff failure was recorded."),
    onError: (error) => showNotice("ERP Update Failed", getApiErrorMessage(error, "ERP handoff failure could not be recorded."), "error")
  });

  const contractRows = contractsQuery.data?.items ?? [];
  const currencyRows = currenciesQuery.data?.items ?? [];
  const selectedContract = contractDetailQuery.data ?? contractRows.find((contract) => contract.id === selectedContractId) ?? null;
  const activePaymentPlan = selectedContract?.paymentPlans?.find((plan) => plan.isActive) ?? null;
  const selectedContractNextAction = selectedContract ? contractNextAction(selectedContract) : null;
  const selectedContractIsClosed = selectedContract?.erpHandoffStatus === "HANDED_OFF";
  const hasCompletePaymentPlan = selectedContract?.commercialSummary?.hasCompletePaymentPlan ?? false;

  const openPaymentPlanModal = () => {
    if (!selectedContract) return;
    if (selectedContract.contractStatus.code === "DRAFT") {
      showNotice("Issue Contract First", "Step 1 is issuing the contract. Save the payment plan after it is issued.", "error");
      return;
    }
    if (selectedContract.contractStatus.code === "CANCELLED") {
      showNotice("Contract Cancelled", "Payment plan cannot be edited on a cancelled contract.", "error");
      return;
    }
    setPaymentPlanModalOpen(true);
  };

  const availableReservations =
    reservationsQuery.data?.items.filter((reservation) =>
      ["APPROVED", "CONVERTED_TO_CONTRACT"].includes(reservation.reservationStatus.code ?? "")
    ) ?? [];

  const stats = useMemo(() => {
    const summary = contractsQuery.data?.summary;
    return {
      total: contractsQuery.data?.pagination.total ?? 0,
      draft: summary?.draft ?? 0,
      signed: summary?.signed ?? 0,
      value: summary?.value ?? 0
    };
  }, [contractsQuery.data]);

  const onContractSubmit = contractForm.handleSubmit((values) => {
    if (!values.reservationId) {
      showNotice("Reservation Required", "Select an approved reservation before creating the contract.", "error");
      return;
    }
    createMutation.mutate(values);
  });
  const onPaymentPlanSave = (values: PaymentPlanFormValues) => {
    if (!selectedContract) return;
    paymentPlanMutation.mutate({ contractId: selectedContract.id, currencyCode: selectedContract.currencyCode, values });
  };
  const onErpComplete = erpForm.handleSubmit((values) => {
    if (!selectedContract) return;
    completeMutation.mutate({ contractId: selectedContract.id, values });
  });
  const onErpFailed = erpForm.handleSubmit((values) => {
    if (!selectedContract || values.errorMessage.trim() === "") {
      showNotice("Failure Message Required", "Enter the ERP failure message before recording the failure.", "error");
      return;
    }
    failedMutation.mutate({ contractId: selectedContract.id, values });
  });

  useEffect(() => {
    const createFor = searchParams.get("createFor");
    if (!createFor || processedHandoffRef.current === createFor) {
      return;
    }

    processedHandoffRef.current = createFor;
    const handoff = (location.state as ContractHandoffState | null) ?? null;
    openCreateModal(createFor, handoff ?? undefined);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("createFor");
    setSearchParams(nextParams, { replace: true });
  }, [location.state, searchParams, setSearchParams]);

  useModalEscape(contractDetailModalOpen, closeContractDetailModal, {
    disabled: createOpen || paymentPlanModalOpen || noticeDialog.open
  });
  useModalEscape(createOpen, () => setCreateOpen(false), { disabled: noticeDialog.open });

  const selectedReservation = availableReservations.find(
    (reservation) => reservation.id === contractForm.watch("reservationId")
  );

  return (
    <div className="crm-workspace">
      <section className="crm-module-header">
        <div>
          <p className="crm-eyebrow">Contracts</p>
          <div className="crm-dashboard-title-row">
            <h2>Contract Workspace</h2>
            <CurrencyBadge />
          </div>
        </div>
        <button className="crm-primary-button" onClick={() => openCreateModal()} type="button">
          New Contract
        </button>
      </section>

      <section className="crm-grid crm-metric-grid">
        <article className="crm-card">
          <h3>Total</h3>
          <div className="crm-kpi">{stats.total}</div>
        </article>
        <article className="crm-card">
          <h3>Draft / Issued</h3>
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

      {createOpen ? (
        <div className="crm-modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="crm-modal crm-management-modal crm-reservation-modal crm-contract-modal"
            role="dialog"
          >
            <div className="crm-panel-header">
              <div>
                <h3>{supersedingContractId ? "Replace Contract" : "Create Contract"}</h3>
                <p className="crm-muted-text">Create a draft contract from an approved reservation.</p>
              </div>
              <button className="crm-secondary-button crm-fit-button" onClick={() => setCreateOpen(false)} type="button">
                Close
              </button>
            </div>
            <form className="crm-reservation-modal-form" onSubmit={onContractSubmit}>
              <div className="crm-reservation-modal-body">
                {handoffNoteRef.current ? (
                  <p className="crm-proposal-prefill-note crm-form-wide">{handoffNoteRef.current}</p>
                ) : null}
                <div className="crm-reservation-modal-fields">
                  <label className="crm-field crm-form-wide">
                    <span className="crm-label">
                      Approved Reservation <span className="crm-label-required-inline">*</span>
                    </span>
                    <select className="crm-input" {...contractForm.register("reservationId")}>
                      <option value="">Select reservation</option>
                      {availableReservations.map((reservation) => (
                        <option key={reservation.id} value={reservation.id}>
                          {reservation.reservationNo} - {reservation.customer.name} - {reservation.unit.unitCode}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="crm-field">
                    <span className="crm-label">Contract Value</span>
                    <input className="crm-input" inputMode="decimal" {...contractForm.register("contractValue")} />
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
                    <textarea className="crm-input crm-textarea crm-opportunity-textarea" {...contractForm.register("remarks")} />
                  </label>
                </div>
                {selectedReservation ? (
                  <dl className="crm-detail-list crm-inline-preview">
                    <div>
                      <dt>Customer</dt>
                      <dd>{selectedReservation.customer.name ?? "-"}</dd>
                    </div>
                    <div>
                      <dt>Unit</dt>
                      <dd>{selectedReservation.unit.unitCode ?? "-"}</dd>
                    </div>
                    <div>
                      <dt>Opportunity</dt>
                      <dd>{selectedReservation.opportunity.opportunityNo ?? "-"}</dd>
                    </div>
                    <div>
                      <dt>Reservation Amount</dt>
                      <dd>{formatInBase(selectedReservation.reservationAmount, selectedReservation.currencyCode)}</dd>
                    </div>
                  </dl>
                ) : null}
              </div>
              <div className="crm-modal-actions crm-modal-actions-sticky">
                <button className="crm-secondary-button crm-fit-button" onClick={() => setCreateOpen(false)} type="button">
                  Close
                </button>
                <button className="crm-primary-button crm-fit-button" disabled={createMutation.isPending} type="submit">
                  {createMutation.isPending
                    ? supersedingContractId
                      ? "Replacing..."
                      : "Creating..."
                    : supersedingContractId
                      ? "Replace Contract"
                      : "Create Contract"}
                </button>
              </div>
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
                <SortableTh
                  column="contractNo"
                  label="Contract"
                  onSort={onSortColumn}
                  sortBy={listSort.sortBy}
                  sortDir={listSort.sortDir}
                />
                <SortableTh column="customer" label="Customer" onSort={onSortColumn} sortBy={listSort.sortBy} sortDir={listSort.sortDir} />
                <SortableTh column="unit" label="Unit" onSort={onSortColumn} sortBy={listSort.sortBy} sortDir={listSort.sortDir} />
                <SortableTh column="status" label="Status" onSort={onSortColumn} sortBy={listSort.sortBy} sortDir={listSort.sortDir} />
                <SortableTh column="value" label="Value" onSort={onSortColumn} sortBy={listSort.sortBy} sortDir={listSort.sortDir} />
                <SortableTh column="erp" label="ERP" onSort={onSortColumn} sortBy={listSort.sortBy} sortDir={listSort.sortDir} />
                <SortableTh
                  column="createdAt"
                  label="Created Date"
                  onSort={onSortColumn}
                  sortBy={listSort.sortBy}
                  sortDir={listSort.sortDir}
                />
              </tr>
            </thead>
            <tbody>
              {contractRows.map((contract) => (
                <tr
                  className={selectedContractId === contract.id && contractDetailModalOpen ? "is-selected" : ""}
                  key={contract.id}
                  onClick={() => loadContract(contract.id)}
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
                  <td>{formatDate(contract.createdAt)}</td>
                </tr>
              ))}
              {contractRows.length === 0 ? (
                <tr>
                  <td className="crm-empty-cell" colSpan={7}>
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

      {contractDetailModalOpen ? (
        <div className="crm-modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="crm-modal crm-management-modal crm-lead-detail-modal crm-opportunity-detail-modal"
            role="dialog"
          >
            <div className="crm-panel-header">
              <div>
                <h3>Contract Detail</h3>
                <p className="crm-muted-text">{selectedContract?.contractNo ?? "Loading contract..."}</p>
              </div>
              <div className="crm-modal-header-actions">
                <CurrencyBadge compact />
                <button className="crm-secondary-button crm-fit-button" onClick={closeContractDetailModal} type="button">
                  Close
                </button>
              </div>
            </div>

            {contractDetailQuery.isLoading && !selectedContract ? (
              <p className="crm-muted-text crm-opportunity-detail-body">Loading contract details...</p>
            ) : selectedContract ? (
              <div className="crm-opportunity-detail-body">
                <div className="crm-detail-title">
                  <div>
                    <strong>{selectedContract.customer.name}</strong>
                    <span>{selectedContract.contractNo}</span>
                    <ul className="crm-detail-facts">
                      <li>
                        <span className="crm-detail-fact-label">Reservation</span>
                        <span className="crm-detail-fact-value">{selectedContract.reservation.reservationNo ?? "-"}</span>
                      </li>
                      <li>
                        <span className="crm-detail-fact-label">Opportunity</span>
                        <span className="crm-detail-fact-value">{selectedContract.opportunity.opportunityNo ?? "-"}</span>
                      </li>
                      <li>
                        <span className="crm-detail-fact-label">Project</span>
                        <span className="crm-detail-fact-value">{selectedContract.project.projectCode ?? "-"}</span>
                      </li>
                      <li>
                        <span className="crm-detail-fact-label">Unit</span>
                        <span className="crm-detail-fact-value">{selectedContract.unit.unitCode ?? "-"}</span>
                      </li>
                      <li>
                        <span className="crm-detail-fact-label">Value</span>
                        <span className="crm-detail-fact-value">
                          {formatInBase(selectedContract.contractValue, selectedContract.currencyCode)}
                        </span>
                      </li>
                      <li>
                        <span className="crm-detail-fact-label">ERP Handoff</span>
                        <span className="crm-detail-fact-value">{selectedContract.erpHandoffStatus ?? "-"}</span>
                      </li>
                    </ul>
                  </div>
                  <span className="crm-status-pill">{selectedContract.contractStatus.name}</span>
                </div>
                <SalesPipelineStrip current={selectedContract.erpHandoffStatus === "HANDED_OFF" ? "erp" : "contract"} />
                <WorkflowTracker showDetail={false} steps={contractWorkflowSteps(selectedContract, formatInBase)} />

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
                    <section className="crm-opportunity-actions">
                      <div className="crm-opportunity-action-card crm-opportunity-action-card-wide">
                        <div className="crm-opportunity-action-card-header">
                          <h4>Contract Workflow</h4>
                          <p className="crm-muted-text">
                            Current status: {selectedContract.contractStatus.name ?? "-"} · ERP: {selectedContract.erpHandoffStatus}
                          </p>
                          <p className="crm-muted-text">
                            Order: 1. Issue Contract → 2. Save Payment Plan → 3. Sign Contract → 4. ERP Handoff.
                          </p>
                        </div>
                        <div className="crm-opportunity-action-card-footer">
                          <button
                            className={`crm-opportunity-action-button ${selectedContract.contractStatus.code === "DRAFT" ? "crm-primary-button" : "crm-secondary-button"}`}
                            disabled={issueMutation.isPending}
                            onClick={() => {
                              if (selectedContract.contractStatus.code !== "DRAFT") {
                                showNotice(
                                  "Already Issued",
                                  `Step 1 is complete. The contract is ${selectedContract.contractStatus.name ?? "past draft"}.`,
                                  "info"
                                );
                                return;
                              }
                              issueMutation.mutate(selectedContract.id);
                            }}
                            type="button"
                          >
                            {issueMutation.isPending ? "Issuing..." : "1. Issue Contract"}
                          </button>
                          <button
                            className={`crm-opportunity-action-button ${
                              selectedContract.contractStatus.code === "ISSUED" && !hasCompletePaymentPlan
                                ? "crm-primary-button"
                                : "crm-secondary-button"
                            }`}
                            onClick={openPaymentPlanModal}
                            type="button"
                          >
                            {hasCompletePaymentPlan ? "2. Edit Payment Plan" : "2. Save Payment Plan"}
                          </button>
                          <button
                            className={`crm-opportunity-action-button ${
                              selectedContract.contractStatus.code === "ISSUED" && hasCompletePaymentPlan
                                ? "crm-primary-button"
                                : "crm-secondary-button"
                            }`}
                            disabled={signMutation.isPending}
                            onClick={() => {
                              if (selectedContract.contractStatus.code === "SIGNED") {
                                showNotice("Already Signed", "Step 3 is complete. The contract is already signed.", "info");
                                return;
                              }
                              if (selectedContract.contractStatus.code !== "ISSUED") {
                                showNotice(
                                  "Issue Contract First",
                                  "Step 1 is issuing the contract. Sign it after issuing and saving the payment plan.",
                                  "error"
                                );
                                return;
                              }
                              if (!hasCompletePaymentPlan) {
                                showNotice(
                                  "Payment Plan Required",
                                  "Step 2 is saving the payment plan. Click Save Payment Plan, complete stages (total 100%), save, then sign.",
                                  "error"
                                );
                                return;
                              }
                              signMutation.mutate(selectedContract.id);
                            }}
                            type="button"
                          >
                            {signMutation.isPending ? "Signing..." : "3. Sign Contract"}
                          </button>
                          <button
                            className="crm-secondary-button crm-opportunity-action-button"
                            disabled={
                              selectedContract.contractStatus.code === "CANCELLED" ||
                              selectedContract.contractStatus.code === "SUPERSEDED" ||
                              selectedContract.erpHandoffStatus === "HANDED_OFF" ||
                              cancelMutation.isPending
                            }
                            onClick={() => cancelMutation.mutate(selectedContract.id)}
                            type="button"
                          >
                            {cancelMutation.isPending ? "Cancelling..." : "Cancel Contract"}
                          </button>
                          {selectedContract.contractStatus.code === "DRAFT" ||
                          selectedContract.contractStatus.code === "ISSUED" ? (
                            <button
                              className="crm-secondary-button crm-opportunity-action-button"
                              disabled={!selectedContract.isActive || selectedContract.erpHandoffStatus === "HANDED_OFF"}
                              onClick={() => openReplaceModal(selectedContract)}
                              type="button"
                            >
                              Replace Contract
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <section className="crm-opportunity-action-card crm-opportunity-action-card-wide">
                        <div className="crm-opportunity-action-card-header">
                          <h4>Payment Plan {hasCompletePaymentPlan ? "(Saved)" : "(Pending)"}</h4>
                          <p className="crm-muted-text">
                            {hasCompletePaymentPlan
                              ? "Commercial schedule is saved. Edit anytime before ERP handoff if needed."
                              : "Open Step 2 to configure remaining balance stages after reservation."}
                          </p>
                        </div>
                        <dl className="crm-detail-grid">
                          <div>
                            <dt>SPA / Unit Value</dt>
                            <dd>{formatInBase(selectedContract.commercialSummary?.contractValue ?? 0, selectedContract.currencyCode)}</dd>
                          </div>
                          <div>
                            <dt>Stage 1 · Reservation</dt>
                            <dd>{formatInBase(selectedContract.commercialSummary?.reservationAmount ?? 0, selectedContract.currencyCode)}</dd>
                          </div>
                          <div>
                            <dt>Schedule Base (SPA)</dt>
                            <dd>{formatInBase(selectedContract.commercialSummary?.contractValue ?? 0, selectedContract.currencyCode)}</dd>
                          </div>
                          <div>
                            <dt>Taxes / Fees</dt>
                            <dd>
                              {formatInBase(
                                selectedContract.commercialSummary?.totalTaxAmount ?? 0,
                                selectedContract.commercialSummary?.baseCurrencyCode ?? null
                              )}
                            </dd>
                          </div>
                          <div>
                            <dt>Total Payable</dt>
                            <dd>
                              {formatInBase(
                                selectedContract.commercialSummary?.totalPayableBase ?? 0,
                                selectedContract.commercialSummary?.baseCurrencyCode ?? null
                              )}
                            </dd>
                          </div>
                          <div>
                            <dt>Active Plan</dt>
                            <dd>{activePaymentPlan?.planName ?? "Not saved"}</dd>
                          </div>
                        </dl>
                        <div className="crm-opportunity-action-card-footer">
                          <button className="crm-secondary-button crm-opportunity-action-button" onClick={openPaymentPlanModal} type="button">
                            {hasCompletePaymentPlan ? "View / Edit Payment Plan" : "Open Payment Plan"}
                          </button>
                        </div>
                      </section>

                      {selectedContract.erpHandoffStatus === "HANDED_OFF" ? (
                        <section className="crm-next-action">
                          <div>
                            <span className="crm-label">Close-Off Stage</span>
                            <strong>Moved to ERP</strong>
                            <p>ERP has accepted the contract payload. CRM contract workflow is complete.</p>
                          </div>
                          <div>
                            <span className="crm-label">ERP Contract</span>
                            <p>{selectedContract.erpContractId ?? "Not captured"}</p>
                          </div>
                        </section>
                      ) : (
                        <form className="crm-opportunity-action-card crm-opportunity-lost-card">
                          <div className="crm-opportunity-action-card-header">
                            <h4>ERP Handoff</h4>
                            <p className="crm-muted-text">Prepare and complete ERP payload handoff after contract is signed.</p>
                          </div>
                          <div className="crm-opportunity-lost-fields">
                            <label className="crm-field">
                              <span className="crm-label">ERP Contract ID</span>
                              <input className="crm-input" placeholder="Optional ERP reference" {...erpForm.register("erpContractId")} />
                            </label>
                            <label className="crm-field">
                              <span className="crm-label">Failure Message</span>
                              <textarea
                                className="crm-input crm-textarea crm-opportunity-textarea"
                                placeholder="Required only when marking handoff as failed"
                                {...erpForm.register("errorMessage")}
                              />
                            </label>
                            <div className="crm-opportunity-action-card-footer crm-opportunity-lost-footer">
                              {selectedContract.erpHandoffStatus === "NOT_READY" || selectedContract.erpHandoffStatus === "FAILED" ? (
                                <button
                                  className="crm-secondary-button crm-opportunity-action-button"
                                  disabled={selectedContract.contractStatus.code !== "SIGNED" || readyMutation.isPending}
                                  onClick={() => readyMutation.mutate(selectedContract.id)}
                                  type="button"
                                >
                                  {readyMutation.isPending ? "Updating..." : MOVE_TO_CTA.handoff}
                                </button>
                              ) : null}
                              {selectedContract.erpHandoffStatus === "READY" ? (
                                <button
                                  className="crm-primary-button crm-opportunity-action-button"
                                  disabled={completeMutation.isPending}
                                  onClick={onErpComplete}
                                  type="button"
                                >
                                  {completeMutation.isPending ? "Moving..." : MOVE_TO_CTA.erp}
                                </button>
                              ) : null}
                              {selectedContract.erpHandoffStatus === "READY" || selectedContract.erpHandoffStatus === "FAILED" ? (
                                <button
                                  className="crm-secondary-button crm-opportunity-action-button"
                                  disabled={failedMutation.isPending}
                                  onClick={onErpFailed}
                                  type="button"
                                >
                                  {failedMutation.isPending ? "Updating..." : "Mark Failed"}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </form>
                      )}
                    </section>

                    <section className="crm-activity-list">
                      <h4>Saved Payment Plans</h4>
                      {(selectedContract.paymentPlans ?? []).map((plan) => (
                        <article key={plan.id}>
                          <strong>{plan.planName}</strong>
                          <span>{plan.planCode} · {plan.isActive ? "Current" : "Replaced"}</span>
                          {plan.lines.map((line) => (
                            <p key={line.id}>
                              {line.sequenceNo}. {line.milestoneLabel ?? "Milestone"} · {line.percentageOfContract ?? 0}% ·{" "}
                              {formatInBase(line.amount, plan.currencyCode)}
                              {line.dueDate ? ` · Due ${line.dueDate}` : ""}
                            </p>
                          ))}
                          {plan.taxLines.map((tax) => (
                            <p key={tax.id}>
                              Tax/Fee · {tax.taxName} · {formatInBase(tax.taxAmount, tax.currencyCode)} · Outside CRM
                            </p>
                          ))}
                          {plan.remarks ? <p>Notes: {plan.remarks}</p> : null}
                        </article>
                      ))}
                      {(selectedContract.paymentPlans ?? []).length === 0 ? (
                        <p className="crm-muted-text">No payment plan saved.</p>
                      ) : null}
                    </section>
                  </>
                ) : (
                  <section className="crm-next-action">
                    <div>
                      <span className="crm-label">Close-Off Stage</span>
                      <strong>Moved to ERP</strong>
                      <p>Contract workflow is complete for this baseline.</p>
                    </div>
                    <div>
                      <span className="crm-label">ERP Contract</span>
                      <p>{selectedContract.erpContractId ?? "-"}</p>
                    </div>
                  </section>
                )}

                {agreedPackQuery.isLoading ? (
                  <p className="crm-muted-text">Loading agreed pack...</p>
                ) : agreedPackQuery.data ? (
                  <AgreedPackView formatInBase={formatInBase} pack={agreedPackQuery.data} />
                ) : agreedPackQuery.isError ? (
                  <p className="crm-muted-text">Agreed pack could not be loaded.</p>
                ) : null}
              </div>
            ) : (
              <p className="crm-muted-text crm-opportunity-detail-body">Contract details could not be loaded.</p>
            )}
          </section>
        </div>
      ) : null}

      <PaymentPlanDialog
        contract={selectedContract}
        formatInBase={formatInBase}
        formatMoney={formatMoney}
        isSaving={paymentPlanMutation.isPending}
        noticeOpen={noticeDialog.open}
        onClose={() => setPaymentPlanModalOpen(false)}
        onNotice={showNotice}
        onSave={onPaymentPlanSave}
        open={paymentPlanModalOpen}
      />

      <FormNoticeDialog
        confirmLabel="OK"
        message={noticeDialog.message}
        onClose={closeNotice}
        open={noticeDialog.open}
        title={noticeDialog.title}
        variant={noticeDialog.variant}
      />
    </div>
  );
}
