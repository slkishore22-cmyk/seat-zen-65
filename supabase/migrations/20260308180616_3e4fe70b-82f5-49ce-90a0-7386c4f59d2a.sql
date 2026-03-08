
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.gen_bcrypt_hash(plain_password text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT crypt(plain_password, gen_salt('bf', 10));
$$;
