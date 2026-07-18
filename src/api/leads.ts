import { apiClient } from "../lib/api-client";
import { buildListQueryParams, type ListQueryParams } from "../lib/list-pagination";

type NamedLink = {
  id: string | null;
  name: string | null;
  code?: string | null;
};

export type LeadScoreBreakdownItem = {
  code: string;
  label: string;
  maxPoints: number;
  awardedPoints: number;
  matchedRuleId: string | null;
  matchedRuleLabel: string | null;
};

export type Lead = {
  id: string;
  leadNo: string;
  leadTitle: string | null;
  firstName: string | null;
  leadSource: NamedLink;
  captureChannel: NamedLink;
  campaign: NamedLink;
  campaignNotes: string | null;
  broker: NamedLink;
  customer: NamedLink;
  contactName: string | null;
  lastName: string | null;
  gender: NamedLink;
  dateOfBirth: string | null;
  nationality: NamedLink;
  country: NamedLink;
  city: string | null;
  currentResidenceCountry: NamedLink;
  mobileNo: string | null;
  whatsappNo: string | null;
  email: string | null;
  leadStatus: NamedLink;
  leadRating: NamedLink;
  buyerType: NamedLink;
  fundingSource: NamedLink;
  purposeOfPurchase: NamedLink;
  decisionMakerStatus: NamedLink;
  affordabilityStatus: NamedLink;
  lastInteractionAt: string | null;
  lastInteractionType: NamedLink;
  interactionOutcome: NamedLink;
  interactionCount: number | null;
  budgetMin: number | null;
  budgetMax: number | null;
  preferredCurrencyCode: string | null;
  preferredProjectCode: string | null;
  preferredLocationCode: string | null;
  preferredUnitType: NamedLink;
  preferredBedroom: NamedLink;
  preferredView: NamedLink;
  incomeRange: NamedLink;
  acquisitionCost: number | null;
  purchaseTimeline: NamedLink;
  qualificationNotes: string | null;
  qualifiedAt: string | null;
  qualifiedByUser: NamedLink;
  convertedAt: string | null;
  convertedByUser: NamedLink;
  assignedToUser: NamedLink;
  assignedByUser: NamedLink;
  assignedAt: string | null;
  capturedAt: string | null;
  createdAt: string | null;
  capturedByUser: NamedLink;
  scoreTotal: number | null;
  scoreEngagement: number | null;
  scoreBehavior: number | null;
  scoreFinancial: number | null;
  scoreComputed?: number | null;
  scoreBreakdown?: LeadScoreBreakdownItem[] | null;
  scoreOverridden?: boolean;
  scoreOverrideReason?: string | null;
  suggestedRating?: NamedLink;
  status: string;
  remarks: string | null;
};

export type LeadDetail = Lead & {
  assignmentHistory: Array<{
    id: string;
    assignedFromUser: NamedLink;
    assignedToUser: NamedLink;
    assignedByUser: NamedLink;
    assignedAt: string | null;
    assignmentReason: string | null;
  }>;
};

export type CreateLeadPayload = {
  firstName?: string;
  lastName?: string;
  leadTitle?: string;
  contactName?: string;
  mobileNo?: string;
  whatsappNo?: string;
  email?: string;
  leadSourceRefId?: string;
  captureChannelRefId?: string;
  campaignId?: string;
  campaignNotes?: string;
  leadRatingRefId?: string;
  genderRefId?: string;
  dateOfBirth?: string;
  nationalityCode?: string;
  countryCode?: string;
  city?: string;
  currentResidenceCountryCode?: string;
  buyerTypeRefId?: string;
  fundingSourceRefId?: string;
  purposeOfPurchaseRefId?: string;
  decisionMakerStatusRefId?: string;
  affordabilityStatusRefId?: string;
  lastInteractionAt?: string;
  lastInteractionTypeRefId?: string;
  interactionOutcomeRefId?: string;
  interactionCount?: number;
  budgetMax?: number;
  preferredCurrencyCode?: string;
  preferredProjectCode?: string;
  preferredLocationCode?: string;
  preferredUnitTypeRefId?: string;
  preferredBedroomRefId?: string;
  preferredViewRefId?: string;
  incomeRangeRefId?: string;
  acquisitionCost?: number;
  purchaseTimelineRefId?: string;
  qualificationNotes?: string;
  assignedToUserId?: string;
  dateGenerated?: string;
  scoreTotal?: number;
  remarks?: string;
};

