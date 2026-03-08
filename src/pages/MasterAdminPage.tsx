import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import bcrypt from "bcryptjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LogOut, Copy, RotateCcw, Trash2, UserPlus, Shield, ChevronRight, ArrowLeft, Calendar, Users } from "lucide-react";

interface AppUser {
  id: string;
  username: string;
  full_name: string;
  is_active: boolean;
  created_at: string | null;
  session_count?: number;
}

interface UserSession {
  id: string;
  exam_name: string;
  created_at: string;
  total_students: number;
  shuffle_type: string;
}

const SALT_ROUNDS = 10;

// ─── Login Form ──────────────────────────────────────────
function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data, error: dbErr } = await supabase
        .from("master_admin")
        .select("password_hash")
        .eq("username", username.trim())
        .maybeSingle();
      if (dbErr) throw dbErr;
      if (!data) { setError("Invalid credentials."); return; }
      const match = bcrypt.compareSync(password, data.password_hash);
      if (!match) { setError("Invalid credentials."); return; }
      localStorage.setItem("master_session", JSON.stringify({ username: username.trim(), ts: Date.now() }));
      onLogin();
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <Card className="w-full max-w-md border-border/40 bg-card">
        <CardHeader className="text-center space-y-1">
          <div className="mx-auto mb-2 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Master Admin</CardTitle>
          <CardDescription>Restricted Access</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
            </div>
            {error && <p className="text-sm text-destructive font-medium">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Logging in…" : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Copyable Credentials Box ────────────────────────────
function CredentialsBox({ username, password }: { username: string; password: string }) {
  const text = `Username: ${username}\nPassword: ${password}`;
  const copy = () => { navigator.clipboard.writeText(text); toast.success("Copied to clipboard"); };
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 mt-4 space-y-2">
      <p className="text-sm font-medium text-primary">✓ User Created Successfully</p>
      <pre className="text-sm whitespace-pre-wrap font-mono text-foreground">{text}</pre>
      <Button size="sm" variant="outline" onClick={copy}><Copy className="w-3.5 h-3.5 mr-1.5" />Copy and share with user</Button>
    </div>
  );
}

// ─── Create User Section ─────────────────────────────────
function CreateUserSection({ onCreated }: { onCreated: () => void }) {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreated(null);
    if (password !== confirmPassword) { toast.error("Passwords do not match"); return; }
    if (password.length < 4) { toast.error("Password too short"); return; }
    setLoading(true);
    try {
      const { data: existing } = await supabase
        .from("app_users")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      if (existing) { toast.error("Username already taken"); return; }
      const hash = bcrypt.hashSync(password, SALT_ROUNDS);
      const { error } = await supabase.from("app_users").insert({
        full_name: fullName.trim(),
        username,
        password_hash: hash,
      });
      if (error) throw error;
      setCreated({ username, password });
      setFullName(""); setUsername(""); setPassword(""); setConfirmPassword("");
      onCreated();
    } catch {
      toast.error("Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><UserPlus className="w-5 h-5" />Create New User</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Username</Label>
            <Input value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))} required />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Confirm Password</Label>
            <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={loading}>{loading ? "Creating…" : "Create User"}</Button>
          </div>
        </form>
        {created && <CredentialsBox username={created.username} password={created.password} />}
      </CardContent>
    </Card>
  );
}

// ─── User Sessions View ──────────────────────────────────
function UserSessionsView({ user, onBack }: { user: AppUser; onBack: () => void }) {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("exam_sessions")
      .select("id, exam_name, created_at, total_students, shuffle_type")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setSessions((data as UserSession[]) || []); setLoading(false); });
  }, [user.id]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4" /></Button>
          <CardTitle className="text-lg">{user.full_name}'s Sessions</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No sessions found for this user.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Exam Name</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.exam_name || "Untitled"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{s.total_students}</TableCell>
                  <TableCell className="text-sm">{s.shuffle_type}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Users Table Section ─────────────────────────────────
