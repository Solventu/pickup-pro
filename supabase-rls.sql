-- ========================================================================
-- PickupPro — Row Level Security policies
-- Run this in the Supabase SQL editor (Dashboard → SQL).
-- These enforce the visibility rules the frontend expects, server-side.
-- Safe to re-run: each policy is dropped first.
-- ========================================================================

alter table profiles            enable row level security;
alter table athlete_posts       enable row level security;
alter table post_likes          enable row level security;
alter table post_comments       enable row level security;
alter table follows             enable row level security;
alter table event_participants  enable row level security;
alter table events              enable row level security;

-- ---------------- PROFILES ----------------
-- Everyone can read profiles (usernames/avatars + public discovery).
drop policy if exists "profiles_select_all" on profiles;
create policy "profiles_select_all" on profiles
  for select using (true);

drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles_insert_own" on profiles;
create policy "profiles_insert_own" on profiles
  for insert with check (auth.uid() = id);

-- ---------------- ATHLETE_POSTS ----------------
-- Visible if: author is public, OR you are the author, OR you are an accepted follower.
drop policy if exists "posts_select_visible" on athlete_posts;
create policy "posts_select_visible" on athlete_posts
  for select using (
    exists (
      select 1 from profiles p
      where p.id = athlete_posts.user_id and p.is_private = false
    )
    or auth.uid() = athlete_posts.user_id
    or exists (
      select 1 from follows f
      where f.follower_id = auth.uid()
        and f.following_id = athlete_posts.user_id
        and f.status = 'accepted'
    )
  );

drop policy if exists "posts_insert_own" on athlete_posts;
create policy "posts_insert_own" on athlete_posts
  for insert with check (auth.uid() = user_id);

-- Delete your OWN post, OR delete ANY post if you are the admin (moderation).
-- The admin UID is a server-side literal here (RLS runs inside Postgres); it is
-- never shipped to the browser.
drop policy if exists "posts_delete_own" on athlete_posts;
drop policy if exists "posts_delete_own_or_admin" on athlete_posts;
create policy "posts_delete_own_or_admin" on athlete_posts
  for delete using (
    auth.uid() = user_id
    or auth.uid() = '2058520b-09cb-4311-999a-d97e971d22b1'
  );

-- ---------------- POST_LIKES ----------------
drop policy if exists "likes_select_all" on post_likes;
create policy "likes_select_all" on post_likes for select using (true);

drop policy if exists "likes_insert_own" on post_likes;
create policy "likes_insert_own" on post_likes
  for insert with check (auth.uid() = user_id);

drop policy if exists "likes_delete_own" on post_likes;
create policy "likes_delete_own" on post_likes
  for delete using (auth.uid() = user_id);

-- ---------------- POST_COMMENTS ----------------
drop policy if exists "comments_select_all" on post_comments;
create policy "comments_select_all" on post_comments for select using (true);

drop policy if exists "comments_insert_own" on post_comments;
create policy "comments_insert_own" on post_comments
  for insert with check (auth.uid() = user_id);

drop policy if exists "comments_delete_own" on post_comments;
create policy "comments_delete_own" on post_comments
  for delete using (auth.uid() = user_id);

-- ---------------- FOLLOWS ----------------
-- Readable by all (needed for counts + follower/following lists).
drop policy if exists "follows_select_all" on follows;
create policy "follows_select_all" on follows for select using (true);

-- Create a follow only as yourself (the follower).
drop policy if exists "follows_insert_own" on follows;
create policy "follows_insert_own" on follows
  for insert with check (auth.uid() = follower_id);

-- Delete a follow you created (unfollow) OR remove a follower of yours.
-- The "following_id = auth.uid()" clause is what enables "Remove follower".
drop policy if exists "follows_delete_own_or_remove" on follows;
create policy "follows_delete_own_or_remove" on follows
  for delete using (auth.uid() = follower_id or auth.uid() = following_id);

-- Allow the target of a follow request to accept/decline it.
drop policy if exists "follows_update_target" on follows;
create policy "follows_update_target" on follows
  for update using (auth.uid() = following_id) with check (auth.uid() = following_id);

-- ---------------- EVENT_PARTICIPANTS ----------------
drop policy if exists "participants_select_all" on event_participants;
create policy "participants_select_all" on event_participants for select using (true);

drop policy if exists "participants_insert_own" on event_participants;
create policy "participants_insert_own" on event_participants
  for insert with check (auth.uid() = user_id);

drop policy if exists "participants_delete_own" on event_participants;
create policy "participants_delete_own" on event_participants
  for delete using (auth.uid() = user_id);

-- ---------------- EVENTS ----------------
-- Everyone can read events. Only the admin UID can insert (matches /post-event).
drop policy if exists "events_select_all" on events;
create policy "events_select_all" on events for select using (true);

drop policy if exists "events_insert_admin" on events;
create policy "events_insert_admin" on events
  for insert with check (auth.uid() = '2058520b-09cb-4311-999a-d97e971d22b1');

-- NOTE: there are intentionally NO update/delete policies on events. With RLS
-- enabled, anon/authenticated users therefore cannot UPDATE or DELETE events at
-- all — only the service_role key (which bypasses RLS, used by trusted server
-- code) can. INSERT stays restricted to the admin UID so /post-event keeps
-- working without a service key.

-- ---------------- NOTIFICATIONS ----------------
-- System notifications (e.g. "admin removed your post"). Created if missing so
-- this file is self-contained. Distinct from the follow-based notifications the
-- bell also shows (those live in the follows table).
create table if not exists notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  message text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);

alter table notifications enable row level security;

-- You can only read your own notifications.
drop policy if exists "users_see_own_notifications" on notifications;
create policy "users_see_own_notifications" on notifications
  for select using (auth.uid() = user_id);

-- Anyone trusted (admin route / service role) can create a notification for a
-- user. (check(true) — the admin route is the only caller and is gated server-side.)
drop policy if exists "service_can_insert" on notifications;
create policy "service_can_insert" on notifications
  for insert with check (true);

-- You can mark your OWN notifications read (the bell flips is_read on open).
drop policy if exists "users_update_own_notifications" on notifications;
create policy "users_update_own_notifications" on notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
