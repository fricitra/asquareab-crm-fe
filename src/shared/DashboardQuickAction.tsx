import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { NavIcon, type NavIconName } from "./NavIcons";

type DashboardQuickActionProps = {
  label: string;
  icon: NavIconName;
  to?: string;
  onClick?: () => void;
};

export function DashboardQuickAction({ label, icon, to, onClick }: DashboardQuickActionProps) {
  const content: ReactNode = (
    <>
      <span className="crm-dashboard-action-icon">
        <NavIcon name={icon} />
      </span>
      <span className="crm-dashboard-action-label">{label}</span>
    </>
  );

  if (to) {
    return (
      <Link className="crm-dashboard-action" to={to}>
        {content}
      </Link>
    );
  }

  return (
    <button className="crm-dashboard-action" onClick={onClick} type="button">
      {content}
    </button>
  );
}
