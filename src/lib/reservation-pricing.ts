import { getUnit, type Unit } from "../api/inventory";

export type ReservationPricing = {
  amount: string;
  currencyCode: string;
  sourceAmount: number | null;
  sourceCurrencyCode: string | null;
};

/**
 * Resolve reservation deposit from unit master, converted into org base currency.
 * Unit catalogue prices are often USD; reservations/contracts use base currency (KES).
 */
export async function resolveUnitReservationPricingInBase(
  unit: Unit,
  options: {
    baseCurrency: string;
    toBase: (value: number | null | undefined, currencyCode?: string | null) => number;
    /** Fallback fraction of list price when no explicit reservation deposit is configured. */
    depositFallbackPercent?: number;
  }
): Promise<ReservationPricing> {
  const baseCurrency = options.baseCurrency.trim().toUpperCase() || "KES";
  const depositFallbackPercent = options.depositFallbackPercent ?? 0.1;

  const toPricing = (sourceAmount: number | null, sourceCurrency: string): ReservationPricing => {
    if (sourceAmount == null) {
      return {
        amount: "",
        currencyCode: baseCurrency,
        sourceAmount: null,
        sourceCurrencyCode: sourceCurrency
      };
    }

    return {
      amount: String(options.toBase(sourceAmount, sourceCurrency)),
      currencyCode: baseCurrency,
      sourceAmount,
      sourceCurrencyCode: sourceCurrency
    };
  };

  try {
    const detail = await getUnit(unit.id);
    const sales = detail.catalogue?.salesInformation;
    const sourceCurrency = (detail.currencyCode ?? unit.currencyCode ?? baseCurrency).trim().toUpperCase();
    const listPrice = sales?.approvedSellingPrice ?? detail.basePrice ?? unit.basePrice;
    const configuredDeposit = sales?.reservationAmount;

    const sourceAmount =
      configuredDeposit != null && configuredDeposit > 0
        ? configuredDeposit
        : listPrice == null
          ? null
          : Number((listPrice * depositFallbackPercent).toFixed(2));

    return toPricing(sourceAmount, sourceCurrency);
  } catch {
    const sourceCurrency = (unit.currencyCode ?? baseCurrency).trim().toUpperCase();
    const sourceAmount =
      unit.basePrice == null ? null : Number((unit.basePrice * depositFallbackPercent).toFixed(2));
    return toPricing(sourceAmount, sourceCurrency);
  }
}
