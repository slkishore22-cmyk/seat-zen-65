
-- Drop restrictive policies
DROP POLICY IF EXISTS "Service role only" ON public.master_admin;
DROP POLICY IF EXISTS "Service role only" ON public.app_users;

-- master_admin: allow SELECT only (for login verification)
CREATE POLICY "Allow select master_admin" ON public.master_admin FOR SELECT TO anon, authenticated USING (true);

-- app_users: allow all operations
CREATE POLICY "Allow select app_users" ON public.app_users FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow insert app_users" ON public.app_users FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow update app_users" ON public.app_users FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete app_users" ON public.app_users FOR DELETE TO anon, authenticated USING (true);

-- Make full_name NOT NULL
ALTER TABLE public.app_users ALTER COLUMN full_name SET NOT NULL;

-- Drop unused columns
ALTER TABLE public.app_users DROP COLUMN IF EXISTS created_by;
ALTER TABLE public.app_users DROP COLUMN IF EXISTS role;
