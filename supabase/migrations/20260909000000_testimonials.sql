-- Public testimonials: a moderated wall of member stories at /testimonials, and the
-- anonymous submit form at /testimonials/share.
--
-- Two deliberate shapes here:
--   * Photos are uploaded to Supabase Storage; video is NOT. Members paste a Google
--     Drive share link and we keep only the file id, never their URL. Everything the
--     page renders into an <img>/<iframe> src is rebuilt by us from that id, so a
--     submitted link can never become an arbitrary embed on gutguard.ph.
--   * Nothing is public until a human approves it. list_testimonials reads approved
--     rows only and never returns the submitter's email.

create table if not exists doctors.testimonials (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  -- Contact only, for consent follow-up. Never returned by the public read.
  email text not null,
  role_line text not null default '',
  story text not null,
  avatar_path text,
  photo_paths text[] not null default '{}',
  -- A Google Drive file id, not a URL. The check constraint is the real guard: even a
  -- caller that bypasses the form cannot land anything but an id here.
  video_file_id text,
  consent boolean not null,
  status text not null default 'pending',
  featured boolean not null default false,
  review_note text not null default '',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint testimonials_status_check check (status in ('pending', 'approved', 'rejected')),
  constraint testimonials_consent_check check (consent),
  constraint testimonials_video_id_check
    check (video_file_id is null or video_file_id ~ '^[A-Za-z0-9_-]{20,200}$'),
  constraint testimonials_avatar_path_check
    check (avatar_path is null or avatar_path ~ '^[A-Za-z0-9/_-]+\.(jpg|jpeg|png|webp)$')
);

-- Serves the public read directly: approved rows, featured first, newest first.
create index if not exists testimonials_public_idx
  on doctors.testimonials (status, featured desc, created_at desc);

create index if not exists testimonials_email_idx
  on doctors.testimonials (email, created_at desc);

-- No policies on purpose. Every read and write goes through the security-definer
-- functions below, so the anon key can submit but can never see a pending row.
alter table doctors.testimonials enable row level security;

-- --- Submit -------------------------------------------------------------------

