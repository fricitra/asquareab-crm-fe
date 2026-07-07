import { useQuery } from "@tanstack/react-query";
import { getCurrencyDisplayContext } from "../api/currencies";
import { convertToBase, formatMoney } from "../lib/format-money";
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

export function useMoneyFormatter() {
  const currencyQuery = useCurrencyContext();
  const baseCurrency = currencyQuery.data?.baseCurrencyCode ?? "KES";
  const ratesToBase = currencyQuery.data?.ratesToBase ?? { KES: 1 };

  return {
    baseCurrency,
    ratesToBase,
    defaultContractCurrency: currencyQuery.data?.defaultContractCurrencyCode ?? baseCurrency,
    formatMoney: (value: number | null | undefined, currencyCode?: string | null) =>
      formatMoney(value, currencyCode ?? baseCurrency),
    toBase: (value: number | null | undefined, currencyCode?: string | null) =>
      convertToBase(value, currencyCode, baseCurrency, ratesToBase),
    formatInBase: (value: number | null | undefined, currencyCode?: string | null) =>
      formatMoney(convertToBase(value, currencyCode, baseCurrency, ratesToBase), baseCurrency)
  };
}
