
CREATE TABLE public.master_admin (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.master_admin ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  full_name text,
  role text DEFAULT 'user',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.master_admin(id)
);

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- RLS: only edge functions (service role) access these tables
CREATE POLICY "Service role only" ON public.master_admin FOR ALL USING (false);
CREATE POLICY "Service role only" ON public.app_users FOR ALL USING (false);
