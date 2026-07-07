import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import {
  createCurrency,
  createExchangeRate,
  getCurrency,
  getCurrencyPolicy,
  listCurrencies,
  listExchangeRates,
  updateCurrency,
  updateCurrencyPolicy,
  type Currency,
  type CurrencyPayload,
  type CurrencyPolicy,
  type CurrencyPolicyPayload,
  type ExchangeRatePayload
} from "../api/currencies";
import { DEFAULT_LIST_PAGE_SIZE, DROPDOWN_LIST_LIMIT } from "../lib/list-pagination";
import { ListPagination } from "../shared/ListPagination";

type CurrencyTab = "currencies" | "policy" | "rates";

type CurrencyFormValues = {
  currencyCode: string;
  currencyName: string;
  symbol: string;
  decimalPlaces: string;
  isBaseCurrency: boolean;
  isLocalCurrency: boolean;
  isReportingCurrency: boolean;
  isContractCurrencyAllowed: boolean;
  isPaymentCurrencyAllowed: boolean;
  isCrmDropdownAllowed: boolean;
  exchangeRateSource: string;
  exchangeRateFrequency: string;
  sortOrder: string;
  status: "ACTIVE" | "INACTIVE";
  isActive: boolean;
  remarks: string;
};

type PolicyFormValues = {
  policyName: string;
  baseCurrencyCode: string;
  localCurrencyCode: string;
  defaultContractCurrencyCode: string;
  maxReportingCurrencies: string;
  reportingCurrencyCodes: string;
  paymentCurrencyCodes: string;
  crmDropdownCurrencyCodes: string;
  exchangeRateSource: string;
  exchangeRateFrequency: string;
  status: "ACTIVE" | "INACTIVE";
  isActive: boolean;
  remarks: string;
};

type RateFormValues = {
  fromCurrencyCode: string;
  toCurrencyCode: string;
  rate: string;
  rateDate: string;
  source: string;
  sourceReference: string;
  remarks: string;
};

const blankCurrencyForm: CurrencyFormValues = {
  currencyCode: "",
  currencyName: "",
  symbol: "",
  decimalPlaces: "2",
  isBaseCurrency: false,
  isLocalCurrency: false,
  isReportingCurrency: false,
  isContractCurrencyAllowed: false,
  isPaymentCurrencyAllowed: false,
  isCrmDropdownAllowed: true,
  exchangeRateSource: "Manual / Central Bank / API",
  exchangeRateFrequency: "Daily and on demand",
  sortOrder: "0",
  status: "ACTIVE",
  isActive: true,
  remarks: ""
};

const blankRateForm: RateFormValues = {
  fromCurrencyCode: "",
  toCurrencyCode: "USD",
  rate: "",
  rateDate: new Date().toISOString().slice(0, 10),
  source: "Manual",
  sourceReference: "",
  remarks: ""
};

function pickString(value: string) {
  return value.trim() === "" ? undefined : value.trim();
}

function pickNumber(value: string) {
  const normalized = value.replace(/[, ]/g, "").trim();
  return normalized === "" ? undefined : Number(normalized);
}

function codeList(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean)
    )
  );
}

function currencyFormValues(currency: Currency): CurrencyFormValues {
  return {
    currencyCode: currency.currencyCode,
    currencyName: currency.currencyName,
    symbol: currency.symbol ?? "",
    decimalPlaces: String(currency.decimalPlaces),
    isBaseCurrency: currency.isBaseCurrency,
    isLocalCurrency: currency.isLocalCurrency,
    isReportingCurrency: currency.isReportingCurrency,
    isContractCurrencyAllowed: currency.isContractCurrencyAllowed,
    isPaymentCurrencyAllowed: currency.isPaymentCurrencyAllowed,
    isCrmDropdownAllowed: currency.isCrmDropdownAllowed,
    exchangeRateSource: currency.exchangeRateSource ?? "",
    exchangeRateFrequency: currency.exchangeRateFrequency ?? "",
    sortOrder: String(currency.sortOrder),
    status: currency.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    isActive: currency.isActive,
    remarks: currency.remarks ?? ""
  };
}

