-- Notebooks: a user-defined label for organizing saved notes.
-- Notebooks are the distinct labels per user (no separate table); a notebook
-- "exists" once it has at least one note. Default keeps existing rows valid.

ALTER TABLE public.notes
  ADD COLUMN notebook text NOT NULL DEFAULT 'Unsorted';

-- Supports filtering a user's notes by notebook.
CREATE INDEX notes_user_notebook_idx ON public.notes (user_id, notebook);

-- Allow owners to update their own notes (e.g. moving a note to a notebook).
-- The original notes migration only granted SELECT / INSERT / DELETE.
CREATE POLICY "Users can update own notes"
  ON public.notes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
