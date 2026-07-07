import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { getAppInfo } from "../api/app-info";
import { useAuthStore } from "../store/auth-store";
import { NavIcon, type NavIconName } from "./NavIcons";

type NavItem = {
  label: string;
  to: string;
  icon: NavIconName;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

const dashboardItem: NavItem = { label: "Dashboard", to: "/", icon: "dashboard" };

const navGroups: NavGroup[] = [
  {
    id: "customer-workflow",
    label: "Customer Workflow",
    items: [
      { label: "Leads", to: "/leads", icon: "leads" },
      { label: "Opportunities", to: "/opportunities", icon: "opportunities" },
      { label: "Proposals", to: "/proposals", icon: "proposals" },
      { label: "Reservations", to: "/reservations", icon: "reservations" },
      { label: "Contracts", to: "/contracts", icon: "contracts" }
    ]
  },
  {
    id: "master-data",
    label: "Master Data",
    items: [
      { label: "Inventory", to: "/inventory", icon: "inventory" },
      { label: "Customers", to: "/customers", icon: "customers" }
    ]
  },
  {
    id: "settings",
    label: "Settings",
    items: [
      { label: "Admin", to: "/admin", icon: "admin" },
      { label: "Currencies", to: "/currencies", icon: "currencies" },
      { label: "Reference Data", to: "/reference-data", icon: "reference-data" },
      { label: "Recent Activity", to: "/recent-activity", icon: "activity" }
    ]
  }
];

function groupContainsPath(group: NavGroup, pathname: string) {
  return group.items.some((item) =>
    item.to === "/" ? pathname === "/" : pathname === item.to || pathname.startsWith(`${item.to}/`)
  );
}

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const appInfoQuery = useQuery({
    queryKey: ["app-info"],
    queryFn: getAppInfo,
    staleTime: 300_000
  });

  const activeGroupId = useMemo(
    () => navGroups.find((group) => groupContainsPath(group, location.pathname))?.id ?? null,
    [location.pathname]
  );

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(navGroups.map((group) => [group.id, false]))
  );

  useEffect(() => {
    if (!activeGroupId) {
      return;
    }

    setCollapsedGroups((current) => {
      if (!current[activeGroupId]) {
        return current;
      }

      return { ...current, [activeGroupId]: false };
    });
  }, [activeGroupId]);

  const applicationName = appInfoQuery.data?.application ?? "ASQUARE CRM";
  const version = appInfoQuery.data?.version ?? "v1.0.0";
  const dbHost = appInfoQuery.data?.dbHost;
  const signedInName = user?.fullName ?? user?.username ?? "CRM User";
  const roleName = user?.roles?.find((role) => role.isPrimary)?.name ?? user?.roles?.[0]?.name ?? "CRM User";

  function toggleGroup(groupId: string) {
    setCollapsedGroups((current) => ({
      ...current,
      [groupId]: !current[groupId]
    }));
  }

  return (
    <div className="crm-shell crm-reference-shell">
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
            <NavIcon name={dashboardItem.icon} />
            <span>{dashboardItem.label}</span>
          </NavLink>
          {navGroups.map((group) => {
            const isCollapsed = collapsedGroups[group.id];
            const isActiveGroup = activeGroupId === group.id;

            return (
              <section
                className={`crm-nav-group${isCollapsed ? " is-collapsed" : ""}${isActiveGroup ? " is-active-group" : ""}`}
                key={group.id}
              >
                <button
                  type="button"
                  className="crm-nav-group-toggle"
                  aria-expanded={!isCollapsed}
                  onClick={() => toggleGroup(group.id)}
                >
                  <span className="crm-nav-group-label">{group.label}</span>
                  <NavIcon name="chevron" />
                </button>
                <div className="crm-nav-group-items">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === "/"}
                      className={({ isActive }) => `crm-nav-link${isActive ? " active" : ""}`}
                    >
                      <NavIcon name={item.icon} />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              </section>
            );
          })}
        </nav>
        <footer className="crm-sidebar-footer">
          <a href="https://asquareab.com/" target="_blank" rel="noreferrer">
            https://asquareab.com/
          </a>
          {dbHost ? <span>DB: {dbHost}</span> : null}
        </footer>
      </aside>

      <main className="crm-content">
        <header className="crm-title-banner">
          <div className="crm-title-brand">
            <strong>{applicationName}</strong>
            <span>{version}</span>
          </div>
          <p>Property sales workspace for leads, opportunities, proposals, reservations, contracts, and customer lifecycle operations.</p>
          <div className="crm-title-actions">
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
