import { useCurrencyContext } from "../hooks/useCurrencyContext";

/** Header chip showing the organization base currency for monetary screens. */
export function CurrencyBadge({ compact = false }: { compact?: boolean }) {
  const currencyQuery = useCurrencyContext();
  const displayCurrency = currencyQuery.data?.baseCurrencyCode ?? "KES";
  const currencySymbol = currencyQuery.data?.symbols?.[displayCurrency]?.symbol ?? displayCurrency;

  return (
    <div
      className={`crm-dashboard-currency-badge${compact ? " is-compact" : ""}`}
      title={`Monetary amounts are shown in ${displayCurrency} unless a line explicitly shows another currency`}
    >
      <span aria-hidden className="crm-currency-badge-icon">
        {currencySymbol}
      </span>
      {!compact ? <span className="crm-currency-badge-label">Base currency</span> : null}
      <strong className="crm-currency-badge-code">{displayCurrency}</strong>
    </div>
  );
}
