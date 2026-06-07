import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "../shared/AppShell";
import { ProtectedRoute } from "../shared/ProtectedRoute";
import { DashboardPage } from "../views/DashboardPage";
import { InventoryPage } from "../views/InventoryPage";
import { LeadsPage } from "../views/LeadsPage";
import { LoginPage } from "../views/LoginPage";
import { OpportunitiesPage } from "../views/OpportunitiesPage";
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
            path: "/inventory",
            element: <InventoryPage />
          },
          {
            path: "/reservations",
            element: <ReservationsPage />
          }
        ]
      }
    ]
  }
]);
