-- A listing's animated preview may now be a short video as well as a GIF.
--
-- Only the bucket's accepted types change. The size cap (8 MB), the
-- per-creator folder policies and the rule on listings.animated_preview_url
-- from 20261006_144 already cover any file in this bucket.
--
-- Like GIFs, videos are stored exactly as uploaded: not re-encoded and not
-- watermarked. The page plays them once, muted, with the file's address
-- hidden and saving blocked, which deters casual copying only.
--
-- Note: the database message for a preview outside the creator's folder
-- still reads "must be a GIF uploaded to Made for Stream" for videos too.

update storage.buckets
   set allowed_mime_types = array['image/gif', 'video/mp4', 'video/webm']
 where id = 'listing-animations';
