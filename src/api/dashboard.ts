import { apiClient } from "../lib/api-client";

export type DashboardBreakdown = {
  code: string | null;
  name: string | null;
  count: number;
  value: number;
};

export type DashboardActivity = {
  activityType: string;
  id: string;
  documentNo: string;
  title: string | null;
  statusName: string | null;
  statusCode: string | null;
  amount: number;
  currencyCode: string | null;
  happenedAt: string | null;
};

export type DashboardAttentionItem = {
  itemType: string;
  id: string;
  documentNo: string;
  title: string | null;
  statusName: string | null;
  statusCode: string | null;
  amount: number;
  currencyCode: string | null;
  route: string;
};

export type DashboardSummary = {
  metrics: {
    totalLeads: number;
    newLeads: number;
    qualifiedLeads: number;
    convertedLeads: number;
    openOpportunities: number;
    wonOpportunities: number;
    pipelineValue: number;
    avgProbability: number;
    totalUnits: number;
    availableUnits: number;
    reservedUnits: number;
    reservationRequests: number;
    approvedReservations: number;
    signedContracts: number;
    contractValue: number;
    erpReady: number;
    erpHandedOff: number;
    failedHandoffs: number;
    proposalsPendingApproval: number;
    acceptedProposals: number;
    discountExposure: number;
    expiringProposals: number;
  };
  breakdowns: {
    opportunityStages: DashboardBreakdown[];
    leadStatuses: DashboardBreakdown[];
    inventoryStatuses: DashboardBreakdown[];
    reservationStatuses: DashboardBreakdown[];
    contractStatuses: DashboardBreakdown[];
  };
  recentActivity: DashboardActivity[];
  attentionItems: DashboardAttentionItem[];
};

export async function getDashboardSummary() {
  const response = await apiClient.get<DashboardSummary>("/dashboard/summary");
  return response.data;
}