function UsersTableSection({ users, onRefresh, onViewSessions }: { users: AppUser[]; onRefresh: () => void; onViewSessions: (user: AppUser) => void }) {
  const [resetUser, setResetUser] = useState<AppUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<AppUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetResult, setResetResult] = useState<{ username: string; password: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleActive = async (user: AppUser) => {
    const { error } = await supabase.from("app_users").update({ is_active: !user.is_active }).eq("id", user.id);
    if (error) toast.error("Failed to update"); else onRefresh();
  };

  const handleResetPassword = async () => {
    if (!resetUser || newPassword.length < 4) { toast.error("Password too short"); return; }
    setLoading(true);
    const hash = bcrypt.hashSync(newPassword, SALT_ROUNDS);
    const { error } = await supabase.from("app_users").update({ password_hash: hash }).eq("id", resetUser.id);
    setLoading(false);
    if (error) { toast.error("Failed to reset password"); return; }
    setResetResult({ username: resetUser.username, password: newPassword });
    setNewPassword("");
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    const { error } = await supabase.from("app_users").delete().eq("id", deleteUser.id);
    if (error) toast.error("Failed to delete"); else { toast.success("User deleted"); onRefresh(); }
    setDeleteUser(null);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Users</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {users.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">No users yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name}</TableCell>
                    <TableCell className="font-mono text-sm">{u.username}</TableCell>
                    <TableCell>
                      <button
                        onClick={() => onViewSessions(u)}
                        className="flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        {u.session_count ?? 0} sessions <ChevronRight className="w-3 h-3" />
                      </button>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch checked={u.is_active ?? true} onCheckedChange={() => toggleActive(u)} />
                        <span className={`text-xs font-medium ${u.is_active ? "text-green-500" : "text-destructive"}`}>
                          {u.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="outline" onClick={() => { setResetUser(u); setResetResult(null); setNewPassword(""); }}>
                        <RotateCcw className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeleteUser(u)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!resetUser} onOpenChange={open => { if (!open) setResetUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>Set a new password for <span className="font-semibold">{resetUser?.username}</span></DialogDescription>
          </DialogHeader>
          {!resetResult ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>
              <Button onClick={handleResetPassword} disabled={loading}>{loading ? "Resetting…" : "Reset Password"}</Button>
            </div>
          ) : (
            <CredentialsBox username={resetResult.username} password={resetResult.password} />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteUser} onOpenChange={open => { if (!open) setDeleteUser(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold">{deleteUser?.username}</span>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Dashboard ───────────────────────────────────────────
function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [viewingUser, setViewingUser] = useState<AppUser | null>(null);

  const fetchUsers = useCallback(async () => {
    const { data: usersData } = await supabase
      .from("app_users")
      .select("id, username, full_name, is_active, created_at")
      .order("created_at", { ascending: false });
    if (!usersData) { setUsers([]); return; }

    // Fetch session counts for all users
    const { data: sessionCounts } = await supabase
      .from("exam_sessions")
      .select("user_id");

    const countMap: Record<string, number> = {};
    if (sessionCounts) {
      for (const row of sessionCounts) {
        if (row.user_id) countMap[row.user_id] = (countMap[row.user_id] || 0) + 1;
      }
    }

    setUsers(usersData.map(u => ({ ...u, session_count: countMap[u.id] || 0 })) as AppUser[]);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleLogout = () => {
    localStorage.removeItem("master_session");
    onLogout();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <h1 className="text-base font-semibold">Master Admin Dashboard</h1>
          <Button variant="ghost" size="sm" onClick={handleLogout}><LogOut className="w-4 h-4 mr-1.5" />Logout</Button>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <CreateUserSection onCreated={fetchUsers} />
        {viewingUser ? (
          <UserSessionsView user={viewingUser} onBack={() => setViewingUser(null)} />
        ) : (
          <UsersTableSection users={users} onRefresh={fetchUsers} onViewSessions={setViewingUser} />
        )}
      </main>
    </div>
  );
}

// ─── Page Root ───────────────────────────────────────────
export default function MasterAdminPage() {
  const [loggedIn, setLoggedIn] = useState(() => !!localStorage.getItem("master_session"));
  if (loggedIn) return <Dashboard onLogout={() => setLoggedIn(false)} />;
  return <LoginForm onLogin={() => setLoggedIn(true)} />;
}
