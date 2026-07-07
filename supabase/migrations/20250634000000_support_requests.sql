-- Support requests table for contact form submissions (rider and user apps)
CREATE TABLE IF NOT EXISTS public.support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_type text NOT NULL DEFAULT 'rider',
  message text NOT NULL,
  category text DEFAULT 'general',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_requests_user_id ON public.support_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_support_requests_created_at ON public.support_requests(created_at DESC);

ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own support request only
DROP POLICY IF EXISTS "Users can insert own support request" ON public.support_requests;
CREATE POLICY "Users can insert own support request" ON public.support_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- No SELECT for regular users (admin could use service role to read)
-- So we do not grant SELECT to authenticated; only service role can read.
