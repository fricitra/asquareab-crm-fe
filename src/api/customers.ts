import { apiClient } from "../lib/api-client";
import { buildListQueryParams, type ListQueryParams } from "../lib/list-pagination";

type NamedLink = {
  id: string | null;
  name: string | null;
};

export type Customer = {
  id: string;
  crmCustomerCode: string;
  erpCustomerId: string | null;
  displayName: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  mobileNo: string | null;
  whatsappNo: string | null;
  email: string | null;
  city: string | null;
  countryCode: string | null;
  buyerType: NamedLink;
  fundingSource: NamedLink;
  preferredCommunication: NamedLink;
  defaultCurrencyCode: string | null;
  defaultProjectCode: string | null;
  status: string;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  remarks: string | null;
};

export type Broker = {
  id: string;
  brokerCode: string;
  brokerType: NamedLink;
  name: string;
  registrationNo: string | null;
  taxIdentifier: string | null;
  mobileNo: string | null;
  whatsappNo: string | null;
  email: string | null;
  city: string | null;
  countryCode: string | null;
  preferredCommunication: NamedLink;
  commissionPlanCode: string | null;
  status: string;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  remarks: string | null;
};

export type CustomerPayload = {
  crmCustomerCode?: string;
  displayName: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  mobileNo?: string;
  whatsappNo?: string;
  email?: string;
  city?: string;
  countryCode?: string;
  buyerTypeRefId?: string;
  fundingSourceRefId?: string;
  preferredCommunicationRefId?: string;
  defaultCurrencyCode?: string;
  defaultProjectCode?: string;
  remarks?: string;
};

export type BrokerPayload = {
  brokerCode?: string;
  name: string;
  registrationNo?: string;
  taxIdentifier?: string;
  mobileNo?: string;
  whatsappNo?: string;
  email?: string;
  city?: string;
  countryCode?: string;
  preferredCommunicationRefId?: string;
  commissionPlanCode?: string;
  remarks?: string;
};

export async function listCustomers(params?: ListQueryParams) {
  const response = await apiClient.get<{
    items: Customer[];
    pagination: { limit: number; offset: number; total: number };
    summary?: { active: number };
  }>("/customers", {
    params: buildListQueryParams(params)
  });
  return response.data;
}

export async function getCustomer(id: string) {
  const response = await apiClient.get<Customer>(`/customers/${id}`);
  return response.data;
}

export async function createCustomer(payload: CustomerPayload) {
  const response = await apiClient.post<Customer>("/customers", payload);
  return response.data;
}

export async function updateCustomer(id: string, payload: Partial<CustomerPayload>) {
  const response = await apiClient.patch<Customer>(`/customers/${id}`, payload);
  return response.data;
}

export async function listBrokers(params?: ListQueryParams) {
  const response = await apiClient.get<{
    items: Broker[];
    pagination: { limit: number; offset: number; total: number };
    summary?: { active: number };
  }>("/brokers", {
    params: buildListQueryParams(params)
  });
  return response.data;
}

export async function getBroker(id: string) {
  const response = await apiClient.get<Broker>(`/brokers/${id}`);
  return response.data;
}

export async function createBroker(payload: BrokerPayload) {
  const response = await apiClient.post<Broker>("/brokers", payload);
  return response.data;
}

export async function updateBroker(id: string, payload: Partial<BrokerPayload>) {
  const response = await apiClient.patch<Broker>(`/brokers/${id}`, payload);
  return response.data;
}
