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

-- ========================================================================
-- Optional location on a post. `location` is the human-readable place label
-- the author types; latitude/longitude are set when they drop a pin so other
-- users can open it on a map. All nullable — posts without a location are fine.
-- Safe to re-run.
-- ========================================================================
alter table athlete_posts add column if not exists location  text;
alter table athlete_posts add column if not exists latitude  double precision;
alter table athlete_posts add column if not exists longitude double precision;

-- ========================================================================
-- Unique usernames, case-insensitive. Two accounts can't share a username
-- regardless of casing ("Alex" == "alex"). NULL usernames are allowed and don't
-- collide (Postgres treats NULLs as distinct in a unique index).
--
-- IMPORTANT: if duplicate usernames already exist, creating this index FAILS —
-- resolve the duplicates first, e.g.:
--   select lower(username), count(*) from profiles
--   where username is not null group by 1 having count(*) > 1;
-- The app also enforces this (signup + edit profile), but the DB index is the
-- real guarantee against races. Safe to re-run.
-- ========================================================================
create unique index if not exists profiles_username_lower_unique
  on profiles (lower(username));
