import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { getAppInfo } from "../api/app-info";
import { useAuthStore } from "../store/auth-store";

const dashboardItem = { label: "Dashboard", to: "/" };

const navGroups = [
  {
    label: "Customer Workflow",
    items: [
      { label: "Leads", to: "/leads" },
      { label: "Opportunities", to: "/opportunities" },
      { label: "Proposals", to: "/proposals" },
      { label: "Reservations", to: "/reservations" },
      { label: "Contracts", to: "/contracts" }
    ]
  },
  {
    label: "Master Data",
    items: [
      { label: "Inventory", to: "/inventory" },
      { label: "Customers", to: "/customers" }
    ]
  },
  {
    label: "Settings",
    items: [
      { label: "Admin", to: "/admin" },
      { label: "Currencies", to: "/currencies" },
      { label: "Reference Data", to: "/reference-data" }
    ]
  }
];

export function AppShell() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const appInfoQuery = useQuery({
    queryKey: ["app-info"],
    queryFn: getAppInfo,
    staleTime: 300_000
  });

  const applicationName = appInfoQuery.data?.application ?? "ASQUARE CRM";
  const version = appInfoQuery.data?.version ?? "v1.0.0";
  const signedInName = user?.fullName ?? user?.username ?? "CRM User";
  const roleName = user?.roles?.find((role) => role.isPrimary)?.name ?? user?.roles?.[0]?.name ?? "CRM User";

  return (
    <div className="crm-shell">
      <aside className="crm-sidebar">
        <p className="crm-eyebrow">Asquare CRM</p>
        <h1 className="crm-sidebar-title">Sales Workspace</h1>
        <p className="crm-sidebar-text">
          Leads, opportunities, inventory reservations, and customer lifecycle operations in one focused workspace.
        </p>
        <nav className="crm-nav">
          <NavLink
            to={dashboardItem.to}
            end
            className={({ isActive }) => `crm-nav-link${isActive ? " active" : ""}`}
          >
            {dashboardItem.label}
          </NavLink>
          {navGroups.map((group) => (
            <section className="crm-nav-group" key={group.label}>
              <p className="crm-nav-group-label">{group.label}</p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) => `crm-nav-link${isActive ? " active" : ""}`}
                >
                  {item.label}
                </NavLink>
              ))}
            </section>
          ))}
        </nav>
      </aside>

      <main className="crm-content">
        <header className="crm-title-banner">
          <div className="crm-title-brand">
            <strong>{applicationName}</strong>
            <span>{version}</span>
          </div>
          <p>Property sales workspace for leads, opportunities, proposals, reservations, contracts, and customer lifecycle operations.</p>
          <div className="crm-title-actions">
            <span className="crm-status-pill">CRM available</span>
            <span className="crm-role-pill">{roleName}</span>
            <span className="crm-user-chip" title={signedInName}>
              {signedInName.slice(0, 1).toUpperCase()}
            </span>
          </div>
          <button
            className="crm-banner-button"
            onClick={() => {
              clearSession();
              navigate("/login", { replace: true });
            }}
            type="button"
          >
            Logout
          </button>
        </header>

        <Outlet />
      </main>
    </div>
  );
}
