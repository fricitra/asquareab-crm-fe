export function convertToBase(
  amount: number | null | undefined,
  currencyCode: string | null | undefined,
  baseCurrencyCode: string,
  ratesToBase: Record<string, number>
) {
  const value = amount ?? 0;
  const fromCurrency = (currencyCode ?? baseCurrencyCode).trim().toUpperCase();

  if (fromCurrency === baseCurrencyCode) {
    return value;
  }

  const rate = ratesToBase[fromCurrency];
  if (!rate) {
    return value;
  }

  return Number((value * rate).toFixed(2));
}

export function convertFromBase(
  amount: number | null | undefined,
  currencyCode: string | null | undefined,
  baseCurrencyCode: string,
  ratesToBase: Record<string, number>
) {
  const value = amount ?? 0;
  const targetCurrency = (currencyCode ?? baseCurrencyCode).trim().toUpperCase();

  if (targetCurrency === baseCurrencyCode) {
    return value;
  }

  const rate = ratesToBase[targetCurrency];
  if (!rate) {
    return null;
  }

  return Number((value / rate).toFixed(2));
}

export function formatAmount(
  value: number | null | undefined,
  options?: { compactAbove?: number }
) {
  const amount = value ?? 0;
  const compactAbove = options?.compactAbove ?? 100_000;
  const abs = Math.abs(amount);

  if (abs >= compactAbove) {
    const millions = amount / 1_000_000;
    return millions.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }) + "M";
  }

  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

export function formatMoney(
  value: number | null | undefined,
  currencyCode = "KES",
  options?: { compactAbove?: number }
) {
  return `${formatAmount(value, options)} ${currencyCode}`;
}

export function formatMoneyRange(
  min: number | null | undefined,
  max: number | null | undefined,
  currencyCode = "KES"
) {
  if (min == null && max == null) {
    return "-";
  }

  if (min != null && max != null) {
    return `${formatMoney(min, currencyCode)} - ${formatMoney(max, currencyCode)}`;
  }

  return formatMoney(min ?? max, currencyCode);
}
