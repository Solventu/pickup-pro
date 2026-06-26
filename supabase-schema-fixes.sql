-- ========================================================================
-- PickupPro — schema fixes
-- Run in the Supabase SQL editor ONLY IF text-only posts (no image) fail to
-- save. A NOT NULL constraint on athlete_posts.image_url (or other optional
-- columns) blocks text-only posts from being inserted, which makes the feed
-- appear to "only show posts with an image".
-- These statements are no-ops if the columns are already nullable.
-- ========================================================================

alter table athlete_posts alter column image_url   drop not null;
alter table athlete_posts alter column title        drop not null;
alter table athlete_posts alter column sport        drop not null;
alter table athlete_posts alter column event_id     drop not null;
alter table athlete_posts alter column description  drop not null;

-- ========================================================================
-- Cascade: deleting an athlete_post removes its likes + comments.
-- Required so post deletion (self-delete AND admin moderation via
-- /api/admin/delete-post) cleans up child rows automatically — especially on the
-- RLS fallback path, where the route can't delete other users' likes/comments
-- directly. Safe to re-run. The drop lines use Postgres' default FK names
-- (<table>_<column>_fkey); adjust if your constraints were named differently.
-- ========================================================================
alter table post_likes    drop constraint if exists post_likes_post_id_fkey;
alter table post_likes    add  constraint post_likes_post_id_fkey
  foreign key (post_id) references athlete_posts(id) on delete cascade;

alter table post_comments drop constraint if exists post_comments_post_id_fkey;
alter table post_comments add  constraint post_comments_post_id_fkey
  foreign key (post_id) references athlete_posts(id) on delete cascade;
