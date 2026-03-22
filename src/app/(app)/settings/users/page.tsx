"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardBody,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Input,
  Select,
  SelectItem,
  Chip,
  Skeleton,
} from "@heroui/react";

interface User {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("STAFF");
  const [showPassword, setShowPassword] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch {
      showToast("Failed to fetch users", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  function generatePassword() {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
    let pw = "";
    for (let i = 0; i < 8; i++) {
      pw += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormPassword(pw);
  }

  function openCreatePanel() {
    setEditingUser(null);
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setFormPassword("");
    setFormRole("STAFF");
    setShowPassword(false);
    setShowPanel(true);
  }

  function openEditPanel(user: User) {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email || "");
    setFormPhone(user.phone || "");
    setFormPassword("");
    setFormRole(user.role);
    setShowPassword(false);
    setShowPanel(true);
  }

  async function handleSave() {
    if (!formName || !formPhone) {
      showToast("Name and phone are required", "error");
      return;
    }
    if (!editingUser && (!formPassword || formPassword.length < 6)) {
      showToast("Password must be at least 6 characters", "error");
      return;
    }

    setSaving(true);
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
      const method = editingUser ? "PATCH" : "POST";

      const bodyData: Record<string, unknown> = {
        name: formName,
        email: formEmail || undefined,
        phone: formPhone,
        userRole: formRole,
      };
      if (formPassword) bodyData.password = formPassword;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save user");

      showToast(
        editingUser ? "User updated successfully" : "User created successfully",
        "success"
      );
      setShowPanel(false);
      fetchUsers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(userId: string) {
    if (!confirm("Are you sure you want to deactivate this user?")) return;

    try {
      const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete user");
      showToast("User deactivated", "success");
      fetchUsers();
    } catch {
      showToast("Failed to deactivate user", "error");
    }
  }

  const roleColorMap: Record<string, "primary" | "secondary" | "warning" | "success"> = {
    ADMIN: "primary",
    STAFF: "secondary",
    ACCOUNTANT: "warning",
    CUSTOMER: "success",
  };

  return (
    <>
      <div className="p-4 lg:p-8 animate-fade-in relative">
        {/* Toast Notification */}
        {toast && (
        <div
          className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg animate-slide-up ${
            toast.type === "success"
              ? "bg-success text-white"
              : "bg-danger text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-default-500 text-sm mt-1">
            Manage staff, accountant, and customer accounts
          </p>
        </div>
        <Button
          id="add-user-btn"
          color="primary"
          className="font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/25"
          onPress={openCreatePanel}
          startContent={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }
        >
          Add User
        </Button>
      </div>

      {/* Users Table */}
      <Card shadow="sm">
        <CardBody className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-default-500">No users found</p>
              <Button
                size="sm"
                color="primary"
                variant="flat"
                className="mt-3"
                onPress={openCreatePanel}
              >
                Create First User
              </Button>
            </div>
          ) : (
            <Table
              aria-label="Users table"
              removeWrapper
              className="min-w-full"
            >
              <TableHeader>
                <TableColumn>NAME</TableColumn>
                <TableColumn>CONTACT</TableColumn>
                <TableColumn>ROLE</TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn>CREATED</TableColumn>
                <TableColumn>ACTIONS</TableColumn>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        {user.email && (
                          <span className="text-sm">{user.email}</span>
                        )}
                        {user.phone && (
                          <span className="text-sm text-default-400">
                            {user.phone}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="sm"
                        color={roleColorMap[user.role] || "primary"}
                        variant="flat"
                        className="capitalize"
                      >
                        {user.role.toLowerCase()}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="sm"
                        color={user.isActive ? "success" : "default"}
                        variant="dot"
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </Chip>
                    </TableCell>
                    <TableCell className="text-sm text-default-500">
                      {new Date(user.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="flat"
                          isIconOnly
                          onPress={() => openEditPanel(user)}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Button>
                        <Button
                          size="sm"
                          variant="flat"
                          color="danger"
                          isIconOnly
                          onPress={() => handleDelete(user.id)}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>
      </div>

      {/* ── Slide-Over Panel ───────────────────────── */}
      {showPanel && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-50"
            onClick={() => setShowPanel(false)}
          />
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-background shadow-2xl z-50 animate-slide-in-right overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">
                  {editingUser ? "Edit User" : "Add New User"}
                </h2>
                <Button
                  isIconOnly
                  variant="light"
                  size="sm"
                  onPress={() => setShowPanel(false)}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Button>
              </div>

              <div className="flex flex-col gap-4">
                <Input
                  label="Name"
                  placeholder="Enter full name"
                  value={formName}
                  onValueChange={setFormName}
                  variant="bordered"
                  isRequired
                />
                <Input
                  label="Email"
                  placeholder="Enter email (optional)"
                  type="email"
                  value={formEmail}
                  onValueChange={setFormEmail}
                  variant="bordered"
                />
                <Input
                  label="Phone"
                  placeholder="Enter phone number"
                  type="tel"
                  value={formPhone}
                  onValueChange={setFormPhone}
                  variant="bordered"
                  isRequired
                />
                <div>
                  <Input
                    label="Password"
                    placeholder={editingUser ? "Leave blank to keep current" : "Min 6 characters"}
                    type={showPassword ? "text" : "password"}
                    value={formPassword}
                    onValueChange={setFormPassword}
                    variant="bordered"
                    isRequired={!editingUser}
                    endContent={
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="flat"
                          onPress={() => setShowPassword((current) => !current)}
                          className="text-xs"
                        >
                          {showPassword ? "Hide" : "Show"}
                        </Button>
                        <Button
                          size="sm"
                          variant="flat"
                          onPress={generatePassword}
                          className="text-xs"
                        >
                          Generate
                        </Button>
                      </div>
                    }
                  />
                </div>
                <Select
                  label="Role"
                  selectedKeys={[formRole]}
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0] as string;
                    if (selected) setFormRole(selected);
                  }}
                  variant="bordered"
                >
                  <SelectItem key="STAFF">Staff</SelectItem>
                  <SelectItem key="ACCOUNTANT">Accountant</SelectItem>
                  <SelectItem key="CUSTOMER">Customer</SelectItem>
                </Select>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="flat"
                    className="flex-1"
                    onPress={() => setShowPanel(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    color="primary"
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600"
                    onPress={handleSave}
                    isLoading={saving}
                  >
                    {editingUser ? "Update" : "Create User"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