function policyFormValues(policy: CurrencyPolicy): PolicyFormValues {
  return {
    policyName: policy.policyName,
    baseCurrencyCode: policy.baseCurrencyCode,
    localCurrencyCode: policy.localCurrencyCode,
    defaultContractCurrencyCode: policy.defaultContractCurrencyCode,
    maxReportingCurrencies: String(policy.maxReportingCurrencies),
    reportingCurrencyCodes: policy.reportingCurrencyCodes.join(", "),
    paymentCurrencyCodes: policy.paymentCurrencyCodes.join(", "),
    crmDropdownCurrencyCodes: policy.crmDropdownCurrencyCodes.join(", "),
    exchangeRateSource: policy.exchangeRateSource ?? "",
    exchangeRateFrequency: policy.exchangeRateFrequency ?? "",
    status: policy.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    isActive: policy.isActive,
    remarks: policy.remarks ?? ""
  };
}

function currencyPayload(values: CurrencyFormValues): CurrencyPayload {
  return {
    currencyCode: values.currencyCode.trim().toUpperCase(),
    currencyName: values.currencyName.trim(),
    symbol: pickString(values.symbol),
    decimalPlaces: pickNumber(values.decimalPlaces),
    isBaseCurrency: values.isBaseCurrency,
    isLocalCurrency: values.isLocalCurrency,
    isReportingCurrency: values.isReportingCurrency,
    isContractCurrencyAllowed: values.isContractCurrencyAllowed,
    isPaymentCurrencyAllowed: values.isPaymentCurrencyAllowed,
    isCrmDropdownAllowed: values.isCrmDropdownAllowed,
    exchangeRateSource: pickString(values.exchangeRateSource),
    exchangeRateFrequency: pickString(values.exchangeRateFrequency),
    sortOrder: pickNumber(values.sortOrder),
    status: values.status,
    isActive: values.isActive,
    remarks: pickString(values.remarks)
  };
}

function policyPayload(values: PolicyFormValues): CurrencyPolicyPayload {
  return {
    policyName: pickString(values.policyName),
    baseCurrencyCode: values.baseCurrencyCode.trim().toUpperCase(),
    localCurrencyCode: values.localCurrencyCode.trim().toUpperCase(),
    defaultContractCurrencyCode: values.defaultContractCurrencyCode.trim().toUpperCase(),
    maxReportingCurrencies: pickNumber(values.maxReportingCurrencies),
    reportingCurrencyCodes: codeList(values.reportingCurrencyCodes),
    paymentCurrencyCodes: codeList(values.paymentCurrencyCodes),
    crmDropdownCurrencyCodes: codeList(values.crmDropdownCurrencyCodes),
    exchangeRateSource: pickString(values.exchangeRateSource),
    exchangeRateFrequency: pickString(values.exchangeRateFrequency),
    status: values.status,
    isActive: values.isActive,
    remarks: pickString(values.remarks)
  };
}

function ratePayload(values: RateFormValues): ExchangeRatePayload {
  return {
    fromCurrencyCode: values.fromCurrencyCode.trim().toUpperCase(),
    toCurrencyCode: values.toCurrencyCode.trim().toUpperCase(),
    rate: Number(values.rate),
    rateDate: values.rateDate,
    source: pickString(values.source),
    sourceReference: pickString(values.sourceReference),
    status: "ACTIVE",
    isActive: true,
    remarks: pickString(values.remarks)
  };
}

