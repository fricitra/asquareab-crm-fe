import type { DashboardVelocityCategory } from "../api/dashboard";

type VelocityBadgeProps = {
  category: DashboardVelocityCategory;
};

export function VelocityBadge({ category }: VelocityBadgeProps) {
  return (
    <span className={`crm-velocity-badge crm-velocity-${category.status}`}>
      {category.code} · {category.label}
    </span>
  );
}
