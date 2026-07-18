import { useQuery } from "@tanstack/react-query";
import { getCurrencyDisplayContext } from "../api/currencies";
import { convertToBase, convertFromBase, formatAmount, formatMoney } from "../lib/format-money";
import { useAuthStore } from "../store/auth-store";

export function useCurrencyContext() {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery({
    queryKey: ["currencies", "display-context"],
    queryFn: getCurrencyDisplayContext,
    enabled: Boolean(accessToken),
    staleTime: 300_000
  });
}

/**
 * Application money display standard:
 * - formatInBase / formatMoney always include a currency code with the amount
 * - Money workspaces also show CurrencyBadge in the page header (base currency)
 */
export function useMoneyFormatter() {
  const currencyQuery = useCurrencyContext();
  const baseCurrency = currencyQuery.data?.baseCurrencyCode ?? "KES";
  const ratesToBase = currencyQuery.data?.ratesToBase ?? { KES: 1 };

  return {
    baseCurrency,
    ratesToBase,
    defaultContractCurrency: currencyQuery.data?.defaultContractCurrencyCode ?? baseCurrency,
    /** Format in the amount's own currency (includes currency code). */
    formatMoney: (value: number | null | undefined, currencyCode?: string | null) =>
      formatMoney(value, currencyCode ?? baseCurrency),
    toBase: (value: number | null | undefined, currencyCode?: string | null) =>
      convertToBase(value, currencyCode, baseCurrency, ratesToBase),
    /**
     * Convert to org base currency and format with currency code (e.g. "33.99M KES").
     * Prefer this for registers, KPIs, detail fields, and workflow summaries.
     */
    formatInBase: (value: number | null | undefined, currencyCode?: string | null) =>
      formatMoney(convertToBase(value, currencyCode, baseCurrency, ratesToBase), baseCurrency),
    /** Numeric-only base amount (no currency code) — use only for math / form defaults, not UI labels. */
    formatInBaseAmount: (value: number | null | undefined, currencyCode?: string | null) =>
      formatAmount(convertToBase(value, currencyCode, baseCurrency, ratesToBase)),
    fromBase: (value: number | null | undefined, currencyCode?: string | null) =>
      convertFromBase(value, currencyCode, baseCurrency, ratesToBase)
  };
}
