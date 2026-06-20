import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import {
  createAdminUser,
  createRole,
  disableUserLogin,
  enableUserLogin,
  getAdminUser,
  getRolePermissions,
  listAdminRoles,
  listAdminUsers,
  listPermissions,
  resetUserPassword,
  setRolePermissions,
  setUserRoles,
  updateAdminUser,
  updateRole,
  type AdminRole,
  type AdminUser,
  type CreateAdminUserPayload,
  type CreateRolePayload,
  type RolePermission
} from "../api/admin";

type AdminTab = "users" | "roles";

type UserFormValues = {
  username: string;
  email: string;
  fullName: string;
  mobileNo: string;
  password: string;
  loginEnabled: boolean;
  status: "ACTIVE" | "INACTIVE" | "LOCKED";
  isActive: boolean;
  remarks: string;
};

type RoleFormValues = {
  code: string;
  name: string;
  description: string;
  status: "ACTIVE" | "INACTIVE";
  isActive: boolean;
  remarks: string;
};

function pickString(value: string) {
  return value.trim() === "" ? undefined : value.trim();
}

const blankUserForm: UserFormValues = {
  username: "",
  email: "",
  fullName: "",
  mobileNo: "",
  password: "",
  loginEnabled: true,
  status: "ACTIVE",
  isActive: true,
  remarks: ""
};

const blankRoleForm: RoleFormValues = {
  code: "",
  name: "",
  description: "",
  status: "ACTIVE",
  isActive: true,
  remarks: ""
};

function userFormValues(user: AdminUser): UserFormValues {
  return {
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    mobileNo: user.mobileNo ?? "",
    password: "",
    loginEnabled: user.loginEnabled,
    status: user.status === "LOCKED" ? "LOCKED" : user.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    isActive: user.isActive,
    remarks: user.remarks ?? ""
  };
}

function roleFormValues(role: AdminRole): RoleFormValues {
  return {
    code: role.code,
    name: role.name,
    description: role.description ?? "",
    status: role.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    isActive: role.isActive,
    remarks: role.remarks ?? ""
  };
}

function userPayload(values: UserFormValues, includePassword: boolean): CreateAdminUserPayload {
  return {
    username: values.username.trim(),
    email: values.email.trim(),
    fullName: values.fullName.trim(),
    mobileNo: pickString(values.mobileNo),
    password: includePassword ? pickString(values.password) : undefined,
    loginEnabled: values.loginEnabled,
    status: values.status,
    isActive: values.isActive,
    remarks: pickString(values.remarks)
  };
}

function rolePayload(values: RoleFormValues): CreateRolePayload {
  return {
    code: values.code.trim(),
    name: values.name.trim(),
    description: pickString(values.description),
    status: values.status,
    isActive: values.isActive,
    remarks: pickString(values.remarks)
  };
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "-";
}

function matrixPayload(rows: RolePermission[]) {
  return {
    permissions: rows.map((row) => ({
      permissionId: row.permissionId,
      canView: row.canView,
      canCreate: row.canCreate,
      canUpdate: row.canUpdate,
      canDelete: row.canDelete,
      canApprove: row.canApprove,
      canExport: row.canExport
    }))
  };
}

