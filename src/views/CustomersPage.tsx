import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
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
import { getReferenceFamily } from "../api/reference-data";

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
  countryCode: "KE",
  buyerTypeRefId: "",
  fundingSourceRefId: "",
  preferredCommunicationRefId: "",
  defaultCurrencyCode: "USD",
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
  const [activeTab, setActiveTab] = useState<CustomerTab>("customers");
  const [search, setSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedBrokerId, setSelectedBrokerId] = useState<string | null>(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [brokerModalOpen, setBrokerModalOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const customerForm = useForm<CustomerFormValues>({ defaultValues: blankCustomer });
  const brokerForm = useForm<BrokerFormValues>({ defaultValues: blankBroker });

  const customersQuery = useQuery({
    queryKey: ["customers", search],
    queryFn: () => listCustomers(search),
    staleTime: 10_000
  });
  const brokersQuery = useQuery({
    queryKey: ["brokers", search],
    queryFn: () => listBrokers(search),
    staleTime: 10_000
  });
  const selectedCustomerQuery = useQuery({
    queryKey: ["customer", selectedCustomerId],
    queryFn: () => getCustomer(selectedCustomerId ?? ""),
    enabled: Boolean(selectedCustomerId)
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

  const customers = customersQuery.data?.items ?? [];
  const brokers = brokersQuery.data?.items ?? [];
  const selectedCustomer = selectedCustomerQuery.data;
  const selectedBroker = selectedBrokerQuery.data;

  const stats = useMemo(
    () => ({
      customers: customersQuery.data?.pagination.total ?? 0,
      brokers: brokersQuery.data?.pagination.total ?? 0,
      activeCustomers: customers.filter((customer) => customer.isActive).length,
      activeBrokers: brokers.filter((broker) => broker.isActive).length
    }),
    [brokers, brokersQuery.data?.pagination.total, customers, customersQuery.data?.pagination.total]
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
      countryCode: customer.countryCode ?? "KE",
      buyerTypeRefId: customer.buyerType.id ?? "",
      fundingSourceRefId: customer.fundingSource.id ?? "",
      preferredCommunicationRefId: customer.preferredCommunication.id ?? "",
      defaultCurrencyCode: customer.defaultCurrencyCode ?? "USD",
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
          <h2>Customer and Broker Workspace</h2>
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
                    <th>Customer</th>
                    <th>Contact</th>
                    <th>Buyer Type</th>
                    <th>Project</th>
                    <th>Status</th>
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
                      <td>{customer.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                <span className="crm-label">City</span>
                <input className="crm-input" {...customerForm.register("city")} />
              </label>
              <label className="crm-field">
                <span className="crm-label">Country</span>
                <input className="crm-input" {...customerForm.register("countryCode")} />
              </label>
            </div>
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
          </form>
            </div>
          ) : null}
        </section>
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
                    <th>Broker</th>
                    <th>Contact</th>
                    <th>City</th>
                    <th>Plan</th>
                    <th>Status</th>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                <span className="crm-label">City</span>
                <input className="crm-input" {...brokerForm.register("city")} />
              </label>
              <label className="crm-field">
                <span className="crm-label">Commission Plan</span>
                <input className="crm-input" {...brokerForm.register("commissionPlanCode")} />
              </label>
            </div>
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
