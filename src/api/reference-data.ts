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

export type ReferenceDataPagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type ReferenceFamilyOption = {
  referenceCategory: string;
  level1Code: string;
  level1Name: string;
};

export type ReferenceDataMetadata = {
  stats: {
    values: number;
    categories: number;
    families: number;
    inactive: number;
  };
  categories: string[];
  families: ReferenceFamilyOption[];
};

export async function listReferenceData(params?: {
  category?: string;
  level1?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  activeOnly?: boolean;
}) {
  const response = await apiClient.get<{ items: ReferenceDataItem[]; pagination: ReferenceDataPagination }>("/reference-data", {
    params: {
      category: params?.category || undefined,
      level1: params?.level1 || undefined,
      search: params?.search || undefined,
      page: params?.page,
      pageSize: params?.pageSize,
      activeOnly: params?.activeOnly === undefined ? undefined : String(params.activeOnly)
    }
  });
  return response.data;
}

export async function getReferenceFamily(category: string, level1: string) {
  const response = await apiClient.get<{ items: ReferenceDataItem[] }>(`/reference-data/families/${category}/${level1}`);
  return response.data.items;
}

export type GeographyCityOption = {
  id: string;
  name: string;
  adminCode: string | null;
};

export type GeographyCountryOption = {
  code: string;
  name: string;
  nativeName: string;
};

export async function getGeographyCountries() {
  const response = await apiClient.get<{ items: GeographyCountryOption[] }>("/reference-data/geography/countries");
  return response.data.items;
}

export async function getCitiesByCountry(countryCode: string, search?: string) {
  const response = await apiClient.get<{ items: GeographyCityOption[]; attribution: string }>(
    "/reference-data/geography/cities",
    {
      params: {
        countryCode,
        search: search?.trim() || undefined,
        limit: 250
      }
    }
  );
  return response.data;
}

export async function getReferenceDataMetadata() {
  const response = await apiClient.get<ReferenceDataMetadata>("/reference-data/metadata");
  return response.data;
}

export async function createReferenceData(payload: ReferenceDataPayload) {
  const response = await apiClient.post<ReferenceDataItem>("/reference-data", payload);
  return response.data;
}

export async function updateReferenceData(id: string, payload: Partial<ReferenceDataPayload>) {
  const response = await apiClient.patch<ReferenceDataItem>(`/reference-data/${id}`, payload);
  return response.data;
}
