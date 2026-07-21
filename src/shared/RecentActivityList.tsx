import type { DashboardActivity } from "../api/dashboard";
import { useMoneyFormatter } from "../hooks/useCurrencyContext";

function formatActivityWhen(value: string | null) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString();
}

export function RecentActivityList({ items }: { items: DashboardActivity[] }) {
  const { formatInBase } = useMoneyFormatter();

  if (!items.length) {
    return <p className="crm-muted-text">No recent activity yet.</p>;
  }

  return (
    <div className="crm-dashboard-activity crm-dashboard-record-list crm-recent-activity-list">
      <div className="crm-dashboard-record-head">
        <span>S.No.</span>
        <span>Record</span>
        <span>Details</span>
        <span>User</span>
        <span>Date / Time</span>
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
            <span>{item.amount ? formatInBase(item.amount, item.currencyCode) : "-"}</span>
          </div>
          <div>
            <span>{item.performedBy?.trim() || "-"}</span>
          </div>
          <div>
            <span>{formatActivityWhen(item.happenedAt)}</span>
          </div>
        </article>
      ))}
    </div>
  );
}
