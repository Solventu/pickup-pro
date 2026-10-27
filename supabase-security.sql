-- ========================================================================
-- PickupPro — security hardening
-- Run in the Supabase SQL editor AFTER supabase-rls.sql and
-- supabase-schema-fixes.sql. Safe to re-run.
--
-- What it fixes:
--   1. Private accounts: nobody can follow themselves into "accepted" status.
--   2. Likes and comments on private posts are no longer readable by everyone.
--   3. Size / format limits enforced in the database, not only in the browser.
--   4. Event sign-ups: no joining past or full events.
--   5. Storage: users can only upload / change / delete files in their own folder.
--   6. (Optional, section 6) posts can only be created through /api/posts,
--      so AI moderation cannot be skipped.
-- ========================================================================


-- ---------------- 1. FOLLOWS ----------------
-- Before: the browser chose the status, so anyone could insert
-- status = 'accepted' for a PRIVATE account and read its posts.
-- Now: 'accepted' is only allowed when the target account is public.
drop policy if exists "follows_insert_own" on follows;
create policy "follows_insert_own" on follows
  for insert with check (
    auth.uid() = follower_id
    and follower_id <> following_id
    and (
      status = 'pending'
      or (
        status = 'accepted'
        and exists (
          select 1 from profiles p
          where p.id = following_id and p.is_private = false
        )
      )
    )
  );

-- The target of a request may only ACCEPT it, and may only change the status
-- column (not who follows whom).
drop policy if exists "follows_update_target" on follows;
create policy "follows_update_target" on follows
  for update using (auth.uid() = following_id)
  with check (auth.uid() = following_id and status = 'accepted');

revoke update on follows from anon, authenticated;
grant update (status) on follows to authenticated;


-- ---------------- 2. LIKES & COMMENTS VISIBILITY ----------------
-- Before: select using (true) exposed every like and every comment, including
-- comments on posts from private accounts. Now you can only see likes and
-- comments of posts you are allowed to see (the athlete_posts policy applies
-- inside the subquery).
drop policy if exists "likes_select_all" on post_likes;
drop policy if exists "likes_select_visible" on post_likes;
create policy "likes_select_visible" on post_likes
  for select using (
    exists (select 1 from athlete_posts p where p.id = post_likes.post_id)
  );

drop policy if exists "likes_insert_own" on post_likes;
create policy "likes_insert_own" on post_likes
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from athlete_posts p where p.id = post_likes.post_id)
  );

drop policy if exists "comments_select_all" on post_comments;
drop policy if exists "comments_select_visible" on post_comments;
create policy "comments_select_visible" on post_comments
  for select using (
    exists (select 1 from athlete_posts p where p.id = post_comments.post_id)
  );

drop policy if exists "comments_insert_own" on post_comments;
create policy "comments_insert_own" on post_comments
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from athlete_posts p where p.id = post_comments.post_id)
  );

-- One like per user per post (stops like-count inflation). If duplicates
-- already exist the index is skipped with a notice instead of failing the script.
do $$ begin
  create unique index if not exists post_likes_one_per_user
    on post_likes (post_id, user_id);
exception when unique_violation then
  raise notice 'post_likes has duplicate likes; remove them, then re-run this script';
end $$;


-- ---------------- 3. DATABASE-LEVEL LIMITS ----------------
-- The browser already trims and limits text, but anyone with the public anon
-- key can call the database directly. These checks are the real guarantee.
-- NOT VALID = existing rows are not checked, only new / changed ones.

alter table athlete_posts drop constraint if exists athlete_posts_description_len;
alter table athlete_posts add constraint athlete_posts_description_len
  check (description is null or char_length(description) <= 500) not valid;

alter table athlete_posts drop constraint if exists athlete_posts_location_len;
alter table athlete_posts add constraint athlete_posts_location_len
  check (location is null or char_length(location) <= 120) not valid;

alter table athlete_posts drop constraint if exists athlete_posts_coords_range;
alter table athlete_posts add constraint athlete_posts_coords_range
  check (
    (latitude is null or latitude between -90 and 90)
    and (longitude is null or longitude between -180 and 180)
  ) not valid;

alter table post_comments drop constraint if exists post_comments_content_len;
alter table post_comments add constraint post_comments_content_len
  check (char_length(content) between 1 and 500) not valid;

alter table profiles drop constraint if exists profiles_username_format;
alter table profiles add constraint profiles_username_format
  check (username is null or username ~ '^[A-Za-z0-9_]{3,20}$') not valid;

alter table profiles drop constraint if exists profiles_bio_len;
alter table profiles add constraint profiles_bio_len
  check (bio is null or char_length(bio) <= 160) not valid;

alter table profiles drop constraint if exists profiles_location_len;
alter table profiles add constraint profiles_location_len
  check (location is null or char_length(location) <= 120) not valid;

-- Avatars must be https links (blocks javascript:/data: tricks).
alter table profiles drop constraint if exists profiles_avatar_https;
alter table profiles add constraint profiles_avatar_https
  check (avatar_url is null or avatar_url like 'https://%') not valid;

-- Event registration links must be https/http.
alter table events drop constraint if exists events_source_url_http;
alter table events add constraint events_source_url_http
  check (source_url is null or source_url ~* '^https?://') not valid;


-- ---------------- 4. EVENT SIGN-UPS ----------------
-- One sign-up per user per event.
do $$ begin
  create unique index if not exists event_participants_one_per_user
    on event_participants (event_id, user_id);
exception when unique_violation then
  raise notice 'event_participants has duplicate sign-ups; remove them, then re-run this script';
end $$;

-- Block joining events that are in the past or already full. Runs inside the
-- database, so it also applies to direct API calls.
create or replace function public.check_event_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
  taken integer;
begin
  select date, max_players into ev from events where id = new.event_id for update;
  if not found then
    raise exception 'Event not found';
  end if;
  if ev.date < current_date then
    raise exception 'This event has already taken place';
  end if;
  if ev.max_players is not null then
    select count(*) into taken from event_participants where event_id = new.event_id;
    if taken >= ev.max_players then
      raise exception 'This event is full';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists event_participants_check_join on event_participants;
create trigger event_participants_check_join
  before insert on event_participants
  for each row execute function public.check_event_join();


-- ---------------- 5. STORAGE (post-images bucket) ----------------
-- Images are public to read, but each user may only write inside the folder
-- named after their own user id (the app already uploads to "<user id>/...").
-- Also limit the bucket to images of at most 5 MB.
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'post-images';

drop policy if exists "post_images_insert_own_folder" on storage.objects;
create policy "post_images_insert_own_folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "post_images_update_own_folder" on storage.objects;
create policy "post_images_update_own_folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "post_images_delete_own_folder" on storage.objects;
create policy "post_images_delete_own_folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- NOTE: check Dashboard → Storage → Policies for older, broader policies on
-- this bucket (for example "allow all authenticated uploads") and delete them,
-- otherwise they still allow writing anywhere.


-- ---------------- 6. OPTIONAL: SERVER-ONLY POST CREATION ----------------
-- Only run this AFTER you have set SUPABASE_SERVICE_ROLE_KEY in your hosting
-- environment variables (Vercel / Cloudflare) and redeployed. Then posts can
-- only be created through /api/posts, which runs AI moderation on the server.
-- Without the key, creating posts will stop working.
--
-- drop policy if exists "posts_insert_own" on athlete_posts;
