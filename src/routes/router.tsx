import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "../shared/AppShell";
import { ProtectedRoute } from "../shared/ProtectedRoute";
import { AdminPage } from "../views/AdminPage";
import { ContractsPage } from "../views/ContractsPage";
import { CurrencyMasterPage } from "../views/CurrencyMasterPage";
import { CustomersPage } from "../views/CustomersPage";
import { DashboardPage } from "../views/DashboardPage";
import { InventoryPage } from "../views/InventoryPage";
import { LeadsPage } from "../views/LeadsPage";
import { LoginPage } from "../views/LoginPage";
import { OpportunitiesPage } from "../views/OpportunitiesPage";
import { ProposalsPage } from "../views/ProposalsPage";
import { ReferenceDataPage } from "../views/ReferenceDataPage";
import { ReservationsPage } from "../views/ReservationsPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            path: "/",
            element: <DashboardPage />
          },
          {
            path: "/leads",
            element: <LeadsPage />
          },
          {
            path: "/opportunities",
            element: <OpportunitiesPage />
          },
          {
            path: "/proposals",
            element: <ProposalsPage />
          },
          {
            path: "/inventory",
            element: <InventoryPage />
          },
          {
            path: "/customers",
            element: <CustomersPage />
          },
          {
            path: "/reservations",
            element: <ReservationsPage />
          },
          {
            path: "/contracts",
            element: <ContractsPage />
          },
          {
            path: "/currencies",
            element: <CurrencyMasterPage />
          },
          {
            path: "/admin",
            element: <AdminPage />
          },
          {
            path: "/reference-data",
            element: <ReferenceDataPage />
          }
        ]
      }
    ]
  }
]);
