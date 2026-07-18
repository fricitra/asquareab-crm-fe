import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getApiErrorMessage } from "../api/auth";
import {
  DASHBOARD_PERIOD_OPTIONS,
  getDashboardSummary,
  updateDashboardTargets,
  type DashboardBreakdown,
  type DashboardComparison,
  type DashboardPeriod,
  type DashboardView
} from "../api/dashboard";
import { useMoneyFormatter } from "../hooks/useCurrencyContext";
import { useModalEscape } from "../hooks/useModalEscape";
import { formatMoney } from "../lib/format-money";
import { CurrencyBadge } from "../shared/CurrencyBadge";
import { DashboardAiAssistant } from "../shared/DashboardAiAssistant";
import { DashboardPeriodSelect } from "../shared/DashboardPeriodSelect";
import { DashboardQuickAction } from "../shared/DashboardQuickAction";
import { NavIcon } from "../shared/NavIcons";
import { VelocityBadge } from "../shared/VelocityBadge";
import { useAuthStore } from "../store/auth-store";

const DASHBOARD_VIEWS: Record<
  DashboardView,
  { label: string; title: string; subtitle: string }
> = {
  operations: {
    label: "Sales Operations",
    title: "Sales Operations Overview",
    subtitle: "Executive KPIs, velocity performance, and commercial health"
  },
  audience: {
    label: "Lead & Customer Insights",
    title: "Lead & Customer Insights",
    subtitle: "Source mix, geography, buyer profile, and conversion by channel"
  }
};

function percent(value: number) {
  return `${Math.round(value)}%`;
}

function ComparisonTable({
  unitLabel,
  actual,
  forecast,
  budget,
  formatValue
}: DashboardComparison & {
  unitLabel: string;
  formatValue?: (value: number) => string;
}) {
  const render = (value: number) => (formatValue ? formatValue(value) : value.toLocaleString());

  return (
    <div className="crm-dashboard-comparison">
      <div className="crm-dashboard-comparison-row">
        <span>Actual</span>
        <strong>{render(actual)}</strong>
      </div>
      <div className="crm-dashboard-comparison-row">
        <span>Forecast</span>
        <strong>{render(forecast)}</strong>
      </div>
      <div className="crm-dashboard-comparison-row">
        <span>Budget</span>
        <strong>{render(budget)}</strong>
      </div>
      <p className="crm-muted-text">{unitLabel}</p>
    </div>
  );
}

