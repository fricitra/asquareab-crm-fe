import { apiClient } from "../lib/api-client";
import { buildListQueryParams, type ListQueryParams } from "../lib/list-pagination";

type NamedLink = {
  id: string | null;
  name: string | null;
};

export type Opportunity = {
  id: string;
  opportunityNo: string;
  customer: NamedLink;
  lead: {
    id: string | null;
    leadNo: string | null;
  };
  broker: NamedLink;
  projectCode: string | null;
  preferredLocationCode: string | null;
  preferredUnitType: NamedLink;
  opportunityStage: NamedLink;
  probabilityPercent: number | null;
  expectedCloseDate: string | null;
  currencyCode: string | null;
  budgetAmount: number | null;
  proposedUnitCode: string | null;
  assignedToUser: NamedLink;
  salesManagerUser: NamedLink;
  lostReason: NamedLink;
  status: string;
  createdAt: string | null;
  createdBy: NamedLink;
  updatedAt: string | null;
  updatedBy: NamedLink;
  remarks: string | null;
};

export type OpportunityDetail = Opportunity & {
  notes: Array<{
    id: string;
    noteText: string;
    noteType: string | null;
    createdAt: string | null;
    createdBy: NamedLink;
  }>;
  siteVisits: Array<{
    id: string;
    visitDate: string | null;
    visitType: "IN_PERSON" | "VIRTUAL";
    projectCode: string | null;
    proposedUnitCode: string | null;
    assignedToUser: NamedLink;
    status: string;
    remarks: string | null;
  }>;
  stageHistory: Array<{
    id: string;
    opportunityStage: NamedLink;
    probabilityPercent: number | null;
    changedAt: string | null;
    changedByUser: NamedLink;
    changedByRole: string | null;
    remarks: string | null;
  }>;
};

export type ConvertLeadPayload = {
  opportunityStageRefId?: string;
  probabilityPercent?: number;
  expectedCloseDate?: string;
  budgetAmount?: number;
  proposedUnitCode?: string;
  remarks?: string;
};

export type ChangeOpportunityStagePayload = {
  opportunityStageRefId: string;
  probabilityPercent?: number;
  lostReasonRefId?: string;
  remarks?: string;
};

export async function convertLeadToOpportunity(leadId: string, payload: ConvertLeadPayload) {
  const response = await apiClient.post<OpportunityDetail>(`/leads/${leadId}/convert`, payload);
  return response.data;
}

export async function listOpportunities(params?: ListQueryParams) {
  const response = await apiClient.get<{
    items: Opportunity[];
    pagination: { limit: number; offset: number; total: number };
    summary?: { open: number; totalBudget: number; avgProbability: number };
  }>("/opportunities", {
    params: buildListQueryParams(params)
  });
  return response.data;
}

export async function getOpportunity(id: string) {
  const response = await apiClient.get<OpportunityDetail>(`/opportunities/${id}`);
  return response.data;
}

export async function changeOpportunityStage(id: string, payload: ChangeOpportunityStagePayload) {
  const response = await apiClient.post<OpportunityDetail>(`/opportunities/${id}/stage`, payload);
  return response.data;
}

export async function addOpportunityNote(id: string, noteText: string, noteType?: string) {
  const response = await apiClient.post<OpportunityDetail>(`/opportunities/${id}/notes`, {
    noteText,
    noteType
  });
  return response.data;
}

export async function scheduleSiteVisit(
  id: string,
  payload: {
    visitDate: string;
    visitType: "IN_PERSON" | "VIRTUAL";
    proposedUnitCode?: string;
    remarks?: string;
  }
) {
  const response = await apiClient.post<OpportunityDetail>(`/opportunities/${id}/site-visits`, payload);
  return response.data;
}

export async function updateSiteVisit(
  opportunityId: string,
  visitId: string,
  payload: {
    visitDate?: string;
    visitType?: "IN_PERSON" | "VIRTUAL";
    status?: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
    proposedUnitCode?: string;
    remarks?: string;
  }
) {
  const response = await apiClient.patch<OpportunityDetail>(
    `/opportunities/${opportunityId}/site-visits/${visitId}`,
    payload
  );
  return response.data;
}
