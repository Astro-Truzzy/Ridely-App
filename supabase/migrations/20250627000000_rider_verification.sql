-- =============================================================================
-- Rider verification: account_verification_status, documents table, storage
-- Riders must be verified to accept delivery requests.
-- =============================================================================

-- 1. Enum for rider account verification (distinct from license/insurance status)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rider_account_verification_status') THEN
    CREATE TYPE rider_account_verification_status AS ENUM (
      'not_submitted',  -- no application yet
      'pending',        -- submitted, awaiting admin review
      'verified',       -- approved, can accept jobs
      'rejected'        -- admin rejected (can reapply)
    );
  END IF;
END $$;

-- 2. Document type for verification uploads (Nigeria dispatch rider docs)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rider_verification_document_type') THEN
    CREATE TYPE rider_verification_document_type AS ENUM (
      'nin',                 -- National ID (NIN slip/card)
      'guarantor_letter',    -- Guarantor's letter
      'drivers_license',    -- Driver's license
      'vehicle_registration',
      'other'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rider_document_review_status') THEN
    CREATE TYPE rider_document_review_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

-- 3. Add account_verification_status to riders (default: not_submitted)
ALTER TABLE public.riders
  ADD COLUMN IF NOT EXISTS account_verification_status rider_account_verification_status
  DEFAULT 'not_submitted';

-- 4. Table: rider_verification_documents (admin reviews these later)
CREATE TABLE IF NOT EXISTS public.rider_verification_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL REFERENCES public.riders(id) ON DELETE CASCADE,
  document_type rider_verification_document_type NOT NULL,
  file_path text NOT NULL,
  file_name text,
  review_status rider_document_review_status DEFAULT 'pending',
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rider_verification_documents_rider_id
  ON public.rider_verification_documents(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_verification_documents_review_status
  ON public.rider_verification_documents(review_status);

ALTER TABLE public.rider_verification_documents ENABLE ROW LEVEL SECURITY;

-- Riders: insert/select/update own documents only
DROP POLICY IF EXISTS "Riders can insert own verification documents" ON public.rider_verification_documents;
CREATE POLICY "Riders can insert own verification documents" ON public.rider_verification_documents
  FOR INSERT TO authenticated WITH CHECK (rider_id = auth.uid());

DROP POLICY IF EXISTS "Riders can read own verification documents" ON public.rider_verification_documents;
CREATE POLICY "Riders can read own verification documents" ON public.rider_verification_documents
  FOR SELECT TO authenticated USING (rider_id = auth.uid());

DROP POLICY IF EXISTS "Riders can update own verification documents (pending only)" ON public.rider_verification_documents;
CREATE POLICY "Riders can update own verification documents (pending only)" ON public.rider_verification_documents
  FOR UPDATE TO authenticated USING (rider_id = auth.uid() AND review_status = 'pending')
  WITH CHECK (rider_id = auth.uid());

-- Admin will use service role or a separate policy when admin dashboard exists; no policy here for admin.

DROP TRIGGER IF EXISTS trigger_rider_verification_documents_updated_at ON public.rider_verification_documents;
CREATE TRIGGER trigger_rider_verification_documents_updated_at
  BEFORE UPDATE ON public.rider_verification_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Storage bucket: create via SQL (Supabase creates bucket with same name if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'rider-verification-docs',
  'rider-verification-docs',
  false,
  10485760,  -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policy: riders can upload to their own folder only
DROP POLICY IF EXISTS "Riders can upload own verification docs" ON storage.objects;
CREATE POLICY "Riders can upload own verification docs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'rider-verification-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Riders can read own verification docs" ON storage.objects;
CREATE POLICY "Riders can read own verification docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'rider-verification-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Riders can update own verification docs" ON storage.objects;
CREATE POLICY "Riders can update own verification docs" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'rider-verification-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
