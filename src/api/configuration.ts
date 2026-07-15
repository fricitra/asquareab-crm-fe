import { apiClient } from "../lib/api-client";

export type ConfigurationEngineCode =
  | "LEAD_DUPLICATE"
  | "LEAD_SCORING"
  | "LEAD_QUALIFICATION"
  | "LEAD_CLASSIFICATION"
  | "CUSTOMER_CREATION";

export type ConfigurationEngineMeta = {
  code: ConfigurationEngineCode;
  name: string;
  description: string;
  module: string;
};

export type AppConfiguration = {
  id: string | null;
  organizationId: string;
  engineCode: ConfigurationEngineCode;
  configVersion: number;
  status: "DRAFT" | "PUBLISHED";
  payload: unknown;
  publishedPayload: unknown | null;
  publishedAt: string | null;
  publishedBy: string | null;
  remarks: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  hasUnpublishedChanges: boolean;
  isDefault: boolean;
};

export type ConfigurationHistoryItem = {
  id: string;
  organizationId: string;
  engineCode: string;
  configVersion: number;
  status: string;
  payload: unknown;
  actionCode: string;
  remarks: string | null;
  createdAt: string | null;
  createdBy: string | null;
};

export async function listConfigurationEngines() {
  const response = await apiClient.get<{ items: ConfigurationEngineMeta[] }>("/configuration/engines");
  return response.data.items;
}

export async function getConfiguration(engineCode: ConfigurationEngineCode) {
  const response = await apiClient.get<AppConfiguration>(`/configuration/${engineCode}`);
  return response.data;
}

export async function listConfigurationHistory(engineCode: ConfigurationEngineCode) {
  const response = await apiClient.get<{ items: ConfigurationHistoryItem[] }>(
    `/configuration/${engineCode}/history`
  );
  return response.data.items;
}

export async function upsertConfiguration(
  engineCode: ConfigurationEngineCode,
  payload: { status?: "DRAFT" | "PUBLISHED"; payload: unknown; remarks?: string }
) {
  const response = await apiClient.put<AppConfiguration>(`/configuration/${engineCode}`, payload);
  return response.data;
}
