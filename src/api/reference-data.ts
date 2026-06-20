import { apiClient } from "../lib/api-client";

export type ReferenceDataItem = {
  id: string;
  organizationId?: string;
  referenceCategory: string;
  level1Code: string;
  level1Name: string;
  level2Code: string;
  level2Name: string;
  description?: string | null;
  parentReferenceId?: string | null;
  sortOrder: number;
  status: string;
  isActive: boolean;
  remarks?: string | null;
};

export type ReferenceDataPayload = {
  referenceCategory: string;
  level1Code: string;
  level1Name: string;
  level2Code: string;
  level2Name: string;
  description?: string;
  parentReferenceId?: string;
  sortOrder?: number;
  status?: "ACTIVE" | "INACTIVE";
  isActive?: boolean;
  remarks?: string;
};

export async function listReferenceData(params?: {
  category?: string;
  level1?: string;
  search?: string;
  activeOnly?: boolean;
}) {
  const response = await apiClient.get<{ items: ReferenceDataItem[] }>("/reference-data", {
    params: {
      category: params?.category || undefined,
      level1: params?.level1 || undefined,
      search: params?.search || undefined,
      activeOnly: params?.activeOnly === undefined ? undefined : String(params.activeOnly)
    }
  });
  return response.data.items;
}

export async function getReferenceFamily(category: string, level1: string) {
  const response = await apiClient.get<{ items: ReferenceDataItem[] }>(`/reference-data/families/${category}/${level1}`);
  return response.data.items;
}

export async function createReferenceData(payload: ReferenceDataPayload) {
  const response = await apiClient.post<ReferenceDataItem>("/reference-data", payload);
  return response.data;
}

export async function updateReferenceData(id: string, payload: Partial<ReferenceDataPayload>) {
  const response = await apiClient.patch<ReferenceDataItem>(`/reference-data/${id}`, payload);
  return response.data;
}
