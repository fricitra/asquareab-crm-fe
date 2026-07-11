import { apiClient } from "../lib/api-client";
import { buildListQueryParams, type ListQueryParams } from "../lib/list-pagination";

export type Currency = {
  id: string;
  organizationId: string;
  currencyCode: string;
  currencyName: string;
  symbol: string | null;
  decimalPlaces: number;
  isBaseCurrency: boolean;
  isLocalCurrency: boolean;
  isReportingCurrency: boolean;
  isContractCurrencyAllowed: boolean;
  isPaymentCurrencyAllowed: boolean;
  isCrmDropdownAllowed: boolean;
  exchangeRateSource: string | null;
  exchangeRateFrequency: string | null;
  sortOrder: number;
  status: string;
  isActive: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  externalCode: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  remarks: string | null;
};

export type CurrencyPayload = {
  currencyCode: string;
  currencyName: string;
  symbol?: string;
  decimalPlaces?: number;
  isBaseCurrency?: boolean;
  isLocalCurrency?: boolean;
  isReportingCurrency?: boolean;
  isContractCurrencyAllowed?: boolean;
  isPaymentCurrencyAllowed?: boolean;
  isCrmDropdownAllowed?: boolean;
  exchangeRateSource?: string;
  exchangeRateFrequency?: string;
  sortOrder?: number;
  status?: "ACTIVE" | "INACTIVE";
  isActive?: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
  externalCode?: string;
  remarks?: string;
};

export type CurrencyPolicy = {
  id: string;
  organizationId: string;
  policyName: string;
  baseCurrencyCode: string;
  localCurrencyCode: string;
  defaultContractCurrencyCode: string;
  maxReportingCurrencies: number;
  reportingCurrencyCodes: string[];
  paymentCurrencyCodes: string[];
  crmDropdownCurrencyCodes: string[];
  exchangeRateSource: string | null;
  exchangeRateFrequency: string | null;
  status: string;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  remarks: string | null;
};

export type CurrencyPolicyPayload = {
  policyName?: string;
  baseCurrencyCode?: string;
  localCurrencyCode?: string;
  defaultContractCurrencyCode?: string;
  maxReportingCurrencies?: number;
  reportingCurrencyCodes?: string[];
  paymentCurrencyCodes?: string[];
  crmDropdownCurrencyCodes?: string[];
  exchangeRateSource?: string;
  exchangeRateFrequency?: string;
  status?: "ACTIVE" | "INACTIVE";
  isActive?: boolean;
  remarks?: string;
};

export type ExchangeRate = {
  id: string;
  organizationId: string;
  fromCurrencyCode: string;
  fromCurrencyName: string | null;
  toCurrencyCode: string;
  toCurrencyName: string | null;
  rate: number;
  rateDate: string;
  source: string | null;
  sourceReference: string | null;
  status: string;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  remarks: string | null;
};

export type ExchangeRatePayload = {
  fromCurrencyCode: string;
  toCurrencyCode: string;
  rate: number;
  rateDate: string;
  source?: string;
  sourceReference?: string;
  status?: "ACTIVE" | "INACTIVE";
  isActive?: boolean;
  remarks?: string;
};

export async function listCurrencies(filters?: {
  search?: string;
  dropdownOnly?: boolean;
  contractAllowed?: boolean;
  paymentAllowed?: boolean;
  reportingOnly?: boolean;
  activeOnly?: boolean;
  limit?: number;
  offset?: number;
}) {
  const response = await apiClient.get<{
    items: Currency[];
    pagination: { limit: number; offset: number; total: number };
    summary?: { active: number; payment: number; contract: string };
  }>("/currencies", { params: filters });
  return response.data;
}

export async function getCurrency(id: string) {
  const response = await apiClient.get<Currency>(`/currencies/${id}`);
  return response.data;
}

export async function createCurrency(payload: CurrencyPayload) {
  const response = await apiClient.post<Currency>("/currencies", payload);
  return response.data;
}

export async function updateCurrency(id: string, payload: Partial<CurrencyPayload>) {
  const response = await apiClient.patch<Currency>(`/currencies/${id}`, payload);
  return response.data;
}

export type CurrencyDisplayContext = {
  baseCurrencyCode: string;
  localCurrencyCode: string;
  defaultContractCurrencyCode: string;
  paymentCurrencyCodes: string[];
  reportingCurrencyCodes: string[];
  ratesToBase: Record<string, number>;
  symbols: Record<string, { symbol: string | null; decimalPlaces: number }>;
};

export async function getCurrencyDisplayContext() {
  const response = await apiClient.get<CurrencyDisplayContext>("/currencies/display-context");
  return response.data;
}

export async function getCurrencyPolicy() {
  const response = await apiClient.get<CurrencyPolicy>("/currencies/policy");
  return response.data;
}

export async function updateCurrencyPolicy(payload: CurrencyPolicyPayload) {
  const response = await apiClient.put<CurrencyPolicy>("/currencies/policy", payload);
  return response.data;
}

export async function listExchangeRates(filters?: {
  fromCurrencyCode?: string;
  toCurrencyCode?: string;
  activeOnly?: boolean;
  limit?: number;
  offset?: number;
}) {
  const response = await apiClient.get<{
    items: ExchangeRate[];
    pagination: { limit: number; offset: number; total: number };
  }>("/currencies/exchange-rates", { params: filters });
  return response.data;
}

export async function createExchangeRate(payload: ExchangeRatePayload) {
  const response = await apiClient.post<ExchangeRate>("/currencies/exchange-rates", payload);
  return response.data;
}
