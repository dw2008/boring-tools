-- Saved notes for the digitizer tool.
-- Option C storage model: markdown + figure metadata live here; the cropped
-- figure images live in the private 'note-figures' Storage bucket, referenced
-- by image_path on each figure in the `figures` JSONB array.

CREATE TABLE public.notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL,
  markdown    text NOT NULL,                       -- clean markdown; figure tokens kept as text
  figures     jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{token,caption,labels,box,image_path}]
  topic       text,
  size_bytes  bigint NOT NULL DEFAULT 0,           -- total bytes of this note's figure crops, for storage caps
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notes"
  ON public.notes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes"
  ON public.notes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes"
  ON public.notes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- List a user's notes newest-first.
CREATE INDEX notes_user_created_idx ON public.notes (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Storage: private bucket for cropped figure images.
-- Object path convention: {user_id}/{note_id}/{token}.jpg
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('note-figures', 'note-figures', false)
ON CONFLICT (id) DO NOTHING;

-- Owners (matched by the first path segment = their uid) can read/write/delete
-- their own figure objects. Reads are served via short-lived signed URLs.
CREATE POLICY "Users can read own note figures"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'note-figures'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can upload own note figures"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'note-figures'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own note figures"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'note-figures'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
