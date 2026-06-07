import { apiClient } from "../lib/api-client";

export type ReferenceDataItem = {
  id: string;
  referenceCategory: string;
  level1Code: string;
  level1Name: string;
  level2Code: string;
  level2Name: string;
  sortOrder: number;
  status: string;
  isActive: boolean;
};

export async function getReferenceFamily(category: string, level1: string) {
  const response = await apiClient.get<{ items: ReferenceDataItem[] }>(`/reference-data/families/${category}/${level1}`);
  return response.data.items;
}