export function AdminPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<AdminTab>("users");
  const [userSearch, setUserSearch] = useState("");
  const [roleSearch, setRoleSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [primaryRoleId, setPrimaryRoleId] = useState("");
  const [permissionRows, setPermissionRows] = useState<RolePermission[]>([]);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const userForm = useForm<UserFormValues>({ defaultValues: blankUserForm });
  const roleForm = useForm<RoleFormValues>({ defaultValues: blankRoleForm });

  const usersQuery = useQuery({
    queryKey: ["admin", "users", userSearch],
    queryFn: () => listAdminUsers(userSearch),
    staleTime: 10_000
  });
  const rolesQuery = useQuery({
    queryKey: ["admin", "roles", roleSearch],
    queryFn: () => listAdminRoles(roleSearch),
    staleTime: 10_000
  });
  const permissionsQuery = useQuery({
    queryKey: ["admin", "permissions"],
    queryFn: listPermissions,
    staleTime: 60_000
  });
  const selectedUserQuery = useQuery({
    queryKey: ["admin", "user", selectedUserId],
    queryFn: () => getAdminUser(selectedUserId ?? ""),
    enabled: Boolean(selectedUserId)
  });
  const selectedRolePermissionsQuery = useQuery({
    queryKey: ["admin", "role-permissions", selectedRoleId],
    queryFn: () => getRolePermissions(selectedRoleId ?? ""),
    enabled: Boolean(selectedRoleId)
  });

  const userRows = usersQuery.data?.items ?? [];
  const roleRows = rolesQuery.data?.items ?? [];
  const selectedUser = selectedUserQuery.data ?? userRows.find((user) => user.id === selectedUserId) ?? null;
  const selectedRole = selectedRolePermissionsQuery.data?.role ?? roleRows.find((role) => role.id === selectedRoleId) ?? null;

  const stats = useMemo(() => {
    const activeUsers = userRows.filter((user) => user.status === "ACTIVE" && user.isActive).length;
    const loginDisabled = userRows.filter((user) => !user.loginEnabled).length;
    const activeRoles = roleRows.filter((role) => role.status === "ACTIVE" && role.isActive).length;
    return {
      users: usersQuery.data?.pagination.total ?? userRows.length,
      activeUsers,
      roles: rolesQuery.data?.pagination.total ?? roleRows.length,
      activeRoles,
      loginDisabled
    };
  }, [roleRows, rolesQuery.data?.pagination.total, userRows, usersQuery.data?.pagination.total]);

  useEffect(() => {
    if (selectedUser) {
      userForm.reset(userFormValues(selectedUser));
      const roleIds = selectedUser.roles.filter((role) => role.isActive && role.status === "ACTIVE").map((role) => role.roleId);
      setSelectedRoleIds(roleIds);
      setPrimaryRoleId(selectedUser.roles.find((role) => role.isPrimary)?.roleId ?? roleIds[0] ?? "");
    }
  }, [selectedUser, userForm]);

  useEffect(() => {
    if (selectedRole) {
      roleForm.reset(roleFormValues(selectedRole));
    }
  }, [roleForm, selectedRole]);

  useEffect(() => {
    if (selectedRolePermissionsQuery.data?.permissions) {
      setPermissionRows(selectedRolePermissionsQuery.data.permissions);
    }
  }, [selectedRolePermissionsQuery.data]);

  const refreshUsers = (successMessage: string, user?: AdminUser) => {
    setMessage(successMessage);
    if (user) setSelectedUserId(user.id);
    void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    if (user) void queryClient.invalidateQueries({ queryKey: ["admin", "user", user.id] });
  };

  const refreshRoles = (successMessage: string, role?: AdminRole) => {
    setMessage(successMessage);
    if (role) setSelectedRoleId(role.id);
    void queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
    if (role) void queryClient.invalidateQueries({ queryKey: ["admin", "role-permissions", role.id] });
  };

  const createUserMutation = useMutation({
    mutationFn: (values: UserFormValues) => createAdminUser(userPayload(values, true)),
    onSuccess: (user) => refreshUsers("User created.", user),
    onError: () => setMessage("User could not be created. Check required fields and duplicate username/email.")
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: UserFormValues }) => updateAdminUser(id, userPayload(values, false)),
    onSuccess: (user) => refreshUsers("User updated.", user),
    onError: () => setMessage("User could not be updated.")
  });

  const loginMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => (enabled ? enableUserLogin(id) : disableUserLogin(id)),
    onSuccess: (user) => refreshUsers("Login access updated.", user),
    onError: () => setMessage("Login access could not be updated.")
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => resetUserPassword(id, password),
    onSuccess: (user) => {
      setResetPasswordValue("");
      refreshUsers("Password reset completed.", user);
    },
    onError: () => setMessage("Password could not be reset. Use at least 8 characters.")
  });

  const assignRolesMutation = useMutation({
    mutationFn: ({ id, roleIds, primary }: { id: string; roleIds: string[]; primary: string }) =>
      setUserRoles(id, { roleIds, primaryRoleId: primary }),
    onSuccess: (user) => refreshUsers("User roles updated.", user),
    onError: () => setMessage("User roles could not be updated. Select at least one role and one primary role.")
  });

  const createRoleMutation = useMutation({
    mutationFn: (values: RoleFormValues) => createRole(rolePayload(values)),
    onSuccess: (role) => refreshRoles("Role created.", role),
    onError: () => setMessage("Role could not be created. Check duplicate code and required fields.")
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: RoleFormValues }) => updateRole(id, rolePayload(values)),
    onSuccess: (role) => refreshRoles("Role updated.", role),
    onError: () => setMessage("Role could not be updated.")
  });

  const saveMatrixMutation = useMutation({
    mutationFn: ({ id, rows }: { id: string; rows: RolePermission[] }) => setRolePermissions(id, matrixPayload(rows)),
    onSuccess: (result) => {
      setPermissionRows(result.permissions);
      refreshRoles("Permission matrix saved.", result.role);
    },
    onError: () => setMessage("Permission matrix could not be saved.")
  });

  const onUserSubmit = userForm.handleSubmit((values) => {
    if (!values.username.trim() || !values.email.trim() || !values.fullName.trim()) {
      setMessage("Username, email, and full name are required.");
      return;
    }
    if (selectedUser) {
      updateUserMutation.mutate({ id: selectedUser.id, values });
      return;
    }
    createUserMutation.mutate(values);
  });

  const onRoleSubmit = roleForm.handleSubmit((values) => {
    if (!values.code.trim() || !values.name.trim()) {
      setMessage("Role code and name are required.");
      return;
    }
    if (selectedRole) {
      updateRoleMutation.mutate({ id: selectedRole.id, values });
      return;
    }
    createRoleMutation.mutate(values);
  });

  const toggleAssignedRole = (roleId: string, checked: boolean) => {
    const next = checked ? Array.from(new Set([...selectedRoleIds, roleId])) : selectedRoleIds.filter((id) => id !== roleId);
    setSelectedRoleIds(next);
    if (!next.includes(primaryRoleId)) {
      setPrimaryRoleId(next[0] ?? "");
    }
  };

  const updatePermissionRow = (permissionId: string, action: keyof RolePermission, checked: boolean) => {
    setPermissionRows((current) =>
      current.map((row) => (row.permissionId === permissionId ? { ...row, [action]: checked } : row))
    );
  };

  return (
    <div className="crm-workspace">
      <section className="crm-module-header">
        <div>
          <p className="crm-eyebrow">Administration</p>
          <h2>User and Role Management</h2>
        </div>
      </section>

      <section className="crm-grid crm-metric-grid">
        <article className="crm-card">
          <h3>Users</h3>
          <div className="crm-kpi">{stats.users}</div>
        </article>
        <article className="crm-card">
          <h3>Active Users</h3>
          <div className="crm-kpi">{stats.activeUsers}</div>
        </article>
        <article className="crm-card">
          <h3>Roles</h3>
          <div className="crm-kpi">{stats.roles}</div>
        </article>
        <article className="crm-card">
          <h3>Login Disabled</h3>
          <div className="crm-kpi">{stats.loginDisabled}</div>
        </article>
      </section>

      {message ? <div className={message.includes("could not") ? "crm-error-banner" : "crm-info-banner"}>{message}</div> : null}

      <section className="crm-tabs" aria-label="Admin workspace tabs">
        <button className={`crm-tab-button${activeTab === "users" ? " is-active" : ""}`} onClick={() => setActiveTab("users")} type="button">
          Users
        </button>
        <button className={`crm-tab-button${activeTab === "roles" ? " is-active" : ""}`} onClick={() => setActiveTab("roles")} type="button">
          Roles & Permissions
        </button>
      </section>

      {activeTab === "users" ? (
        <section className="crm-action-grid crm-inventory-grid">
          <section className="crm-panel">
            <div className="crm-panel-header">
              <h3>User Register</h3>
              <input
                className="crm-input crm-search-input"
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder="Search user, email, mobile"
                value={userSearch}
              />
            </div>
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Primary Role</th>
                    <th>Status</th>
                    <th>Login</th>
                  </tr>
                </thead>
                <tbody>
                  {userRows.map((user) => (
                    <tr className={selectedUserId === user.id ? "is-selected" : ""} key={user.id} onClick={() => setSelectedUserId(user.id)}>
                      <td>
                        <strong>{user.fullName}</strong>
                        <span>{user.username} - {user.email}</span>
                      </td>
                      <td>{user.roles.find((role) => role.isPrimary)?.roleName ?? "-"}</td>
                      <td>{user.status}</td>
                      <td>{user.loginEnabled ? "Enabled" : "Disabled"}</td>
                    </tr>
                  ))}
                  {userRows.length === 0 ? (
                    <tr>
                      <td className="crm-empty-cell" colSpan={4}>No users found.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="crm-panel">
            <div className="crm-panel-header">
              <h3>{selectedUser ? "Edit User" : "New User"}</h3>
              <button
                className="crm-secondary-button"
                onClick={() => {
                  setSelectedUserId(null);
                  setSelectedRoleIds([]);
                  setPrimaryRoleId("");
                  userForm.reset(blankUserForm);
                }}
                type="button"
              >
                New
              </button>
            </div>

            <form className="crm-form" onSubmit={onUserSubmit}>
              <div className="crm-two-col">
                <label className="crm-field">
                  <span className="crm-label">Username</span>
                  <input className="crm-input" {...userForm.register("username")} />
                </label>
                <label className="crm-field">
                  <span className="crm-label">Email</span>
                  <input className="crm-input" {...userForm.register("email")} />
                </label>
              </div>
              <label className="crm-field">
                <span className="crm-label">Full Name</span>
                <input className="crm-input" {...userForm.register("fullName")} />
              </label>
              <div className="crm-two-col">
                <label className="crm-field">
                  <span className="crm-label">Mobile</span>
                  <input className="crm-input" {...userForm.register("mobileNo")} />
                </label>
                <label className="crm-field">
                  <span className="crm-label">Status</span>
                  <select className="crm-input" {...userForm.register("status")}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="LOCKED">Locked</option>
                  </select>
                </label>
              </div>
              {!selectedUser ? (
                <label className="crm-field">
                  <span className="crm-label">Initial Password</span>
                  <input className="crm-input" type="password" {...userForm.register("password")} />
                </label>
              ) : null}
              <div className="crm-two-col">
                <label className="crm-check-field">
                  <input type="checkbox" {...userForm.register("loginEnabled")} />
                  <span>Login enabled</span>
                </label>
                <label className="crm-check-field">
                  <input type="checkbox" {...userForm.register("isActive")} />
                  <span>User active</span>
                </label>
              </div>
              <label className="crm-field">
                <span className="crm-label">Remarks</span>
                <textarea className="crm-input crm-textarea" {...userForm.register("remarks")} />
              </label>
              <button className="crm-primary-button" disabled={createUserMutation.isPending || updateUserMutation.isPending} type="submit">
                {selectedUser ? "Update User" : "Create User"}
              </button>
            </form>

            {selectedUser ? (
              <section className="crm-admin-section">
                <div className="crm-detail-title">
                  <div>
                    <strong>Role Assignment</strong>
                    <span>Last login: {formatDate(selectedUser.lastLoginAt)}</span>
                  </div>
                </div>
                <div className="crm-admin-role-list">
                  {roleRows.map((role) => {
                    const checked = selectedRoleIds.includes(role.id);
                    return (
                      <label className="crm-admin-role-option" key={role.id}>
                        <input checked={checked} onChange={(event) => toggleAssignedRole(role.id, event.target.checked)} type="checkbox" />
                        <span>
                          <strong>{role.name}</strong>
                          <small>{role.code}</small>
                        </span>
                        <input
                          checked={primaryRoleId === role.id}
                          disabled={!checked}
                          name="primaryRole"
                          onChange={() => setPrimaryRoleId(role.id)}
                          type="radio"
                        />
                      </label>
                    );
                  })}
                </div>
                <button
                  className="crm-primary-button"
                  disabled={!selectedRoleIds.length || !primaryRoleId || assignRolesMutation.isPending}
                  onClick={() => assignRolesMutation.mutate({ id: selectedUser.id, roleIds: selectedRoleIds, primary: primaryRoleId })}
                  type="button"
                >
                  Save User Roles
                </button>
                <div className="crm-two-col">
                  <button
                    className="crm-secondary-button"
                    disabled={loginMutation.isPending}
                    onClick={() => loginMutation.mutate({ id: selectedUser.id, enabled: !selectedUser.loginEnabled })}
                    type="button"
                  >
                    {selectedUser.loginEnabled ? "Disable Login" : "Enable Login"}
                  </button>
                  <label className="crm-field">
                    <span className="crm-label">Reset Password</span>
                    <input
                      className="crm-input"
                      onChange={(event) => setResetPasswordValue(event.target.value)}
                      type="password"
                      value={resetPasswordValue}
                    />
                  </label>
                </div>
                <button
                  className="crm-secondary-button"
                  disabled={resetPasswordValue.length < 8 || resetPasswordMutation.isPending}
                  onClick={() => resetPasswordMutation.mutate({ id: selectedUser.id, password: resetPasswordValue })}
                  type="button"
                >
                  Reset Password
                </button>
              </section>
            ) : null}
          </section>
        </section>
      ) : (
        <section className="crm-action-grid crm-inventory-grid">
          <section className="crm-panel">
            <div className="crm-panel-header">
              <h3>Role Register</h3>
              <input
                className="crm-input crm-search-input"
                onChange={(event) => setRoleSearch(event.target.value)}
                placeholder="Search role code, name"
                value={roleSearch}
              />
            </div>
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {roleRows.map((role) => (
                    <tr className={selectedRoleId === role.id ? "is-selected" : ""} key={role.id} onClick={() => setSelectedRoleId(role.id)}>
                      <td>
                        <strong>{role.name}</strong>
                        <span>{role.code}</span>
                      </td>
                      <td>{role.status}</td>
                      <td>{role.isActive ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                  {roleRows.length === 0 ? (
                    <tr>
                      <td className="crm-empty-cell" colSpan={3}>No roles found.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="crm-panel">
            <div className="crm-panel-header">
              <h3>{selectedRole ? "Edit Role" : "New Role"}</h3>
              <button
                className="crm-secondary-button"
                onClick={() => {
                  setSelectedRoleId(null);
                  setPermissionRows([]);
                  roleForm.reset(blankRoleForm);
                }}
                type="button"
              >
                New
              </button>
            </div>

            <form className="crm-form" onSubmit={onRoleSubmit}>
              <div className="crm-two-col">
                <label className="crm-field">
                  <span className="crm-label">Role Code</span>
                  <input className="crm-input" {...roleForm.register("code")} />
                </label>
                <label className="crm-field">
                  <span className="crm-label">Role Name</span>
                  <input className="crm-input" {...roleForm.register("name")} />
                </label>
              </div>
              <div className="crm-two-col">
                <label className="crm-field">
                  <span className="crm-label">Status</span>
                  <select className="crm-input" {...roleForm.register("status")}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </label>
                <label className="crm-check-field">
                  <input type="checkbox" {...roleForm.register("isActive")} />
                  <span>Role active</span>
                </label>
              </div>
              <label className="crm-field">
                <span className="crm-label">Description</span>
                <textarea className="crm-input crm-textarea" {...roleForm.register("description")} />
              </label>
              <label className="crm-field">
                <span className="crm-label">Remarks</span>
                <textarea className="crm-input crm-textarea" {...roleForm.register("remarks")} />
              </label>
              <button className="crm-primary-button" disabled={createRoleMutation.isPending || updateRoleMutation.isPending} type="submit">
                {selectedRole ? "Update Role" : "Create Role"}
              </button>
            </form>

            {selectedRole ? (
              <section className="crm-admin-section">
                <div className="crm-detail-title">
                  <div>
                    <strong>Permission Matrix</strong>
                    <span>{permissionsQuery.data?.length ?? 0} permissions available</span>
                  </div>
                </div>
                <div className="crm-permission-matrix">
                  <table className="crm-table">
                    <thead>
                      <tr>
                        <th>Permission</th>
                        <th>View</th>
                        <th>Create</th>
                        <th>Update</th>
                        <th>Delete</th>
                        <th>Approve</th>
                        <th>Export</th>
                      </tr>
                    </thead>
                    <tbody>
                      {permissionRows.map((row) => (
                        <tr key={row.permissionId}>
                          <td>
                            <strong>{row.permissionName}</strong>
                            <span>{row.permissionCode}</span>
                          </td>
                          {(["canView", "canCreate", "canUpdate", "canDelete", "canApprove", "canExport"] as const).map((action) => (
                            <td key={action}>
                              <input
                                checked={Boolean(row[action])}
                                onChange={(event) => updatePermissionRow(row.permissionId, action, event.target.checked)}
                                type="checkbox"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                      {permissionRows.length === 0 ? (
                        <tr>
                          <td className="crm-empty-cell" colSpan={7}>Select a role to load permissions.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
                <button
                  className="crm-primary-button"
                  disabled={!selectedRoleId || saveMatrixMutation.isPending}
                  onClick={() => selectedRoleId && saveMatrixMutation.mutate({ id: selectedRoleId, rows: permissionRows })}
                  type="button"
                >
                  Save Permission Matrix
                </button>
              </section>
            ) : null}
          </section>
        </section>
      )}
    </div>
  );
}
