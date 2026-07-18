import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { getApiErrorMessage } from "../api/auth";
import { listCurrencies } from "../api/currencies";
import { listUnits, type Unit } from "../api/inventory";
import { listOpportunities } from "../api/opportunities";
import {
  acceptProposal,
  approveProposal,
  createProposal,
  getProposal,
  listProposals,
  rejectProposal,
  submitProposal,
  type Proposal,
  type ProposalPricingContext
} from "../api/proposals";
import { listReservations } from "../api/reservations";
import { useCurrencyContext, useMoneyFormatter } from "../hooks/useCurrencyContext";
import { formatMoney } from "../lib/format-money";
import { DEFAULT_LIST_PAGE_SIZE, DROPDOWN_LIST_LIMIT } from "../lib/list-pagination";
import { useModalEscape } from "../hooks/useModalEscape";
import { CurrencyBadge } from "../shared/CurrencyBadge";
import { DateField } from "../shared/DateField";
import { ListPagination } from "../shared/ListPagination";
import { WorkflowTracker, type WorkflowStep } from "../shared/WorkflowTracker";
import { ContinuePanel, MOVE_TO_CTA, SalesPipelineStrip } from "../shared/SalesPipeline";

type ProposalFormValues = {
  opportunityId: string;
  unitId: string;
  validUntil: string;
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

function defaultProposalValidUntil() {
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 14);
  return validUntil.toISOString().slice(0, 10);
}

function formatDiscountNumber(value: number) {
  return String(Number(value.toFixed(2)));
}

function recalculateProposalDiscount(
  setValue: (name: keyof ProposalFormValues, value: string) => void,
  listPriceRaw: string,
  proposedPriceRaw: string
) {
  const listPrice = pickNumber(listPriceRaw);
  const proposedPrice = pickNumber(proposedPriceRaw);

  if (listPrice == null || proposedPrice == null) {
    setValue("discountAmount", "");
    setValue("discountPercent", "");
    return;
  }

  const discountAmount = Math.max(0, listPrice - proposedPrice);
  const discountPercent = listPrice > 0 ? (discountAmount / listPrice) * 100 : 0;
  setValue("discountAmount", formatDiscountNumber(discountAmount));
  setValue("discountPercent", formatDiscountNumber(discountPercent));
}

function buildEquivalentHint(
  amountInBase: number | null | undefined,
  equivalentCurrency: string,
  baseCurrency: string,
  ratesToBase: Record<string, number>,
  fromBase: (value: number | null | undefined, currencyCode?: string | null) => number | null
) {
  if (amountInBase == null || equivalentCurrency === baseCurrency) {
    return null;
  }

  const converted = fromBase(amountInBase, equivalentCurrency);
  const rateToBase = ratesToBase[equivalentCurrency];

  if (converted == null || !rateToBase) {
    return `No active exchange rate for ${equivalentCurrency}.`;
  }

  const basePerUnit = Number((1 / rateToBase).toFixed(4));
  return `≈ ${formatMoney(converted, equivalentCurrency)} (1 ${equivalentCurrency} = ${basePerUnit.toLocaleString()} ${baseCurrency})`;
}

function buildPricingContext(
  unit: Unit,
  baseCurrency: string,
  equivalentCurrency: string,
  ratesToBase: Record<string, number>,
  toBase: (value: number | null | undefined, currencyCode?: string | null) => number,
  options?: {
    proposedPrice?: number | null;
    proposedPriceCurrency?: string | null;
    reservationNo?: string | null;
  }
): ProposalPricingContext {
  const listPriceInBase = unit.basePrice == null ? null : toBase(unit.basePrice, unit.currencyCode);
  const proposedSource = options?.proposedPrice ?? unit.basePrice;
  const proposedCurrency = options?.proposedPriceCurrency ?? unit.currencyCode ?? baseCurrency;
  const proposedInBase = proposedSource == null ? null : toBase(proposedSource, proposedCurrency);

  return {
    equivalentCurrencyCode: equivalentCurrency,
    listPriceSource:
      unit.basePrice == null ? undefined : { amount: unit.basePrice, currencyCode: unit.currencyCode ?? baseCurrency },
    listPriceBase: listPriceInBase == null ? undefined : { amount: listPriceInBase, currencyCode: baseCurrency },
    proposedPriceSource:
      proposedSource == null ? undefined : { amount: proposedSource, currencyCode: proposedCurrency },
    proposedPriceBase: proposedInBase == null ? undefined : { amount: proposedInBase, currencyCode: baseCurrency },
    reservationNo: options?.reservationNo ?? null,
    ratesUsed: ratesToBase
  };
}

function formatPricingConversionLine(
  label: string,
  source: { amount: number; currencyCode: string },
  base: { amount: number; currencyCode: string }
) {
  if (source.currencyCode.toUpperCase() === base.currencyCode.toUpperCase()) {
    return `${label}: ${formatMoney(source.amount, source.currencyCode)}`;
  }

  return `${label}: ${formatMoney(source.amount, source.currencyCode)} → ${formatMoney(base.amount, base.currencyCode)}`;
}

