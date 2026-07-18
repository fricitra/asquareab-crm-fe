import { apiClient } from "../lib/api-client";

export type DashboardPeriod = "this_month" | "last_30_days" | "this_quarter" | "ytd";

export type DashboardBreakdown = {
  code: string | null;
  name: string | null;
  count: number;
  value: number;
};

export type DashboardVelocityCategory = {
  code: string;
  label: string;
  status: "excellent" | "strong" | "acceptable" | "slow" | "critical";
};

export type DashboardVelocityBreakdown = {
  code: string;
  name: string;
  count: number;
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

export type DashboardComparison = {
  actual: number;
  forecast: number;
  budget: number;
};

export type DashboardTargets = {
  monthlyUnitsBudget: number;
  monthlyRevenueBudgetUsd: number;
  monthlyUnitsForecast: number;
  monthlyRevenueForecastUsd: number;
};

export type DashboardSummary = {
  displayCurrency: string;
  metrics: {
    totalLeads: number;
    convertedLeads: number;
    openOpportunities: number;
    wonOpportunities: number;
    pipelineValue: number;
    avgProbability: number;
    totalUnits: number;
    availableUnits: number;
    reservedUnits: number;
    soldUnits: number;
    sellableUnits: number;
    signedContracts: number;
    contractValue: number;
    erpReady: number;
    erpHandedOff: number;
    failedHandoffs: number;
    proposalsPendingApproval: number;
    proposalsAwaitingAcceptance: number;
    acceptedProposals: number;
    discountExposure: number;
    expiringProposals: number;
  };
  salesVelocity: {
    period: DashboardPeriod;
    periodLabel: string;
    unitsSoldThisMonth: number;
    unitsSoldCategory: DashboardVelocityCategory;
    revenueSoldThisMonth: number;
    revenueSoldUsd: number | null;
    revenueSoldCategory: DashboardVelocityCategory;
    absorptionRate: number;
    totalSoldUnits: number;
    sellableUnits: number;
    unitVelocityBreakdown: DashboardVelocityBreakdown[];
    comparison: {
      units: DashboardComparison;
      revenueUsd: DashboardComparison;
    };
    targets: DashboardTargets;
  };
  audience: {
    period: DashboardPeriod;
    periodLabel: string;
    leadsCaptured: number;
    leadsConverted: number;
    conversionRate: number;
    bySource: DashboardBreakdown[];
    byCaptureChannel: DashboardBreakdown[];
    byNationality: DashboardBreakdown[];
    byInterestCountry: DashboardBreakdown[];
    byResidenceCountry: DashboardBreakdown[];
    byBuyerType: DashboardBreakdown[];
    byFundingSource: DashboardBreakdown[];
    byPurpose: DashboardBreakdown[];
    conversionBySource: Array<{
      code: string | null;
      name: string | null;
      count: number;
      convertedCount: number;
      conversionRate: number;
    }>;
  };
  breakdowns: {
    opportunityStages: DashboardBreakdown[];
    inventoryStatuses: DashboardBreakdown[];
  };
  recentActivity: DashboardActivity[];
  attentionItems: DashboardAttentionItem[];
};

export type UpdateDashboardTargetsPayload = {
  monthlyUnitsBudget: number;
  monthlyRevenueBudgetUsd: number;
  monthlyUnitsForecast?: number | null;
  monthlyRevenueForecastUsd?: number | null;
  remarks?: string;
};

export type DashboardSummaryView = "operations" | "pipeline" | "audience" | "all";

export async function getDashboardSummary(
  period: DashboardPeriod = "this_month",
  view: DashboardSummaryView = "all"
) {
  const response = await apiClient.get<DashboardSummary>("/dashboard/summary", { params: { period, view } });
  return response.data;
}

export async function getDashboardTargets() {
  const response = await apiClient.get<DashboardTargets>("/dashboard/targets");
  return response.data;
}

export async function updateDashboardTargets(payload: UpdateDashboardTargetsPayload) {
  const response = await apiClient.put<DashboardTargets>("/dashboard/targets", payload);
  return response.data;
}

export const DASHBOARD_PERIOD_OPTIONS: Array<{ value: DashboardPeriod; label: string }> = [
  { value: "this_month", label: "This month" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "this_quarter", label: "This quarter" },
  { value: "ytd", label: "Year to date" }
];

export type DashboardView = "operations" | "audience";

export type DashboardAiInsight = {
  category: "progress" | "improvement" | "buyer_profile" | "scenario";
  title: string;
  summary: string;
  bullets: string[];
};

export type DashboardAiInsightsResponse = {
  view: DashboardView;
  period: DashboardPeriod;
  periodLabel: string;
  insights: DashboardAiInsight[];
  suggestedQuestions: string[];
  poweredBy: "crm-analytics" | "openai";
};

export type DashboardAiChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type DashboardAiChatResponse = {
  reply: string;
  poweredBy: "crm-analytics" | "openai";
};

export async function getDashboardAiInsights(view: DashboardView, period: DashboardPeriod) {
  const response = await apiClient.post<DashboardAiInsightsResponse>("/dashboard/ai/insights", { view, period });
  return response.data;
}

export async function chatDashboardAi(input: {
  view: DashboardView;
  period: DashboardPeriod;
  message: string;
  history?: DashboardAiChatMessage[];
}) {
  const response = await apiClient.post<DashboardAiChatResponse>("/dashboard/ai/chat", input);
  return response.data;
}
