import { apiClient } from "../lib/api-client";

type NamedLink = {
  id: string | null;
  name: string | null;
};

export type Lead = {
  id: string;
  leadNo: string;
  leadTitle: string | null;
  leadSource: NamedLink;
  captureChannel: NamedLink;
  campaign: NamedLink;
  broker: NamedLink;
  customer: NamedLink;
  contactName: string | null;
  mobileNo: string | null;
  whatsappNo: string | null;
  email: string | null;
  leadStatus: NamedLink;
  leadRating: NamedLink;
  buyerType: NamedLink;
  fundingSource: NamedLink;
  budgetMin: number | null;
  budgetMax: number | null;
  preferredCurrencyCode: string | null;
  preferredProjectCode: string | null;
  preferredLocationCode: string | null;
  preferredUnitType: NamedLink;
  purchaseTimeline: NamedLink;
  qualificationNotes: string | null;
  qualifiedAt: string | null;
  convertedAt: string | null;
  assignedToUser: NamedLink;
  assignedByUser: NamedLink;
  assignedAt: string | null;
  capturedAt: string | null;
  scoreTotal: number | null;
  scoreEngagement: number | null;
  scoreBehavior: number | null;
  scoreFinancial: number | null;
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
  leadTitle?: string;
  contactName?: string;
  mobileNo?: string;
  whatsappNo?: string;
  email?: string;
  leadSourceRefId?: string;
  captureChannelRefId?: string;
  leadRatingRefId?: string;
  buyerTypeRefId?: string;
  fundingSourceRefId?: string;
  budgetMin?: number;
  budgetMax?: number;
  preferredCurrencyCode?: string;
  preferredProjectCode?: string;
  preferredLocationCode?: string;
  preferredUnitTypeRefId?: string;
  purchaseTimelineRefId?: string;
  qualificationNotes?: string;
  scoreTotal?: number;
  remarks?: string;
};

export type QualifyLeadPayload = {
  leadStatusRefId?: string;
  leadRatingRefId?: string;
  buyerTypeRefId?: string;
  fundingSourceRefId?: string;
  budgetMin?: number;
  budgetMax?: number;
  preferredCurrencyCode?: string;
  preferredProjectCode?: string;
  preferredLocationCode?: string;
  preferredUnitTypeRefId?: string;
  purchaseTimelineRefId?: string;
  qualificationNotes?: string;
  scoreTotal?: number;
  scoreEngagement?: number;
  scoreBehavior?: number;
  scoreFinancial?: number;
  remarks?: string;
};

export async function listLeads(search?: string) {
  const response = await apiClient.get<{ items: Lead[]; pagination: { limit: number; offset: number; total: number } }>("/leads", {
    params: search ? { search } : undefined
  });
  return response.data;
}

export async function createLead(payload: CreateLeadPayload) {
  const response = await apiClient.post<LeadDetail>("/leads", payload);
  return response.data;
}

export async function getLead(id: string) {
  const response = await apiClient.get<LeadDetail>(`/leads/${id}`);
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
