import { useCurrencyContext } from "../hooks/useCurrencyContext";

export function CurrencyBadge() {
  const currencyQuery = useCurrencyContext();
  const displayCurrency = currencyQuery.data?.baseCurrencyCode ?? "KES";
  const currencySymbol = currencyQuery.data?.symbols?.[displayCurrency]?.symbol ?? displayCurrency;

  return (
    <div className="crm-dashboard-currency-badge" title={`All monetary values are shown in ${displayCurrency}`}>
      <span aria-hidden className="crm-currency-badge-icon">
        {currencySymbol}
      </span>
      <span className="crm-currency-badge-label">Base currency</span>
      <strong className="crm-currency-badge-code">{displayCurrency}</strong>
    </div>
  );
}