function StatusBars({
  items,
  valueMode = false,
  formatValue = (value) => formatMoney(value)
}: {
  items: DashboardBreakdown[];
  valueMode?: boolean;
  formatValue?: (value: number) => string;
}) {
  const visibleItems = items.filter((item) => (valueMode ? item.value > 0 : item.count > 0));
  const max = Math.max(...visibleItems.map((item) => (valueMode ? item.value : item.count)), 1);

  if (!visibleItems.length) {
    return <p className="crm-muted-text">No data yet.</p>;
  }

  return (
    <div className="crm-dashboard-bars">
      {visibleItems.map((item) => {
        const current = valueMode ? item.value : item.count;
        return (
          <div className="crm-dashboard-bar" key={`${item.code}-${item.name}`}>
            <div className="crm-dashboard-bar-label">
              <strong>{item.name ?? item.code ?? "-"}</strong>
              <span>{valueMode ? formatValue(current) : current.toLocaleString()}</span>
            </div>
            <div className="crm-dashboard-bar-track">
              <span style={{ width: `${Math.max((current / max) * 100, current > 0 ? 8 : 0)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ConversionBars({
  items
}: {
  items: Array<{ code: string | null; name: string | null; count: number; convertedCount: number; conversionRate: number }>;
}) {
  const visibleItems = items.filter((item) => item.count > 0);
  const max = Math.max(...visibleItems.map((item) => item.count), 1);

  if (!visibleItems.length) {
    return <p className="crm-muted-text">No conversion-by-source data yet.</p>;
  }

  return (
    <div className="crm-dashboard-bars">
      {visibleItems.map((item) => (
        <div className="crm-dashboard-bar" key={`${item.code}-${item.name}`}>
          <div className="crm-dashboard-bar-label">
            <strong>{item.name ?? item.code ?? "-"}</strong>
            <span>
              {item.convertedCount.toLocaleString()}/{item.count.toLocaleString()} · {percent(item.conversionRate)}
            </span>
          </div>
          <div className="crm-dashboard-bar-track">
            <span style={{ width: `${Math.max((item.count / max) * 100, item.count > 0 ? 8 : 0)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const { formatInBase, baseCurrency, toBase, fromBase } = useMoneyFormatter();
  const [period, setPeriod] = useState<DashboardPeriod>("this_month");
  const [dashboardView, setDashboardView] = useState<DashboardView>("operations");
  const [geographyMode, setGeographyMode] = useState<"interest" | "residence">("interest");
  const [revenueCurrency, setRevenueCurrency] = useState<"base" | "usd">("base");
  const [targetsRevenueCurrency, setTargetsRevenueCurrency] = useState<"base" | "usd">("base");
  const [aiOpen, setAiOpen] = useState(false);
  const [targetsModalOpen, setTargetsModalOpen] = useState(false);
  const [targetsForm, setTargetsForm] = useState({
    monthlyUnitsBudget: "8",
    monthlyRevenueBudget: "7200000",
    monthlyUnitsForecast: "10",
    monthlyRevenueForecast: "9000000"
  });
  const [targetsError, setTargetsError] = useState<string | null>(null);

  const canEditTargets = Boolean(user?.permissions?.some((permission) => permission.code === "DASHBOARD" && permission.canUpdate));
  const showUsdToggle = baseCurrency.toUpperCase() !== "USD";

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", "summary", period, dashboardView],
    queryFn: () => getDashboardSummary(period, dashboardView),
    enabled: Boolean(accessToken),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1
  });

  const targetsMutation = useMutation({
    mutationFn: updateDashboardTargets,
    onSuccess: () => {
      setTargetsModalOpen(false);
      setTargetsError(null);
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "summary"] });
    }
  });

  useModalEscape(targetsModalOpen, () => setTargetsModalOpen(false));

  const summary = dashboardQuery.data;
  const conversionRate = useMemo(() => {
    if (!summary?.metrics.totalLeads) return 0;
    return (summary.metrics.convertedLeads / summary.metrics.totalLeads) * 100;
  }, [summary]);
  const reservationPressure = useMemo(() => {
    if (!summary?.metrics.totalUnits) return 0;
    return (summary.metrics.reservedUnits / summary.metrics.totalUnits) * 100;
  }, [summary]);

  const revenueComparison = useMemo(() => {
    if (!summary) {
      return { actual: 0, forecast: 0, budget: 0 };
    }

    const usd = summary.salesVelocity.comparison.revenueUsd;
    if (!showUsdToggle || revenueCurrency === "usd") {
      return usd;
    }

    return {
      actual: summary.salesVelocity.revenueSoldThisMonth,
      forecast: toBase(usd.forecast, "USD"),
      budget: toBase(usd.budget, "USD")
    };
  }, [summary, revenueCurrency, showUsdToggle, toBase]);

  const formatRevenueTargetAmount = (usdAmount: number, mode: "base" | "usd") => {
    if (!showUsdToggle || mode === "usd") {
      return String(usdAmount);
    }
    return String(toBase(usdAmount, "USD"));
  };

  const openTargetsModal = () => {
    if (!summary) return;
    const mode: "base" | "usd" = showUsdToggle ? "base" : "usd";
    setTargetsRevenueCurrency(mode);
    setTargetsError(null);
    setTargetsForm({
      monthlyUnitsBudget: String(summary.salesVelocity.targets.monthlyUnitsBudget),
      monthlyUnitsForecast: String(summary.salesVelocity.targets.monthlyUnitsForecast),
      monthlyRevenueBudget: formatRevenueTargetAmount(summary.salesVelocity.targets.monthlyRevenueBudgetUsd, mode),
      monthlyRevenueForecast: formatRevenueTargetAmount(summary.salesVelocity.targets.monthlyRevenueForecastUsd, mode)
    });
    setTargetsModalOpen(true);
  };

  const switchTargetsRevenueCurrency = (mode: "base" | "usd") => {
    if (mode === targetsRevenueCurrency) return;

    const budget = Number(targetsForm.monthlyRevenueBudget);
    const forecast = Number(targetsForm.monthlyRevenueForecast);

    if (mode === "usd") {
      const budgetUsd = fromBase(budget, "USD");
      const forecastUsd = fromBase(forecast, "USD");
      if (budgetUsd == null || forecastUsd == null) {
        setTargetsError("USD exchange rate is unavailable. Keep editing in base currency.");
        return;
      }
      setTargetsForm((current) => ({
        ...current,
        monthlyRevenueBudget: String(budgetUsd),
        monthlyRevenueForecast: String(forecastUsd)
      }));
    } else {
      setTargetsForm((current) => ({
        ...current,
        monthlyRevenueBudget: String(toBase(budget, "USD")),
        monthlyRevenueForecast: String(toBase(forecast, "USD"))
      }));
    }

    setTargetsError(null);
    setTargetsRevenueCurrency(mode);
  };

  const saveTargets = () => {
    const budgetInput = Number(targetsForm.monthlyRevenueBudget);
    const forecastInput = Number(targetsForm.monthlyRevenueForecast);
    let monthlyRevenueBudgetUsd = budgetInput;
    let monthlyRevenueForecastUsd = forecastInput;

    if (showUsdToggle && targetsRevenueCurrency === "base") {
      const budgetUsd = fromBase(budgetInput, "USD");
      const forecastUsd = fromBase(forecastInput, "USD");
      if (budgetUsd == null || forecastUsd == null) {
        setTargetsError("USD exchange rate is unavailable. Switch to USD or check currency rates.");
        return;
      }
      monthlyRevenueBudgetUsd = budgetUsd;
      monthlyRevenueForecastUsd = forecastUsd;
    }

    setTargetsError(null);
    targetsMutation.mutate({
      monthlyUnitsBudget: Number(targetsForm.monthlyUnitsBudget),
      monthlyUnitsForecast: Number(targetsForm.monthlyUnitsForecast),
      monthlyRevenueBudgetUsd,
      monthlyRevenueForecastUsd
    });
  };

  if (dashboardQuery.isLoading) {
    return (
      <section className="crm-panel">
        <p className="crm-muted-text">Loading dashboard...</p>
      </section>
    );
  }

  if (!summary || dashboardQuery.isError) {
    return (
      <section className="crm-panel">
        <h3>Dashboard unavailable</h3>
        <div className="crm-error-banner">
          {dashboardQuery.error ? getApiErrorMessage(dashboardQuery.error) : "The dashboard summary could not be loaded."}
        </div>
        <button className="crm-secondary-button" type="button" onClick={() => dashboardQuery.refetch()}>
          Retry
        </button>
      </section>
    );
  }

  const metrics = summary.metrics;
  const velocity = summary.salesVelocity;
  const formatMetric = (value: number) => formatInBase(value);
  const formatUsd = (value: number) => formatMoney(value, "USD");
  const formatRevenueComparison = (value: number) =>
    !showUsdToggle || revenueCurrency === "base" ? formatMetric(value) : formatUsd(value);
  const revenueUnitLabel =
    !showUsdToggle || revenueCurrency === "base"
      ? `${baseCurrency} revenue in selected period`
      : "USD revenue in selected period";
  const targetsRevenueCode = !showUsdToggle || targetsRevenueCurrency === "base" ? baseCurrency : "USD";
  const activeView = DASHBOARD_VIEWS[dashboardView];

  return (
    <div className="crm-workspace crm-dashboard-workspace">
      <section className="crm-module-header crm-dashboard-header">
        <div className="crm-dashboard-header-intro">
          <p className="crm-eyebrow">Executive Dashboard</p>
          <h2>{activeView.title}</h2>
          <div className="crm-dashboard-meta-row">
            <CurrencyBadge />
            <p className="crm-dashboard-meta-copy">
              {activeView.subtitle} · All monetary values in base currency · {velocity.periodLabel}
            </p>
          </div>
        </div>

        <div className="crm-dashboard-toolbar">
          <div aria-label="Dashboard view" className="crm-dashboard-view-segment" role="tablist">
            {(Object.keys(DASHBOARD_VIEWS) as DashboardView[]).map((viewKey) => (
              <button
                aria-selected={dashboardView === viewKey}
                className={`crm-dashboard-view-segment-button${dashboardView === viewKey ? " is-active" : ""}`}
                key={viewKey}
                onClick={() => setDashboardView(viewKey)}
                role="tab"
                type="button"
              >
                {DASHBOARD_VIEWS[viewKey].label}
              </button>
            ))}
          </div>
          <span aria-hidden="true" className="crm-dashboard-toolbar-divider" />
          <DashboardPeriodSelect
            onChange={setPeriod}
            options={DASHBOARD_PERIOD_OPTIONS}
            value={period}
          />
          <button className="crm-dashboard-action crm-dashboard-action-ai" onClick={() => setAiOpen(true)} type="button">
            <span className="crm-dashboard-action-icon">
              <NavIcon name="ai" />
            </span>
            <span className="crm-dashboard-action-label">AI Insights</span>
          </button>
          {canEditTargets ? (
            <DashboardQuickAction icon="targets" label="Edit Targets" onClick={openTargetsModal} />
          ) : null}
          <DashboardQuickAction icon="leads" label="Leads" to="/leads" />
          <DashboardQuickAction icon="opportunities" label="Pipeline" to="/opportunities" />
          <DashboardQuickAction icon="proposals" label="Proposals" to="/proposals" />
          <DashboardQuickAction icon="contracts" label="Contracts" to="/contracts" />
        </div>
      </section>

      {dashboardView === "operations" ? (
        <>
          <section className="crm-grid crm-metric-grid">
        <article className="crm-card crm-dashboard-kpi crm-dashboard-kpi-velocity">
          <h3>Unit Sales Velocity</h3>
          <div className="crm-kpi">{velocity.unitsSoldThisMonth.toLocaleString()}</div>
          <ComparisonTable unitLabel="Units sold in selected period" {...velocity.comparison.units} />
          <VelocityBadge category={velocity.unitsSoldCategory} />
        </article>
        <article className="crm-card crm-dashboard-kpi crm-dashboard-kpi-velocity">
          <div className="crm-dashboard-kpi-heading">
            <h3>Revenue Sales Velocity</h3>
            {showUsdToggle ? (
              <div aria-label="Revenue currency" className="crm-dashboard-view-segment crm-dashboard-currency-toggle" role="group">
                <button
                  className={`crm-dashboard-view-segment-button${revenueCurrency === "base" ? " is-active" : ""}`}
                  onClick={() => setRevenueCurrency("base")}
                  type="button"
                >
                  {baseCurrency}
                </button>
                <button
                  className={`crm-dashboard-view-segment-button${revenueCurrency === "usd" ? " is-active" : ""}`}
                  onClick={() => setRevenueCurrency("usd")}
                  type="button"
                >
                  USD
                </button>
              </div>
            ) : null}
          </div>
          <div className="crm-kpi">
            {!showUsdToggle || revenueCurrency === "base"
              ? formatMetric(velocity.revenueSoldThisMonth)
              : formatUsd(velocity.revenueSoldUsd ?? 0)}
          </div>
          <ComparisonTable
            formatValue={formatRevenueComparison}
            unitLabel={revenueUnitLabel}
            {...revenueComparison}
          />
          <VelocityBadge category={velocity.revenueSoldCategory} />
        </article>
        <article className="crm-card crm-dashboard-kpi crm-dashboard-kpi-velocity">
          <h3>Inventory Absorption</h3>
          <div className="crm-kpi">{percent(velocity.absorptionRate)}</div>
          <p>{velocity.totalSoldUnits} sold of {velocity.sellableUnits} sellable units</p>
        </article>
      </section>

      <section className="crm-grid crm-metric-grid">
        <article className="crm-card crm-dashboard-kpi">
          <h3>Open Pipeline Value</h3>
          <div className="crm-kpi">{formatMetric(metrics.pipelineValue)}</div>
          <p>{metrics.openOpportunities} open opportunities · {percent(metrics.avgProbability)} average probability</p>
        </article>
        <article className="crm-card crm-dashboard-kpi">
          <h3>Lead Conversion</h3>
          <div className="crm-kpi">{percent(conversionRate)}</div>
          <p>{metrics.convertedLeads} converted from {metrics.totalLeads} leads</p>
        </article>
        <article className="crm-card crm-dashboard-kpi">
          <h3>Unit Availability</h3>
          <div className="crm-kpi">{metrics.availableUnits}</div>
          <p>
            {metrics.reservedUnits} reserved · {metrics.soldUnits} sold · {percent(reservationPressure)} reservation pressure
          </p>
        </article>
        <article className="crm-card crm-dashboard-kpi">
          <h3>Signed Contract Value</h3>
          <div className="crm-kpi">{formatMetric(metrics.contractValue)}</div>
          <p>{metrics.signedContracts} signed · {metrics.erpHandedOff} ERP handed off</p>
        </article>
      </section>

      <section className="crm-grid crm-metric-grid crm-metric-grid-compact">
        <article className="crm-card crm-dashboard-kpi">
          <h3>Awaiting Approval</h3>
          <div className="crm-kpi">{metrics.proposalsPendingApproval}</div>
          <p>Submitted proposals waiting for internal decision</p>
        </article>
        <article className="crm-card crm-dashboard-kpi">
          <h3>Awaiting Acceptance</h3>
          <div className="crm-kpi">{metrics.proposalsAwaitingAcceptance}</div>
          <p>Approved proposals waiting for customer acceptance</p>
        </article>
        <article className="crm-card crm-dashboard-kpi">
          <h3>Active Discount Exposure</h3>
          <div className="crm-kpi">{formatMetric(metrics.discountExposure)}</div>
          <p>Submitted, approved, and accepted proposals only</p>
        </article>
      </section>
        </>
      ) : (
        <>
          <section className="crm-grid crm-metric-grid crm-metric-grid-audience">
            <article className="crm-card crm-dashboard-kpi">
              <h3>Leads Captured</h3>
              <div className="crm-kpi">{summary.audience.leadsCaptured.toLocaleString()}</div>
              <p>Active leads captured in {summary.audience.periodLabel.toLowerCase()}</p>
            </article>
            <article className="crm-card crm-dashboard-kpi">
              <h3>Converted (Period)</h3>
              <div className="crm-kpi">{summary.audience.leadsConverted.toLocaleString()}</div>
              <p>Converted among leads captured in this period</p>
            </article>
            <article className="crm-card crm-dashboard-kpi">
              <h3>Period Conversion</h3>
              <div className="crm-kpi">{percent(summary.audience.conversionRate)}</div>
              <p>Converted ÷ captured for the selected period</p>
            </article>
            <article className="crm-card crm-dashboard-kpi">
              <h3>Top Source</h3>
              <div className="crm-kpi crm-kpi-text">
                {summary.audience.bySource[0]?.name ?? summary.audience.bySource[0]?.code ?? "—"}
              </div>
              <p>
                {summary.audience.bySource[0]
                  ? `${summary.audience.bySource[0].count.toLocaleString()} leads`
                  : "No source mix yet"}
              </p>
            </article>
          </section>

          <section className="crm-dashboard-grid crm-dashboard-grid-focused">
            <section className="crm-panel">
              <div className="crm-panel-header">
                <div>
                  <h3>Lead Source Mix</h3>
                  <p className="crm-muted-text">Top sources for leads captured in {summary.audience.periodLabel.toLowerCase()}</p>
                </div>
                <Link to="/leads">Open</Link>
              </div>
              <StatusBars items={summary.audience.bySource} />
            </section>

            <section className="crm-panel">
              <div className="crm-panel-header">
                <div>
                  <h3>Capture Channel</h3>
                  <p className="crm-muted-text">How leads entered the CRM this period</p>
                </div>
                <Link to="/leads">Open</Link>
              </div>
              <StatusBars items={summary.audience.byCaptureChannel} />
            </section>

            <section className="crm-panel">
              <div className="crm-panel-header">
                <div>
                  <h3>Nationality</h3>
                  <p className="crm-muted-text">Lead nationality mix for the period</p>
                </div>
              </div>
              <StatusBars items={summary.audience.byNationality} />
            </section>

            <section className="crm-panel">
              <div className="crm-panel-header">
                <div>
                  <h3>Geography</h3>
                  <p className="crm-muted-text">
                    {geographyMode === "interest" ? "Country of interest" : "Current residence"} for period leads
                  </p>
                </div>
                <div className="crm-dashboard-view-segment" role="group" aria-label="Geography mode">
                  <button
                    className={`crm-dashboard-view-segment-button${geographyMode === "interest" ? " is-active" : ""}`}
                    onClick={() => setGeographyMode("interest")}
                    type="button"
                  >
                    Interest
                  </button>
                  <button
                    className={`crm-dashboard-view-segment-button${geographyMode === "residence" ? " is-active" : ""}`}
                    onClick={() => setGeographyMode("residence")}
                    type="button"
                  >
                    Residence
                  </button>
                </div>
              </div>
              <StatusBars
                items={
                  geographyMode === "interest"
                    ? summary.audience.byInterestCountry
                    : summary.audience.byResidenceCountry
                }
              />
            </section>

            <section className="crm-panel">
              <div className="crm-panel-header">
                <div>
                  <h3>Buyer Profile</h3>
                  <p className="crm-muted-text">Buyer type, funding, and purchase purpose (top segments)</p>
                </div>
              </div>
              <div className="crm-dashboard-audience-profile">
                <div>
                  <h4>Buyer type</h4>
                  <StatusBars items={summary.audience.byBuyerType} />
                </div>
                <div>
                  <h4>Funding</h4>
                  <StatusBars items={summary.audience.byFundingSource} />
                </div>
                <div>
                  <h4>Purpose</h4>
                  <StatusBars items={summary.audience.byPurpose} />
                </div>
              </div>
            </section>

            <section className="crm-panel">
              <div className="crm-panel-header">
                <div>
                  <h3>Conversion by Source</h3>
                  <p className="crm-muted-text">Converted vs captured for each source this period</p>
                </div>
                <Link to="/leads">Open</Link>
              </div>
              <ConversionBars items={summary.audience.conversionBySource} />
            </section>
          </section>
        </>
      )}

      <DashboardAiAssistant onClose={() => setAiOpen(false)} open={aiOpen} period={period} view={dashboardView} />

      {targetsModalOpen ? (
        <div className="crm-modal-backdrop" role="presentation">
          <section aria-modal="true" className="crm-modal crm-management-modal crm-dashboard-targets-modal" role="dialog">
            <div className="crm-panel-header">
              <div>
                <h3>Sales Velocity Targets</h3>
                <p className="crm-muted-text">
                  Monthly budget and forecast for Actual / Forecast / Budget comparisons
                  {showUsdToggle ? ` · revenue shown in ${targetsRevenueCode}` : ""}.
                </p>
              </div>
              <div className="crm-dashboard-targets-header-actions">
                {showUsdToggle ? (
                  <div aria-label="Target revenue currency" className="crm-dashboard-view-segment crm-dashboard-currency-toggle" role="group">
                    <button
                      className={`crm-dashboard-view-segment-button${targetsRevenueCurrency === "base" ? " is-active" : ""}`}
                      onClick={() => switchTargetsRevenueCurrency("base")}
                      type="button"
                    >
                      {baseCurrency}
                    </button>
                    <button
                      className={`crm-dashboard-view-segment-button${targetsRevenueCurrency === "usd" ? " is-active" : ""}`}
                      onClick={() => switchTargetsRevenueCurrency("usd")}
                      type="button"
                    >
                      USD
                    </button>
                  </div>
                ) : null}
                <button className="crm-secondary-button crm-fit-button" onClick={() => setTargetsModalOpen(false)} type="button">
                  Close
                </button>
              </div>
            </div>
            <form
              className="crm-form"
              onSubmit={(event) => {
                event.preventDefault();
                saveTargets();
              }}
            >
              <label className="crm-field">
                <span className="crm-label">Monthly Units Budget</span>
                <input
                  className="crm-input"
                  onChange={(event) => setTargetsForm((current) => ({ ...current, monthlyUnitsBudget: event.target.value }))}
                  required
                  type="number"
                  value={targetsForm.monthlyUnitsBudget}
                />
              </label>
              <label className="crm-field">
                <span className="crm-label">Monthly Units Forecast</span>
                <input
                  className="crm-input"
                  onChange={(event) => setTargetsForm((current) => ({ ...current, monthlyUnitsForecast: event.target.value }))}
                  required
                  type="number"
                  value={targetsForm.monthlyUnitsForecast}
                />
              </label>
              <label className="crm-field">
                <span className="crm-label">Monthly Revenue Budget ({targetsRevenueCode})</span>
                <input
                  className="crm-input"
                  onChange={(event) => setTargetsForm((current) => ({ ...current, monthlyRevenueBudget: event.target.value }))}
                  required
                  step="0.01"
                  type="number"
                  value={targetsForm.monthlyRevenueBudget}
                />
              </label>
              <label className="crm-field">
                <span className="crm-label">Monthly Revenue Forecast ({targetsRevenueCode})</span>
                <input
                  className="crm-input"
                  onChange={(event) => setTargetsForm((current) => ({ ...current, monthlyRevenueForecast: event.target.value }))}
                  required
                  step="0.01"
                  type="number"
                  value={targetsForm.monthlyRevenueForecast}
                />
              </label>
              {targetsError ? <div className="crm-error-banner">{targetsError}</div> : null}
              <div className="crm-modal-actions">
                <button className="crm-secondary-button" onClick={() => setTargetsModalOpen(false)} type="button">
                  Cancel
                </button>
                <button className="crm-primary-button" disabled={targetsMutation.isPending} type="submit">
                  Save Targets
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
