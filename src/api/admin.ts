import { apiClient } from "../lib/api-client";

export type AdminUserRole = {
  id: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  isPrimary: boolean;
  status: string;
  isActive: boolean;
};

export type AdminUser = {
  id: string;
  username: string;
  email: string;
  fullName: string;
  mobileNo: string | null;
  loginEnabled: boolean;
  status: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  remarks: string | null;
  roles: AdminUserRole[];
};

export type AdminRole = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  remarks: string | null;
};

export type AdminPermission = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  isActive: boolean;
};

export type RolePermission = {
  id: string | null;
  permissionId: string;
  permissionCode: string;
  permissionName: string;
  permissionDescription: string | null;
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canExport: boolean;
  status: string | null;
  isActive: boolean | null;
};

export type CreateAdminUserPayload = {
  username: string;
  email: string;
  fullName: string;
  mobileNo?: string;
  password?: string;
  loginEnabled?: boolean;
  status?: "ACTIVE" | "INACTIVE" | "LOCKED";
  isActive?: boolean;
  remarks?: string;
};

export type CreateRolePayload = {
  code: string;
  name: string;
  description?: string;
  status?: "ACTIVE" | "INACTIVE";
  isActive?: boolean;
  remarks?: string;
};

export type SetUserRolesPayload = {
  roleIds: string[];
  primaryRoleId: string;
};

export type SetRolePermissionsPayload = {
  permissions: Array<{
    permissionId: string;
    canView: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canApprove: boolean;
    canExport: boolean;
  }>;
};

export async function listAdminUsers(search?: string) {
  const response = await apiClient.get<{
    items: AdminUser[];
    pagination: { limit: number; offset: number; total: number };
  }>("/admin/users", {
    params: search ? { search } : undefined
  });
  return response.data;
}

export async function getAdminUser(id: string) {
  const response = await apiClient.get<AdminUser>(`/admin/users/${id}`);
  return response.data;
}

export async function createAdminUser(payload: CreateAdminUserPayload) {
  const response = await apiClient.post<AdminUser>("/admin/users", payload);
  return response.data;
}

export async function updateAdminUser(id: string, payload: Partial<CreateAdminUserPayload>) {
  const response = await apiClient.patch<AdminUser>(`/admin/users/${id}`, payload);
  return response.data;
}

export async function enableUserLogin(id: string) {
  const response = await apiClient.post<AdminUser>(`/admin/users/${id}/enable-login`);
  return response.data;
}

export async function disableUserLogin(id: string) {
  const response = await apiClient.post<AdminUser>(`/admin/users/${id}/disable-login`);
  return response.data;
}

export async function resetUserPassword(id: string, password: string) {
  const response = await apiClient.post<AdminUser>(`/admin/users/${id}/reset-password`, { password });
  return response.data;
}

export async function setUserRoles(id: string, payload: SetUserRolesPayload) {
  const response = await apiClient.put<AdminUser>(`/admin/users/${id}/roles`, payload);
  return response.data;
}

export async function listAdminRoles(search?: string) {
  const response = await apiClient.get<{
    items: AdminRole[];
    pagination: { limit: number; offset: number; total: number };
  }>("/admin/roles", {
    params: search ? { search } : undefined
  });
  return response.data;
}

export async function createRole(payload: CreateRolePayload) {
  const response = await apiClient.post<AdminRole>("/admin/roles", payload);
  return response.data;
}

export async function updateRole(id: string, payload: Partial<CreateRolePayload>) {
  const response = await apiClient.patch<AdminRole>(`/admin/roles/${id}`, payload);
  return response.data;
}

export async function listPermissions() {
  const response = await apiClient.get<{ items: AdminPermission[] }>("/admin/permissions");
  return response.data.items;
}

export async function getRolePermissions(id: string) {
  const response = await apiClient.get<{ role: AdminRole; permissions: RolePermission[] }>(`/admin/roles/${id}/permissions`);
  return response.data;
}

export async function setRolePermissions(id: string, payload: SetRolePermissionsPayload) {
  const response = await apiClient.put<{ role: AdminRole; permissions: RolePermission[] }>(`/admin/roles/${id}/permissions`, payload);
  return response.data;
}
