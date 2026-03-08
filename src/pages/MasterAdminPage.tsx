import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  LogIn, Plus, Users, Eye, EyeOff, Copy, Trash2,
  KeyRound, ToggleLeft, ToggleRight, LogOut, Shield
} from "lucide-react";

interface AppUser {
  id: string;
  username: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

const MasterAdminPage = () => {
  const [adminSession, setAdminSession] = useState<{ id: string; username: string } | null>(null);

  // Login state
  const [loginUser, setLoginUser] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  // Create user state
  const [fullName, setFullName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<{ username: string; password: string } | null>(null);

  // Users list
  const [users, setUsers] = useState<AppUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // Reset password modal
  const [resetModal, setResetModal] = useState<{ userId: string; username: string } | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetCreds, setResetCreds] = useState<{ username: string; password: string } | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!adminSession) return;
    setUsersLoading(true);
    const { data } = await supabase.functions.invoke("auth-admin", {
      body: { action: "list_users" },
    });
    if (data?.users) setUsers(data.users);
    setUsersLoading(false);
  }, [adminSession]);

  useEffect(() => {
    if (adminSession) fetchUsers();
  }, [adminSession, fetchUsers]);

  // ── MASTER LOGIN ──
  const handleMasterLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("auth-admin", {
        body: { action: "master_login", username: loginUser.trim(), password: loginPw },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      setAdminSession(data);
      toast.success("Master admin logged in");
    } catch {
      toast.error("Login failed");
    } finally {
      setLoginLoading(false);
    }
  };

  // ── CREATE USER ──
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) { toast.error("Passwords do not match"); return; }
    if (newPw.length < 4) { toast.error("Password must be at least 4 characters"); return; }
    setCreateLoading(true);
    setCreatedCreds(null);
    try {
      const { data, error } = await supabase.functions.invoke("auth-admin", {
        body: { action: "create_user", admin_id: adminSession!.id, username: newUsername.trim(), password: newPw, full_name: fullName.trim() },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      toast.success(`User "${newUsername}" created`);
      setCreatedCreds({ username: newUsername.trim(), password: newPw });
      setFullName(""); setNewUsername(""); setNewPw(""); setConfirmPw("");
      fetchUsers();
    } catch {
      toast.error("Failed to create user");
    } finally {
      setCreateLoading(false);
    }
  };

  // ── TOGGLE ACTIVE ──
  const toggleActive = async (userId: string, current: boolean) => {
    await supabase.functions.invoke("auth-admin", {
      body: { action: "toggle_active", user_id: userId, is_active: !current },
    });
    toast.success(current ? "User deactivated" : "User activated");
    fetchUsers();
  };

  // ── DELETE USER ──
  const deleteUser = async (userId: string) => {
    if (!confirm("Delete this user permanently?")) return;
    await supabase.functions.invoke("auth-admin", {
      body: { action: "delete_user", user_id: userId },
    });
    toast.success("User deleted");
    fetchUsers();
  };

  // ── RESET PASSWORD ──
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetPw.length < 4) { toast.error("Password must be at least 4 characters"); return; }
    setResetLoading(true);
    setResetCreds(null);
    try {
      await supabase.functions.invoke("auth-admin", {
        body: { action: "reset_password", user_id: resetModal!.userId, new_password: resetPw },
      });
      toast.success("Password reset");
      setResetCreds({ username: resetModal!.username, password: resetPw });
      setResetPw("");
    } catch {
      toast.error("Failed to reset password");
    } finally {
      setResetLoading(false);
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  // ── LOGIN SCREEN ──
  if (!adminSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <form onSubmit={handleMasterLogin} className="w-full max-w-sm space-y-6 p-8 rounded-2xl border border-border bg-card shadow-lg">
          <div className="text-center space-y-1">
            <Shield className="mx-auto text-primary" size={32} />
            <h1 className="text-2xl font-bold text-foreground">Master Admin</h1>
            <p className="text-sm text-muted-foreground">Restricted access</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Username</label>
              <input type="text" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" autoFocus />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Password</label>
              <div className="relative mt-1">
                <input type={showLoginPw ? "text" : "password"} value={loginPw} onChange={(e) => setLoginPw(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-primary" />
                <button type="button" onClick={() => setShowLoginPw(!showLoginPw)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">{showLoginPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </div>
          </div>
          <button type="submit" disabled={loginLoading} className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:opacity-90 transition disabled:opacity-50">
            <LogIn size={16} /> {loginLoading ? "Signing in…" : "Login"}
          </button>
        </form>
      </div>
    );
  }

  // ── ADMIN DASHBOARD ──
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-card/80 backdrop-blur">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-primary" />
            <span className="font-semibold text-foreground">Master Admin</span>
          </div>
          <button onClick={() => setAdminSession(null)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
            <LogOut size={14} /> Logout
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 pt-20 pb-12 space-y-8">
        {/* SECTION 1: Create User */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Plus size={18} /> Create New User
          </h2>
          <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground">Full Name</label>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" required />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Username</label>
              <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" required />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Password</label>
              <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" required />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Confirm Password</label>
              <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" required />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" disabled={createLoading} className="flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:opacity-90 transition disabled:opacity-50">
                <Plus size={16} /> {createLoading ? "Creating…" : "Create User"}
              </button>
            </div>
          </form>
          {createdCreds && (
            <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">✅ User created! Share these credentials:</p>
              <div className="flex items-center gap-2 font-mono text-sm bg-background rounded-lg px-3 py-2 border border-input">
                <span>Username: <strong>{createdCreds.username}</strong> | Password: <strong>{createdCreds.password}</strong></span>
                <button onClick={() => copyText(`Username: ${createdCreds.username}\nPassword: ${createdCreds.password}`)} className="ml-auto text-muted-foreground hover:text-foreground"><Copy size={14} /></button>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 2: Manage Users */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Users size={18} /> Manage Users
          </h2>
          {usersLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users created yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Full Name</th>
                    <th className="py-2 pr-4 font-medium">Username</th>
                    <th className="py-2 pr-4 font-medium">Created</th>
                    <th className="py-2 pr-4 font-medium">Active</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border/50">
                      <td className="py-3 pr-4 text-foreground">{u.full_name || "—"}</td>
                      <td className="py-3 pr-4 font-mono text-foreground">{u.username}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="py-3 pr-4">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${u.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {u.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3 flex items-center gap-1">
                        <button onClick={() => toggleActive(u.id, u.is_active)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition" title={u.is_active ? "Deactivate" : "Activate"}>
                          {u.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                        </button>
                        <button onClick={() => { setResetModal({ userId: u.id, username: u.username }); setResetPw(""); setResetCreds(null); }} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition" title="Reset Password">
                          <KeyRound size={16} />
                        </button>
                        <button onClick={() => deleteUser(u.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition" title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Reset Password Modal */}
      {resetModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-semibold text-foreground">Reset Password</h3>
            <p className="text-sm text-muted-foreground">User: <strong>{resetModal.username}</strong></p>
            <form onSubmit={handleResetPassword} className="space-y-3">
              <input type="password" value={resetPw} onChange={(e) => setResetPw(e.target.value)} placeholder="New password" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" required autoFocus />
              <div className="flex gap-2">
                <button type="submit" disabled={resetLoading} className="flex-1 rounded-lg bg-primary text-primary-foreground py-2 text-sm font-medium hover:opacity-90 transition disabled:opacity-50">
                  {resetLoading ? "Resetting…" : "Reset"}
                </button>
                <button type="button" onClick={() => setResetModal(null)} className="flex-1 rounded-lg border border-input py-2 text-sm font-medium hover:bg-secondary transition">Cancel</button>
              </div>
            </form>
            {resetCreds && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1">
                <p className="text-sm font-medium text-foreground">✅ Password reset!</p>
                <div className="flex items-center gap-2 font-mono text-sm bg-background rounded-lg px-3 py-2 border border-input">
                  <span>Username: <strong>{resetCreds.username}</strong> | Password: <strong>{resetCreds.password}</strong></span>
                  <button onClick={() => copyText(`Username: ${resetCreds.username}\nPassword: ${resetCreds.password}`)} className="ml-auto text-muted-foreground hover:text-foreground"><Copy size={14} /></button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterAdminPage;
