import axios from "axios";

const FIELD_LABELS: Record<string, string> = {
  assignedToUserId: "Assignee",
  buyerTypeRefId: "Buyer Type",
  fundingSourceRefId: "Funding Source",
  purposeOfPurchaseRefId: "Purpose of Purchase",
  decisionMakerStatusRefId: "Decision Maker Status",
  affordabilityStatusRefId: "Affordability Status",
  lastInteractionAt: "Last Interaction Date & Time",
  lastInteractionTypeRefId: "Interaction Type",
  interactionOutcomeRefId: "Interaction Outcome",
  purchaseTimelineRefId: "Purchase Timeline",
  budgetMax: "Budget",
  scoreTotal: "Qualification Score",
  qualificationNotes: "Qualification Notes",
  interestPreference: "Unit Preference (type, bedroom, or view)",
  leadSourceRefId: "Lead Source",
  captureChannelRefId: "Capture Channel",
  leadStatusRefId: "Lead Status",
  leadRatingRefId: "Lead Rating",
  preferredUnitTypeRefId: "Preferred Unit Type",
  preferredBedroomRefId: "Preferred Bedroom",
  preferredViewRefId: "Preferred View",
  opportunityStageRefId: "Opportunity Stage",
  unitId: "Unit",
  reservationId: "Reservation"
};

const PERMISSION_MODULE_LABELS: Record<string, string> = {
  LEADS: "leads",
  OPPORTUNITIES: "opportunities",
  PROPOSALS: "proposals",
  RESERVATIONS: "reservations",
  CONTRACTS: "contracts",
  INVENTORY: "inventory",
  CUSTOMERS: "customers",
  BROKERS: "brokers",
  CURRENCIES: "currencies",
  ADMIN: "administration",
  REFERENCE_DATA: "reference data",
  DASHBOARD: "dashboard"
};

const PERMISSION_ACTION_LABELS: Record<string, string> = {
  view: "view",
  create: "create",
  update: "edit",
  delete: "delete",
  approve: "approve"
};

function humanizeFieldKey(key: string) {
  const label = FIELD_LABELS[key];
  if (label) {
    return label;
  }

  return key
    .replace(/RefId$/, "")
    .replace(/Id$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPermissionMessage(message: string) {
  const match = message.match(/^Permission\s+([A-Z0-9_]+)\.([a-z]+)\s+is required\.?$/i);
  if (!match) {
    return message;
  }

  const [, moduleCode, actionCode] = match;
  const moduleLabel = PERMISSION_MODULE_LABELS[moduleCode] ?? moduleCode.toLowerCase().replace(/_/g, " ");
  const actionLabel = PERMISSION_ACTION_LABELS[actionCode.toLowerCase()] ?? actionCode.toLowerCase();

  return `You do not have permission to ${actionLabel} ${moduleLabel}. Contact your administrator if you need access.`;
}

function formatQualificationIncompleteMessage(message: string) {
  const prefixMatch = message.match(/^Qualification checklist is incomplete:\s*(.+)$/i);
  if (!prefixMatch) {
    return message;
  }

  const rawFields = prefixMatch[1]
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean);

  const labels = rawFields.map((field) => humanizeFieldKey(field));

  return ["Please complete the following before qualifying this lead:", "", ...labels.map((label) => `• ${label}`)].join("\n");
}

function formatIncompleteChecklistMessage(message: string) {
  if (/^Please complete the following before qualifying this lead:/i.test(message)) {
    return message;
  }

  return formatQualificationIncompleteMessage(message);
}

export function formatApiErrorMessage(message: string) {
  const trimmed = message.trim();
  if (trimmed === "") {
    return trimmed;
  }

  if (/^Permission\s+[A-Z0-9_]+\.[a-z]+\s+is required\.?$/i.test(trimmed)) {
    return formatPermissionMessage(trimmed);
  }

  if (/^Qualification checklist is incomplete:/i.test(trimmed)) {
    return formatQualificationIncompleteMessage(trimmed);
  }

  return trimmed;
}

export function getApiErrorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (!axios.isAxiosError(error)) {
    return fallback;
  }

  if (!error.response) {
    return "CRM backend is not reachable. Please check whether the backend is running.";
  }

  if (error.response.status === 401) {
    const message = (error.response.data as { message?: string } | undefined)?.message;
    return message && message.trim() !== "" ? formatApiErrorMessage(message) : "Invalid username or password.";
  }

  if (error.response.status === 403) {
    const message = (error.response.data as { message?: string } | undefined)?.message;
    return message && message.trim() !== ""
      ? formatApiErrorMessage(message)
      : "You do not have permission for this action.";
  }

  const message = (error.response.data as { message?: string } | undefined)?.message;
  if (message && message.trim() !== "") {
    return formatIncompleteChecklistMessage(formatApiErrorMessage(message));
  }

  return fallback;
}
