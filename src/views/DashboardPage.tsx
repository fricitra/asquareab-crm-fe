import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getDashboardSummary, type DashboardActivity, type DashboardBreakdown } from "../api/dashboard";

function money(value: number, currencyCode = "USD") {
  return `${value.toLocaleString()} ${currencyCode}`;
}

function percent(value: number) {
  return `${Math.round(value)}%`;
}

function dateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function StatusBars({ items, valueMode = false }: { items: DashboardBreakdown[]; valueMode?: boolean }) {
  const max = Math.max(...items.map((item) => (valueMode ? item.value : item.count)), 1);

  if (!items.length) {
    return <p className="crm-muted-text">No data yet.</p>;
  }

  return (
    <div className="crm-dashboard-bars">
      {items.map((item) => {
        const current = valueMode ? item.value : item.count;
        return (
          <div className="crm-dashboard-bar" key={`${item.code}-${item.name}`}>
            <div className="crm-dashboard-bar-label">
              <strong>{item.name ?? item.code ?? "-"}</strong>
              <span>{valueMode ? money(current) : current.toLocaleString()}</span>
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

function ActivityList({ items }: { items: DashboardActivity[] }) {
  if (!items.length) {
    return <p className="crm-muted-text">No recent activity yet.</p>;
  }

  return (
    <div className="crm-dashboard-activity crm-dashboard-record-list">
      <div className="crm-dashboard-record-head">
        <span>S.No.</span>
        <span>Record</span>
        <span>Details</span>
      </div>
      {items.map((item, index) => (
        <article key={`${item.activityType}-${item.id}`}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <div>
            <strong>{item.documentNo}</strong>
            <span>{item.activityType} · {item.statusName ?? item.statusCode ?? "-"}</span>
          </div>
          <div>
            <span>{item.title ?? "-"}</span>
            <span>{item.amount ? money(item.amount, item.currencyCode ?? "USD") : dateTime(item.happenedAt)}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const dashboardQuery = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: getDashboardSummary,
    staleTime: 15_000
  });

  const summary = dashboardQuery.data;
  const conversionRate = useMemo(() => {
    if (!summary?.metrics.totalLeads) return 0;
    return (summary.metrics.convertedLeads / summary.metrics.totalLeads) * 100;
  }, [summary]);
  const reservationPressure = useMemo(() => {
    if (!summary?.metrics.totalUnits) return 0;
    return (summary.metrics.reservedUnits / summary.metrics.totalUnits) * 100;
  }, [summary]);

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
        <p className="crm-muted-text">The dashboard summary could not be loaded.</p>
      </section>
    );
  }

  const metrics = summary.metrics;

  return (
    <div className="crm-workspace crm-dashboard-workspace">
      <section className="crm-module-header">
        <div>
          <p className="crm-eyebrow">Executive Dashboard</p>
          <h2>Sales Operations Overview</h2>
        </div>
        <div className="crm-dashboard-actions">
          <Link className="crm-secondary-button" to="/leads">Leads</Link>
          <Link className="crm-secondary-button" to="/opportunities">Pipeline</Link>
          <Link className="crm-secondary-button" to="/proposals">Proposals</Link>
          <Link className="crm-secondary-button" to="/contracts">Contracts</Link>
        </div>
      </section>

      <section className="crm-grid crm-metric-grid">
        <article className="crm-card crm-dashboard-kpi">
          <h3>Pipeline Value</h3>
          <div className="crm-kpi">{money(metrics.pipelineValue)}</div>
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
          <p>{metrics.reservedUnits} reserved · {percent(reservationPressure)} reservation pressure</p>
        </article>
        <article className="crm-card crm-dashboard-kpi">
          <h3>Contract Value</h3>
          <div className="crm-kpi">{money(metrics.contractValue)}</div>
          <p>{metrics.signedContracts} signed · {metrics.erpHandedOff} ERP handed off</p>
        </article>
      </section>

      <section className="crm-grid crm-metric-grid">
        <article className="crm-card crm-dashboard-kpi">
          <h3>Pending Approval</h3>
          <div className="crm-kpi">{metrics.proposalsPendingApproval}</div>
          <p>Submitted proposals waiting for decision</p>
        </article>
        <article className="crm-card crm-dashboard-kpi">
          <h3>Accepted Proposals</h3>
          <div className="crm-kpi">{metrics.acceptedProposals}</div>
          <p>Customer accepted commercial proposals</p>
        </article>
        <article className="crm-card crm-dashboard-kpi">
          <h3>Discount Exposure</h3>
          <div className="crm-kpi">{money(metrics.discountExposure)}</div>
          <p>Total discount amount across active proposals</p>
        </article>
        <article className="crm-card crm-dashboard-kpi">
          <h3>Expiring Proposals</h3>
          <div className="crm-kpi">{metrics.expiringProposals}</div>
          <p>Valid until date falls within the next 7 days</p>
        </article>
      </section>

      <section className="crm-dashboard-grid">
        <section className="crm-panel">
          <div className="crm-panel-header">
            <h3>Pipeline by Stage</h3>
            <Link to="/opportunities">Open</Link>
          </div>
          <StatusBars items={summary.breakdowns.opportunityStages} valueMode />
        </section>

        <section className="crm-panel">
          <div className="crm-panel-header">
            <h3>Inventory Position</h3>
            <Link to="/inventory">Open</Link>
          </div>
          <StatusBars items={summary.breakdowns.inventoryStatuses} />
        </section>

        <section className="crm-panel">
          <div className="crm-panel-header">
            <h3>Reservation Health</h3>
            <Link to="/reservations">Open</Link>
          </div>
          <StatusBars items={summary.breakdowns.reservationStatuses} valueMode />
        </section>

        <section className="crm-panel">
          <div className="crm-panel-header">
            <h3>Contract Status</h3>
            <Link to="/contracts">Open</Link>
          </div>
          <StatusBars items={summary.breakdowns.contractStatuses} valueMode />
        </section>
      </section>

      <section className="crm-action-grid">
        <section className="crm-panel">
          <h3>Needs Attention</h3>
          <div className="crm-dashboard-queue">
            {summary.attentionItems.length ? (
              summary.attentionItems.map((item) => (
                <Link className="crm-dashboard-queue-item" key={`${item.itemType}-${item.id}`} to={item.route}>
                  <div>
                    <strong>{item.itemType}</strong>
                    <span>{item.documentNo} · {item.title ?? "-"}</span>
                  </div>
                  <span className="crm-status-pill">{item.statusName ?? item.statusCode ?? "-"}</span>
                </Link>
              ))
            ) : (
              <p className="crm-muted-text">No urgent workflow items.</p>
            )}
          </div>
        </section>

        <section className="crm-panel">
          <h3>Lead Status</h3>
          <StatusBars items={summary.breakdowns.leadStatuses} />
        </section>

        <section className="crm-panel">
          <h3>ERP Handoff</h3>
          <dl className="crm-detail-list crm-dashboard-handoff">
            <div><dt>Ready</dt><dd>{metrics.erpReady}</dd></div>
            <div><dt>Handed Off</dt><dd>{metrics.erpHandedOff}</dd></div>
            <div><dt>Failed</dt><dd>{metrics.failedHandoffs}</dd></div>
            <div><dt>Signed</dt><dd>{metrics.signedContracts}</dd></div>
          </dl>
        </section>
      </section>

      <section className="crm-panel">
        <div className="crm-panel-header">
          <h3>Recent Activity</h3>
          <span className="crm-muted-text">Latest updates across sales lifecycle</span>
        </div>
        <ActivityList items={summary.recentActivity} />
      </section>
    </div>
  );
}
