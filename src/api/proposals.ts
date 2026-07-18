import { apiClient } from "../lib/api-client";
import { buildListQueryParams, type ListQueryParams } from "../lib/list-pagination";

type NamedLink = {
  id: string | null;
  name: string | null;
};

type WorkflowUser = {
  id: string | null;
  name: string | null;
};

export type ProposalApprovalHistory = {
  id: string;
  approvalOutcome: {
    id: string;
    code: string | null;
    name: string | null;
  };
  fromStatus: {
    id: string | null;
    code: string | null;
    name: string | null;
  };
  toStatus: {
    id: string | null;
    code: string | null;
    name: string | null;
  };
  changedAt: string | null;
  changedByUser: WorkflowUser;
  approvalRoleCode: string | null;
  proposedPrice: number | null;
  discountAmount: number | null;
  discountPercent: number | null;
  remarks: string | null;
};

export type ProposalUnitSnapshot = {
  id: string;
  project: {
    id: string | null;
    projectCode: string | null;
    name: string | null;
  };
  unit: {
    id: string | null;
    unitCode: string | null;
    unitName: string | null;
  };
  blockCode: string | null;
  floorNo: string | null;
  unitType: NamedLink;
  bedroomCount: number | null;
  grossArea: number | null;
  netArea: number | null;
  basePrice: number | null;
  currencyCode: string | null;
  createdAt: string | null;
  remarks: string | null;
};

export type ProposalPricingContext = {
  equivalentCurrencyCode?: string | null;
  listPriceSource?: { amount: number; currencyCode: string };
  listPriceBase?: { amount: number; currencyCode: string };
  proposedPriceSource?: { amount: number; currencyCode: string };
  proposedPriceBase?: { amount: number; currencyCode: string };
  reservationNo?: string | null;
  ratesUsed?: Record<string, number>;
};

export type Proposal = {
  id: string;
  proposalNo: string;
  opportunity: {
    id: string;
    opportunityNo: string | null;
  };
  customer: NamedLink;
  lead: {
    id: string | null;
    leadNo: string | null;
  };
  broker: NamedLink;
  project: {
    id: string | null;
    projectCode: string | null;
    name: string | null;
  };
  unit: {
    id: string | null;
    unitCode: string | null;
    unitName: string | null;
  };
  proposalStatus: {
    id: string;
    code: string | null;
    name: string | null;
  };
  proposalDate: string;
  validUntil: string | null;
  currencyCode: string | null;
  priceBasis: {
    id: string | null;
    code: string | null;
    name: string | null;
  };
  listPrice: number | null;
  proposedPrice: number;
  discountAmount: number | null;
  discountPercent: number | null;
  discountType: {
    id: string | null;
    code: string | null;
    name: string | null;
  };
  approvalRequired: boolean;
  approvalThresholdPercent: number | null;
  approvedAt: string | null;
  approvedBy: NamedLink;
  acceptedAt: string | null;
  acceptedBy: NamedLink;
  status: string;
  isActive: boolean;
  createdAt: string | null;
  createdBy: WorkflowUser;
  updatedAt: string | null;
  updatedBy: WorkflowUser;
  remarks: string | null;
  equivalentCurrencyCode?: string | null;
  pricingContextJson?: ProposalPricingContext | null;
  unitSnapshot?: ProposalUnitSnapshot | null;
  approvalHistory?: ProposalApprovalHistory[];
};

export type CreateProposalPayload = {
  opportunityId: string;
  unitId?: string;
  validUntil?: string;
  currencyCode?: string;
  listPrice?: number;
  proposedPrice?: number;
  discountAmount?: number;
  discountPercent?: number;
  approvalThresholdPercent?: number;
  equivalentCurrencyCode?: string;
  pricingContextJson?: ProposalPricingContext;
  remarks?: string;
};

export async function listProposals(params?: ListQueryParams) {
  const response = await apiClient.get<{
    items: Proposal[];
    pagination: { limit: number; offset: number; total: number };
    summary?: { approvalRequired: number; approved: number; value: number };
  }>("/proposals", {
    params: buildListQueryParams(params)
  });
  return response.data;
}

export async function getProposal(id: string) {
  const response = await apiClient.get<Proposal>(`/proposals/${id}`);
  return response.data;
}

export async function createProposal(payload: CreateProposalPayload) {
  const response = await apiClient.post<Proposal>("/proposals", payload);
  return response.data;
}

export async function supersedeProposal(id: string, payload: CreateProposalPayload) {
  const response = await apiClient.post<Proposal>(`/proposals/${id}/supersede`, payload);
  return response.data;
}

export async function submitProposal(id: string, remarks?: string) {
  const response = await apiClient.post<Proposal>(`/proposals/${id}/submit`, { remarks });
  return response.data;
}

export async function approveProposal(id: string, remarks?: string) {
  const response = await apiClient.post<Proposal>(`/proposals/${id}/approve`, { remarks });
  return response.data;
}

export async function rejectProposal(id: string, remarks: string) {
  const response = await apiClient.post<Proposal>(`/proposals/${id}/reject`, { remarks });
  return response.data;
}

export async function acceptProposal(id: string, remarks?: string) {
  const response = await apiClient.post<Proposal>(`/proposals/${id}/accept`, { remarks });
  return response.data;
}
