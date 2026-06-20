import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth-store";

const navItems = [
  { label: "Dashboard", to: "/" },
  { label: "Inventory", to: "/inventory" },
  { label: "Customers", to: "/customers" },
  { label: "Leads", to: "/leads" },
  { label: "Opportunities", to: "/opportunities" },
  { label: "Proposals", to: "/proposals" },
  { label: "Reservations", to: "/reservations" },
  { label: "Contracts", to: "/contracts" },
  { label: "Reference Data", to: "/reference-data" }
];

export function AppShell() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);

  return (
    <div className="crm-shell">
      <aside className="crm-sidebar">
        <p className="crm-eyebrow">Asquare CRM</p>
        <h1 className="crm-sidebar-title">Sales Workspace</h1>
        <p className="crm-sidebar-text">
          Leads, opportunities, inventory reservations, and customer lifecycle operations in one focused workspace.
        </p>
        <nav className="crm-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => `crm-nav-link${isActive ? " active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="crm-content">
        <header className="crm-topbar">
          <div>
            <h2>Welcome back</h2>
            <p>{user?.fullName ?? user?.username ?? "CRM User"} is signed in.</p>
          </div>
          <button
            className="crm-secondary-button"
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
