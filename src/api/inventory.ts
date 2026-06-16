import { apiClient } from "../lib/api-client";

type NamedLink = {
  id: string | null;
  name: string | null;
};

export type Project = {
  id: string;
  projectCode: string;
  erpProjectId: string | null;
  name: string;
  description: string | null;
  locationCode: string | null;
  legalEntityCode: string | null;
  currencyCode: string | null;
  status: string;
  isActive: boolean;
  remarks: string | null;
};

export type CreateProjectPayload = {
  projectCode: string;
  name: string;
  description?: string;
  locationCode?: string;
  legalEntityCode?: string;
  currencyCode?: string;
  remarks?: string;
};

export type Unit = {
  id: string;
  project: {
    id: string;
    projectCode: string | null;
    name: string | null;
  };
  erpUnitId: string | null;
  unitCode: string;
  unitName: string | null;
  blockCode: string | null;
  floorNo: string | null;
  unitType: NamedLink;
  viewCategory: NamedLink;
  bedroomCount: number | null;
  grossArea: number | null;
  netArea: number | null;
  basePrice: number | null;
  currencyCode: string | null;
  availabilityStatus: {
    id: string;
    name: string | null;
    code: string | null;
  };
  reservationStatus: NamedLink;
  status: string;
  isActive: boolean;
  remarks: string | null;
};

export type CreateUnitPayload = {
  projectId: string;
  unitCode: string;
  unitName?: string;
  blockCode?: string;
  floorNo?: string;
  unitTypeRefId?: string;
  bedroomCount?: number;
  grossArea?: number;
  netArea?: number;
  basePrice?: number;
  currencyCode?: string;
  availabilityStatusRefId?: string;
  remarks?: string;
};

export async function listProjects(search?: string) {
  const response = await apiClient.get<{
    items: Project[];
    pagination: { limit: number; offset: number; total: number };
  }>("/inventory/projects", {
    params: search ? { search } : undefined
  });
  return response.data;
}

export async function listUnits(search?: string) {
  const response = await apiClient.get<{
    items: Unit[];
    pagination: { limit: number; offset: number; total: number };
  }>("/inventory/units", {
    params: search ? { search } : undefined
  });
  return response.data;
}

export async function getUnit(id: string) {
  const response = await apiClient.get<Unit>(`/inventory/units/${id}`);
  return response.data;
}

export async function getProject(id: string) {
  const response = await apiClient.get<Project>(`/inventory/projects/${id}`);
  return response.data;
}

export async function createProject(payload: CreateProjectPayload) {
  const response = await apiClient.post<Project>("/inventory/projects", payload);
  return response.data;
}

export async function updateProject(id: string, payload: Partial<CreateProjectPayload>) {
  const response = await apiClient.patch<Project>(`/inventory/projects/${id}`, payload);
  return response.data;
}

export async function createUnit(payload: CreateUnitPayload) {
  const response = await apiClient.post<Unit>("/inventory/units", payload);
  return response.data;
}

export async function updateUnit(id: string, payload: Partial<CreateUnitPayload>) {
  const response = await apiClient.patch<Unit>(`/inventory/units/${id}`, payload);
  return response.data;
}
