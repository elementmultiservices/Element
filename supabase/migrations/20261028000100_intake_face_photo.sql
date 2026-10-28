-- Element — face photo on the intake form. After signing, the taxpayer takes
-- (or uploads) a photo of their face; the browser checks that it shows one
-- face before the form can be submitted. The JPEG is stored next to the
-- signatures (intake/<owner>/<submission>/face.jpg). Forms submitted before
-- this change have none.

alter table public.intake_submissions
  add column if not exists face_photo_path text;