function buildPrefillSourceNote(context: ProposalPricingContext | null, baseCurrency: string, prefix?: string | null) {
  if (!context) {
    return prefix ?? null;
  }

  const lines: string[] = [];

  if (prefix) {
    lines.push(prefix);
  }

  if (context.listPriceSource && context.listPriceBase) {
    lines.push(formatPricingConversionLine("Unit master", context.listPriceSource, context.listPriceBase));
  }

  if (context.proposedPriceSource && context.proposedPriceBase) {
    const label = context.reservationNo ? `Reservation ${context.reservationNo}` : "Proposed price";
    lines.push(formatPricingConversionLine(label, context.proposedPriceSource, context.proposedPriceBase));
  }

  if (context.equivalentCurrencyCode && context.equivalentCurrencyCode !== baseCurrency) {
    lines.push(`Equivalent display currency: ${context.equivalentCurrencyCode}.`);
  }

  lines.push("You can change the unit before submitting.");
  return lines.join(" ");
}

function buildProposalAuditLines(context: ProposalPricingContext | null, baseCurrency: string) {
  if (!context) {
    return [];
  }

  const lines: string[] = [];

  if (context.listPriceSource && context.listPriceBase) {
    lines.push(formatPricingConversionLine("List price source", context.listPriceSource, context.listPriceBase));
  }

  if (context.proposedPriceSource && context.proposedPriceBase) {
    const label = context.reservationNo ? `Reservation amount (${context.reservationNo})` : "Proposed price source";
    lines.push(formatPricingConversionLine(label, context.proposedPriceSource, context.proposedPriceBase));
  }

  if (context.equivalentCurrencyCode) {
    lines.push(`Equivalent currency recorded: ${context.equivalentCurrencyCode}`);
  }

  if (context.ratesUsed && context.equivalentCurrencyCode && context.ratesUsed[context.equivalentCurrencyCode]) {
    const rate = context.ratesUsed[context.equivalentCurrencyCode];
    lines.push(`Exchange rate used: 1 ${context.equivalentCurrencyCode} = ${(1 / rate).toFixed(4)} ${baseCurrency}`);
  }

  return lines;
}

