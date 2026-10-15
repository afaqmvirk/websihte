create table public.applications (
  id uuid primary key default gen_random_uuid(),
  submission_hash text not null unique check (submission_hash ~ '^[a-f0-9]{64}$'),
  event_slug text not null check (char_length(event_slug) between 1 and 80),
  full_name text not null check (char_length(full_name) between 1 and 200),
  email text not null check (char_length(email) between 3 and 320 and email = lower(btrim(email))),
  affiliation text not null check (char_length(affiliation) between 1 and 500),
  tshirt_size text not null check (tshirt_size in ('XS', 'S', 'M', 'L', 'XL', '2XL', '3XL')),
  dietary_restrictions text not null check (dietary_restrictions in ('none', 'halal', 'vegan', 'vegetarian', 'other')),
  dietary_restrictions_other text check (char_length(dietary_restrictions_other) <= 500),
  linkedin_url text not null check (char_length(linkedin_url) between 1 and 2048),
  other_url text check (char_length(other_url) <= 2048),
  stupidest_thing text not null check (char_length(stupidest_thing) between 1 and 400),
  coolest_build text not null check (char_length(coolest_build) between 1 and 100),
  attending boolean not null check (attending),
  sponsor_opt_in boolean not null default false,
  privacy_policy_version text not null,
  consented_at timestamptz not null default now(),
  resume_bucket text,
  resume_path text,
  resume_filename text,
  resume_content_type text,
  resume_size integer not null default 0 check (resume_size between 0 and 4194304),
  resume_sha256 text check (resume_sha256 ~ '^[a-f0-9]{64}$'),
  intake_status text not null default 'complete' check (intake_status in ('pending_resume', 'complete')),
  confirmation_email_status text not null default 'pending' check (confirmation_email_status in ('pending', 'sent', 'failed')),
  confirmation_email_id text,
  confirmation_email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resume_metadata_complete check (
    resume_size = 0 or (
      resume_bucket is not null and resume_path is not null and
      resume_filename is not null and resume_content_type is not null and resume_sha256 is not null
    )
  ),
  constraint sent_email_has_receipt check (
    confirmation_email_status <> 'sent' or (
      confirmation_email_id is not null and confirmation_email_sent_at is not null
    )
  )
);

create index applications_event_created_idx on public.applications (event_slug, created_at desc);
create index applications_email_idx on public.applications (email);

alter table public.applications enable row level security;
revoke all on public.applications from public, anon, authenticated;
grant select, insert, update, delete on public.applications to service_role;

comment on table public.applications is
  'Private SIH application records. Access through the server or the Supabase dashboard only.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'application-resumes', 'application-resumes', false, 4194304,
  array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No browser policies are granted for the applications table or résumé bucket.
-- The website's server-only secret key provides the required service_role access.
