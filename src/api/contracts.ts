import { apiClient } from "../lib/api-client";
import { buildListQueryParams, type ListQueryParams } from "../lib/list-pagination";

type NamedLink = {
  id: string | null;
  name: string | null;
};

type WorkflowUser = {
  id: string | null;
  name: string | null;
  role: string | null;
};

export type PaymentPlanLine = {
  id: string;
  paymentPlanId: string;
  sequenceNo: number;
  milestoneLabel: string | null;
  dueDate: string | null;
  amount: number;
  percentageOfContract: number | null;
  erpReceivableLineId: string | null;
  status: string;
  remarks: string | null;
};

export type PaymentPlan = {
  id: string;
  planCode: string;
  planName: string;
  currencyCode: string | null;
  erpPaymentPlanId: string | null;
  status: string;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  remarks: string | null;
  lines: PaymentPlanLine[];
};

export type ErpHandoff = {
  id: string;
  entityType: string;
  entityId: string;
  handoffStatus: string;
  payloadJson: Record<string, unknown> | null;
  lastAttemptedAt: string | null;
  handedOffAt: string | null;
  errorMessage: string | null;
  retryCount: number;
  remarks: string | null;
};

export type ContractStatusHistory = {
  id: string;
  contractStatus: {
    id: string;
    name: string | null;
    code: string | null;
  };
  changedAt: string | null;
  changedByUser: WorkflowUser;
  remarks: string | null;
};

export type Contract = {
  id: string;
  contractNo: string;
  reservation: {
    id: string | null;
    reservationNo: string | null;
  };
  opportunity: {
    id: string | null;
    opportunityNo: string | null;
  };
  customer: NamedLink;
  unit: {
    id: string;
    unitCode: string | null;
    unitName: string | null;
  };
  project: {
    id: string;
    projectCode: string | null;
    name: string | null;
  };
  contractStatus: {
    id: string;
    name: string | null;
    code: string | null;
  };
  contractDate: string;
  contractValue: number | null;
  currencyCode: string | null;
  erpContractId: string | null;
  erpHandoffStatus: string;
  signedAt: string | null;
  signedBy: NamedLink;
  status: string;
  isActive: boolean;
  createdAt: string | null;
  createdBy: WorkflowUser;
  updatedAt: string | null;
  updatedBy: WorkflowUser;
  remarks: string | null;
  statusHistory?: ContractStatusHistory[];
  paymentPlans?: PaymentPlan[];
  erpHandoff?: ErpHandoff | null;
};

export type CreateContractPayload = {
  reservationId: string;
  contractValue?: number;
  currencyCode?: string;
  remarks?: string;
};

export type CreatePaymentPlanPayload = {
  planName: string;
  currencyCode?: string;
  remarks?: string;
  lines: Array<{
    sequenceNo: number;
    milestoneLabel?: string;
    dueDate?: string;
    amount: number;
    percentageOfContract?: number;
    remarks?: string;
  }>;
};

export async function listContracts(params?: ListQueryParams) {
  const response = await apiClient.get<{
    items: Contract[];
    pagination: { limit: number; offset: number; total: number };
    summary?: { draft: number; signed: number; value: number };
  }>("/contracts", {
    params: buildListQueryParams(params)
  });
  return response.data;
}

export async function getContract(id: string) {
  const response = await apiClient.get<Contract>(`/contracts/${id}`);
  return response.data;
}

export async function createContract(payload: CreateContractPayload) {
  const response = await apiClient.post<Contract>("/contracts", payload);
  return response.data;
}

export async function issueContract(id: string, remarks?: string) {
  const response = await apiClient.post<Contract>(`/contracts/${id}/issue`, { remarks });
  return response.data;
}

export async function signContract(id: string, remarks?: string) {
  const response = await apiClient.post<Contract>(`/contracts/${id}/sign`, { remarks });
  return response.data;
}

export async function cancelContract(id: string, remarks?: string) {
  const response = await apiClient.post<Contract>(`/contracts/${id}/cancel`, { remarks });
  return response.data;
}

export async function createPaymentPlan(id: string, payload: CreatePaymentPlanPayload) {
  const response = await apiClient.post<Contract>(`/contracts/${id}/payment-plans`, payload);
  return response.data;
}

export async function markErpHandoffReady(id: string, remarks?: string) {
  const response = await apiClient.post<Contract>(`/contracts/${id}/erp-handoff/ready`, { remarks });
  return response.data;
}

export async function markErpHandoffCompleted(id: string, erpContractId?: string, remarks?: string) {
  const response = await apiClient.post<Contract>(`/contracts/${id}/erp-handoff/complete`, { erpContractId, remarks });
  return response.data;
}

export async function markErpHandoffFailed(id: string, errorMessage: string, remarks?: string) {
  const response = await apiClient.post<Contract>(`/contracts/${id}/erp-handoff/fail`, { errorMessage, remarks });
  return response.data;
}
