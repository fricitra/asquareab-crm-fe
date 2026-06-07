import axios from "axios";
import { apiClient } from "../lib/api-client";

export type LoginPayload = {
  username: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    username: string;
    email: string;
    fullName?: string;
  };
};

export async function login(payload: LoginPayload) {
  const response = await apiClient.post<LoginResponse>("/auth/login", payload);
  return response.data;
}

export function getApiErrorMessage(error: unknown) {
  if (!axios.isAxiosError(error)) {
    return "Unexpected error while contacting the CRM backend.";
  }

  if (!error.response) {
    return "CRM backend is not reachable. Please check whether the backend is running.";
  }

  if (error.response.status === 401) {
    return (error.response.data as { message?: string } | undefined)?.message ?? "Invalid username or password.";
  }

  return `Request failed with status ${error.response.status}.`;
}