function applyUnitPricingToForm(
  setValue: (name: keyof ProposalFormValues, value: string) => void,
  unit: Unit,
  toBase: (value: number | null | undefined, currencyCode?: string | null) => number,
  options?: {
    proposedPrice?: number | null;
    proposedPriceCurrency?: string | null;
    overwriteProposedPrice?: boolean;
  }
) {
  setValue("unitId", unit.id);

  const listPriceInBase = unit.basePrice == null ? null : toBase(unit.basePrice, unit.currencyCode);
  setValue("listPrice", listPriceInBase == null ? "" : formatDiscountNumber(listPriceInBase));

  const proposedSource = options?.proposedPrice ?? unit.basePrice;
  const proposedCurrency = options?.proposedPriceCurrency ?? unit.currencyCode;
  const proposedInBase = proposedSource == null ? null : toBase(proposedSource, proposedCurrency);

  if (options?.overwriteProposedPrice !== false && proposedInBase != null) {
    setValue("proposedPrice", formatDiscountNumber(proposedInBase));
  }

  const listRaw = listPriceInBase == null ? "" : formatDiscountNumber(listPriceInBase);
  const proposedRaw =
    options?.overwriteProposedPrice !== false && proposedInBase != null
      ? formatDiscountNumber(proposedInBase)
      : "";
  recalculateProposalDiscount(setValue, listRaw, proposedRaw || listRaw);
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
      title: MOVE_TO_CTA.contract,
      summary: "Proposal chapter is complete. Move to contract with the accepted commercial terms.",
      dataNeeded: "Approved reservation and accepted proposal value."
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
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const processedHandoffRef = useRef<string | null>(null);
  const handoffNoteRef = useRef<string | null>(null);
  const currencyContextQuery = useCurrencyContext();
  const { formatInBase, baseCurrency, ratesToBase, toBase, fromBase } = useMoneyFormatter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = DEFAULT_LIST_PAGE_SIZE;
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const [proposalDetailModalOpen, setProposalDetailModalOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [prefillSource, setPrefillSource] = useState<string | null>(null);
  const [pricingContext, setPricingContext] = useState<ProposalPricingContext | null>(null);
  const [equivalentCurrencyCode, setEquivalentCurrencyCode] = useState("USD");
  const lastPrefilledOpportunityIdRef = useRef<string | null>(null);

  const proposalForm = useForm<ProposalFormValues>({
    defaultValues: {
      opportunityId: "",
      unitId: "",
      validUntil: "",
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
    enabled: Boolean(selectedProposalId && proposalDetailModalOpen),
    refetchOnWindowFocus: false
  });
  const opportunitiesQuery = useQuery({
    queryKey: ["opportunities", "proposal-select"],
    queryFn: () => listOpportunities({ limit: DROPDOWN_LIST_LIMIT }),
    enabled: createOpen,
    staleTime: 10_000,
    refetchOnWindowFocus: false
  });
  const reservedOpportunitiesQuery = useQuery({
    queryKey: ["reservations", "proposal-opportunities"],
    queryFn: () => listReservations({ limit: DROPDOWN_LIST_LIMIT }),
    enabled: createOpen,
    staleTime: 10_000,
    refetchOnWindowFocus: false
  });
  const unitsQuery = useQuery({
    queryKey: ["units", "proposal-select"],
    queryFn: () => listUnits({ limit: DROPDOWN_LIST_LIMIT }),
    enabled: createOpen,
    staleTime: 10_000,
    refetchOnWindowFocus: false
  });
  const currenciesQuery = useQuery({
    queryKey: ["currencies", "proposal-dropdown"],
    queryFn: () => listCurrencies({ dropdownOnly: true, activeOnly: true }),
    enabled: createOpen,
    staleTime: 60_000
  });

  const selectedOpportunityId = proposalForm.watch("opportunityId");
  const opportunityReservationPrefillQuery = useQuery({
    queryKey: ["reservations", "proposal-prefill", selectedOpportunityId],
    queryFn: () => listReservations({ opportunityId: selectedOpportunityId, limit: 5, offset: 0 }),
    enabled: createOpen && Boolean(selectedOpportunityId),
    staleTime: 10_000,
    refetchOnWindowFocus: false
  });

  const proposalRows = proposalsQuery.data?.items ?? [];
  const currencyRows = currenciesQuery.data?.items ?? [];
  const selectedProposal = proposalDetailQuery.data ?? proposalRows.find((proposal) => proposal.id === selectedProposalId) ?? null;
  const proposalContractReservationQuery = useQuery({
    queryKey: ["reservations", "proposal-contract", selectedProposal?.opportunity.id],
    queryFn: () => listReservations({ opportunityId: selectedProposal?.opportunity.id, limit: 5, offset: 0 }),
    enabled: Boolean(proposalDetailModalOpen && selectedProposal?.opportunity.id),
    staleTime: 10_000,
    refetchOnWindowFocus: false
  });
  const selectedUnitId = proposalForm.watch("unitId");
  const selectedOpportunity = (opportunitiesQuery.data?.items ?? []).find((opportunity) => opportunity.id === selectedOpportunityId);
  const selectedUnit = (unitsQuery.data?.items ?? []).find((unit) => unit.id === selectedUnitId);
  const activeOpportunityReservation =
    (opportunityReservationPrefillQuery.data?.items ?? []).find(
      (reservation) => reservation.isActive && reservation.reservationStatus.code !== "CANCELLED"
    ) ?? null;
  const activeProposalReservation =
    (proposalContractReservationQuery.data?.items ?? []).find(
      (reservation) =>
        reservation.isActive &&
        ["APPROVED", "CONVERTED_TO_CONTRACT"].includes(reservation.reservationStatus.code ?? "")
    ) ?? null;

  const proposalUnits = useMemo(() => {
    const units = unitsQuery.data?.items ?? [];
    const projectCode = selectedOpportunity?.projectCode;

    if (!projectCode) {
      return units;
    }

    const projectUnits = units.filter((unit) => unit.project.projectCode === projectCode);
    return projectUnits.length > 0 ? projectUnits : units;
  }, [selectedOpportunity?.projectCode, unitsQuery.data?.items]);

  const proposalOpportunities = useMemo(() => {
    const reservedOpportunityIds = new Set(
      (reservedOpportunitiesQuery.data?.items ?? [])
        .filter((reservation) => reservation.isActive && reservation.reservationStatus.code !== "CANCELLED")
        .map((reservation) => reservation.opportunity.id)
        .filter((id): id is string => Boolean(id))
    );

    return (opportunitiesQuery.data?.items ?? []).filter((opportunity) => reservedOpportunityIds.has(opportunity.id));
  }, [opportunitiesQuery.data?.items, reservedOpportunitiesQuery.data?.items]);

  const equivalentCurrencyOptions = useMemo(() => {
    const reportingCodes = currencyContextQuery.data?.reportingCurrencyCodes ?? [];
    const codes = new Set([baseCurrency, ...reportingCodes, "USD"]);
    return currencyRows.filter((currency) => codes.has(currency.currencyCode));
  }, [baseCurrency, currencyContextQuery.data?.reportingCurrencyCodes, currencyRows]);

  const watchedListPrice = proposalForm.watch("listPrice");
  const watchedProposedPrice = proposalForm.watch("proposedPrice");
  const listPriceEquivalentHint = buildEquivalentHint(
    pickNumber(watchedListPrice),
    equivalentCurrencyCode,
    baseCurrency,
    ratesToBase,
    fromBase
  );
  const proposedPriceEquivalentHint = buildEquivalentHint(
    pickNumber(watchedProposedPrice),
    equivalentCurrencyCode,
    baseCurrency,
    ratesToBase,
    fromBase
  );
  const selectedProposalNextAction = selectedProposal ? proposalNextAction(selectedProposal) : null;
  const selectedProposalIsClosed =
    selectedProposal?.proposalStatus.code === "ACCEPTED" ||
    selectedProposal?.proposalStatus.code === "CANCELLED" ||
    selectedProposal?.proposalStatus.code === "EXPIRED";

  const stats = useMemo(() => {
    const summary = proposalsQuery.data?.summary;
    return {
      total: proposalsQuery.data?.pagination.total ?? 0,
      approvalRequired: summary?.approvalRequired ?? 0,
      approved: summary?.approved ?? 0,
      value: summary?.value ?? 0
    };
  }, [proposalsQuery.data]);

  const refreshProposal = (proposal: Proposal, successMessage: string) => {
    setMessage(successMessage);
    setSelectedProposalId(proposal.id);
    setProposalDetailModalOpen(true);
    queryClient.setQueryData(["proposal", proposal.id], proposal);
    void queryClient.invalidateQueries({ queryKey: ["proposals"] });
    void queryClient.invalidateQueries({ queryKey: ["proposal", proposal.id] });
  };

  const loadProposal = (proposalId: string) => {
    setSelectedProposalId(proposalId);
    setProposalDetailModalOpen(true);
  };

  const closeProposalDetailModal = () => {
    setProposalDetailModalOpen(false);
    setSelectedProposalId(null);
  };

  const openContractHandoff = (proposal: Proposal) => {
    if (!activeProposalReservation) {
      setMessage("No approved reservation found for this opportunity.");
      return;
    }

    closeProposalDetailModal();
    navigate(`/contracts?createFor=${activeProposalReservation.id}`, {
      state: {
        fromProposal: proposal.proposalNo,
        contractValue: proposal.proposedPrice,
        currencyCode: proposal.currencyCode ?? baseCurrency,
        remarks: `Contract from accepted proposal ${proposal.proposalNo}.`
      }
    });
  };

  const createMutation = useMutation({
    mutationFn: (values: ProposalFormValues) =>
      createProposal({
        opportunityId: values.opportunityId,
        unitId: pickString(values.unitId),
        validUntil: pickString(values.validUntil),
        currencyCode: baseCurrency,
        listPrice: pickNumber(values.listPrice),
        proposedPrice: pickNumber(values.proposedPrice),
        discountAmount: pickNumber(values.discountAmount),
        discountPercent: pickNumber(values.discountPercent),
        approvalThresholdPercent: pickNumber(values.approvalThresholdPercent),
        equivalentCurrencyCode,
        pricingContextJson: pricingContext
          ? { ...pricingContext, equivalentCurrencyCode }
          : { equivalentCurrencyCode },
        remarks: pickString(values.remarks)
      }),
    onSuccess: (proposal) => {
      setCreateOpen(false);
      setPricingContext(null);
      proposalForm.reset({
        opportunityId: "",
        unitId: "",
        validUntil: "",
        listPrice: "",
        proposedPrice: "",
        discountAmount: "",
        discountPercent: "",
        approvalThresholdPercent: "5",
        remarks: ""
      });
      refreshProposal(proposal, "Proposal created.");
    },
    onError: (error) => setMessage(getApiErrorMessage(error, "Proposal could not be created."))
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => submitProposal(id, pickString(actionForm.getValues("remarks"))),
    onSuccess: (proposal) => refreshProposal(proposal, "Proposal submitted."),
    onError: (error) => setMessage(getApiErrorMessage(error, "Proposal could not be submitted."))
  });
  const approveMutation = useMutation({
    mutationFn: (id: string) => approveProposal(id, pickString(actionForm.getValues("remarks"))),
    onSuccess: (proposal) => refreshProposal(proposal, "Proposal approved."),
    onError: (error) => setMessage(getApiErrorMessage(error, "Proposal could not be approved."))
  });
  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectProposal(id, actionForm.getValues("rejectionReason")),
    onSuccess: (proposal) => {
      actionForm.reset({ remarks: "", rejectionReason: "" });
      refreshProposal(proposal, "Proposal rejected.");
    },
    onError: (error) => setMessage(getApiErrorMessage(error, "Proposal could not be rejected."))
  });
  const acceptMutation = useMutation({
    mutationFn: (id: string) => acceptProposal(id, pickString(actionForm.getValues("remarks"))),
    onSuccess: (proposal) => {
      void queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      void queryClient.invalidateQueries({ queryKey: ["opportunity", proposal.opportunity.id] });
      refreshProposal(proposal, "Proposal accepted. Opportunity moved to Won.");
    },
    onError: (error) => setMessage(getApiErrorMessage(error, "Proposal could not be accepted."))
  });

  const onProposalSubmit = proposalForm.handleSubmit((values) => {
    if (!values.opportunityId) {
      setMessage("Select an opportunity.");
      return;
    }
    createMutation.mutate(values);
  });

  const openCreateModal = (opportunityId?: string) => {
    lastPrefilledOpportunityIdRef.current = null;
    handoffNoteRef.current = null;
    setPrefillSource(null);
    setPricingContext(null);
    setEquivalentCurrencyCode(
      equivalentCurrencyOptions.find((currency) => currency.currencyCode === "USD")?.currencyCode ??
        equivalentCurrencyOptions.find((currency) => currency.currencyCode !== baseCurrency)?.currencyCode ??
        baseCurrency
    );
    proposalForm.reset({
      opportunityId: opportunityId ?? "",
      unitId: "",
      validUntil: defaultProposalValidUntil(),
      listPrice: "",
      proposedPrice: "",
      discountAmount: "",
      discountPercent: "",
      approvalThresholdPercent: "5",
      remarks: ""
    });
    setCreateOpen(true);
  };

  useEffect(() => {
    const createFor = searchParams.get("createFor");
    if (!createFor || processedHandoffRef.current === createFor) {
      return;
    }

    processedHandoffRef.current = createFor;

    const navState = location.state as {
      fromReservation?: string;
      fromOpportunity?: string;
      handoffNotes?: string;
    } | null;
    const handoffNotes = navState?.handoffNotes?.trim();
    if (handoffNotes) {
      handoffNoteRef.current = handoffNotes;
    } else if (navState?.fromReservation) {
      handoffNoteRef.current = `Opened from approved reservation ${navState.fromReservation}.`;
    } else if (navState?.fromOpportunity) {
      handoffNoteRef.current = `Opened from opportunity ${navState.fromOpportunity} after moving to Proposal.`;
    }

    openCreateModal(createFor);

    if (handoffNotes) {
      proposalForm.setValue("remarks", handoffNotes);
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("createFor");
    setSearchParams(nextParams, { replace: true });
  }, [location.state, proposalForm, searchParams, setSearchParams]);

  const applyPricingFromUnit = (
    unit: Unit,
    options?: {
      proposedPrice?: number | null;
      proposedPriceCurrency?: string | null;
      reservationNo?: string | null;
    }
  ) => {
    applyUnitPricingToForm(proposalForm.setValue, unit, toBase, {
      proposedPrice: options?.proposedPrice,
      proposedPriceCurrency: options?.proposedPriceCurrency,
      overwriteProposedPrice: true
    });

    const context = buildPricingContext(unit, baseCurrency, equivalentCurrencyCode, ratesToBase, toBase, options);
    setPricingContext(context);
    setPrefillSource(buildPrefillSourceNote(context, baseCurrency, handoffNoteRef.current));
  };

  useEffect(() => {
    setPricingContext((current) => (current ? { ...current, equivalentCurrencyCode } : current));
  }, [equivalentCurrencyCode]);

  useEffect(() => {
    if (pricingContext) {
      setPrefillSource(buildPrefillSourceNote(pricingContext, baseCurrency, handoffNoteRef.current));
    }
  }, [baseCurrency, pricingContext]);

  useEffect(() => {
    if (!createOpen || !selectedOpportunityId || !unitsQuery.data) {
      return;
    }

    if (lastPrefilledOpportunityIdRef.current === selectedOpportunityId) {
      return;
    }

    if (opportunityReservationPrefillQuery.isFetching) {
      return;
    }

    lastPrefilledOpportunityIdRef.current = selectedOpportunityId;

    const units = unitsQuery.data.items;
    const opportunity = selectedOpportunity;
    const activeReservation = activeOpportunityReservation;

    let unit: Unit | undefined;
    let proposedPrice: number | null | undefined;
    let proposedPriceCurrency: string | null | undefined;
    let reservationNo: string | null = null;

    if (activeReservation) {
      unit = units.find((item) => item.id === activeReservation.unit.id);
      proposedPrice = activeReservation.reservationAmount ?? opportunity?.budgetAmount ?? null;
      proposedPriceCurrency = activeReservation.currencyCode ?? opportunity?.currencyCode ?? unit?.currencyCode ?? null;
      reservationNo = activeReservation.reservationNo;
    }

    if (!unit && opportunity?.proposedUnitCode) {
      unit = units.find((item) => item.unitCode === opportunity.proposedUnitCode);
      proposedPrice = opportunity.budgetAmount ?? unit?.basePrice ?? null;
      proposedPriceCurrency = opportunity.currencyCode ?? unit?.currencyCode ?? null;
    }

    if (unit) {
      applyPricingFromUnit(unit, { proposedPrice, proposedPriceCurrency, reservationNo });
      proposalForm.setValue(
        "remarks",
        activeReservation
          ? `Proposal from reservation ${activeReservation.reservationNo}.`
          : opportunity?.remarks ?? ""
      );
      return;
    }

    setPricingContext(null);
    proposalForm.setValue("unitId", "");
    proposalForm.setValue("listPrice", "");
    proposalForm.setValue(
      "proposedPrice",
      opportunity?.budgetAmount != null ? formatDiscountNumber(toBase(opportunity.budgetAmount, opportunity.currencyCode)) : ""
    );
    setPrefillSource("No reserved unit found for this opportunity. Select a unit manually.");
  }, [
    activeOpportunityReservation,
    baseCurrency,
    createOpen,
    opportunityReservationPrefillQuery.isFetching,
    proposalForm,
    selectedOpportunity,
    selectedOpportunityId,
    toBase,
    unitsQuery.data,
    equivalentCurrencyCode,
    ratesToBase
  ]);

  useModalEscape(proposalDetailModalOpen, closeProposalDetailModal, { disabled: createOpen });
  useModalEscape(createOpen, () => setCreateOpen(false));

  const selectedProposalAuditLines = buildProposalAuditLines(selectedProposal?.pricingContextJson ?? null, baseCurrency);

  return (
    <div className="crm-workspace">
      <section className="crm-module-header">
        <div>
          <p className="crm-eyebrow">Pricing</p>
          <div className="crm-dashboard-title-row">
            <h2>Proposal Workspace</h2>
            <CurrencyBadge />
          </div>
        </div>
        <button className="crm-primary-button" onClick={() => openCreateModal()} type="button">
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
          <section aria-modal="true" className="crm-modal crm-management-modal crm-reservation-modal crm-proposal-modal" role="dialog">
            <div className="crm-panel-header">
              <div>
                <h3>Create Proposal</h3>
                <p className="crm-muted-text">All proposal amounts are captured in base currency ({baseCurrency}).</p>
              </div>
              <button className="crm-secondary-button crm-fit-button" onClick={() => setCreateOpen(false)} type="button">
                Close
              </button>
            </div>
            <form className="crm-reservation-modal-form" onSubmit={onProposalSubmit}>
              <div className="crm-reservation-modal-body">
                <div className="crm-proposal-modal-fields">
                  <label className="crm-field crm-form-wide">
                    <span className="crm-label">Opportunity</span>
                    <select
                      className="crm-input"
                      {...proposalForm.register("opportunityId", {
                        onChange: (event) => {
                          lastPrefilledOpportunityIdRef.current = null;
                          setPrefillSource(null);
                          proposalForm.setValue("opportunityId", event.target.value);
                          proposalForm.setValue("unitId", "");
                          proposalForm.setValue("listPrice", "");
                          proposalForm.setValue("proposedPrice", "");
                        }
                      })}
                    >
                      <option value="">Select reservation-backed opportunity</option>
                      {proposalOpportunities.map((opportunity) => (
                        <option key={opportunity.id} value={opportunity.id}>
                          {opportunity.opportunityNo} - {opportunity.customer.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {prefillSource ? <p className="crm-proposal-prefill-note crm-form-wide">{prefillSource}</p> : null}
                  <label className="crm-field crm-form-wide">
                    <span className="crm-label">Unit</span>
                    <select
                      className="crm-input"
                      {...proposalForm.register("unitId", {
                        onChange: (event) => {
                          const unit = proposalUnits.find((item) => item.id === event.target.value);
                          if (unit) {
                            applyPricingFromUnit(unit, {
                              proposedPrice: pickNumber(proposalForm.getValues("proposedPrice")),
                              proposedPriceCurrency: baseCurrency
                            });
                          }
                        }
                      })}
                    >
                      <option value="">Select unit</option>
                      {proposalUnits.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.unitCode} - {formatInBase(unit.basePrice, unit.currencyCode)}
                          {unit.id === activeOpportunityReservation?.unit.id ? " (Reserved)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="crm-field">
                    <span className="crm-label">Deal Currency</span>
                    <input className="crm-input crm-input-readonly" disabled readOnly value={baseCurrency} />
                  </label>
                  <label className="crm-field">
                    <span className="crm-label">Show Equivalent In</span>
                    <select
                      className="crm-input"
                      onChange={(event) => setEquivalentCurrencyCode(event.target.value)}
                      value={equivalentCurrencyCode}
                    >
                      {equivalentCurrencyOptions.map((currency) => (
                        <option key={currency.id} value={currency.currencyCode}>
                          {currency.currencyCode} - {currency.currencyName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="crm-field">
                    <span className="crm-label">List Price ({baseCurrency})</span>
                    <input
                      className="crm-input"
                      inputMode="decimal"
                      {...proposalForm.register("listPrice", {
                        onChange: (event) => {
                          proposalForm.setValue("listPrice", event.target.value);
                          recalculateProposalDiscount(
                            proposalForm.setValue,
                            event.target.value,
                            proposalForm.getValues("proposedPrice")
                          );
                        }
                      })}
                    />
                    {listPriceEquivalentHint ? <p className="crm-field-hint">{listPriceEquivalentHint}</p> : null}
                  </label>
                  <label className="crm-field">
                    <span className="crm-label">Proposed Price ({baseCurrency})</span>
                    <input
                      className="crm-input"
                      inputMode="decimal"
                      {...proposalForm.register("proposedPrice", {
                        onChange: (event) => {
                          proposalForm.setValue("proposedPrice", event.target.value);
                          recalculateProposalDiscount(
                            proposalForm.setValue,
                            proposalForm.getValues("listPrice"),
                            event.target.value
                          );
                        }
                      })}
                    />
                    {proposedPriceEquivalentHint ? <p className="crm-field-hint">{proposedPriceEquivalentHint}</p> : null}
                  </label>
                  <label className="crm-field">
                    <span className="crm-label">Discount Amount ({baseCurrency})</span>
                    <input className="crm-input crm-input-readonly" readOnly {...proposalForm.register("discountAmount")} />
                  </label>
                  <label className="crm-field">
                    <span className="crm-label">Discount %</span>
                    <input className="crm-input crm-input-readonly" readOnly {...proposalForm.register("discountPercent")} />
                  </label>
                  <label className="crm-field">
                    <span className="crm-label">Valid Until</span>
                    <Controller
                      control={proposalForm.control}
                      name="validUntil"
                      render={({ field }) => (
                        <DateField onBlur={field.onBlur} onChange={field.onChange} ref={field.ref} value={field.value} />
                      )}
                    />
                  </label>
                  <label className="crm-field">
                    <span className="crm-label">Approval Threshold %</span>
                    <input className="crm-input" inputMode="decimal" {...proposalForm.register("approvalThresholdPercent")} />
                  </label>
                  <label className="crm-field crm-form-wide">
                    <span className="crm-label">Remarks</span>
                    <textarea className="crm-input crm-textarea crm-opportunity-textarea" {...proposalForm.register("remarks")} />
                  </label>
                </div>
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
              </div>
              <div className="crm-modal-actions crm-modal-actions-sticky">
                <button className="crm-secondary-button crm-fit-button" onClick={() => setCreateOpen(false)} type="button">
                  Close
                </button>
                <button className="crm-primary-button crm-fit-button" disabled={createMutation.isPending} type="submit">
                  {createMutation.isPending ? "Creating..." : "Create Proposal"}
                </button>
              </div>
            </form>
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
                  className={selectedProposalId === proposal.id && proposalDetailModalOpen ? "is-selected" : ""}
                  key={proposal.id}
                  onClick={() => loadProposal(proposal.id)}
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

      {proposalDetailModalOpen ? (
        <div className="crm-modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="crm-modal crm-management-modal crm-lead-detail-modal crm-opportunity-detail-modal"
            role="dialog"
          >
            <div className="crm-panel-header">
              <div>
                <h3>Proposal Detail</h3>
                <p className="crm-muted-text">{selectedProposal?.proposalNo ?? "Loading proposal..."}</p>
              </div>
              <button className="crm-secondary-button crm-fit-button" onClick={closeProposalDetailModal} type="button">
                Close
              </button>
            </div>

            {proposalDetailQuery.isLoading && !selectedProposal ? (
              <p className="crm-muted-text crm-opportunity-detail-body">Loading proposal details...</p>
            ) : selectedProposal ? (
              <div className="crm-opportunity-detail-body">
                <div className="crm-detail-title">
                  <div>
                    <strong>{selectedProposal.customer.name}</strong>
                    <span>{selectedProposal.proposalNo}</span>
                  </div>
                  <span className="crm-status-pill">{selectedProposal.proposalStatus.name}</span>
                </div>
                <SalesPipelineStrip current="proposal" />
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
                  {selectedProposal.equivalentCurrencyCode ? (
                    <div>
                      <dt>Equivalent Currency</dt>
                      <dd>{selectedProposal.equivalentCurrencyCode}</dd>
                    </div>
                  ) : null}
                </dl>

                {selectedProposalAuditLines.length > 0 ? (
                  <section className="crm-activity-list">
                    <h4>Pricing Audit</h4>
                    {selectedProposalAuditLines.map((line) => (
                      <p className="crm-muted-text" key={line}>
                        {line}
                      </p>
                    ))}
                  </section>
                ) : null}

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
                  <>
                    <section className="crm-opportunity-actions">
                    <div className="crm-opportunity-action-card crm-opportunity-action-card-wide">
                      <div className="crm-opportunity-action-card-header">
                        <h4>Workflow Actions</h4>
                        <p className="crm-muted-text">
                          Current status: {selectedProposal.proposalStatus.name ?? "-"}
                          {selectedProposal.approvalRequired ? " · Management approval required" : ""}
                        </p>
                      </div>
                      <div className="crm-opportunity-action-card-fields">
                        <label className="crm-field">
                          <span className="crm-label">Action Remarks</span>
                          <textarea
                            className="crm-input crm-textarea crm-opportunity-textarea"
                            placeholder="Optional remarks for submit, approve, or accept"
                            {...actionForm.register("remarks")}
                          />
                        </label>
                      </div>
                      <div className="crm-opportunity-action-card-footer">
                        <button
                          className={`crm-opportunity-action-button ${["DRAFT", "REJECTED"].includes(selectedProposal.proposalStatus.code ?? "") ? "crm-primary-button" : "crm-secondary-button"}`}
                          disabled={!["DRAFT", "REJECTED"].includes(selectedProposal.proposalStatus.code ?? "") || submitMutation.isPending}
                          onClick={() => submitMutation.mutate(selectedProposal.id)}
                          type="button"
                        >
                          {submitMutation.isPending ? "Submitting..." : "Submit Proposal"}
                        </button>
                        <button
                          className={`crm-opportunity-action-button ${selectedProposal.proposalStatus.code === "SUBMITTED" ? "crm-primary-button" : "crm-secondary-button"}`}
                          disabled={selectedProposal.proposalStatus.code !== "SUBMITTED" || approveMutation.isPending}
                          onClick={() => approveMutation.mutate(selectedProposal.id)}
                          type="button"
                        >
                          {approveMutation.isPending ? "Approving..." : "Approve Proposal"}
                        </button>
                        <button
                          className={`crm-opportunity-action-button ${selectedProposal.proposalStatus.code === "APPROVED" ? "crm-primary-button" : "crm-secondary-button"}`}
                          disabled={selectedProposal.proposalStatus.code !== "APPROVED" || acceptMutation.isPending}
                          onClick={() => acceptMutation.mutate(selectedProposal.id)}
                          type="button"
                        >
                          {acceptMutation.isPending ? "Accepting..." : "Accept Proposal"}
                        </button>
                      </div>
                    </div>

                    <form
                      className="crm-opportunity-action-card crm-opportunity-lost-card"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (actionForm.getValues("rejectionReason").trim() === "") {
                          setMessage("Enter rejection reason.");
                          return;
                        }
                        rejectMutation.mutate(selectedProposal.id);
                      }}
                    >
                      <div className="crm-opportunity-action-card-header">
                        <h4>Rejection Control</h4>
                        <p className="crm-muted-text">Reject a submitted proposal and return it for revision.</p>
                      </div>
                      <div className="crm-opportunity-lost-fields">
                        <label className="crm-field">
                          <span className="crm-label">
                            Rejection Reason <span className="crm-label-required-inline">*</span>
                          </span>
                          <textarea
                            className="crm-input crm-textarea crm-opportunity-textarea"
                            placeholder="Reason required when rejecting a submitted proposal"
                            {...actionForm.register("rejectionReason")}
                          />
                        </label>
                        <div className="crm-opportunity-action-card-footer crm-opportunity-lost-footer">
                          <button
                            className="crm-secondary-button crm-opportunity-action-button"
                            disabled={selectedProposal.proposalStatus.code !== "SUBMITTED" || rejectMutation.isPending}
                            type="submit"
                          >
                            {rejectMutation.isPending ? "Rejecting..." : "Reject Proposal"}
                          </button>
                        </div>
                      </div>
                    </form>
                  </section>

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
                  </>
                ) : (
                  <>
                    <section className="crm-next-action">
                      <div>
                        <span className="crm-label">Close-Off Stage</span>
                        <strong>Accepted</strong>
                        <p>Proposal chapter is complete. {MOVE_TO_CTA.contract} when ready.</p>
                      </div>
                      <div>
                        <span className="crm-label">Accepted By</span>
                        <p>{selectedProposal.acceptedBy.name ?? "-"}</p>
                      </div>
                    </section>

                    {activeProposalReservation ? (
                      <section className="crm-opportunity-actions">
                        <div className="crm-opportunity-action-card crm-opportunity-action-card-wide">
                          <div className="crm-opportunity-action-card-header">
                            <h4>{MOVE_TO_CTA.contract}</h4>
                            <p className="crm-muted-text">
                              Proposal accepted at {formatInBase(selectedProposal.proposedPrice, selectedProposal.currencyCode)}.
                              Open contract form with reservation {activeProposalReservation.reservationNo} and value pre-filled.
                            </p>
                          </div>
                          <div className="crm-opportunity-action-card-footer">
                            <button
                              className="crm-secondary-button crm-opportunity-action-button"
                              onClick={() => navigate(`/reservations?selected=${activeProposalReservation.id}`)}
                              type="button"
                            >
                              View Reservation
                            </button>
                            <button
                              className="crm-primary-button crm-opportunity-action-button"
                              onClick={() => openContractHandoff(selectedProposal)}
                              type="button"
                            >
                              {MOVE_TO_CTA.contract}
                            </button>
                          </div>
                        </div>
                      </section>
                    ) : (
                      <p className="crm-muted-text">No approved reservation is available to move to contract.</p>
                    )}
                  </>
                )}
              </div>
            ) : (
              <p className="crm-muted-text crm-opportunity-detail-body">Proposal details could not be loaded.</p>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
