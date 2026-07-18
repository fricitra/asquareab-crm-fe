import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { getContractAgreedPack, listCustomerAgreedPacks } from "../api/agreed-pack";
import {
  createBroker,
  createCustomer,
  getBroker,
  getCustomer,
  listBrokers,
  listCustomers,
  updateBroker,
  updateCustomer,
  type Broker,
  type Customer
} from "../api/customers";
import { getCitiesByCountry, getGeographyCountries, getReferenceFamily } from "../api/reference-data";
import { useMoneyFormatter } from "../hooks/useCurrencyContext";
import { DEFAULT_LIST_PAGE_SIZE } from "../lib/list-pagination";
import { nextListSort, type ListSortState } from "../lib/list-sort";
import { useModalEscape } from "../hooks/useModalEscape";
import { AgreedPackView } from "../shared/AgreedPackView";
import { CurrencyBadge } from "../shared/CurrencyBadge";
import { ListPagination } from "../shared/ListPagination";
import { SortableTh } from "../shared/SortableTh";

type CustomerTab = "customers" | "brokers";

type CustomerFormValues = {
  crmCustomerCode: string;
  displayName: string;
  firstName: string;
  lastName: string;
  mobileNo: string;
  whatsappNo: string;
  email: string;
  city: string;
  nationalityCode: string;
  countryCode: string;
  buyerTypeRefId: string;
  fundingSourceRefId: string;
  preferredCommunicationRefId: string;
  defaultCurrencyCode: string;
  defaultProjectCode: string;
  remarks: string;
};

type BrokerFormValues = {
  brokerCode: string;
  name: string;
  registrationNo: string;
  taxIdentifier: string;
  mobileNo: string;
  whatsappNo: string;
  email: string;
  city: string;
  countryCode: string;
  preferredCommunicationRefId: string;
  commissionPlanCode: string;
  remarks: string;
};

