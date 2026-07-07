import { apiClient } from "../lib/api-client";
import { buildListQueryParams, type ListQueryParams } from "../lib/list-pagination";

type NamedLink = {
  id: string | null;
  name: string | null;
};

export type Reservation = {
  id: string;
  reservationNo: string;
  customer: NamedLink;
  opportunity: {
    id: string | null;
    opportunityNo: string | null;
  };
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
  reservationStatus: {
    id: string;
    name: string | null;
    code: string | null;
  };
  reservationDate: string;
  expiryDate: string | null;
  reservationAmount: number | null;
  currencyCode: string | null;
  broker: NamedLink;
  commercialTermsJson: Record<string, unknown> | null;
  status: string;
  isActive: boolean;
  createdAt: string | null;
  createdBy: {
    id: string | null;
    name: string | null;
    role: string | null;
  };
  updatedAt: string | null;
  updatedBy: {
    id: string | null;
    name: string | null;
    role: string | null;
  };
  remarks: string | null;
};

export type CreateReservationPayload = {
  opportunityId: string;
  unitId: string;
  reservationAmount?: number;
  currencyCode?: string;
  expiryDate?: string;
  remarks?: string;
};

export async function listReservations(params?: ListQueryParams) {
  const response = await apiClient.get<{
    items: Reservation[];
    pagination: { limit: number; offset: number; total: number };
  }>("/reservations", {
    params: buildListQueryParams(params)
  });
  return response.data;
}

export async function getReservation(id: string) {
  const response = await apiClient.get<Reservation>(`/reservations/${id}`);
  return response.data;
}

export async function createReservation(payload: CreateReservationPayload) {
  const response = await apiClient.post<Reservation>("/reservations", payload);
  return response.data;
}

export async function cancelReservation(id: string, remarks?: string) {
  const response = await apiClient.post<Reservation>(`/reservations/${id}/cancel`, { remarks });
  return response.data;
}

export async function approveReservation(id: string, remarks?: string) {
  const response = await apiClient.post<Reservation>(`/reservations/${id}/approve`, { remarks });
  return response.data;
}
