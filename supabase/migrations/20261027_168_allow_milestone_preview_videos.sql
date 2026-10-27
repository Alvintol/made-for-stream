-- Milestone previews can be videos as well as images (decided 2026-10-27),
-- so a creator can show work that moves: an animation, a rig, a turnaround.
--
-- The website plays the creator's video or animated GIF in their browser,
-- draws the same "Made for Stream · @handle" watermark on every frame and
-- records a new clip of at most 30 seconds, without sound
-- (src/lib/listings/milestonePreviewVideo.ts). Only that recording is
-- uploaded, as WebM, or MP4 from Safari. The original never leaves the
-- creator's device, as with preview images (20261011_154).
--
-- Only the bucket changes: it accepts the two video types, and each file may
-- be up to 20 MB (a 30-second recording is about 9 MB). Everything else
-- stays as 20261011_154 set it: private, uploads only by the milestone's
-- creator into its folder, no swapping or deleting, at most 6 previews per
-- submission, deleted 180 days after the commission closes (20261012_159).

update storage.buckets
set file_size_limit = 20971520, -- 20 MB
    allowed_mime_types = array['image/webp', 'image/jpeg', 'video/webm', 'video/mp4']
where id = 'milestone-previews';
