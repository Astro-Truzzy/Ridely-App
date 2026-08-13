-- =============================================================================
-- Private storage bucket for proof-of-delivery photos.
-- Riders upload to <delivery_id>/...; customer and assigned rider can read.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'delivery-proofs',
  'delivery-proofs',
  false,
  5242880,  -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Rider assigned to delivery can upload proof photos
DROP POLICY IF EXISTS "Riders can upload delivery proofs" ON storage.objects;
CREATE POLICY "Riders can upload delivery proofs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'delivery-proofs'
    AND EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id::text = (storage.foldername(name))[1]
        AND d.rider_id = auth.uid()
    )
  );

-- Customer (delivery owner) can read proof photos
DROP POLICY IF EXISTS "Customers can read delivery proofs" ON storage.objects;
CREATE POLICY "Customers can read delivery proofs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'delivery-proofs'
    AND EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id::text = (storage.foldername(name))[1]
        AND d.user_id = auth.uid()
    )
  );

-- Assigned rider can read proof photos they uploaded
DROP POLICY IF EXISTS "Riders can read delivery proofs" ON storage.objects;
CREATE POLICY "Riders can read delivery proofs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'delivery-proofs'
    AND EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id::text = (storage.foldername(name))[1]
        AND d.rider_id = auth.uid()
    )
  );
