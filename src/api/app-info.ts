import { apiClient } from "../lib/api-client";

export type AppInfo = {
  application: string;
  service: string;
  status: string;
  version: string;
  dbHost?: string;
};

export async function getAppInfo() {
  const response = await apiClient.get<AppInfo>("/health");
  return response.data;
}
