import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useForm, type FieldValues, type Path, type UseFormRegister } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import {
  assignLead,
  checkLeadDuplicate,
  createLead,
  getLead,
  listLeadAssignableUsers,
  listLeadCampaigns,
  listLeads,
  qualifyLead,
  updateLead,
  type CreateLeadPayload,
  type Lead,
  type LeadAssignableUser,
  type LeadCampaignOption,
  type QualifyLeadPayload
} from "../api/leads";
import { convertLeadToOpportunity } from "../api/opportunities";
import { getReferenceFamily, type ReferenceDataItem } from "../api/reference-data";
import { DEFAULT_LIST_PAGE_SIZE, getRowSerialNumber } from "../lib/list-pagination";
import {
  buildLeadValidationMessage,
  getFirstInvalidLeadField,
  todayIsoDate,
  validateMandatoryLeadFields,
  type LeadFormFieldName
} from "../lib/lead-form-validation";
import { ListPagination } from "../shared/ListPagination";
import { FormNoticeDialog } from "../shared/FormNoticeDialog";
import { WorkflowTracker, type WorkflowStep } from "../shared/WorkflowTracker";
import { useMoneyFormatter } from "../hooks/useCurrencyContext";
import { useAuthStore } from "../store/auth-store";

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

type LeadFormValues = {
  firstName: string;
  lastName: string;
  mobileNo: string;
  whatsappNo: string;
  email: string;
  leadSourceRefId: string;
  captureChannelRefId: string;
  campaignId: string;
  campaignNotes: string;
  assignedToUserId: string;
  dateGenerated: string;
  leadRatingRefId: string;
  genderRefId: string;
  dateOfBirth: string;
  nationalityRefId: string;
  countryRefId: string;
  city: string;
  currentResidenceCountryRefId: string;
  buyerTypeRefId: string;
  fundingSourceRefId: string;
  purposeOfPurchaseRefId: string;
  decisionMakerStatusRefId: string;
  affordabilityStatusRefId: string;
  lastInteractionAt: string;
  lastInteractionTypeRefId: string;
  interactionOutcomeRefId: string;
  interactionCount: string;
  budgetMax: string;
  preferredCurrencyCode: string;
  preferredProjectCode: string;
  preferredLocationCode: string;
  preferredUnitTypeRefId: string;
  preferredBedroomRefId: string;
  preferredViewRefId: string;
  incomeRangeRefId: string;
  acquisitionCost: string;
  purchaseTimelineRefId: string;
  qualificationNotes: string;
  scoreTotal: string;
  remarks: string;
};

type QualifyFormValues = {
  leadRatingRefId: string;
  genderRefId: string;
  dateOfBirth: string;
  nationalityRefId: string;
  countryRefId: string;
  city: string;
  currentResidenceCountryRefId: string;
  buyerTypeRefId: string;
  fundingSourceRefId: string;
  purposeOfPurchaseRefId: string;
  decisionMakerStatusRefId: string;
  affordabilityStatusRefId: string;
  lastInteractionAt: string;
  lastInteractionTypeRefId: string;
  interactionOutcomeRefId: string;
  interactionCount: string;
  purchaseTimelineRefId: string;
  budgetMax: string;
  preferredBedroomRefId: string;
  preferredViewRefId: string;
  incomeRangeRefId: string;
  acquisitionCost: string;
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

function getApiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)?.message;
    return message && message.trim() !== "" ? message : fallback;
  }

  return fallback;
}

function toCreatePayload(values: LeadFormValues): CreateLeadPayload {
  return {
    firstName: pickString(values.firstName),
    lastName: pickString(values.lastName),
    mobileNo: pickString(values.mobileNo),
    whatsappNo: pickString(values.whatsappNo),
    email: pickString(values.email),
    leadSourceRefId: pickString(values.leadSourceRefId),
    captureChannelRefId: pickString(values.captureChannelRefId),
    campaignId: pickString(values.campaignId),
    campaignNotes: pickString(values.campaignNotes),
    assignedToUserId: pickString(values.assignedToUserId),
    dateGenerated: pickString(values.dateGenerated),
    leadRatingRefId: pickString(values.leadRatingRefId),
    genderRefId: pickString(values.genderRefId),
    dateOfBirth: pickString(values.dateOfBirth),
    nationalityRefId: pickString(values.nationalityRefId),
    countryRefId: pickString(values.countryRefId),
    city: pickString(values.city),
    currentResidenceCountryRefId: pickString(values.currentResidenceCountryRefId),
    buyerTypeRefId: pickString(values.buyerTypeRefId),
    fundingSourceRefId: pickString(values.fundingSourceRefId),
    purposeOfPurchaseRefId: pickString(values.purposeOfPurchaseRefId),
    decisionMakerStatusRefId: pickString(values.decisionMakerStatusRefId),
    affordabilityStatusRefId: pickString(values.affordabilityStatusRefId),
    lastInteractionAt: pickString(values.lastInteractionAt),
    lastInteractionTypeRefId: pickString(values.lastInteractionTypeRefId),
    interactionOutcomeRefId: pickString(values.interactionOutcomeRefId),
    interactionCount: pickNumber(values.interactionCount),
    budgetMax: pickNumber(values.budgetMax),
    preferredCurrencyCode: pickString(values.preferredCurrencyCode),
    preferredProjectCode: pickString(values.preferredProjectCode),
    preferredLocationCode: pickString(values.preferredLocationCode),
    preferredUnitTypeRefId: pickString(values.preferredUnitTypeRefId),
    preferredBedroomRefId: pickString(values.preferredBedroomRefId),
    preferredViewRefId: pickString(values.preferredViewRefId),
    incomeRangeRefId: pickString(values.incomeRangeRefId),
    acquisitionCost: pickNumber(values.acquisitionCost),
    purchaseTimelineRefId: pickString(values.purchaseTimelineRefId),
    qualificationNotes: pickString(values.qualificationNotes),
    scoreTotal: pickNumber(values.scoreTotal),
    remarks: pickString(values.remarks)
  };
}

