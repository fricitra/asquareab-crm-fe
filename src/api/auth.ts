import axios from "axios";
import { apiClient } from "../lib/api-client";

export type LoginPayload = {
  username: string;
  password: string;
};

export type OtpRequestPayload = {
  username: string;
};

export type OtpLoginPayload = {
  username: string;
  otp: string;
};

export type OtpRequestResponse = {
  username: string;
  maskedDestination: string;
  expiresAt: string;
  devOtp: string;
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    username: string;
    email: string;
    fullName?: string;
    roles?: Array<{
      code: string;
      name: string;
      isPrimary: boolean;
    }>;
    permissions?: Array<{
      code: string;
      canView: boolean;
      canCreate: boolean;
      canUpdate: boolean;
      canDelete: boolean;
      canApprove: boolean;
      canExport: boolean;
    }>;
  };
};

export async function login(payload: LoginPayload) {
  const response = await apiClient.post<LoginResponse>("/auth/login", payload);
  return response.data;
}

export async function requestOtp(payload: OtpRequestPayload) {
  const response = await apiClient.post<OtpRequestResponse>("/auth/otp/request", payload);
  return response.data;
}

export async function loginWithOtp(payload: OtpLoginPayload) {
  const response = await apiClient.post<LoginResponse>("/auth/otp/login", payload);
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
