export type LeadMandatoryFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  mobileNo: string;
  whatsappNo: string;
  leadSourceRefId: string;
  captureChannelRefId: string;
  campaignId: string;
  campaignNotes: string;
  assignedToUserId: string;
  dateGenerated: string;
  acquisitionCost: string;
  countryCode: string;
  nationalityCode: string;
};

export type LeadFormValidationResult = {
  valid: boolean;
  missingFields: string[];
  invalidFields: string[];
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneCharactersPattern = /^\+?[\d\s().-]+$/;

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

export function normalizePhoneNumber(value: string) {
  const trimmed = value.trim();
  const hasInternationalPrefix = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return digits ? `${hasInternationalPrefix ? "+" : ""}${digits}` : "";
}

export function normalizeEmailAddress(value: string) {
  return value.trim().toLowerCase();
}

export function isValidPhoneNumber(value: string) {
  const trimmed = value.trim();
  if (!phoneCharactersPattern.test(trimmed)) {
    return false;
  }
  const digitCount = trimmed.replace(/\D/g, "").length;
  return digitCount >= 7 && digitCount <= 15;
}

export function isValidEmailAddress(value: string) {
  return emailPattern.test(value.trim());
}

export const PHONE_VALIDATION_MESSAGE = "Enter a valid phone number: 7–15 digits, may start with + (e.g. +254 712 345 678).";
export const EMAIL_VALIDATION_MESSAGE = "Enter a valid email address (e.g. name@example.com).";

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
    ["Country", hasText(values.countryCode)],
    ["Nationality", hasText(values.nationalityCode)]
  ];

  for (const [label, isValid] of requiredChecks) {
    if (!isValid) {
      missingFields.push(label);
    }
  }

  if (hasText(values.email) && !emailPattern.test(values.email.trim())) {
    invalidFields.push("Email must be a valid email address.");
  }

  if (hasText(values.mobileNo) && !isValidPhoneNumber(values.mobileNo)) {
    invalidFields.push("Mobile must contain 7–15 digits and may start with +.");
  }

  if (hasText(values.whatsappNo) && !isValidPhoneNumber(values.whatsappNo)) {
    invalidFields.push("WhatsApp must contain 7–15 digits and may start with +.");
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
  | "whatsappNo"
  | "leadSourceRefId"
  | "captureChannelRefId"
  | "campaignId"
  | "campaignNotes"
  | "assignedToUserId"
  | "dateGenerated"
  | "acquisitionCost"
  | "countryCode"
  | "nationalityCode";

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

  if (!isValidPhoneNumber(values.mobileNo)) {
    return "mobileNo";
  }

  if (hasText(values.whatsappNo) && !isValidPhoneNumber(values.whatsappNo)) {
    return "whatsappNo";
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

  if (!hasText(values.countryCode)) {
    return "countryCode";
  }

  if (!hasText(values.nationalityCode)) {
    return "nationalityCode";
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
