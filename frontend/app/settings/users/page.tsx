"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useUsers, createUser, patchUser, toggleUserActive } from "@/hooks/use-users";
import { UserProfile } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api-client";

function roleBadge(role: string) {
  return role === "admin" ? (
    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Admin</Badge>
  ) : (
    <Badge variant="secondary">Analyst</Badge>
  );
}

function providerBadge(provider: string) {
  return provider === "azure" ? (
    <Badge variant="outline" className="text-[10px]">Microsoft SSO</Badge>
  ) : (
    <Badge variant="outline" className="text-[10px]">Local</Badge>
  );
}

export default function UsersPage() {
  const { isAdmin, user: me } = useAuth();
  const { data, isLoading, mutate } = useUsers();
  const [showCreate, setShowCreate] = useState(false);
  const [actionError, setActionError] = useState("");

  if (!isAdmin) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Admin access required.
      </div>
    );
  }

  async function handleRoleToggle(u: UserProfile) {
    setActionError("");
    try {
      await patchUser(u.id, { role: u.role === "admin" ? "analyst" : "admin" });
      mutate();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Failed to update role");
    }
  }

  async function handleToggleActive(u: UserProfile) {
    setActionError("");
    try {
      await toggleUserActive(u.id);
      mutate();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Failed to update user");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">User Management</h1>
          <p className="text-sm text-muted-foreground">Manage accounts and access roles.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>Add User</Button>
      </div>

      {actionError && (
        <p className="text-sm text-destructive">{actionError}</p>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-3">Name / Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last Login</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.users.map((u) => {
                  const isSelf = u.id === me?.id;
                  const displayName = u.first_name
                    ? `${u.first_name}${u.last_name ? " " + u.last_name : ""}`
                    : null;
                  return (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3">
                        {displayName && <div className="font-medium">{displayName}</div>}
                        <div className="text-muted-foreground">{u.email}</div>
                      </td>
                      <td className="px-4 py-3">{roleBadge(u.role)}</td>
                      <td className="px-4 py-3">{providerBadge(u.auth_provider)}</td>
                      <td className="px-4 py-3">
                        <span className={u.is_active ? "text-emerald-600" : "text-muted-foreground"}>
                          {u.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {u.last_login
                          ? new Date(u.last_login).toLocaleDateString()
                          : "Never"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {!isSelf && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRoleToggle(u)}
                              >
                                Make {u.role === "admin" ? "Analyst" : "Admin"}
                              </Button>
                              <Button
                                size="sm"
                                variant={u.is_active ? "destructive" : "outline"}
                                onClick={() => handleToggleActive(u)}
                              >
                                {u.is_active ? "Deactivate" : "Reactivate"}
                              </Button>
                            </>
                          )}
                          {isSelf && <span className="text-xs text-muted-foreground">You</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <CreateUserModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { mutate(); setShowCreate(false); }}
      />
    </div>
  );
}

function CreateUserModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<"admin" | "analyst">("analyst");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await createUser({
        email,
        password,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        role,
      });
      onCreated();
      setEmail(""); setPassword(""); setFirstName(""); setLastName(""); setRole("analyst");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create user");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium">
              First Name
              <Input className="mt-1" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </label>
            <label className="block text-sm font-medium">
              Last Name
              <Input className="mt-1" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </label>
          </div>
          <label className="block text-sm font-medium">
            Email *
            <Input className="mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="block text-sm font-medium">
            Password *
            <Input className="mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </label>
          <label className="block text-sm font-medium">
            Role
            <select
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "analyst")}
            >
              <option value="analyst">Analyst</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Creating…" : "Create User"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
