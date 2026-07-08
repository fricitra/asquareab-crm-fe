export type LeadMandatoryFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  mobileNo: string;
  leadSourceRefId: string;
  captureChannelRefId: string;
  campaignId: string;
  campaignNotes: string;
  assignedToUserId: string;
  dateGenerated: string;
  acquisitionCost: string;
  countryRefId: string;
  nationalityRefId: string;
};

export type LeadFormValidationResult = {
  valid: boolean;
  missingFields: string[];
  invalidFields: string[];
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hasText(value: string) {
  return value.trim().length > 0;
}

function hasPositiveNumber(value: string) {
  const normalized = value.replace(/[% ,]/g, "").trim();
  if (normalized === "") {
    return false;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0;
}

export function validateMandatoryLeadFields(values: LeadMandatoryFormValues): LeadFormValidationResult {
  const missingFields: string[] = [];
  const invalidFields: string[] = [];

  const requiredChecks: Array<[string, boolean]> = [
    ["First Name", hasText(values.firstName)],
    ["Last Name", hasText(values.lastName)],
    ["Email", hasText(values.email)],
    ["Mobile", hasText(values.mobileNo)],
    ["Lead Source", hasText(values.leadSourceRefId)],
    ["Lead Source Category", hasText(values.captureChannelRefId)],
    ["Campaign Name", hasText(values.campaignId) || hasText(values.campaignNotes)],
    ["Lead Owner", hasText(values.assignedToUserId)],
    ["Date Generated", hasText(values.dateGenerated)],
    ["Marketing Cost Allocation", hasPositiveNumber(values.acquisitionCost)],
    ["Country", hasText(values.countryRefId)],
    ["Nationality", hasText(values.nationalityRefId)]
  ];

  for (const [label, isValid] of requiredChecks) {
    if (!isValid) {
      missingFields.push(label);
    }
  }

  if (hasText(values.email) && !emailPattern.test(values.email.trim())) {
    invalidFields.push("Email must be a valid email address.");
  }

  return {
    valid: missingFields.length === 0 && invalidFields.length === 0,
    missingFields,
    invalidFields
  };
}

export type LeadFormFieldName =
  | "firstName"
  | "lastName"
  | "email"
  | "mobileNo"
  | "leadSourceRefId"
  | "captureChannelRefId"
  | "campaignId"
  | "campaignNotes"
  | "assignedToUserId"
  | "dateGenerated"
  | "acquisitionCost"
  | "countryRefId"
  | "nationalityRefId";

export function getFirstInvalidLeadField(
  values: LeadMandatoryFormValues,
  campaignHasOptions: boolean
): LeadFormFieldName | null {
  if (!hasText(values.firstName)) {
    return "firstName";
  }

  if (!hasText(values.lastName)) {
    return "lastName";
  }

  if (!hasText(values.email)) {
    return "email";
  }

  if (!emailPattern.test(values.email.trim())) {
    return "email";
  }

  if (!hasText(values.mobileNo)) {
    return "mobileNo";
  }

  if (!hasText(values.leadSourceRefId)) {
    return "leadSourceRefId";
  }

  if (!hasText(values.captureChannelRefId)) {
    return "captureChannelRefId";
  }

  if (campaignHasOptions) {
    if (!hasText(values.campaignId) && !hasText(values.campaignNotes)) {
      return "campaignId";
    }
  } else if (!hasText(values.campaignNotes)) {
    return "campaignNotes";
  }

  if (!hasText(values.assignedToUserId)) {
    return "assignedToUserId";
  }

  if (!hasText(values.dateGenerated)) {
    return "dateGenerated";
  }

  if (!hasPositiveNumber(values.acquisitionCost)) {
    return "acquisitionCost";
  }

  if (!hasText(values.countryRefId)) {
    return "countryRefId";
  }

  if (!hasText(values.nationalityRefId)) {
    return "nationalityRefId";
  }

  return null;
}

export function buildLeadValidationMessage(result: LeadFormValidationResult) {
  const lines: string[] = [];

  if (result.missingFields.length > 0) {
    lines.push("Please complete the required fields:");
    lines.push(...result.missingFields.map((field) => `• ${field}`));
  }

  if (result.invalidFields.length > 0) {
    if (lines.length > 0) {
      lines.push("");
    }

    lines.push(...result.invalidFields);
  }

  return lines.join("\n");
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}