function toQualifyPayload(values: QualifyFormValues): QualifyLeadPayload {
  return {
    leadRatingRefId: pickString(values.leadRatingRefId),
    genderRefId: pickString(values.genderRefId),
    dateOfBirth: pickString(values.dateOfBirth),
    nationalityRefId: pickString(values.nationalityRefId),
    countryRefId: pickString(values.countryRefId),
    city: pickString(values.city),
    currentResidenceCountryRefId: pickString(values.currentResidenceCountryRefId),
    buyerTypeRefId: pickString(values.buyerTypeRefId),
    fundingSourceRefId: pickString(values.fundingSourceRefId),
    purposeOfPurchaseRefId: pickString(values.purposeOfPurchaseRefId),
    decisionMakerStatusRefId: pickString(values.decisionMakerStatusRefId),
    affordabilityStatusRefId: pickString(values.affordabilityStatusRefId),
    lastInteractionAt: pickString(values.lastInteractionAt),
    lastInteractionTypeRefId: pickString(values.lastInteractionTypeRefId),
    interactionOutcomeRefId: pickString(values.interactionOutcomeRefId),
    interactionCount: pickNumber(values.interactionCount),
    purchaseTimelineRefId: pickString(values.purchaseTimelineRefId),
    budgetMax: pickNumber(values.budgetMax),
    preferredBedroomRefId: pickString(values.preferredBedroomRefId),
    preferredViewRefId: pickString(values.preferredViewRefId),
    incomeRangeRefId: pickString(values.incomeRangeRefId),
    acquisitionCost: pickNumber(values.acquisitionCost),
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

function leadWorkflowSteps(lead: Lead, formatBudget: (max: number | null, currency?: string | null) => string): WorkflowStep[] {
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
        { label: "Contact", value: [lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.contactName },
        { label: "Mobile", value: lead.mobileNo },
        { label: "Email", value: lead.email },
        { label: "Source", value: lead.leadSource.name },
        { label: "Channel", value: lead.captureChannel.name },
        { label: "Budget", value: formatBudget(lead.budgetMax, lead.preferredCurrencyCode) },
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
      status: isConverted ? "completed" : "next",
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

const blankLeadForm: LeadFormValues = {
  firstName: "",
  lastName: "",
  mobileNo: "",
  whatsappNo: "",
  email: "",
  leadSourceRefId: "",
  captureChannelRefId: "",
  campaignId: "",
  campaignNotes: "",
  assignedToUserId: "",
  dateGenerated: todayIsoDate(),
  leadRatingRefId: "",
  genderRefId: "",
  dateOfBirth: "",
  nationalityRefId: "",
  countryRefId: "",
  city: "",
  currentResidenceCountryRefId: "",
  buyerTypeRefId: "",
  fundingSourceRefId: "",
  purposeOfPurchaseRefId: "",
  decisionMakerStatusRefId: "",
  affordabilityStatusRefId: "",
  lastInteractionAt: "",
  lastInteractionTypeRefId: "",
  interactionOutcomeRefId: "",
  interactionCount: "",
  budgetMax: "",
  preferredCurrencyCode: "KES",
  preferredProjectCode: "",
  preferredLocationCode: "",
  preferredUnitTypeRefId: "",
  preferredBedroomRefId: "",
  preferredViewRefId: "",
  incomeRangeRefId: "",
  acquisitionCost: "",
  purchaseTimelineRefId: "",
  qualificationNotes: "",
  scoreTotal: "",
  remarks: ""
};

const leadSourceToChannelFamilyMap: Record<string, string> = {
  "digital marketing": "Digital Marketing",
  "property portals": "Property Portal",
  "broker channels": "Broker Channel",
  referrals: "Referral",
  "events & exhibitions": "Events",
  "hospitality channels": "Hospitality",
  "direct sales": "Direct Sales",
  "strategic partners": "Strategic Partners",
  "public relations": "Public Relations"
};

function resolveLeadChannelFamily(sourceName: string | null | undefined) {
  if (!sourceName) {
    return null;
  }

  const key = sourceName.trim().toLowerCase();
  return leadSourceToChannelFamilyMap[key] ?? sourceName.trim();
}

function FieldLabel({ children, required = false }: { children: string; required?: boolean }) {
  return <span className={required ? "crm-label crm-label-required" : "crm-label"}>{children}</span>;
}

function SelectField<TFormValues extends FieldValues>({
  label,
  name,
  options,
  register,
  required = false
}: {
  label: string;
  name: Path<TFormValues>;
  options: ReferenceDataItem[];
  register: UseFormRegister<TFormValues>;
  required?: boolean;
}) {
  return (
    <label className="crm-field">
      <FieldLabel required={required}>{label}</FieldLabel>
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

function CampaignSelectField<TFormValues extends FieldValues>({
  label,
  name,
  options,
  register,
  required = false
}: {
  label: string;
  name: Path<TFormValues>;
  options: LeadCampaignOption[];
  register: UseFormRegister<TFormValues>;
  required?: boolean;
}) {
  return (
    <label className="crm-field">
      <FieldLabel required={required}>{label}</FieldLabel>
      <select className="crm-input" {...register(name)}>
        <option value="">Select campaign</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function FormSectionTitle({ children }: { children: string }) {
  return <h4 className="crm-form-section-title crm-form-wide">{children}</h4>;
}

function UserSelectField<TFormValues extends FieldValues>({
  label,
  name,
  options,
  register,
  required = false
}: {
  label: string;
  name: Path<TFormValues>;
  options: LeadAssignableUser[];
  register: UseFormRegister<TFormValues>;
  required?: boolean;
}) {
  return (
    <label className="crm-field">
      <FieldLabel required={required}>{label}</FieldLabel>
      <select className="crm-input" {...register(name)}>
        <option value="">Select owner</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function LeadsPage() {
  const { formatInBase, baseCurrency } = useMoneyFormatter();

  const formatLeadBudget = (max: number | null, currency?: string | null) => formatInBase(max, currency);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = DEFAULT_LIST_PAGE_SIZE;
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [leadCreateModalOpen, setLeadCreateModalOpen] = useState(false);
  const [leadDetailModalOpen, setLeadDetailModalOpen] = useState(false);
  const [assignTargetUserId, setAssignTargetUserId] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeDialog, setNoticeDialog] = useState<NoticeState>({
    open: false,
    title: "",
    message: "",
    variant: "info"
  });
  const [isValidatingLead, setIsValidatingLead] = useState(false);
  const firstNameInputRef = useRef<HTMLInputElement | null>(null);
  const pendingFocusFieldRef = useRef<LeadFormFieldName | null>(null);

  const showNotice = (title: string, message: string, variant: NoticeState["variant"]) => {
    setNoticeDialog({ open: true, title, message, variant });
  };

  const isLeadEditorOpen = leadCreateModalOpen || leadDetailModalOpen;

  const leadSourcesQuery = useQuery({
    queryKey: ["reference", "LEAD", "CATEGORY"],
    queryFn: () => getReferenceFamily("LEAD", "CATEGORY"),
    ...referenceQueryDefaults
  });
  const leadRatingsQuery = useQuery({
    queryKey: ["reference", "LEAD", "RATING"],
    queryFn: () => getReferenceFamily("LEAD", "RATING"),
    ...referenceQueryDefaults
  });
  const gendersQuery = useQuery({
    queryKey: ["reference", "PERSON", "GENDER"],
    queryFn: () => getReferenceFamily("PERSON", "GENDER"),
    ...referenceQueryDefaults
  });
  const nationalitiesQuery = useQuery({
    queryKey: ["reference", "ORGANIZATION", "NATIONALITY"],
    queryFn: () => getReferenceFamily("ORGANIZATION", "NATIONALITY"),
    ...referenceQueryDefaults
  });
  const countriesQuery = useQuery({
    queryKey: ["reference", "ORGANIZATION", "COUNTRY"],
    queryFn: () => getReferenceFamily("ORGANIZATION", "COUNTRY"),
    ...referenceQueryDefaults
  });
  const buyerTypesQuery = useQuery({
    queryKey: ["reference", "CUSTOMER", "BUYER_TYPE"],
    queryFn: () => getReferenceFamily("CUSTOMER", "BUYER_TYPE"),
    ...referenceQueryDefaults
  });
  const fundingSourcesQuery = useQuery({
    queryKey: ["reference", "CUSTOMER", "FUNDING_SOURCE"],
    queryFn: () => getReferenceFamily("CUSTOMER", "FUNDING_SOURCE"),
    ...referenceQueryDefaults
  });
  const purposeOfPurchaseQuery = useQuery({
    queryKey: ["reference", "LEAD", "PURPOSE_OF_PURCHASE"],
    queryFn: () => getReferenceFamily("LEAD", "PURPOSE_OF_PURCHASE"),
    ...referenceQueryDefaults
  });
  const decisionMakerStatusQuery = useQuery({
    queryKey: ["reference", "LEAD", "DECISION_MAKER_STATUS"],
    queryFn: () => getReferenceFamily("LEAD", "DECISION_MAKER_STATUS"),
    ...referenceQueryDefaults
  });
  const affordabilityStatusQuery = useQuery({
    queryKey: ["reference", "LEAD", "AFFORDABILITY_STATUS"],
    queryFn: () => getReferenceFamily("LEAD", "AFFORDABILITY_STATUS"),
    ...referenceQueryDefaults
  });
  const interactionTypeQuery = useQuery({
    queryKey: ["reference", "LEAD", "INTERACTION_TYPE"],
    queryFn: () => getReferenceFamily("LEAD", "INTERACTION_TYPE"),
    ...referenceQueryDefaults
  });
  const interactionOutcomeQuery = useQuery({
    queryKey: ["reference", "LEAD", "INTERACTION_OUTCOME"],
    queryFn: () => getReferenceFamily("LEAD", "INTERACTION_OUTCOME"),
    ...referenceQueryDefaults
  });
  const unitTypesQuery = useQuery({
    queryKey: ["reference", "INVENTORY", "UNIT_TYPE"],
    queryFn: () => getReferenceFamily("INVENTORY", "UNIT_TYPE"),
    ...referenceQueryDefaults
  });
  const bedroomQuery = useQuery({
    queryKey: ["reference", "INVENTORY", "BEDROOM_COUNT"],
    queryFn: () => getReferenceFamily("INVENTORY", "BEDROOM_COUNT"),
    ...referenceQueryDefaults
  });
  const viewTypeQuery = useQuery({
    queryKey: ["reference", "INVENTORY", "VIEW_TYPE"],
    queryFn: () => getReferenceFamily("INVENTORY", "VIEW_TYPE"),
    ...referenceQueryDefaults
  });
  const incomeRangeQuery = useQuery({
    queryKey: ["reference", "PERSON", "INCOME RANGE"],
    queryFn: () => getReferenceFamily("PERSON", "INCOME RANGE"),
    ...referenceQueryDefaults
  });
  const timelinesQuery = useQuery({
    queryKey: ["reference", "LEAD", "PURCHASE_TIMELINE"],
    queryFn: () => getReferenceFamily("LEAD", "PURCHASE_TIMELINE"),
    ...referenceQueryDefaults
  });
  const campaignsQuery = useQuery({
    queryKey: ["leads", "campaigns"],
    queryFn: listLeadCampaigns,
    staleTime: 30 * 60 * 1000,
    enabled: isLeadEditorOpen,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });
  const assignableUsersQuery = useQuery({
    queryKey: ["leads", "assignable-users"],
    queryFn: listLeadAssignableUsers,
    staleTime: 30 * 60 * 1000,
    enabled: isLeadEditorOpen,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });

  const leadsQuery = useQuery({
    queryKey: ["leads", search, page],
    queryFn: () =>
      listLeads({
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

  const leadDetailQuery = useQuery({
    queryKey: ["lead", selectedLeadId],
    queryFn: () => getLead(selectedLeadId ?? ""),
    enabled: Boolean(selectedLeadId && leadDetailModalOpen),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });

  const createForm = useForm<LeadFormValues>({
    defaultValues: { ...blankLeadForm, preferredCurrencyCode: baseCurrency }
  });

  const closeNotice = () => {
    setNoticeDialog((current) => ({ ...current, open: false }));

    if (pendingFocusFieldRef.current) {
      const fieldName = pendingFocusFieldRef.current;
      pendingFocusFieldRef.current = null;
      window.setTimeout(() => {
        createForm.setFocus(fieldName);
      }, 0);
    }
  };

  const selectedLeadSourceRefId = createForm.watch("leadSourceRefId");
  const selectedLeadSourceName = useMemo(
    () => (leadSourcesQuery.data ?? []).find((item) => item.id === selectedLeadSourceRefId)?.level2Name ?? null,
    [leadSourcesQuery.data, selectedLeadSourceRefId]
  );
  const selectedLeadChannelFamily = useMemo(
    () => resolveLeadChannelFamily(selectedLeadSourceName),
    [selectedLeadSourceName]
  );
  const channelsQuery = useQuery({
    queryKey: ["reference", "LEAD", selectedLeadChannelFamily],
    queryFn: () => getReferenceFamily("LEAD", selectedLeadChannelFamily ?? ""),
    enabled: Boolean(selectedLeadChannelFamily && leadCreateModalOpen),
    ...referenceQueryDefaults
  });
  const previousLeadSourceRef = useRef("");

  const qualifyForm = useForm<QualifyFormValues>({
    defaultValues: {
      leadRatingRefId: "",
      genderRefId: "",
      dateOfBirth: "",
      nationalityRefId: "",
      countryRefId: "",
      city: "",
      currentResidenceCountryRefId: "",
      buyerTypeRefId: "",
      fundingSourceRefId: "",
      purchaseTimelineRefId: "",
      budgetMax: "",
      preferredBedroomRefId: "",
      preferredViewRefId: "",
      incomeRangeRefId: "",
      acquisitionCost: "",
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
      createForm.reset({ ...blankLeadForm, preferredCurrencyCode: baseCurrency, dateGenerated: todayIsoDate(), assignedToUserId: user?.id ?? "" });
      setLeadCreateModalOpen(false);
      setLeadDetailModalOpen(true);
      queryClient.setQueryData(["lead", lead.id], lead);
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
      showNotice("Lead Created", `Lead ${lead.leadNo} was created successfully.`, "success");
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, "Lead could not be created. Check required fields and reference values.");
      setErrorMessage(message);
      showNotice("Lead Not Created", message, "error");
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CreateLeadPayload }) => updateLead(id, payload),
    onSuccess: (lead) => {
      setErrorMessage(null);
      setSelectedLeadId(lead.id);
      setEditingLeadId(null);
      createForm.reset({ ...blankLeadForm, preferredCurrencyCode: baseCurrency, dateGenerated: todayIsoDate(), assignedToUserId: user?.id ?? "" });
      setLeadCreateModalOpen(false);
      setLeadDetailModalOpen(true);
      queryClient.setQueryData(["lead", lead.id], lead);
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
      void queryClient.invalidateQueries({ queryKey: ["lead", lead.id] });
      showNotice("Lead Updated", `Lead ${lead.leadNo} was updated successfully.`, "success");
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, "Lead could not be updated.");
      setErrorMessage(message);
      showNotice("Lead Not Updated", message, "error");
    }
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
    onError: (error) => {
      const message = getApiErrorMessage(error, "Lead could not be qualified. Complete the qualification checklist and try again.");
      setErrorMessage(message);
      showNotice("Qualification Failed", message, "error");
    }
  });

  const assignMutation = useMutation({
    mutationFn: ({ leadId, assignedToUserId }: { leadId: string; assignedToUserId: string }) => {
      return assignLead(leadId, assignedToUserId, "Assigned from lead detail");
    },
    onSuccess: (lead) => {
      setErrorMessage(null);
      setSelectedLeadId(lead.id);
      queryClient.setQueryData(["lead", lead.id], lead);
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
      void queryClient.invalidateQueries({ queryKey: ["lead", lead.id] });
      const assigneeName =
        lead.assignedToUser.name ??
        (assignableUsersQuery.data ?? []).find((option) => option.id === lead.assignedToUser.id)?.name ??
        "selected user";
      showNotice("Lead Assigned", `Lead assigned to ${assigneeName}.`, "success");
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, "Lead could not be assigned. Please check assignee eligibility and try again.");
      setErrorMessage(message);
      showNotice("Assignment Failed", message, "error");
    }
  });

  const convertMutation = useMutation({
    mutationFn: (id: string) =>
      convertLeadToOpportunity(id, {
        probabilityPercent: 35,
        remarks: "Converted from Lead module"
      }),
    onSuccess: (opportunity) => {
      setErrorMessage(null);
      void queryClient.invalidateQueries({ queryKey: ["lead", selectedLeadId] });
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
      void queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.setQueryData(["opportunity", opportunity.id], opportunity);
      closeLeadDetailModal();
      navigate(`/opportunities?selected=${opportunity.id}`, {
        state: { convertNotice: opportunity.opportunityNo }
      });
    },
    onError: (error) => {
      const message = getApiErrorMessage(error, "Lead could not be converted. Qualify the lead before conversion.");
      setErrorMessage(message);
      showNotice("Conversion Failed", message, "error");
    }
  });

  const selectedLead = leadDetailQuery.data;
  const selectedLeadNextAction = selectedLead ? leadNextAction(selectedLead) : null;

  useEffect(() => {
    if (!selectedLead) {
      setAssignTargetUserId("");
      return;
    }

    setAssignTargetUserId(selectedLead.assignedToUser.id ?? "");
  }, [selectedLead]);

  const loadLead = (lead: Lead) => {
    setSelectedLeadId(lead.id);
    setLeadDetailModalOpen(true);
  };

  const closeLeadDetailModal = () => {
    setLeadDetailModalOpen(false);
    setSelectedLeadId(null);
  };

  const closeLeadCreateModal = () => {
    setLeadCreateModalOpen(false);
    setEditingLeadId(null);
    createForm.reset({ ...blankLeadForm, preferredCurrencyCode: baseCurrency, dateGenerated: todayIsoDate(), assignedToUserId: user?.id ?? "" });
  };

  const openCreateLeadModal = () => {
    setEditingLeadId(null);
    createForm.reset({
      ...blankLeadForm,
      preferredCurrencyCode: baseCurrency,
      dateGenerated: todayIsoDate(),
      assignedToUserId: user?.id ?? ""
    });
    setLeadCreateModalOpen(true);
  };

  useEffect(() => {
    if (!leadCreateModalOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeLeadCreateModal();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => firstNameInputRef.current?.focus(), 0);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [leadCreateModalOpen]);

  useEffect(() => {
    if (!selectedLeadSourceRefId) {
      previousLeadSourceRef.current = "";
      createForm.setValue("captureChannelRefId", "");
      return;
    }

    if (previousLeadSourceRef.current && previousLeadSourceRef.current !== selectedLeadSourceRefId) {
      createForm.setValue("captureChannelRefId", "");
    }

    previousLeadSourceRef.current = selectedLeadSourceRefId;
  }, [createForm, selectedLeadSourceRefId]);

  const openLeadEditModal = (lead: Lead) => {
    setEditingLeadId(lead.id);
    setSelectedLeadId(lead.id);
    previousLeadSourceRef.current = lead.leadSource.id ?? "";
    createForm.reset({
      firstName: lead.firstName ?? lead.leadTitle ?? "",
      lastName: lead.lastName ?? lead.contactName ?? "",
      mobileNo: lead.mobileNo ?? "",
      whatsappNo: lead.whatsappNo ?? "",
      email: lead.email ?? "",
      leadSourceRefId: lead.leadSource.id ?? "",
      captureChannelRefId: lead.captureChannel.id ?? "",
      campaignId: lead.campaign.id ?? "",
      campaignNotes: lead.campaignNotes ?? "",
      assignedToUserId: lead.assignedToUser.id ?? user?.id ?? "",
      dateGenerated: lead.capturedAt?.slice(0, 10) ?? todayIsoDate(),
      leadRatingRefId: lead.leadRating.id ?? "",
      genderRefId: lead.gender.id ?? "",
      dateOfBirth: lead.dateOfBirth?.slice(0, 10) ?? "",
      nationalityRefId: lead.nationality.id ?? "",
      countryRefId: lead.country.id ?? "",
      city: lead.city ?? "",
      currentResidenceCountryRefId: lead.currentResidenceCountry.id ?? "",
      buyerTypeRefId: lead.buyerType.id ?? "",
      fundingSourceRefId: lead.fundingSource.id ?? "",
      purposeOfPurchaseRefId: lead.purposeOfPurchase.id ?? "",
      decisionMakerStatusRefId: lead.decisionMakerStatus.id ?? "",
      affordabilityStatusRefId: lead.affordabilityStatus.id ?? "",
      lastInteractionAt: lead.lastInteractionAt ? lead.lastInteractionAt.slice(0, 16) : "",
      lastInteractionTypeRefId: lead.lastInteractionType.id ?? "",
      interactionOutcomeRefId: lead.interactionOutcome.id ?? "",
      interactionCount: lead.interactionCount == null ? "" : String(lead.interactionCount),
      budgetMax: lead.budgetMax == null ? "" : String(lead.budgetMax),
      preferredCurrencyCode: lead.preferredCurrencyCode ?? baseCurrency,
      preferredProjectCode: lead.preferredProjectCode ?? "",
      preferredLocationCode: lead.preferredLocationCode ?? "",
      preferredUnitTypeRefId: lead.preferredUnitType.id ?? "",
      preferredBedroomRefId: lead.preferredBedroom.id ?? "",
      preferredViewRefId: lead.preferredView.id ?? "",
      incomeRangeRefId: lead.incomeRange.id ?? "",
      acquisitionCost: lead.acquisitionCost == null ? "" : String(lead.acquisitionCost),
      purchaseTimelineRefId: lead.purchaseTimeline.id ?? "",
      qualificationNotes: lead.qualificationNotes ?? "",
      scoreTotal: lead.scoreTotal == null ? "" : String(lead.scoreTotal),
      remarks: lead.remarks ?? ""
    });
    setLeadCreateModalOpen(true);
  };

  useEffect(() => {
    if (!selectedLead) {
      return;
    }

    qualifyForm.reset({
      leadRatingRefId: selectedLead.leadRating.id ?? "",
      genderRefId: selectedLead.gender.id ?? "",
      dateOfBirth: selectedLead.dateOfBirth?.slice(0, 10) ?? "",
      nationalityRefId: selectedLead.nationality.id ?? "",
      countryRefId: selectedLead.country.id ?? "",
      city: selectedLead.city ?? "",
      currentResidenceCountryRefId: selectedLead.currentResidenceCountry.id ?? "",
      buyerTypeRefId: selectedLead.buyerType.id ?? "",
      fundingSourceRefId: selectedLead.fundingSource.id ?? "",
      purposeOfPurchaseRefId: selectedLead.purposeOfPurchase.id ?? "",
      decisionMakerStatusRefId: selectedLead.decisionMakerStatus.id ?? "",
      affordabilityStatusRefId: selectedLead.affordabilityStatus.id ?? "",
      lastInteractionAt: selectedLead.lastInteractionAt ? selectedLead.lastInteractionAt.slice(0, 16) : "",
      lastInteractionTypeRefId: selectedLead.lastInteractionType.id ?? "",
      interactionOutcomeRefId: selectedLead.interactionOutcome.id ?? "",
      interactionCount: selectedLead.interactionCount == null ? "" : String(selectedLead.interactionCount),
      purchaseTimelineRefId: selectedLead.purchaseTimeline.id ?? "",
      budgetMax: selectedLead.budgetMax == null ? "" : String(selectedLead.budgetMax),
      preferredBedroomRefId: selectedLead.preferredBedroom.id ?? "",
      preferredViewRefId: selectedLead.preferredView.id ?? "",
      incomeRangeRefId: selectedLead.incomeRange.id ?? "",
      acquisitionCost: selectedLead.acquisitionCost == null ? "" : String(selectedLead.acquisitionCost),
      scoreTotal: selectedLead.scoreTotal == null ? "" : String(selectedLead.scoreTotal),
      scoreEngagement: "",
      scoreBehavior: "",
      scoreFinancial: "",
      qualificationNotes: selectedLead.qualificationNotes ?? ""
    });
  }, [qualifyForm, selectedLead]);

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

  const onCreate = createForm.handleSubmit(async (values) => {
    const campaignHasOptions = (campaignsQuery.data ?? []).length > 0;
    const validation = validateMandatoryLeadFields(values);
    if (!validation.valid) {
      const message = buildLeadValidationMessage(validation);
      const invalidField = getFirstInvalidLeadField(values, campaignHasOptions);
      if (invalidField) {
        pendingFocusFieldRef.current = invalidField;
      }
      setErrorMessage(message);
      showNotice("Required Fields Missing", message, "error");
      return;
    }

    setIsValidatingLead(true);
    setErrorMessage(null);

    try {
      const duplicate = await checkLeadDuplicate({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        mobileNo: values.mobileNo.trim(),
        email: values.email.trim(),
        excludeLeadId: editingLeadId ?? undefined
      });

      if (duplicate.isDuplicate && duplicate.lead) {
        const message =
          "A lead already exists with the same First Name, Last Name, Mobile, and Email.\n" +
          "All four values must match (names and email ignore case; mobile ignores spaces and symbols).\n" +
          `Existing lead: ${duplicate.lead.leadNo}`;
        setErrorMessage(message);
        showNotice("Duplicate Lead Detected", message, "error");
        return;
      }

      const payload = toCreatePayload(values);
      if (editingLeadId) {
        updateMutation.mutate({ id: editingLeadId, payload });
        return;
      }

      createMutation.mutate(payload);
    } catch (error) {
      const message = getApiErrorMessage(error, "Could not validate lead details. Please try again.");
      setErrorMessage(message);
      showNotice("Validation Failed", message, "error");
    } finally {
      setIsValidatingLead(false);
    }
  });
  const onQualify = qualifyForm.handleSubmit((values) => {
    if (!selectedLeadId || !selectedLead?.assignedToUser.id) {
      setErrorMessage("Assign the lead before completing qualification.");
      return;
    }

    qualifyMutation.mutate({ id: selectedLeadId, payload: toQualifyPayload(values) });
  });

  const leadRows = leadsQuery.data?.items ?? [];
  const leadPagination = leadsQuery.data?.pagination ?? { limit: pageSize, offset: 0, total: 0 };
  const firstNameRegister = createForm.register("firstName");
  const campaignOptions = campaignsQuery.data ?? [];
  const campaignHasOptions = campaignOptions.length > 0;

  return (
    <div className="crm-workspace crm-leads-workspace">
      <section className="crm-module-header">
        <div>
          <p className="crm-eyebrow">Lead Management</p>
          <h2>Lead Inbox</h2>
        </div>
        <button
          className="crm-primary-button crm-fit-button"
          onClick={openCreateLeadModal}
          type="button"
        >
          Create Lead
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

        <div className="crm-table-wrap crm-leads-record-grid">
          <table className="crm-table crm-leads-inbox-table">
            <thead>
              <tr>
                <th>S.No.</th>
                <th>Lead No.</th>
                <th>Contact</th>
                <th>Source</th>
                <th>Status</th>
                <th>Rating</th>
                <th>Score</th>
                <th>Captured</th>
                <th>Assigned</th>
                <th>Act.</th>
              </tr>
            </thead>
            <tbody>
              {leadRows.map((lead: Lead, index) => (
                <tr
                  className={selectedLeadId === lead.id ? "is-selected" : ""}
                  key={lead.id}
                  onClick={() => loadLead(lead)}
                >
                  <td>{String(getRowSerialNumber(page, pageSize, index)).padStart(2, "0")}</td>
                  <td>
                    <strong>{lead.leadNo}</strong>
                    <span>{lead.firstName ?? lead.leadTitle ?? "Lead"}</span>
                  </td>
                  <td>
                    <strong>{[lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.contactName || "Unnamed lead"}</strong>
                    <span>{lead.mobileNo ?? lead.email ?? "-"}</span>
                  </td>
                  <td>{lead.leadSource.name ?? "-"}</td>
                  <td>{lead.leadStatus.name ?? "-"}</td>
                  <td>{lead.leadRating.name ?? "-"}</td>
                  <td>{lead.scoreTotal ?? "-"}</td>
                  <td>{formatDate(lead.capturedAt)}</td>
                  <td>{lead.assignedToUser.name ?? "Unassigned"}</td>
                  <td className="crm-leads-action-cell">
                    <button
                      aria-label={`Edit ${lead.leadNo}`}
                      className="crm-icon-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openLeadEditModal(lead);
                      }}
                      title="Edit lead"
                      type="button"
                    >
                      <svg aria-hidden="true" className="crm-icon-button-svg" viewBox="0 0 20 20">
                        <path d="M13.586 3.586a2 2 0 0 1 2.828 2.828l-9.5 9.5a1 1 0 0 1-.39.242l-3.2 1.067a.5.5 0 0 1-.632-.632l1.067-3.2a1 1 0 0 1 .242-.39l9.5-9.5Z" />
                        <path d="M12.172 5l2.828 2.828" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
              {leadRows.length === 0 ? (
                <tr>
                  <td className="crm-empty-cell" colSpan={10}>
                    No leads found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <ListPagination
          page={page}
          pageSize={pageSize}
          total={leadPagination.total}
          itemLabel="leads"
          onPageChange={setPage}
        />
      </section>

      {leadCreateModalOpen ? (
        <div className="crm-modal-backdrop" role="presentation">
          <section aria-labelledby="lead-create-title" aria-modal="true" className="crm-modal crm-management-modal crm-lead-modal" role="dialog">
            <div className="crm-panel-header crm-lead-modal-header">
              <div>
                <h3 id="lead-create-title">{editingLeadId ? "Edit Lead" : "Create Lead"}</h3>
                <p className="crm-muted-text">Fields marked with <span className="crm-label-required-inline">*</span> are required.</p>
              </div>
            </div>

            <form className="crm-lead-modal-form" onSubmit={onCreate}>
              <div className="crm-lead-modal-body">
                <div className="crm-form crm-two-col">
                  <FormSectionTitle>Contact</FormSectionTitle>
                  <label className="crm-field">
                    <FieldLabel required>First Name</FieldLabel>
                    <input
                      className="crm-input"
                      {...firstNameRegister}
                      ref={(element) => {
                        firstNameRegister.ref(element);
                        firstNameInputRef.current = element;
                      }}
                    />
                  </label>
                  <label className="crm-field">
                    <FieldLabel required>Last Name</FieldLabel>
                    <input className="crm-input" {...createForm.register("lastName")} />
                  </label>
                  <label className="crm-field">
                    <FieldLabel required>Mobile</FieldLabel>
                    <input className="crm-input" {...createForm.register("mobileNo")} />
                  </label>
                  <label className="crm-field">
                    <FieldLabel required>Email</FieldLabel>
                    <input className="crm-input" type="email" {...createForm.register("email")} />
                  </label>
                  <label className="crm-field">
                    <FieldLabel>WhatsApp</FieldLabel>
                    <input className="crm-input" {...createForm.register("whatsappNo")} />
                  </label>
                  <SelectField label="Gender" name="genderRefId" options={gendersQuery.data ?? []} register={createForm.register} />

                  <FormSectionTitle>Source & Campaign</FormSectionTitle>
                  <SelectField label="Lead Source" name="leadSourceRefId" options={leadSourcesQuery.data ?? []} register={createForm.register} required />
                  <SelectField
                    label="Lead Source Category"
                    name="captureChannelRefId"
                    options={channelsQuery.data ?? []}
                    register={createForm.register}
                    required
                  />
                  {campaignHasOptions ? (
                    <CampaignSelectField
                      label="Campaign Name"
                      name="campaignId"
                      options={campaignOptions}
                      register={createForm.register}
                      required
                    />
                  ) : (
                    <label className="crm-field">
                      <FieldLabel required>Campaign Name</FieldLabel>
                      <input className="crm-input" placeholder="Enter campaign name" {...createForm.register("campaignNotes")} />
                    </label>
                  )}
                  <UserSelectField
                    label="Lead Owner"
                    name="assignedToUserId"
                    options={assignableUsersQuery.data ?? []}
                    register={createForm.register}
                    required
                  />
                  {campaignHasOptions ? (
                    <label className="crm-field crm-form-wide">
                      <FieldLabel>Campaign Notes</FieldLabel>
                      <input className="crm-input" placeholder="Optional if campaign is selected above" {...createForm.register("campaignNotes")} />
                    </label>
                  ) : (
                    <p className="crm-muted-text crm-field-note crm-form-wide">
                      Campaign list is not configured yet, so campaign name is captured as text.
                    </p>
                  )}
                  <label className="crm-field">
                    <FieldLabel required>Date Generated</FieldLabel>
                    <input className="crm-input" type="date" {...createForm.register("dateGenerated")} />
                  </label>
                  <label className="crm-field">
                    <FieldLabel required>Marketing Cost Allocation</FieldLabel>
                    <input className="crm-input" inputMode="decimal" {...createForm.register("acquisitionCost")} />
                  </label>

                  <FormSectionTitle>Profile & Preferences</FormSectionTitle>
                  <SelectField label="Nationality" name="nationalityRefId" options={nationalitiesQuery.data ?? []} register={createForm.register} required />
                  <SelectField label="Country" name="countryRefId" options={countriesQuery.data ?? []} register={createForm.register} required />
                  <SelectField
                    label="Current Residence"
                    name="currentResidenceCountryRefId"
                    options={countriesQuery.data ?? []}
                    register={createForm.register}
                  />
                  <label className="crm-field">
                    <FieldLabel>Date of Birth</FieldLabel>
                    <input className="crm-input" type="date" {...createForm.register("dateOfBirth")} />
                  </label>
                  <label className="crm-field">
                    <FieldLabel>City</FieldLabel>
                    <input className="crm-input" {...createForm.register("city")} />
                  </label>
                  <SelectField label="Rating" name="leadRatingRefId" options={leadRatingsQuery.data ?? []} register={createForm.register} />
                  <SelectField label="Buyer Type" name="buyerTypeRefId" options={buyerTypesQuery.data ?? []} register={createForm.register} />
                  <SelectField label="Funding" name="fundingSourceRefId" options={fundingSourcesQuery.data ?? []} register={createForm.register} />
                  <SelectField label="Purpose of Purchase" name="purposeOfPurchaseRefId" options={purposeOfPurchaseQuery.data ?? []} register={createForm.register} />
                  <SelectField label="Decision Maker Status" name="decisionMakerStatusRefId" options={decisionMakerStatusQuery.data ?? []} register={createForm.register} />
                  <SelectField label="Affordability Assessment" name="affordabilityStatusRefId" options={affordabilityStatusQuery.data ?? []} register={createForm.register} />
                  <SelectField label="Unit Type" name="preferredUnitTypeRefId" options={unitTypesQuery.data ?? []} register={createForm.register} />
                  <SelectField label="Bedrooms" name="preferredBedroomRefId" options={bedroomQuery.data ?? []} register={createForm.register} />
                  <SelectField label="Preferred View" name="preferredViewRefId" options={viewTypeQuery.data ?? []} register={createForm.register} />
                  <SelectField label="Income Range" name="incomeRangeRefId" options={incomeRangeQuery.data ?? []} register={createForm.register} />
                  <SelectField label="Timeline" name="purchaseTimelineRefId" options={timelinesQuery.data ?? []} register={createForm.register} />
                  <label className="crm-field">
                    <FieldLabel>Last Interaction</FieldLabel>
                    <input className="crm-input" type="datetime-local" {...createForm.register("lastInteractionAt")} />
                  </label>
                  <SelectField label="Interaction Type" name="lastInteractionTypeRefId" options={interactionTypeQuery.data ?? []} register={createForm.register} />
                  <SelectField label="Interaction Outcome" name="interactionOutcomeRefId" options={interactionOutcomeQuery.data ?? []} register={createForm.register} />
                  <label className="crm-field">
                    <FieldLabel>Interaction Count</FieldLabel>
                    <input className="crm-input" inputMode="numeric" {...createForm.register("interactionCount")} />
                  </label>
                  <label className="crm-field">
                    <FieldLabel>Budget</FieldLabel>
                    <input className="crm-input" {...createForm.register("budgetMax")} />
                  </label>
                  <label className="crm-field">
                    <FieldLabel>Currency</FieldLabel>
                    <input className="crm-input" {...createForm.register("preferredCurrencyCode")} />
                  </label>
                  <label className="crm-field">
                    <FieldLabel>Project Code</FieldLabel>
                    <input className="crm-input" {...createForm.register("preferredProjectCode")} />
                  </label>
                  <label className="crm-field">
                    <FieldLabel>Score</FieldLabel>
                    <input className="crm-input" {...createForm.register("scoreTotal")} />
                  </label>
                  <label className="crm-field crm-form-wide">
                    <FieldLabel>Qualification Notes</FieldLabel>
                    <textarea className="crm-input crm-textarea" {...createForm.register("qualificationNotes")} />
                  </label>
                </div>
              </div>

              <div className="crm-modal-actions crm-modal-actions-sticky">
                <button className="crm-secondary-button crm-fit-button" onClick={closeLeadCreateModal} type="button">
                  Close
                </button>
                <button
                  className="crm-primary-button crm-fit-button"
                  disabled={createMutation.isPending || updateMutation.isPending || isValidatingLead}
                  type="submit"
                >
                  {editingLeadId
                    ? updateMutation.isPending
                      ? "Updating..."
                      : "Update Lead"
                    : createMutation.isPending
                      ? "Creating..."
                      : "Create Lead"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {leadDetailModalOpen ? (
        <div className="crm-modal-backdrop" role="presentation">
          <section aria-modal="true" className="crm-modal crm-management-modal crm-lead-detail-modal" role="dialog">
            <div className="crm-panel-header">
              <div>
                <h3>Lead Detail</h3>
                {selectedLead ? (
                  <p className="crm-muted-text">
                    {selectedLead.leadNo} · {[selectedLead.firstName, selectedLead.lastName].filter(Boolean).join(" ") || selectedLead.contactName || "Unnamed lead"}
                  </p>
                ) : null}
              </div>
              <button className="crm-secondary-button crm-fit-button" onClick={closeLeadDetailModal} type="button">
                Close
              </button>
            </div>

            {leadDetailQuery.isLoading ? (
              <p className="crm-muted-text">Loading lead details...</p>
            ) : selectedLead ? (
              <>
                <div className="crm-detail-title">
                  <div>
                    <strong>{[selectedLead.firstName, selectedLead.lastName].filter(Boolean).join(" ") || selectedLead.contactName || selectedLead.leadNo}</strong>
                    <span>{selectedLead.leadNo}</span>
                  </div>
                  <span className="crm-status-pill">{selectedLead.leadStatus.name ?? selectedLead.status}</span>
                </div>
                <WorkflowTracker steps={leadWorkflowSteps(selectedLead, formatLeadBudget)} />
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
                      {formatLeadBudget(selectedLead.budgetMax, selectedLead.preferredCurrencyCode)}
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

                <div className="crm-lead-detail-actions">
                  <label className="crm-field crm-lead-action-field">
                    <span className="crm-label">Assign To User</span>
                    <select className="crm-input crm-lead-action-control" onChange={(event) => setAssignTargetUserId(event.target.value)} value={assignTargetUserId}>
                      <option value="">Select user</option>
                      {(assignableUsersQuery.data ?? []).map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="crm-primary-button crm-lead-action-button"
                    disabled={assignMutation.isPending || !assignTargetUserId || assignTargetUserId === selectedLead.assignedToUser.id}
                    onClick={() => assignMutation.mutate({ leadId: selectedLead.id, assignedToUserId: assignTargetUserId })}
                    type="button"
                  >
                    {assignMutation.isPending ? "Assigning..." : "Assign Lead"}
                  </button>
                  <button
                    className={`${selectedLead.qualifiedAt && !selectedLead.convertedAt ? "crm-primary-button" : "crm-secondary-button"} crm-lead-action-button`}
                    disabled={convertMutation.isPending || !selectedLead.qualifiedAt || Boolean(selectedLead.convertedAt)}
                    onClick={() => convertMutation.mutate(selectedLead.id)}
                    type="button"
                  >
                    {selectedLead.convertedAt ? "Converted" : convertMutation.isPending ? "Converting..." : "Convert to Opportunity"}
                  </button>
                </div>
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
                    {!selectedLead.assignedToUser.id ? (
                      <p className="crm-action-note">Assign the lead first, then qualification can be completed.</p>
                    ) : null}
                    <SelectField label="Rating" name="leadRatingRefId" options={leadRatingsQuery.data ?? []} register={qualifyForm.register} />
                    <SelectField label="Gender" name="genderRefId" options={gendersQuery.data ?? []} register={qualifyForm.register} />
                    <SelectField label="Nationality" name="nationalityRefId" options={nationalitiesQuery.data ?? []} register={qualifyForm.register} />
                    <SelectField label="Country" name="countryRefId" options={countriesQuery.data ?? []} register={qualifyForm.register} />
                    <SelectField
                      label="Current Residence"
                      name="currentResidenceCountryRefId"
                      options={countriesQuery.data ?? []}
                      register={qualifyForm.register}
                    />
                    <SelectField label="Buyer Type" name="buyerTypeRefId" options={buyerTypesQuery.data ?? []} register={qualifyForm.register} />
                    <SelectField label="Funding" name="fundingSourceRefId" options={fundingSourcesQuery.data ?? []} register={qualifyForm.register} />
                    <SelectField label="Purpose of Purchase" name="purposeOfPurchaseRefId" options={purposeOfPurchaseQuery.data ?? []} register={qualifyForm.register} />
                    <SelectField
                      label="Decision Maker Status"
                      name="decisionMakerStatusRefId"
                      options={decisionMakerStatusQuery.data ?? []}
                      register={qualifyForm.register}
                    />
                    <SelectField
                      label="Affordability Assessment"
                      name="affordabilityStatusRefId"
                      options={affordabilityStatusQuery.data ?? []}
                      register={qualifyForm.register}
                    />
                    <SelectField label="Timeline" name="purchaseTimelineRefId" options={timelinesQuery.data ?? []} register={qualifyForm.register} />
                    <SelectField label="Bedrooms" name="preferredBedroomRefId" options={bedroomQuery.data ?? []} register={qualifyForm.register} />
                    <SelectField label="Preferred View" name="preferredViewRefId" options={viewTypeQuery.data ?? []} register={qualifyForm.register} />
                    <SelectField label="Income Range" name="incomeRangeRefId" options={incomeRangeQuery.data ?? []} register={qualifyForm.register} />
                    <label className="crm-field">
                      <span className="crm-label">Last Interaction</span>
                      <input className="crm-input" type="datetime-local" {...qualifyForm.register("lastInteractionAt")} />
                    </label>
                    <SelectField
                      label="Interaction Type"
                      name="lastInteractionTypeRefId"
                      options={interactionTypeQuery.data ?? []}
                      register={qualifyForm.register}
                    />
                    <SelectField
                      label="Interaction Outcome"
                      name="interactionOutcomeRefId"
                      options={interactionOutcomeQuery.data ?? []}
                      register={qualifyForm.register}
                    />
                    <label className="crm-field">
                      <span className="crm-label">Interaction Count</span>
                      <input className="crm-input" inputMode="numeric" {...qualifyForm.register("interactionCount")} />
                    </label>
                    <label className="crm-field">
                      <span className="crm-label">Date of Birth</span>
                      <input className="crm-input" type="date" {...qualifyForm.register("dateOfBirth")} />
                    </label>
                    <label className="crm-field">
                      <span className="crm-label">City</span>
                      <input className="crm-input" {...qualifyForm.register("city")} />
                    </label>
                    <div className="crm-two-col">
                      <label className="crm-field">
                        <span className="crm-label">Budget</span>
                        <input className="crm-input" {...qualifyForm.register("budgetMax")} />
                      </label>
                      <label className="crm-field">
                        <span className="crm-label">Acquisition Cost</span>
                        <input className="crm-input" {...qualifyForm.register("acquisitionCost")} />
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
              <p className="crm-muted-text">Lead details could not be loaded.</p>
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
    </div>
  );
}