function pickString(value: string) {
  return value.trim() === "" ? undefined : value.trim();
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function customerPayload(values: CustomerFormValues) {
  return {
    crmCustomerCode: pickString(values.crmCustomerCode),
    displayName: values.displayName.trim(),
    firstName: pickString(values.firstName),
    lastName: pickString(values.lastName),
    mobileNo: pickString(values.mobileNo),
    whatsappNo: pickString(values.whatsappNo),
    email: pickString(values.email),
    city: pickString(values.city),
    nationalityCode: pickString(values.nationalityCode),
    countryCode: pickString(values.countryCode),
    buyerTypeRefId: pickString(values.buyerTypeRefId),
    fundingSourceRefId: pickString(values.fundingSourceRefId),
    preferredCommunicationRefId: pickString(values.preferredCommunicationRefId),
    defaultCurrencyCode: pickString(values.defaultCurrencyCode),
    defaultProjectCode: pickString(values.defaultProjectCode),
    remarks: pickString(values.remarks)
  };
}

function brokerPayload(values: BrokerFormValues) {
  return {
    brokerCode: pickString(values.brokerCode),
    name: values.name.trim(),
    registrationNo: pickString(values.registrationNo),
    taxIdentifier: pickString(values.taxIdentifier),
    mobileNo: pickString(values.mobileNo),
    whatsappNo: pickString(values.whatsappNo),
    email: pickString(values.email),
    city: pickString(values.city),
    countryCode: pickString(values.countryCode),
    preferredCommunicationRefId: pickString(values.preferredCommunicationRefId),
    commissionPlanCode: pickString(values.commissionPlanCode),
    remarks: pickString(values.remarks)
  };
}

const blankCustomer: CustomerFormValues = {
  crmCustomerCode: "",
  displayName: "",
  firstName: "",
  lastName: "",
  mobileNo: "",
  whatsappNo: "",
  email: "",
  city: "",
  nationalityCode: "",
  countryCode: "KE",
  buyerTypeRefId: "",
  fundingSourceRefId: "",
  preferredCommunicationRefId: "",
  defaultCurrencyCode: "KES",
  defaultProjectCode: "PEX-WATAMU",
  remarks: ""
};

const blankBroker: BrokerFormValues = {
  brokerCode: "",
  name: "",
  registrationNo: "",
  taxIdentifier: "",
  mobileNo: "",
  whatsappNo: "",
  email: "",
  city: "",
  countryCode: "KE",
  preferredCommunicationRefId: "",
  commissionPlanCode: "",
  remarks: ""
};

export function CustomersPage() {
  const queryClient = useQueryClient();
  const { baseCurrency, formatInBase } = useMoneyFormatter();
  const [activeTab, setActiveTab] = useState<CustomerTab>("customers");
  const [search, setSearch] = useState("");
  const [customerPage, setCustomerPage] = useState(1);
  const [brokerPage, setBrokerPage] = useState(1);
  const [customerListSort, setCustomerListSort] = useState<ListSortState>({ sortBy: "createdAt", sortDir: "desc" });
  const [brokerListSort, setBrokerListSort] = useState<ListSortState>({ sortBy: "createdAt", sortDir: "desc" });
  const pageSize = DEFAULT_LIST_PAGE_SIZE;
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedBrokerId, setSelectedBrokerId] = useState<string | null>(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [brokerModalOpen, setBrokerModalOpen] = useState(false);
  const [agreedPackContractId, setAgreedPackContractId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useModalEscape(customerModalOpen, () => {
    setCustomerModalOpen(false);
    setAgreedPackContractId(null);
  });
  useModalEscape(Boolean(agreedPackContractId), () => setAgreedPackContractId(null));
  useModalEscape(brokerModalOpen, () => setBrokerModalOpen(false));

  const customerForm = useForm<CustomerFormValues>({ defaultValues: blankCustomer });
  const brokerForm = useForm<BrokerFormValues>({ defaultValues: blankBroker });

  const customersQuery = useQuery({
    queryKey: ["customers", search, customerPage, customerListSort.sortBy, customerListSort.sortDir],
    queryFn: () =>
      listCustomers({
        search: search || undefined,
        limit: pageSize,
        offset: (customerPage - 1) * pageSize,
        sortBy: customerListSort.sortBy,
        sortDir: customerListSort.sortDir
      }),
    staleTime: 10_000
  });
  const brokersQuery = useQuery({
    queryKey: ["brokers", search, brokerPage, brokerListSort.sortBy, brokerListSort.sortDir],
    queryFn: () =>
      listBrokers({
        search: search || undefined,
        limit: pageSize,
        offset: (brokerPage - 1) * pageSize,
        sortBy: brokerListSort.sortBy,
        sortDir: brokerListSort.sortDir
      }),
    staleTime: 10_000
  });

  useEffect(() => {
    setCustomerPage(1);
    setBrokerPage(1);
  }, [search]);

  useEffect(() => {
    setCustomerPage(1);
  }, [customerListSort.sortBy, customerListSort.sortDir]);

  useEffect(() => {
    setBrokerPage(1);
  }, [brokerListSort.sortBy, brokerListSort.sortDir]);

  const onCustomerSortColumn = (column: string) => {
    const preferDesc = column === "createdAt";
    setCustomerListSort((current) => nextListSort(current, column, preferDesc ? "desc" : "asc"));
  };

  const onBrokerSortColumn = (column: string) => {
    const preferDesc = column === "createdAt";
    setBrokerListSort((current) => nextListSort(current, column, preferDesc ? "desc" : "asc"));
  };
  const selectedCustomerQuery = useQuery({
    queryKey: ["customer", selectedCustomerId],
    queryFn: () => getCustomer(selectedCustomerId ?? ""),
    enabled: Boolean(selectedCustomerId)
  });
  const customerAgreedPacksQuery = useQuery({
    queryKey: ["customer", selectedCustomerId, "agreed-packs"],
    queryFn: () => listCustomerAgreedPacks(selectedCustomerId ?? ""),
    enabled: Boolean(selectedCustomerId && customerModalOpen),
    staleTime: 15_000
  });
  const customerAgreedPackDetailQuery = useQuery({
    queryKey: ["contract", agreedPackContractId, "agreed-pack"],
    queryFn: () => getContractAgreedPack(agreedPackContractId ?? ""),
    enabled: Boolean(agreedPackContractId),
    staleTime: 15_000
  });
  const selectedBrokerQuery = useQuery({
    queryKey: ["broker", selectedBrokerId],
    queryFn: () => getBroker(selectedBrokerId ?? ""),
    enabled: Boolean(selectedBrokerId)
  });
  const buyerTypesQuery = useQuery({
    queryKey: ["reference", "customer-buyer-types"],
    queryFn: () => getReferenceFamily("CUSTOMER", "BUYER_TYPE"),
    staleTime: 60_000
  });
  const fundingSourcesQuery = useQuery({
    queryKey: ["reference", "customer-funding-sources"],
    queryFn: () => getReferenceFamily("CUSTOMER", "FUNDING_SOURCE"),
    staleTime: 60_000
  });
  const communicationQuery = useQuery({
    queryKey: ["reference", "person-preferred-communication"],
    queryFn: () => getReferenceFamily("PERSON", "PREFERRED_COMMUNICATION"),
    staleTime: 60_000
  });
  const countriesQuery = useQuery({
    queryKey: ["geography", "countries"],
    queryFn: getGeographyCountries,
    staleTime: 30 * 60 * 1000
  });
  const customerCountryCode = customerForm.watch("countryCode");
  const brokerCountryCode = brokerForm.watch("countryCode");
  const customerCitySearch = useDeferredValue(customerForm.watch("city"));
  const brokerCitySearch = useDeferredValue(brokerForm.watch("city"));
  const customerCitiesQuery = useQuery({
    queryKey: ["geography", "cities", customerCountryCode, customerCitySearch],
    queryFn: () => getCitiesByCountry(customerCountryCode, customerCitySearch),
    enabled: Boolean(customerCountryCode),
    staleTime: 30 * 60 * 1000
  });
  const brokerCitiesQuery = useQuery({
    queryKey: ["geography", "cities", brokerCountryCode, brokerCitySearch],
    queryFn: () => getCitiesByCountry(brokerCountryCode, brokerCitySearch),
    enabled: Boolean(brokerCountryCode),
    staleTime: 30 * 60 * 1000
  });

  const customers = customersQuery.data?.items ?? [];
  const brokers = brokersQuery.data?.items ?? [];
  const selectedCustomer = selectedCustomerQuery.data;
  const selectedBroker = selectedBrokerQuery.data;

  const stats = useMemo(
    () => ({
      customers: customersQuery.data?.pagination.total ?? 0,
      brokers: brokersQuery.data?.pagination.total ?? 0,
      activeCustomers: customersQuery.data?.summary?.active ?? 0,
      activeBrokers: brokersQuery.data?.summary?.active ?? 0
    }),
    [brokersQuery.data, customersQuery.data]
  );

  const refresh = (successMessage: string) => {
    setMessage(successMessage);
    void queryClient.invalidateQueries({ queryKey: ["customers"] });
    void queryClient.invalidateQueries({ queryKey: ["brokers"] });
  };

  const createCustomerMutation = useMutation({
    mutationFn: (values: CustomerFormValues) => createCustomer(customerPayload(values)),
    onSuccess: (customer) => {
      setSelectedCustomerId(customer.id);
      setCustomerModalOpen(false);
      customerForm.reset(blankCustomer);
      refresh("Customer saved.");
    },
    onError: () => setMessage("Customer could not be saved. Check duplicate email, phone, and required fields.")
  });
  const updateCustomerMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: CustomerFormValues }) => updateCustomer(id, customerPayload(values)),
    onSuccess: (customer) => {
      setSelectedCustomerId(customer.id);
      setCustomerModalOpen(false);
      refresh("Customer updated.");
    },
    onError: () => setMessage("Customer could not be updated.")
  });
  const createBrokerMutation = useMutation({
    mutationFn: (values: BrokerFormValues) => createBroker(brokerPayload(values)),
    onSuccess: (broker) => {
      setSelectedBrokerId(broker.id);
      setBrokerModalOpen(false);
      brokerForm.reset(blankBroker);
      refresh("Broker saved.");
    },
    onError: () => setMessage("Broker could not be saved. Check duplicate email, phone, and required fields.")
  });
  const updateBrokerMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: BrokerFormValues }) => updateBroker(id, brokerPayload(values)),
    onSuccess: (broker) => {
      setSelectedBrokerId(broker.id);
      setBrokerModalOpen(false);
      refresh("Broker updated.");
    },
    onError: () => setMessage("Broker could not be updated.")
  });

  const loadCustomer = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setCustomerModalOpen(true);
    customerForm.reset({
      crmCustomerCode: customer.crmCustomerCode,
      displayName: customer.displayName,
      firstName: customer.firstName ?? "",
      lastName: customer.lastName ?? "",
      mobileNo: customer.mobileNo ?? "",
      whatsappNo: customer.whatsappNo ?? "",
      email: customer.email ?? "",
      city: customer.city ?? "",
      nationalityCode: customer.nationalityCode ?? "",
      countryCode: customer.countryCode ?? "KE",
      buyerTypeRefId: customer.buyerType.id ?? "",
      fundingSourceRefId: customer.fundingSource.id ?? "",
      preferredCommunicationRefId: customer.preferredCommunication.id ?? "",
      defaultCurrencyCode: customer.defaultCurrencyCode ?? baseCurrency,
      defaultProjectCode: customer.defaultProjectCode ?? "PEX-WATAMU",
      remarks: customer.remarks ?? ""
    });
  };

  const loadBroker = (broker: Broker) => {
    setSelectedBrokerId(broker.id);
    setBrokerModalOpen(true);
    brokerForm.reset({
      brokerCode: broker.brokerCode,
      name: broker.name,
      registrationNo: broker.registrationNo ?? "",
      taxIdentifier: broker.taxIdentifier ?? "",
      mobileNo: broker.mobileNo ?? "",
      whatsappNo: broker.whatsappNo ?? "",
      email: broker.email ?? "",
      city: broker.city ?? "",
      countryCode: broker.countryCode ?? "KE",
      preferredCommunicationRefId: broker.preferredCommunication.id ?? "",
      commissionPlanCode: broker.commissionPlanCode ?? "",
      remarks: broker.remarks ?? ""
    });
  };

  const onCustomerSubmit = customerForm.handleSubmit((values) => {
    if (!values.displayName.trim()) {
      setMessage("Customer name is required.");
      return;
    }
    if (selectedCustomer) {
      updateCustomerMutation.mutate({ id: selectedCustomer.id, values });
      return;
    }
    createCustomerMutation.mutate(values);
  });

  const onBrokerSubmit = brokerForm.handleSubmit((values) => {
    if (!values.name.trim()) {
      setMessage("Broker name is required.");
      return;
    }
    if (selectedBroker) {
      updateBrokerMutation.mutate({ id: selectedBroker.id, values });
      return;
    }
    createBrokerMutation.mutate(values);
  });

  return (
    <div className="crm-workspace">
      <section className="crm-module-header">
        <div>
          <p className="crm-eyebrow">Customers</p>
          <div className="crm-dashboard-title-row">
            <h2>Customer and Broker Workspace</h2>
            <CurrencyBadge />
          </div>
        </div>
      </section>

      <section className="crm-grid crm-metric-grid">
        <article className="crm-card">
          <h3>Customers</h3>
          <div className="crm-kpi">{stats.customers}</div>
        </article>
        <article className="crm-card">
          <h3>Brokers</h3>
          <div className="crm-kpi">{stats.brokers}</div>
        </article>
        <article className="crm-card">
          <h3>Active Customers</h3>
          <div className="crm-kpi">{stats.activeCustomers}</div>
        </article>
        <article className="crm-card">
          <h3>Active Brokers</h3>
          <div className="crm-kpi">{stats.activeBrokers}</div>
        </article>
      </section>

      {message ? <div className={message.includes("could not") ? "crm-error-banner" : "crm-info-banner"}>{message}</div> : null}

      <section className="crm-tabs" aria-label="Customer workspace tabs">
        <button className={`crm-tab-button${activeTab === "customers" ? " is-active" : ""}`} onClick={() => setActiveTab("customers")} type="button">
          Customers
        </button>
        <button className={`crm-tab-button${activeTab === "brokers" ? " is-active" : ""}`} onClick={() => setActiveTab("brokers")} type="button">
          Brokers
        </button>
      </section>

      {activeTab === "customers" ? (
        <section className="crm-management-workspace">
          <section className="crm-panel">
            <div className="crm-panel-header">
              <h3>Customer Register</h3>
              <div className="crm-unit-register-actions">
                <input className="crm-input crm-search-input" onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, phone, email" value={search} />
                <button
                  className="crm-primary-button"
                  onClick={() => {
                    setSelectedCustomerId(null);
                    customerForm.reset(blankCustomer);
                    setCustomerModalOpen(true);
                  }}
                  type="button"
                >
                  New Customer
                </button>
              </div>
            </div>
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    <SortableTh
                      column="customer"
                      label="Customer"
                      onSort={onCustomerSortColumn}
                      sortBy={customerListSort.sortBy}
                      sortDir={customerListSort.sortDir}
                    />
                    <SortableTh
                      column="contact"
                      label="Contact"
                      onSort={onCustomerSortColumn}
                      sortBy={customerListSort.sortBy}
                      sortDir={customerListSort.sortDir}
                    />
                    <SortableTh
                      column="buyerType"
                      label="Buyer Type"
                      onSort={onCustomerSortColumn}
                      sortBy={customerListSort.sortBy}
                      sortDir={customerListSort.sortDir}
                    />
                    <SortableTh
                      column="project"
                      label="Project"
                      onSort={onCustomerSortColumn}
                      sortBy={customerListSort.sortBy}
                      sortDir={customerListSort.sortDir}
                    />
                    <SortableTh
                      column="status"
                      label="Status"
                      onSort={onCustomerSortColumn}
                      sortBy={customerListSort.sortBy}
                      sortDir={customerListSort.sortDir}
                    />
                    <SortableTh
                      column="createdAt"
                      label="Created Date"
                      onSort={onCustomerSortColumn}
                      sortBy={customerListSort.sortBy}
                      sortDir={customerListSort.sortDir}
                    />
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr className={selectedCustomerId === customer.id ? "is-selected" : ""} key={customer.id} onClick={() => loadCustomer(customer)}>
                      <td>
                        <strong>{customer.displayName}</strong>
                        <span>{customer.crmCustomerCode}</span>
                      </td>
                      <td>
                        <strong>{customer.mobileNo ?? "-"}</strong>
                        <span>{customer.email ?? "-"}</span>
                      </td>
                      <td>{customer.buyerType.name ?? "-"}</td>
                      <td>{customer.defaultProjectCode ?? "-"}</td>
                      <td>
                        {customer.status === "PROSPECT"
                          ? "Prospect (pre-customer)"
                          : customer.status === "ACTIVE"
                            ? "Customer"
                            : customer.status}
                      </td>
                      <td>{formatDate(customer.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ListPagination
              page={customerPage}
              pageSize={pageSize}
              total={customersQuery.data?.pagination.total ?? 0}
              itemLabel="customers"
              onPageChange={setCustomerPage}
            />
          </section>

          {customerModalOpen ? (
            <div className="crm-modal-backdrop" role="presentation">
          <form aria-modal="true" className="crm-modal crm-management-modal crm-form" onSubmit={onCustomerSubmit} role="dialog">
            <div className="crm-panel-header">
              <h3>{selectedCustomer ? "Edit Customer" : "Create Customer"}</h3>
              <button
                className="crm-secondary-button crm-fit-button"
                onClick={() => {
                  setSelectedCustomerId(null);
                  customerForm.reset(blankCustomer);
                  setCustomerModalOpen(false);
                }}
                type="button"
              >
                Close
              </button>
            </div>
            <label className="crm-field">
              <span className="crm-label">Display Name</span>
              <input className="crm-input" {...customerForm.register("displayName")} />
            </label>
            <div className="crm-two-col">
              <label className="crm-field">
                <span className="crm-label">First Name</span>
                <input className="crm-input" {...customerForm.register("firstName")} />
              </label>
              <label className="crm-field">
                <span className="crm-label">Last Name</span>
                <input className="crm-input" {...customerForm.register("lastName")} />
              </label>
            </div>
            <div className="crm-two-col">
              <label className="crm-field">
                <span className="crm-label">Mobile</span>
                <input className="crm-input" {...customerForm.register("mobileNo")} />
              </label>
              <label className="crm-field">
                <span className="crm-label">Email</span>
                <input className="crm-input" {...customerForm.register("email")} />
              </label>
            </div>
            <div className="crm-two-col">
              <label className="crm-field">
                <span className="crm-label">Buyer Type</span>
                <select className="crm-input" {...customerForm.register("buyerTypeRefId")}>
                  <option value="">Select buyer type</option>
                  {(buyerTypesQuery.data ?? []).map((item) => (
                    <option key={item.id} value={item.id}>{item.level2Name}</option>
                  ))}
                </select>
              </label>
              <label className="crm-field">
                <span className="crm-label">Funding</span>
                <select className="crm-input" {...customerForm.register("fundingSourceRefId")}>
                  <option value="">Select funding</option>
                  {(fundingSourcesQuery.data ?? []).map((item) => (
                    <option key={item.id} value={item.id}>{item.level2Name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="crm-two-col">
              <label className="crm-field">
                <span className="crm-label">Nationality / Citizenship Country</span>
                <select className="crm-input" {...customerForm.register("nationalityCode")}>
                  <option value="">Select nationality</option>
                  {(countriesQuery.data ?? []).map((country) => (
                    <option key={country.code} value={country.code}>{country.name}</option>
                  ))}
                </select>
              </label>
              <label className="crm-field">
                <span className="crm-label">Country</span>
                <select
                  className="crm-input"
                  {...customerForm.register("countryCode", {
                    onChange: () => customerForm.setValue("city", "")
                  })}
                >
                  <option value="">Select country</option>
                  {(countriesQuery.data ?? []).map((country) => (
                    <option key={country.code} value={country.code}>{country.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="crm-field">
              <span className="crm-label">City</span>
              <input className="crm-input" disabled={!customerCountryCode} list="customer-city-options" {...customerForm.register("city")} />
              <datalist id="customer-city-options">
                {(customerCitiesQuery.data?.items ?? []).map((city) => <option key={city.id} value={city.name} />)}
              </datalist>
              <small className="crm-muted-text">City data © GeoNames (CC BY 4.0)</small>
            </label>
            <div className="crm-two-col">
              <label className="crm-field">
                <span className="crm-label">Preferred Communication</span>
                <select className="crm-input" {...customerForm.register("preferredCommunicationRefId")}>
                  <option value="">Select preference</option>
                  {(communicationQuery.data ?? []).map((item) => (
                    <option key={item.id} value={item.id}>{item.level2Name}</option>
                  ))}
                </select>
              </label>
              <label className="crm-field">
                <span className="crm-label">Project</span>
                <input className="crm-input" {...customerForm.register("defaultProjectCode")} />
              </label>
            </div>
            <label className="crm-field">
              <span className="crm-label">Remarks</span>
              <textarea className="crm-input crm-textarea" {...customerForm.register("remarks")} />
            </label>
            <button className="crm-primary-button" disabled={createCustomerMutation.isPending || updateCustomerMutation.isPending} type="submit">
              {selectedCustomer ? "Update Customer" : "Create Customer"}
            </button>
            {selectedCustomer ? (
              <dl className="crm-detail-list">
                <div><dt>Created</dt><dd>{formatDate(selectedCustomer.createdAt)}</dd></div>
                <div><dt>Updated</dt><dd>{formatDate(selectedCustomer.updatedAt)}</dd></div>
              </dl>
            ) : null}
            {selectedCustomer ? (
              <section className="crm-agreed-pack" style={{ borderTop: "1px solid rgba(148,163,184,0.35)", marginTop: 16, paddingTop: 12 }}>
                <div className="crm-agreed-pack-header">
                  <div>
                    <h4>Agreed Packs</h4>
                    <p className="crm-muted-text">Open the deal pack for sales, legal, or ERP without hunting across modules.</p>
                  </div>
                </div>
                {customerAgreedPacksQuery.isLoading ? (
                  <p className="crm-muted-text">Loading packs...</p>
                ) : customerAgreedPacksQuery.data?.items.length ? (
                  <div className="crm-agreed-pack-list">
                    {customerAgreedPacksQuery.data.items.map((item) => (
                      <button
                        className="crm-agreed-pack-list-item"
                        key={item.packId}
                        onClick={() => setAgreedPackContractId(item.contractId)}
                        type="button"
                      >
                        <div>
                          <strong>
                            {item.contractNo} · {item.unitCode ?? "Unit"} · {item.projectCode ?? "Project"}
                          </strong>
                          <span>
                            {item.contractStatus.name ?? item.contractStatus.code ?? "—"} · {item.completeCount}/
                            {item.totalSections} complete
                            {item.signedAt ? ` · Signed ${item.signedAt.slice(0, 10)}` : ""}
                          </span>
                        </div>
                        <span className="crm-status-pill">Open</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="crm-muted-text">No contracts yet for this customer.</p>
                )}
              </section>
            ) : null}
          </form>
            </div>
          ) : null}
        </section>
      ) : null}

      {agreedPackContractId ? (
        <div className="crm-modal-backdrop is-nested" role="presentation">
          <section aria-modal="true" className="crm-modal crm-management-modal crm-lead-detail-wide" role="dialog">
            <div className="crm-panel-header">
              <div>
                <h3>Agreed Pack</h3>
                <p className="crm-muted-text">{customerAgreedPackDetailQuery.data?.agreement.contractNo ?? "Loading..."}</p>
              </div>
              <div className="crm-modal-header-actions">
                <CurrencyBadge compact />
                <button className="crm-secondary-button crm-fit-button" onClick={() => setAgreedPackContractId(null)} type="button">
                  Close
                </button>
              </div>
            </div>
            {customerAgreedPackDetailQuery.isLoading ? (
              <p className="crm-muted-text">Loading agreed pack...</p>
            ) : customerAgreedPackDetailQuery.data ? (
              <div className="crm-opportunity-detail-body">
                <AgreedPackView formatInBase={formatInBase} pack={customerAgreedPackDetailQuery.data} />
              </div>
            ) : (
              <p className="crm-muted-text">Agreed pack could not be loaded.</p>
            )}
          </section>
        </div>
      ) : null}

      {activeTab === "brokers" ? (
        <section className="crm-management-workspace">
          <section className="crm-panel">
            <div className="crm-panel-header">
              <h3>Broker Register</h3>
              <div className="crm-unit-register-actions">
                <input className="crm-input crm-search-input" onChange={(event) => setSearch(event.target.value)} placeholder="Search broker, phone, email" value={search} />
                <button
                  className="crm-primary-button"
                  onClick={() => {
                    setSelectedBrokerId(null);
                    brokerForm.reset(blankBroker);
                    setBrokerModalOpen(true);
                  }}
                  type="button"
                >
                  New Broker
                </button>
              </div>
            </div>
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    <SortableTh
                      column="broker"
                      label="Broker"
                      onSort={onBrokerSortColumn}
                      sortBy={brokerListSort.sortBy}
                      sortDir={brokerListSort.sortDir}
                    />
                    <SortableTh
                      column="contact"
                      label="Contact"
                      onSort={onBrokerSortColumn}
                      sortBy={brokerListSort.sortBy}
                      sortDir={brokerListSort.sortDir}
                    />
                    <SortableTh
                      column="city"
                      label="City"
                      onSort={onBrokerSortColumn}
                      sortBy={brokerListSort.sortBy}
                      sortDir={brokerListSort.sortDir}
                    />
                    <SortableTh
                      column="plan"
                      label="Plan"
                      onSort={onBrokerSortColumn}
                      sortBy={brokerListSort.sortBy}
                      sortDir={brokerListSort.sortDir}
                    />
                    <SortableTh
                      column="status"
                      label="Status"
                      onSort={onBrokerSortColumn}
                      sortBy={brokerListSort.sortBy}
                      sortDir={brokerListSort.sortDir}
                    />
                    <SortableTh
                      column="createdAt"
                      label="Created Date"
                      onSort={onBrokerSortColumn}
                      sortBy={brokerListSort.sortBy}
                      sortDir={brokerListSort.sortDir}
                    />
                  </tr>
                </thead>
                <tbody>
                  {brokers.map((broker) => (
                    <tr className={selectedBrokerId === broker.id ? "is-selected" : ""} key={broker.id} onClick={() => loadBroker(broker)}>
                      <td>
                        <strong>{broker.name}</strong>
                        <span>{broker.brokerCode}</span>
                      </td>
                      <td>
                        <strong>{broker.mobileNo ?? "-"}</strong>
                        <span>{broker.email ?? "-"}</span>
                      </td>
                      <td>{broker.city ?? "-"}</td>
                      <td>{broker.commissionPlanCode ?? "-"}</td>
                      <td>{broker.status}</td>
                      <td>{formatDate(broker.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ListPagination
              page={brokerPage}
              pageSize={pageSize}
              total={brokersQuery.data?.pagination.total ?? 0}
              itemLabel="brokers"
              onPageChange={setBrokerPage}
            />
          </section>

          {brokerModalOpen ? (
            <div className="crm-modal-backdrop" role="presentation">
          <form aria-modal="true" className="crm-modal crm-management-modal crm-form" onSubmit={onBrokerSubmit} role="dialog">
            <div className="crm-panel-header">
              <h3>{selectedBroker ? "Edit Broker" : "Create Broker"}</h3>
              <button
                className="crm-secondary-button crm-fit-button"
                onClick={() => {
                  setSelectedBrokerId(null);
                  brokerForm.reset(blankBroker);
                  setBrokerModalOpen(false);
                }}
                type="button"
              >
                Close
              </button>
            </div>
            <label className="crm-field">
              <span className="crm-label">Broker Name</span>
              <input className="crm-input" {...brokerForm.register("name")} />
            </label>
            <div className="crm-two-col">
              <label className="crm-field">
                <span className="crm-label">Registration No</span>
                <input className="crm-input" {...brokerForm.register("registrationNo")} />
              </label>
              <label className="crm-field">
                <span className="crm-label">Tax ID</span>
                <input className="crm-input" {...brokerForm.register("taxIdentifier")} />
              </label>
            </div>
            <div className="crm-two-col">
              <label className="crm-field">
                <span className="crm-label">Mobile</span>
                <input className="crm-input" {...brokerForm.register("mobileNo")} />
              </label>
              <label className="crm-field">
                <span className="crm-label">Email</span>
                <input className="crm-input" {...brokerForm.register("email")} />
              </label>
            </div>
            <div className="crm-two-col">
              <label className="crm-field">
                <span className="crm-label">Country</span>
                <select
                  className="crm-input"
                  {...brokerForm.register("countryCode", {
                    onChange: () => brokerForm.setValue("city", "")
                  })}
                >
                  <option value="">Select country</option>
                  {(countriesQuery.data ?? []).map((country) => (
                    <option key={country.code} value={country.code}>{country.name}</option>
                  ))}
                </select>
              </label>
              <label className="crm-field">
                <span className="crm-label">City</span>
                <input className="crm-input" disabled={!brokerCountryCode} list="broker-city-options" {...brokerForm.register("city")} />
                <datalist id="broker-city-options">
                  {(brokerCitiesQuery.data?.items ?? []).map((city) => <option key={city.id} value={city.name} />)}
                </datalist>
              </label>
            </div>
            <label className="crm-field">
              <span className="crm-label">Commission Plan</span>
              <input className="crm-input" {...brokerForm.register("commissionPlanCode")} />
            </label>
            <small className="crm-muted-text">City data © GeoNames (CC BY 4.0)</small>
            <label className="crm-field">
              <span className="crm-label">Preferred Communication</span>
              <select className="crm-input" {...brokerForm.register("preferredCommunicationRefId")}>
                <option value="">Select preference</option>
                {(communicationQuery.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>{item.level2Name}</option>
                ))}
              </select>
            </label>
            <label className="crm-field">
              <span className="crm-label">Remarks</span>
              <textarea className="crm-input crm-textarea" {...brokerForm.register("remarks")} />
            </label>
            <button className="crm-primary-button" disabled={createBrokerMutation.isPending || updateBrokerMutation.isPending} type="submit">
              {selectedBroker ? "Update Broker" : "Create Broker"}
            </button>
          </form>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
