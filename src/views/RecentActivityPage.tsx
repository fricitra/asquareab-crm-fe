import { useQuery } from "@tanstack/react-query";
import { getApiErrorMessage } from "../api/auth";
import { getDashboardSummary } from "../api/dashboard";
import { CurrencyBadge } from "../shared/CurrencyBadge";
import { RecentActivityList } from "../shared/RecentActivityList";
import { useAuthStore } from "../store/auth-store";

export function RecentActivityPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const activityQuery = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => getDashboardSummary(),
    enabled: Boolean(accessToken),
    staleTime: 15_000,
    retry: 1
  });

  if (activityQuery.isLoading) {
    return (
      <section className="crm-panel">
        <p className="crm-muted-text">Loading recent activity...</p>
      </section>
    );
  }

  if (!activityQuery.data || activityQuery.isError) {
    return (
      <section className="crm-panel">
        <h3>Recent activity unavailable</h3>
        <div className="crm-error-banner">
          {activityQuery.error ? getApiErrorMessage(activityQuery.error) : "Activity feed could not be loaded."}
        </div>
        <button className="crm-secondary-button" type="button" onClick={() => activityQuery.refetch()}>
          Retry
        </button>
      </section>
    );
  }

  return (
    <div className="crm-workspace">
      <section className="crm-module-header">
        <div>
          <p className="crm-eyebrow">Activity Feed</p>
          <div className="crm-dashboard-title-row">
            <h2>Recent Activity</h2>
            <CurrencyBadge />
          </div>
          <p className="crm-muted-text">Latest updates across leads, opportunities, proposals, reservations, and contracts.</p>
        </div>
      </section>

      <section className="crm-panel">
        <RecentActivityList items={activityQuery.data.recentActivity} />
      </section>
    </div>
  );
}
