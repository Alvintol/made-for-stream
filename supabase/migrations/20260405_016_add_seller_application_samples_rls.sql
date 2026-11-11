-- Emptied 2026-11-11 so the chain replays on an empty database (prod).
--
-- This file's policies used seller_applications.user_id, a column that never
-- existed (the column is profile_user_id), so it never applied on dev: none
-- of its policies are there. 20260410_019 creates the policies dev actually
-- has. The original text is in git history.
select 1;
