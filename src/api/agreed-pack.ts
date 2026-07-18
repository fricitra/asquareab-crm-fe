import { apiClient } from "../lib/api-client";

export type AgreedPackCompleteness = {
  reservation: boolean;
  proposal: boolean;
  paymentPlan: boolean;
  agreement: boolean;
};

export type AgreedPackSummary = {
  packId: string;
  contractId: string;
  contractNo: string;
  contractStatus: { code: string | null; name: string | null };
  contractValue: number;
  currencyCode: string | null;
  signedAt: string | null;
  opportunity: { id: string | null; opportunityNo: string | null };
  reservation: { id: string | null; reservationNo: string | null };
  unitCode: string | null;
  projectCode: string | null;
  completeness: AgreedPackCompleteness;
  completeCount: number;
  totalSections: number;
};

export type AgreedPack = {
  packId: string;
  contractId: string;
  customer: { id: string | null; name: string | null };
  opportunity: { id: string | null; opportunityNo: string | null };
  completeness: AgreedPackCompleteness;
  completeCount: number;
  totalSections: number;
  warnings: string[];
  prices: {
    proposalAcceptedPrice: number | null;
    proposalCurrencyCode: string | null;
    contractValue: number;
    contractCurrencyCode: string | null;
  };
  reservation: {
    id: string;
    reservationNo: string;
    unit: { id: string | null; unitCode: string | null; unitName: string | null };
    project: { id: string | null; projectCode: string | null; name: string | null };
    amount: number;
    currencyCode: string | null;
    reservationDate: string | null;
    expiryDate: string | null;
    status: { id: string | null; code: string | null; name: string | null };
  } | null;
  proposal: {
    id: string;
    proposalNo: string;
    listPrice: number;
    acceptedPrice: number;
    discountAmount: number;
    discountPercent: number;
    currencyCode: string | null;
    validUntil: string | null;
    acceptedAt: string | null;
    acceptedBy: { id: string | null; name: string | null };
    status: { id: string | null; code: string | null; name: string | null };
  } | null;
  paymentPlan: {
    id: string;
    planCode: string;
    planName: string;
    currencyCode: string | null;
    status: string;
    lines: Array<{
      sequenceNo: number;
      milestoneLabel: string | null;
      lineType: string;
      dueDate: string | null;
      amount: number;
      percentageOfContract: number | null;
      status: string;
    }>;
    taxLines: Array<{
      taxCode: string;
      taxName: string;
      calculationType: string;
      ratePercent: number | null;
      fixedAmount: number | null;
      taxAmount: number;
      currencyCode: string;
      paymentOutsideCrm: boolean;
      sequenceNo: number;
    }>;
  } | null;
  agreement: {
    contractNo: string;
    contractStatus: { id: string | null; name: string | null; code: string | null };
    contractDate: string | null;
    contractValue: number;
    currencyCode: string | null;
    signedAt: string | null;
    signedBy: { id: string | null; name: string | null };
    erpContractId: string | null;
    erpHandoffStatus: string | null;
    spaDocument: null;
    spaDocumentNote: string;
  };
};

export async function getContractAgreedPack(contractId: string) {
  const response = await apiClient.get<AgreedPack>(`/contracts/${contractId}/agreed-pack`);
  return response.data;
}

export async function listCustomerAgreedPacks(customerId: string) {
  const response = await apiClient.get<{
    customer: { id: string; name: string };
    items: AgreedPackSummary[];
    total: number;
  }>(`/customers/${customerId}/agreed-packs`);
  return response.data;
}
