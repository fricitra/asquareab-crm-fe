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
import { formatAmount } from "../lib/format-money";
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
  pipeline: {
    label: "Pipeline & Stages",
    title: "Sales Stage Pipeline View",
    subtitle: "Stage distribution, inventory position, velocity mix, and action queue"
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
  formatValue = formatAmount
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

function VelocityBars({ items }: { items: Array<{ code: string; name: string; count: number }> }) {
  const visibleItems = items.filter((item) => item.count > 0);
  const max = Math.max(...visibleItems.map((item) => item.count), 1);

  if (!visibleItems.length) {
    return <p className="crm-muted-text">No unit velocity data yet.</p>;
  }

  return (
    <div className="crm-dashboard-bars">
      {visibleItems.map((item) => (
        <div className="crm-dashboard-bar" key={item.code}>
          <div className="crm-dashboard-bar-label">
            <strong>{item.name}</strong>
            <span>{item.count.toLocaleString()}</span>
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
  const { formatInBase } = useMoneyFormatter();
  const [period, setPeriod] = useState<DashboardPeriod>("this_month");
  const [dashboardView, setDashboardView] = useState<DashboardView>("operations");
  const [aiOpen, setAiOpen] = useState(false);
  const [targetsModalOpen, setTargetsModalOpen] = useState(false);
  const [targetsForm, setTargetsForm] = useState({
    monthlyUnitsBudget: "8",
    monthlyRevenueBudgetUsd: "7200000",
    monthlyUnitsForecast: "10",
    monthlyRevenueForecastUsd: "9000000"
  });

  const canEditTargets = Boolean(user?.permissions?.some((permission) => permission.code === "DASHBOARD" && permission.canUpdate));

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", "summary", period],
    queryFn: () => getDashboardSummary(period),
    enabled: Boolean(accessToken),
    staleTime: 15_000,
    retry: 1
  });

  const targetsMutation = useMutation({
    mutationFn: updateDashboardTargets,
    onSuccess: () => {
      setTargetsModalOpen(false);
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

  const openTargetsModal = () => {
    if (!summary) return;
    setTargetsForm({
      monthlyUnitsBudget: String(summary.salesVelocity.targets.monthlyUnitsBudget),
      monthlyRevenueBudgetUsd: String(summary.salesVelocity.targets.monthlyRevenueBudgetUsd),
      monthlyUnitsForecast: String(summary.salesVelocity.targets.monthlyUnitsForecast),
      monthlyRevenueForecastUsd: String(summary.salesVelocity.targets.monthlyRevenueForecastUsd)
    });
    setTargetsModalOpen(true);
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
  const formatUsd = (value: number) => `USD ${formatAmount(value)}`;
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
          <h3>Revenue Sales Velocity</h3>
          <div className="crm-kpi">{formatMetric(velocity.revenueSoldThisMonth)}</div>
          <ComparisonTable
            formatValue={formatUsd}
            unitLabel="USD revenue in selected period"
            {...velocity.comparison.revenueUsd}
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
        <section className="crm-dashboard-grid crm-dashboard-grid-focused">
          <section className="crm-panel">
            <div className="crm-panel-header">
              <div>
                <h3>Open Pipeline by Stage</h3>
                <p className="crm-muted-text">Number of open opportunities in each stage</p>
              </div>
              <Link to="/opportunities">Open</Link>
            </div>
            <StatusBars items={summary.breakdowns.opportunityStages} />
          </section>

          <section className="crm-panel">
            <div className="crm-panel-header">
              <div>
                <h3>Inventory Position</h3>
                <p className="crm-muted-text">Live unit counts by availability status</p>
              </div>
              <Link to="/inventory">Open</Link>
            </div>
            <StatusBars items={summary.breakdowns.inventoryStatuses} />
          </section>

          <section className="crm-panel">
            <div className="crm-panel-header">
              <div>
                <h3>Unit Velocity Mix</h3>
                <p className="crm-muted-text">How quickly units sell or age on market</p>
              </div>
              <Link to="/inventory">Open</Link>
            </div>
            <VelocityBars items={velocity.unitVelocityBreakdown} />
          </section>

          <section className="crm-panel">
            <div className="crm-panel-header">
              <div>
                <h3>Action Queue</h3>
                <p className="crm-muted-text">
                  Reservations, proposals, and ERP handoffs needing action · ERP {metrics.erpReady} ready · {metrics.failedHandoffs} failed · {metrics.erpHandedOff} handed off
                </p>
              </div>
            </div>
            <div className="crm-dashboard-queue">
              {summary.attentionItems.length ? (
                summary.attentionItems.map((item) => (
                  <Link className="crm-dashboard-queue-item" key={`${item.itemType}-${item.id}`} to={item.route}>
                    <div>
                      <strong>{item.itemType}</strong>
                      <span>
                        {item.documentNo} · {item.title ?? "-"}
                      </span>
                    </div>
                    <div className="crm-dashboard-queue-meta">
                      <span className="crm-status-pill">{item.statusName ?? item.statusCode ?? "-"}</span>
                      {item.amount > 0 ? <span className="crm-dashboard-queue-amount">{formatMetric(item.amount)}</span> : null}
                    </div>
                  </Link>
                ))
              ) : (
                <p className="crm-muted-text">No urgent workflow items.</p>
              )}
            </div>
          </section>
        </section>
      )}

      <DashboardAiAssistant onClose={() => setAiOpen(false)} open={aiOpen} period={period} view={dashboardView} />

      {targetsModalOpen ? (
        <div className="crm-modal-backdrop" role="presentation">
          <section aria-modal="true" className="crm-modal crm-management-modal crm-dashboard-targets-modal" role="dialog">
            <div className="crm-panel-header">
              <div>
                <h3>Sales Velocity Targets</h3>
                <p className="crm-muted-text">Monthly budget and forecast values used for Actual / Forecast / Budget comparisons.</p>
              </div>
              <button className="crm-secondary-button crm-fit-button" onClick={() => setTargetsModalOpen(false)} type="button">
                Close
              </button>
            </div>
            <form
              className="crm-form"
              onSubmit={(event) => {
                event.preventDefault();
                targetsMutation.mutate({
                  monthlyUnitsBudget: Number(targetsForm.monthlyUnitsBudget),
                  monthlyRevenueBudgetUsd: Number(targetsForm.monthlyRevenueBudgetUsd),
                  monthlyUnitsForecast: Number(targetsForm.monthlyUnitsForecast),
                  monthlyRevenueForecastUsd: Number(targetsForm.monthlyRevenueForecastUsd)
                });
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
                <span className="crm-label">Monthly Revenue Budget (USD)</span>
                <input
                  className="crm-input"
                  onChange={(event) => setTargetsForm((current) => ({ ...current, monthlyRevenueBudgetUsd: event.target.value }))}
                  required
                  step="0.01"
                  type="number"
                  value={targetsForm.monthlyRevenueBudgetUsd}
                />
              </label>
              <label className="crm-field">
                <span className="crm-label">Monthly Revenue Forecast (USD)</span>
                <input
                  className="crm-input"
                  onChange={(event) => setTargetsForm((current) => ({ ...current, monthlyRevenueForecastUsd: event.target.value }))}
                  required
                  step="0.01"
                  type="number"
                  value={targetsForm.monthlyRevenueForecastUsd}
                />
              </label>
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
