import type { ReactNode } from "react";

type NavIconProps = {
  name: NavIconName;
};

export type NavIconName =
  | "dashboard"
  | "leads"
  | "opportunities"
  | "proposals"
  | "reservations"
  | "contracts"
  | "inventory"
  | "customers"
  | "admin"
  | "currencies"
  | "reference-data"
  | "activity"
  | "chevron"
  | "targets"
  | "calendar"
  | "ai";

const iconPaths: Record<NavIconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="10" width="8" height="11" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
    </>
  ),
  leads: (
    <>
      <path d="M12 12a4 4 0 1 0-4-4" />
      <path d="M8 16h8" />
      <path d="M10 20h4" />
      <circle cx="17" cy="7" r="3" />
    </>
  ),
  opportunities: (
    <>
      <path d="M4 18V8l8-4 8 4v10" />
      <path d="M8 14h8" />
      <path d="M8 10h5" />
    </>
  ),
  proposals: (
    <>
      <path d="M7 4h10v16H7z" />
      <path d="M10 8h6" />
      <path d="M10 12h6" />
      <path d="M10 16h4" />
    </>
  ),
  reservations: (
    <>
      <path d="M5 8h14v12H5z" />
      <path d="M8 5h8v3H8z" />
      <path d="M9 13h6" />
      <path d="M9 16h4" />
    </>
  ),
  contracts: (
    <>
      <path d="M6 4h12v16H6z" />
      <path d="M9 9h8" />
      <path d="M9 13h8" />
      <path d="M9 17h5" />
      <path d="M15 17l2 2 4-4" />
    </>
  ),
  inventory: (
    <>
      <path d="M4 9l8-4 8 4-8 4-8-4z" />
      <path d="M4 14l8 4 8-4" />
      <path d="M4 19l8 4 8-4" />
    </>
  ),
  customers: (
    <>
      <circle cx="9" cy="9" r="3" />
      <circle cx="17" cy="10" r="2.5" />
      <path d="M4 20c0-3 2.5-5 5-5s5 2 5 5" />
      <path d="M15 20c0-2 1.5-3.5 3.5-3.5" />
    </>
  ),
  admin: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="M5 5l1.5 1.5" />
      <path d="M17.5 17.5L19 19" />
      <path d="M19 5l-1.5 1.5" />
      <path d="M5 19l1.5-1.5" />
    </>
  ),
  currencies: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M9 10h4.5a2 2 0 1 1 0 4H9" />
      <path d="M12 7v10" />
    </>
  ),
  "reference-data": (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
      <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
    </>
  ),
  activity: (
    <>
      <path d="M4 6h16" />
      <path d="M4 12h10" />
      <path d="M4 18h14" />
      <circle cx="19" cy="12" r="2" />
    </>
  ),
  chevron: <path d="M8 10l4 4 4-4" />,
  targets: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M4 10h16" />
    </>
  ),
  ai: (
    <>
      <path d="M12 3l1.2 4.2L17 8.5l-3.8 1.3L12 14l-1.2-4.2L7 8.5l3.8-1.3L12 3z" />
      <path d="M5 16l.8 2.8L8.5 19l-2.7.9L5 22.5l-.8-2.6L1.5 19l2.7-.9L5 16z" />
      <path d="M19 15l.7 2.3L22 18l-2.3.8L19 21l-.7-2.2L16 18l2.3-.8L19 15z" />
    </>
  )
};

export function NavIcon({ name }: NavIconProps) {
  return (
    <svg
      className="crm-nav-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[name]}
    </svg>
  );
}