create or replace function doctors.submit_testimonial(
  p_display_name text,
  p_email text,
  p_role_line text,
  p_story text,
  p_avatar_path text,
  p_photo_paths text[],
  p_video_file_id text,
  p_consent boolean
)
returns uuid
language plpgsql
security definer
set search_path = doctors, public
as $$
declare
  v_name text := trim(coalesce(p_display_name, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_role text := trim(coalesce(p_role_line, ''));
  v_story text := trim(coalesce(p_story, ''));
  v_photos text[] := coalesce(p_photo_paths, '{}');
  v_id uuid;
  v_path text;
begin
  -- The form validates all of this too, but that is for the member's benefit. This is
  -- the copy that actually holds, because anyone can call the RPC with the anon key.
  if p_consent is not true then
    raise exception 'Consent is required to publish a story.';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'Name must be between 2 and 80 characters.';
  end if;

  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'A valid email address is required.';
  end if;

  if char_length(v_role) > 80 then
    raise exception 'Location or role must be 80 characters or fewer.';
  end if;

  if char_length(v_story) < 40 or char_length(v_story) > 1500 then
    raise exception 'Your story must be between 40 and 1500 characters.';
  end if;

  if coalesce(array_length(v_photos, 1), 0) > 4 then
    raise exception 'Up to 4 photos may be attached.';
  end if;

  foreach v_path in array v_photos loop
    if v_path !~ '^[A-Za-z0-9/_-]+\.(jpg|jpeg|png|webp)$' then
      raise exception 'Unsupported photo attachment.';
    end if;
  end loop;

  -- ponytail: crude per-address throttle, enough to stop a bored visitor filling the
  -- moderation queue. Swap for a captcha or an edge rate limiter if it is ever abused
  -- at scale, since nothing here stops someone cycling addresses.
  if (
    select count(*)
    from doctors.testimonials
    where email = v_email
      and status = 'pending'
      and created_at > now() - interval '24 hours'
  ) >= 3 then
    raise exception 'You already have stories awaiting review. Please give us a day to read them.';
  end if;

  insert into doctors.testimonials (
    display_name, email, role_line, story,
    avatar_path, photo_paths, video_file_id, consent
  )
  values (
    v_name, v_email, v_role, v_story,
    nullif(trim(coalesce(p_avatar_path, '')), ''),
    v_photos,
    nullif(trim(coalesce(p_video_file_id, '')), ''),
    true
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function doctors.submit_testimonial(text, text, text, text, text, text[], text, boolean)
  to anon, authenticated;

-- --- Public read --------------------------------------------------------------

create or replace function doctors.list_testimonials(p_limit integer default 60)
returns table (
  id uuid,
  display_name text,
  role_line text,
  story text,
  avatar_path text,
  photo_paths text[],
  video_file_id text,
  featured boolean,
  created_at timestamptz
)
language sql
security definer
set search_path = doctors, public
as $$
  select
    t.id, t.display_name, t.role_line, t.story,
    t.avatar_path, t.photo_paths, t.video_file_id, t.featured, t.created_at
  from doctors.testimonials t
  where t.status = 'approved'
  order by t.featured desc, t.created_at desc
  limit least(greatest(coalesce(p_limit, 60), 1), 200);
$$;

grant execute on function doctors.list_testimonials(integer) to anon, authenticated;

-- --- Moderation ---------------------------------------------------------------

create or replace function doctors.admin_list_testimonials(
  p_admin_password text,
  p_status text default null
)
returns setof doctors.testimonials
language plpgsql
security definer
set search_path = doctors, public
as $$
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  return query
  select *
  from doctors.testimonials t
  where p_status is null or t.status = p_status
  order by
    case t.status when 'pending' then 0 when 'approved' then 1 else 2 end,
    t.created_at desc;
end;
$$;

grant execute on function doctors.admin_list_testimonials(text, text) to anon, authenticated, service_role;

create or replace function doctors.admin_review_testimonial(
  p_admin_password text,
  p_id uuid,
  p_status text,
  p_featured boolean default false,
  p_review_note text default ''
)
returns doctors.testimonials
language plpgsql
security definer
set search_path = doctors, public
as $$
declare
  v_row doctors.testimonials;
begin
  perform doctors.assert_wheel_admin(p_admin_password);

  if p_status not in ('pending', 'approved', 'rejected') then
    raise exception 'Unknown status %', p_status;
  end if;

  -- Exactly one featured story at a time: the page gives it a layout no second row can
  -- share, so clearing the others here is simpler than picking a winner at render time.
  if p_featured and p_status = 'approved' then
    update doctors.testimonials set featured = false where featured and id <> p_id;
  end if;

  update doctors.testimonials
  set status = p_status,
      featured = (p_featured and p_status = 'approved'),
      review_note = coalesce(p_review_note, ''),
      reviewed_at = now()
  where id = p_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Testimonial % not found', p_id;
  end if;

  return v_row;
end;
$$;

grant execute on function doctors.admin_review_testimonial(text, uuid, text, boolean, text)
  to anon, authenticated, service_role;

-- --- Storage ------------------------------------------------------------------

-- Photos only. Video never lands here - it stays on the member's Google Drive, which is
-- what keeps this bucket small, cheap, and narrow enough to hand the anon key.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'testimonial-media',
  'testimonial-media',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "testimonial media public read" on storage.objects;
drop policy if exists "testimonial media anon upload" on storage.objects;

-- ponytail: pending uploads sit at public, unguessable URLs until a moderator approves
-- the row that links them. Nothing on the site points at an unapproved file, but the
-- object itself is readable to anyone holding the uuid path. Move to a private bucket
-- with signed URLs plus a copy-on-approve step if that ever stops being acceptable.
create policy "testimonial media public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'testimonial-media');

-- Insert only. No update or delete policy, so an uploader cannot overwrite or remove
-- someone else's photo after the fact.
create policy "testimonial media anon upload"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'testimonial-media');
