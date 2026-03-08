
CREATE TABLE public.exam_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  exam_name text,
  shuffle_type text,
  rooms jsonb,
  groups jsonb,
  total_students integer
);

ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select" ON public.exam_sessions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow all insert" ON public.exam_sessions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow all update" ON public.exam_sessions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all delete" ON public.exam_sessions FOR DELETE TO anon, authenticated USING (true);
