-- =============================================================================
-- Per-delivery chat between the customer and the assigned rider.
-- - delivery_messages: text and/or photo messages, RLS restricted to the two
--   participants of the delivery.
-- - chat-attachments: private storage bucket for photo messages, scoped per
--   delivery (path: <delivery_id>/<filename>).
-- - Realtime replication so both sides receive messages instantly.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.delivery_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('user', 'rider')),
  content text,
  image_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  CONSTRAINT delivery_messages_has_body CHECK (
    content IS NOT NULL OR image_path IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS delivery_messages_delivery_id_created_at_idx
  ON public.delivery_messages (delivery_id, created_at);

ALTER TABLE public.delivery_messages ENABLE ROW LEVEL SECURITY;

-- Both participants (customer or assigned rider) can read the thread.
DROP POLICY IF EXISTS "Participants can read delivery messages" ON public.delivery_messages;
CREATE POLICY "Participants can read delivery messages" ON public.delivery_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = delivery_id
        AND (d.user_id = auth.uid() OR d.rider_id = auth.uid())
    )
  );

-- Participants can send messages as themselves.
DROP POLICY IF EXISTS "Participants can send delivery messages" ON public.delivery_messages;
CREATE POLICY "Participants can send delivery messages" ON public.delivery_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = delivery_id
        AND (
          (sender_type = 'user' AND d.user_id = auth.uid())
          OR (sender_type = 'rider' AND d.rider_id = auth.uid())
        )
    )
  );

-- Recipients can mark messages as read. Column guard below allows only read_at.
DROP POLICY IF EXISTS "Participants can mark messages read" ON public.delivery_messages;
CREATE POLICY "Participants can mark messages read" ON public.delivery_messages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = delivery_id
        AND (d.user_id = auth.uid() OR d.rider_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = delivery_id
        AND (d.user_id = auth.uid() OR d.rider_id = auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.protect_delivery_message_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.delivery_id IS DISTINCT FROM OLD.delivery_id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.sender_type IS DISTINCT FROM OLD.sender_type
     OR NEW.content IS DISTINCT FROM OLD.content
     OR NEW.image_path IS DISTINCT FROM OLD.image_path
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Only read_at may be updated on delivery messages'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_protect_delivery_message_columns ON public.delivery_messages;
CREATE TRIGGER trigger_protect_delivery_message_columns
  BEFORE UPDATE ON public.delivery_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_delivery_message_columns();

-- Realtime replication for instant message delivery.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'delivery_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_messages;
  END IF;
END $$;

ALTER TABLE public.delivery_messages REPLICA IDENTITY FULL;

-- ---------------------------------------------------------------------------
-- Private bucket for chat photo attachments (path: <delivery_id>/<file>).
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  false,
  5242880,  -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Participants can upload chat attachments" ON storage.objects;
CREATE POLICY "Participants can upload chat attachments" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id::text = (storage.foldername(name))[1]
        AND (d.user_id = auth.uid() OR d.rider_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Participants can read chat attachments" ON storage.objects;
CREATE POLICY "Participants can read chat attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id::text = (storage.foldername(name))[1]
        AND (d.user_id = auth.uid() OR d.rider_id = auth.uid())
    )
  );