export function CurrencyMasterPage() {
  const queryClient = useQueryClient();
  const pageSize = DEFAULT_LIST_PAGE_SIZE;
  const [activeTab, setActiveTab] = useState<CurrencyTab>("currencies");
  const [search, setSearch] = useState("");
  const [currencyPage, setCurrencyPage] = useState(1);
  const [ratePage, setRatePage] = useState(1);
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<string | null>(null);
  const [currencyModalOpen, setCurrencyModalOpen] = useState(false);
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const currencyForm = useForm<CurrencyFormValues>({ defaultValues: blankCurrencyForm });
  const policyForm = useForm<PolicyFormValues>({
    defaultValues: {
      policyName: "",
      baseCurrencyCode: "USD",
      localCurrencyCode: "KES",
      defaultContractCurrencyCode: "USD",
      maxReportingCurrencies: "3",
      reportingCurrencyCodes: "USD, KES, EUR",
      paymentCurrencyCodes: "USD, EUR, GBP, CHF, KES",
      crmDropdownCurrencyCodes: "",
      exchangeRateSource: "",
      exchangeRateFrequency: "",
      status: "ACTIVE",
      isActive: true,
      remarks: ""
    }
  });
  const rateForm = useForm<RateFormValues>({ defaultValues: blankRateForm });

  const currenciesQuery = useQuery({
    queryKey: ["currencies", search, currencyPage],
    queryFn: () =>
      listCurrencies({
        search: search || undefined,
        activeOnly: false,
        limit: pageSize,
        offset: (currencyPage - 1) * pageSize
      }),
    staleTime: 10_000
  });
  const currencyOptionsQuery = useQuery({
    queryKey: ["currencies", "dropdown-options"],
    queryFn: () => listCurrencies({ activeOnly: true, limit: DROPDOWN_LIST_LIMIT }),
    staleTime: 60_000
  });
  const selectedCurrencyQuery = useQuery({
    queryKey: ["currencies", "detail", selectedCurrencyId],
    queryFn: () => getCurrency(selectedCurrencyId ?? ""),
    enabled: Boolean(selectedCurrencyId)
  });
  const policyQuery = useQuery({
    queryKey: ["currencies", "policy"],
    queryFn: getCurrencyPolicy,
    staleTime: 10_000
  });
  const ratesQuery = useQuery({
    queryKey: ["currencies", "rates", ratePage],
    queryFn: () =>
      listExchangeRates({
        activeOnly: false,
        limit: pageSize,
        offset: (ratePage - 1) * pageSize
      }),
    staleTime: 10_000
  });

  useEffect(() => {
    setCurrencyPage(1);
  }, [search]);

  const rows = currenciesQuery.data?.items ?? [];
  const selectedCurrency = selectedCurrencyQuery.data ?? null;
  const rates = ratesQuery.data?.items ?? [];
  const currencyOptions = currencyOptionsQuery.data?.items ?? [];
  const currencyTotal = currenciesQuery.data?.pagination.total ?? 0;
  const rateTotal = ratesQuery.data?.pagination.total ?? 0;

  const stats = useMemo(() => {
    const active = rows.filter((currency) => currency.status === "ACTIVE" && currency.isActive).length;
    const payment = rows.filter((currency) => currency.isPaymentCurrencyAllowed).length;
    const dropdown = rows.filter((currency) => currency.isCrmDropdownAllowed).length;
    const contract = rows.filter((currency) => currency.isContractCurrencyAllowed).map((currency) => currency.currencyCode).join(", ") || "-";
    return { total: currencyTotal, active, payment, dropdown, contract };
  }, [rows, currencyTotal]);

  useEffect(() => {
    if (selectedCurrency) {
      currencyForm.reset(currencyFormValues(selectedCurrency));
    }
  }, [currencyForm, selectedCurrency]);

  useEffect(() => {
    if (policyQuery.data) {
      policyForm.reset(policyFormValues(policyQuery.data));
    }
  }, [policyForm, policyQuery.data]);

  const refresh = (successMessage: string) => {
    setMessage(successMessage);
    void queryClient.invalidateQueries({ queryKey: ["currencies"] });
  };

  const createCurrencyMutation = useMutation({
    mutationFn: (values: CurrencyFormValues) => createCurrency(currencyPayload(values)),
    onSuccess: (currency) => {
      setSelectedCurrencyId(currency.id);
      setCurrencyModalOpen(false);
      currencyForm.reset(currencyFormValues(currency));
      refresh("Currency saved.");
    },
    onError: () => setMessage("Currency could not be saved. Check duplicate code and base currency settings.")
  });

  const updateCurrencyMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: CurrencyFormValues }) => updateCurrency(id, currencyPayload(values)),
    onSuccess: (currency) => {
      setSelectedCurrencyId(currency.id);
      setCurrencyModalOpen(false);
      refresh("Currency updated.");
    },
    onError: () => setMessage("Currency could not be updated.")
  });

  const updatePolicyMutation = useMutation({
    mutationFn: (values: PolicyFormValues) => updateCurrencyPolicy(policyPayload(values)),
    onSuccess: (policy) => {
      policyForm.reset(policyFormValues(policy));
      refresh("Currency policy updated.");
    },
    onError: () => setMessage("Currency policy could not be updated. Check currency codes and reporting limit.")
  });

  const createRateMutation = useMutation({
    mutationFn: (values: RateFormValues) => createExchangeRate(ratePayload(values)),
    onSuccess: () => {
      setRateModalOpen(false);
      rateForm.reset(blankRateForm);
      refresh("Exchange rate saved.");
    },
    onError: () => setMessage("Exchange rate could not be saved. Check currency pair, date, and duplicate source.")
  });

  const onCurrencySubmit = currencyForm.handleSubmit((values) => {
    if (!values.currencyCode.trim() || !values.currencyName.trim()) {
      setMessage("Currency code and name are required.");
      return;
    }

    if (selectedCurrency) {
      updateCurrencyMutation.mutate({ id: selectedCurrency.id, values });
      return;
    }

    createCurrencyMutation.mutate(values);
  });

  const onPolicySubmit = policyForm.handleSubmit((values) => updatePolicyMutation.mutate(values));
  const onRateSubmit = rateForm.handleSubmit((values) => createRateMutation.mutate(values));

  return (
    <div className="crm-workspace">
      <section className="crm-module-header">
        <div>
          <p className="crm-eyebrow">Finance Master</p>
          <h2>Currency Master</h2>
        </div>
      </section>

      <section className="crm-grid crm-metric-grid">
        <article className="crm-card">
          <h3>Currencies</h3>
          <div className="crm-kpi">{stats.total}</div>
        </article>
        <article className="crm-card">
          <h3>Active</h3>
          <div className="crm-kpi">{stats.active}</div>
        </article>
        <article className="crm-card">
          <h3>Payment</h3>
          <div className="crm-kpi">{stats.payment}</div>
        </article>
        <article className="crm-card">
          <h3>Contract</h3>
          <div className="crm-kpi">{stats.contract}</div>
        </article>
      </section>

      {message ? <div className={message.includes("could not") ? "crm-error-banner" : "crm-info-banner"}>{message}</div> : null}

      <div className="crm-tabs">
        {(["currencies", "policy", "rates"] as const).map((tab) => (
          <button
            className={`crm-tab-button${activeTab === tab ? " is-active" : ""}`}
            key={tab}
            onClick={() => setActiveTab(tab)}
            type="button"
          >
            {tab === "currencies" ? "Currencies" : tab === "policy" ? "Policy" : "Exchange Rates"}
          </button>
        ))}
      </div>

      {activeTab === "currencies" ? (
        <section className="crm-management-workspace">
          <section className="crm-panel">
            <div className="crm-panel-header">
              <h3>Currency Register</h3>
              <div className="crm-unit-register-actions">
                <input
                  className="crm-input crm-search-input"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search code, name, symbol"
                  value={search}
                />
                <button
                  className="crm-primary-button"
                  onClick={() => {
                    setSelectedCurrencyId(null);
                    currencyForm.reset(blankCurrencyForm);
                    setCurrencyModalOpen(true);
                  }}
                  type="button"
                >
                  New Currency
                </button>
              </div>
            </div>
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Currency</th>
                    <th>Use</th>
                    <th>Decimals</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((currency) => (
                    <tr
                      className={selectedCurrencyId === currency.id ? "is-selected" : ""}
                      key={currency.id}
                      onClick={() => {
                        setSelectedCurrencyId(currency.id);
                        setCurrencyModalOpen(true);
                      }}
                    >
                      <td>
                        <strong>{currency.currencyCode}</strong>
                        <span>{currency.currencyName}</span>
                      </td>
                      <td>
                        <div className="crm-chip-row">
                          {currency.isBaseCurrency ? <span className="crm-status-pill success">Base</span> : null}
                          {currency.isLocalCurrency ? <span className="crm-status-pill">Local</span> : null}
                          {currency.isContractCurrencyAllowed ? <span className="crm-status-pill success">Contract</span> : null}
                          {currency.isPaymentCurrencyAllowed ? <span className="crm-status-pill">Payment</span> : null}
                        </div>
                      </td>
                      <td>{currency.decimalPlaces}</td>
                      <td>
                        <span className={`crm-status-pill${currency.status === "ACTIVE" && currency.isActive ? " success" : ""}`}>
                          {currency.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 ? (
                    <tr>
                      <td className="crm-empty-cell" colSpan={4}>No currencies found.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <ListPagination
              page={currencyPage}
              pageSize={pageSize}
              total={currencyTotal}
              itemLabel="currencies"
              onPageChange={setCurrencyPage}
            />
          </section>

          {currencyModalOpen ? (
            <div className="crm-modal-backdrop" role="presentation">
          <section aria-modal="true" className="crm-modal crm-management-modal" role="dialog">
            <div className="crm-panel-header">
              <h3>{selectedCurrency ? "Edit Currency" : "Create Currency"}</h3>
              <button
                className="crm-secondary-button"
                onClick={() => {
                  setSelectedCurrencyId(null);
                  currencyForm.reset(blankCurrencyForm);
                  setCurrencyModalOpen(false);
                }}
                type="button"
              >
                Close
              </button>
            </div>
            <form className="crm-form crm-two-col" onSubmit={onCurrencySubmit}>
              <label className="crm-field">
                <span className="crm-label">Currency Code</span>
                <input className="crm-input" {...currencyForm.register("currencyCode")} />
              </label>
              <label className="crm-field">
                <span className="crm-label">Currency Name</span>
                <input className="crm-input" {...currencyForm.register("currencyName")} />
              </label>
              <label className="crm-field">
                <span className="crm-label">Symbol</span>
                <input className="crm-input" {...currencyForm.register("symbol")} />
              </label>
              <label className="crm-field">
                <span className="crm-label">Decimal Places</span>
                <input className="crm-input" type="number" {...currencyForm.register("decimalPlaces")} />
              </label>
              <label className="crm-field">
                <span className="crm-label">Rate Source</span>
                <input className="crm-input" {...currencyForm.register("exchangeRateSource")} />
              </label>
              <label className="crm-field">
                <span className="crm-label">Rate Frequency</span>
                <input className="crm-input" {...currencyForm.register("exchangeRateFrequency")} />
              </label>
              <label className="crm-field">
                <span className="crm-label">Sort Order</span>
                <input className="crm-input" type="number" {...currencyForm.register("sortOrder")} />
              </label>
              <label className="crm-field">
                <span className="crm-label">Status</span>
                <select className="crm-input" {...currencyForm.register("status")}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </label>
              <div className="crm-form-wide crm-check-grid">
                {[
                  ["isBaseCurrency", "Base currency"],
                  ["isLocalCurrency", "Local currency"],
                  ["isReportingCurrency", "Reporting currency"],
                  ["isContractCurrencyAllowed", "Contract allowed"],
                  ["isPaymentCurrencyAllowed", "Payment allowed"],
                  ["isCrmDropdownAllowed", "CRM dropdown"],
                  ["isActive", "Active"]
                ].map(([field, label]) => (
                  <label className="crm-check-field" key={field}>
                    <input type="checkbox" {...currencyForm.register(field as keyof CurrencyFormValues)} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <label className="crm-field crm-form-wide">
                <span className="crm-label">Remarks</span>
                <textarea className="crm-input crm-textarea" {...currencyForm.register("remarks")} />
              </label>
              <button className="crm-primary-button crm-form-wide" disabled={createCurrencyMutation.isPending || updateCurrencyMutation.isPending} type="submit">
                {selectedCurrency ? "Update Currency" : "Create Currency"}
              </button>
            </form>
          </section>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === "policy" ? (
        <section className="crm-panel">
          <div className="crm-panel-header">
            <h3>Currency Policy</h3>
            <span className="crm-muted">One contract currency with controlled payment currencies</span>
          </div>
          <form className="crm-form crm-two-col" onSubmit={onPolicySubmit}>
            <label className="crm-field crm-form-wide">
              <span className="crm-label">Policy Name</span>
              <input className="crm-input" {...policyForm.register("policyName")} />
            </label>
            <label className="crm-field">
              <span className="crm-label">Base Currency</span>
              <select className="crm-input" {...policyForm.register("baseCurrencyCode")}>
                {currencyOptions.map((currency) => (
                  <option key={currency.id} value={currency.currencyCode}>{currency.currencyCode}</option>
                ))}
              </select>
            </label>
            <label className="crm-field">
              <span className="crm-label">Local Currency</span>
              <select className="crm-input" {...policyForm.register("localCurrencyCode")}>
                {currencyOptions.map((currency) => (
                  <option key={currency.id} value={currency.currencyCode}>{currency.currencyCode}</option>
                ))}
              </select>
            </label>
            <label className="crm-field">
              <span className="crm-label">Contract Currency</span>
              <select className="crm-input" {...policyForm.register("defaultContractCurrencyCode")}>
                {currencyOptions.map((currency) => (
                  <option key={currency.id} value={currency.currencyCode}>{currency.currencyCode}</option>
                ))}
              </select>
            </label>
            <label className="crm-field">
              <span className="crm-label">Max Reporting</span>
              <input className="crm-input" type="number" {...policyForm.register("maxReportingCurrencies")} />
            </label>
            <label className="crm-field crm-form-wide">
              <span className="crm-label">Reporting Currencies</span>
              <input className="crm-input" {...policyForm.register("reportingCurrencyCodes")} />
            </label>
            <label className="crm-field crm-form-wide">
              <span className="crm-label">Payment Currencies</span>
              <input className="crm-input" {...policyForm.register("paymentCurrencyCodes")} />
            </label>
            <label className="crm-field crm-form-wide">
              <span className="crm-label">CRM Dropdown Currencies</span>
              <input className="crm-input" {...policyForm.register("crmDropdownCurrencyCodes")} />
            </label>
            <label className="crm-field">
              <span className="crm-label">Rate Source</span>
              <input className="crm-input" {...policyForm.register("exchangeRateSource")} />
            </label>
            <label className="crm-field">
              <span className="crm-label">Rate Frequency</span>
              <input className="crm-input" {...policyForm.register("exchangeRateFrequency")} />
            </label>
            <label className="crm-field">
              <span className="crm-label">Status</span>
              <select className="crm-input" {...policyForm.register("status")}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </label>
            <label className="crm-check-field">
              <input type="checkbox" {...policyForm.register("isActive")} />
              <span>Policy active</span>
            </label>
            <label className="crm-field crm-form-wide">
              <span className="crm-label">Remarks</span>
              <textarea className="crm-input crm-textarea" {...policyForm.register("remarks")} />
            </label>
            <button className="crm-primary-button crm-form-wide" disabled={updatePolicyMutation.isPending} type="submit">
              Update Policy
            </button>
          </form>
        </section>
      ) : null}

      {activeTab === "rates" ? (
        <section className="crm-management-workspace">
          <section className="crm-panel">
            <div className="crm-panel-header">
              <h3>Exchange Rate Register</h3>
              <button
                className="crm-primary-button"
                onClick={() => {
                  rateForm.reset(blankRateForm);
                  setRateModalOpen(true);
                }}
                type="button"
              >
                New Exchange Rate
              </button>
            </div>
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Pair</th>
                    <th>Rate</th>
                    <th>Date</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((rate) => (
                    <tr key={rate.id}>
                      <td>
                        <strong>{rate.fromCurrencyCode} to {rate.toCurrencyCode}</strong>
                        <span>{rate.fromCurrencyName ?? "-"} / {rate.toCurrencyName ?? "-"}</span>
                      </td>
                      <td>{rate.rate.toLocaleString(undefined, { maximumFractionDigits: 8 })}</td>
                      <td>{rate.rateDate}</td>
                      <td>{rate.source ?? "-"}</td>
                    </tr>
                  ))}
                  {rates.length === 0 ? (
                    <tr>
                      <td className="crm-empty-cell" colSpan={4}>No exchange rates saved.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <ListPagination
              page={ratePage}
              pageSize={pageSize}
              total={rateTotal}
              itemLabel="exchange rates"
              onPageChange={setRatePage}
            />
          </section>

          {rateModalOpen ? (
            <div className="crm-modal-backdrop" role="presentation">
          <section aria-modal="true" className="crm-modal crm-management-modal" role="dialog">
            <div className="crm-panel-header">
              <h3>Add Exchange Rate</h3>
              <button className="crm-secondary-button" onClick={() => setRateModalOpen(false)} type="button">Close</button>
            </div>
            <form className="crm-form crm-two-col" onSubmit={onRateSubmit}>
              <label className="crm-field">
                <span className="crm-label">From</span>
                <select className="crm-input" {...rateForm.register("fromCurrencyCode")}>
                  <option value="">Select</option>
                  {currencyOptions.map((currency) => (
                    <option key={currency.id} value={currency.currencyCode}>{currency.currencyCode}</option>
                  ))}
                </select>
              </label>
              <label className="crm-field">
                <span className="crm-label">To</span>
                <select className="crm-input" {...rateForm.register("toCurrencyCode")}>
                  {currencyOptions.map((currency) => (
                    <option key={currency.id} value={currency.currencyCode}>{currency.currencyCode}</option>
                  ))}
                </select>
              </label>
              <label className="crm-field">
                <span className="crm-label">Rate</span>
                <input className="crm-input" type="number" step="0.00000001" {...rateForm.register("rate")} />
              </label>
              <label className="crm-field">
                <span className="crm-label">Rate Date</span>
                <input className="crm-input" type="date" {...rateForm.register("rateDate")} />
              </label>
              <label className="crm-field">
                <span className="crm-label">Source</span>
                <input className="crm-input" {...rateForm.register("source")} />
              </label>
              <label className="crm-field">
                <span className="crm-label">Source Ref</span>
                <input className="crm-input" {...rateForm.register("sourceReference")} />
              </label>
              <label className="crm-field crm-form-wide">
                <span className="crm-label">Remarks</span>
                <textarea className="crm-input crm-textarea" {...rateForm.register("remarks")} />
              </label>
              <button className="crm-primary-button crm-form-wide" disabled={createRateMutation.isPending} type="submit">
                Save Exchange Rate
              </button>
            </form>
          </section>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