export type UpdateLeadPayload = CreateLeadPayload;

export type LeadDuplicateCheck = {
  isDuplicate: boolean;
  blockCreate?: boolean;
  showWarning?: boolean;
  warningMessage?: string | null;
  lead: { id: string; leadNo: string } | null;
};

export type LeadCampaignOption = {
  id: string;
  name: string;
  campaignCode: string;
};

export type LeadAssignableUser = {
  id: string;
  name: string;
  email: string;
};

export type QualifyLeadPayload = {
  leadStatusRefId?: string;
  leadRatingRefId?: string;
  genderRefId?: string;
  dateOfBirth?: string;
  nationalityCode?: string;
  countryCode?: string;
  city?: string;
  currentResidenceCountryCode?: string;
  buyerTypeRefId?: string;
  fundingSourceRefId?: string;
  purposeOfPurchaseRefId?: string;
  decisionMakerStatusRefId?: string;
  affordabilityStatusRefId?: string;
  lastInteractionAt?: string;
  lastInteractionTypeRefId?: string;
  interactionOutcomeRefId?: string;
  interactionCount?: number;
  budgetMax?: number;
  preferredCurrencyCode?: string;
  preferredProjectCode?: string;
  preferredLocationCode?: string;
  preferredUnitTypeRefId?: string;
  preferredBedroomRefId?: string;
  preferredViewRefId?: string;
  incomeRangeRefId?: string;
  acquisitionCost?: number;
  purchaseTimelineRefId?: string;
  qualificationNotes?: string;
  scoreTotal?: number;
  scoreEngagement?: number;
  scoreBehavior?: number;
  scoreFinancial?: number;
  remarks?: string;
  confirmBelowThreshold?: boolean;
};

export async function listLeads(params?: ListQueryParams) {
  const response = await apiClient.get<{
    items: Lead[];
    pagination: { limit: number; offset: number; total: number };
    summary?: { assigned: number; qualified: number; averageScore: number };
  }>("/leads", {
    params: buildListQueryParams(params)
  });
  return response.data;
}

export async function checkLeadDuplicate(params: {
  firstName: string;
  lastName: string;
  mobileNo: string;
  email: string;
  excludeLeadId?: string;
}) {
  const response = await apiClient.get<LeadDuplicateCheck>("/leads/check-duplicate", { params });
  return response.data;
}

export async function listLeadCampaigns() {
  const response = await apiClient.get<{ items: LeadCampaignOption[] }>("/leads/lookup/campaigns");
  return response.data.items;
}

export async function listLeadAssignableUsers() {
  const response = await apiClient.get<{ items: LeadAssignableUser[] }>("/leads/lookup/assignable-users");
  return response.data.items;
}

export async function createLead(payload: CreateLeadPayload) {
  const response = await apiClient.post<LeadDetail>("/leads", payload);
  return response.data;
}

export async function getLead(id: string) {
  const response = await apiClient.get<LeadDetail>(`/leads/${id}`);
  return response.data;
}

export async function updateLead(id: string, payload: UpdateLeadPayload) {
  const response = await apiClient.patch<LeadDetail>(`/leads/${id}`, payload);
  return response.data;
}

export async function assignLead(id: string, assignedToUserId: string, assignmentReason?: string) {
  const response = await apiClient.post<LeadDetail>(`/leads/${id}/assign`, {
    assignedToUserId,
    assignmentReason
  });
  return response.data;
}

export async function qualifyLead(id: string, payload: QualifyLeadPayload) {
  const response = await apiClient.post<LeadDetail>(`/leads/${id}/qualify`, payload);
  return response.data;
}

export async function recalculateLeadScore(id: string, applySuggestedRating = false) {
  const response = await apiClient.post<LeadDetail & {
    scoring?: {
      scoreComputed: number;
      breakdown: LeadScoreBreakdownItem[];
      suggestedClassification: { ratingCode: string; label: string; minScore: number; maxScore: number } | null;
    };
  }>(`/leads/${id}/recalculate-score`, { applySuggestedRating });
  return response.data;
}
