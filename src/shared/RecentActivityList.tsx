import type { DashboardActivity } from "../api/dashboard";
import { useMoneyFormatter } from "../hooks/useCurrencyContext";

export function RecentActivityList({ items }: { items: DashboardActivity[] }) {
  const { formatInBase } = useMoneyFormatter();

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
            <span>
              {item.activityType} · {item.statusName ?? item.statusCode ?? "-"}
            </span>
          </div>
          <div>
            <span>{item.title ?? "-"}</span>
            <span>
              {item.amount
                ? formatInBase(item.amount, item.currencyCode)
                : item.happenedAt
                  ? new Date(item.happenedAt).toLocaleString()
                  : "-"}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}
