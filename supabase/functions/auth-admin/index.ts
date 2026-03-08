import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hash as hashPassword, verify as verifyPassword } from "https://deno.land/x/scrypt@v4.3.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Simple password hashing using Web Crypto (PBKDF2)
async function hashPw(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256
  );
  const hashArr = new Uint8Array(bits);
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, "0")).join("");
  const hashHex = Array.from(hashArr).map(b => b.toString(16).padStart(2, "0")).join("");
  return `${saltHex}:${hashHex}`;
}

async function verifyPw(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256
  );
  const computed = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, "0")).join("");
  return computed === hashHex;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { action, ...payload } = await req.json();

    // ── SETUP MASTER (one-time) ──
    if (action === "setup_master") {
      const { username, password } = payload;
      const { data: existing } = await supabase.from("master_admin").select("id").limit(1).maybeSingle();
      if (existing) return json({ error: "Master admin already exists" }, 409);
      const hash = await hashPw(password);
      const { data, error } = await supabase
        .from("master_admin")
        .insert({ username, password_hash: hash })
        .select("id, username")
        .single();
      if (error) throw error;
      return json({ admin: data });
    }

    // ── MASTER LOGIN ──
    if (action === "master_login") {
      const { username, password } = payload;
      const { data: admin, error } = await supabase
        .from("master_admin")
        .select("*")
        .eq("username", username)
        .maybeSingle();

      if (error || !admin) return json({ error: "Invalid credentials" }, 401);

      const valid = await verifyPw(password, admin.password_hash);
      if (!valid) return json({ error: "Invalid credentials" }, 401);

      return json({ id: admin.id, username: admin.username });
    }

    // ── CREATE USER ──
    if (action === "create_user") {
      const { admin_id, username, password, full_name } = payload;

      const { data: admin } = await supabase
        .from("master_admin")
        .select("id")
        .eq("id", admin_id)
        .maybeSingle();
      if (!admin) return json({ error: "Unauthorized" }, 403);

      const hash = await hashPw(password);
      const { data, error } = await supabase
        .from("app_users")
        .insert({ username, password_hash: hash, full_name, created_by: admin_id })
        .select("id, username, full_name, created_at")
        .single();

      if (error) {
        if (error.message?.includes("duplicate")) {
          return json({ error: "Username already exists" }, 409);
        }
        throw error;
      }
      return json({ user: data });
    }

    // ── LIST USERS ──
    if (action === "list_users") {
      const { data, error } = await supabase
        .from("app_users")
        .select("id, username, full_name, role, is_active, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json({ users: data });
    }

    // ── TOGGLE ACTIVE ──
    if (action === "toggle_active") {
      const { user_id, is_active } = payload;
      const { error } = await supabase
        .from("app_users")
        .update({ is_active })
        .eq("id", user_id);
      if (error) throw error;
      return json({ success: true });
    }

    // ── RESET PASSWORD ──
    if (action === "reset_password") {
      const { user_id, new_password } = payload;
      const hash = await hashPw(new_password);
      const { error } = await supabase
        .from("app_users")
        .update({ password_hash: hash })
        .eq("id", user_id);
      if (error) throw error;
      return json({ success: true });
    }

    // ── DELETE USER ──
    if (action === "delete_user") {
      const { user_id } = payload;
      const { error } = await supabase
        .from("app_users")
        .delete()
        .eq("id", user_id);
      if (error) throw error;
      return json({ success: true });
    }

    // ── USER LOGIN ──
    if (action === "user_login") {
      const { username, password } = payload;
      const { data: user, error } = await supabase
        .from("app_users")
        .select("*")
        .eq("username", username)
        .maybeSingle();

      if (error || !user) return json({ error: "Invalid credentials" }, 401);
      if (!user.is_active) return json({ error: "Account disabled. Contact your administrator." }, 403);

      const valid = await verifyPw(password, user.password_hash);
      if (!valid) return json({ error: "Invalid credentials" }, 401);

      return json({
        id: user.id,
        username: user.username,
        full_name: user.full_name,
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("auth-admin error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
