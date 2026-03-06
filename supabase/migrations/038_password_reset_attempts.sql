-- Rate limiting for forgot-password: track attempts per email to prevent abuse.
-- Cleanup function removes old rows so the table stays small.

-- Table: one row per forgot-password request (any outcome)
create table if not exists public.password_reset_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  ip_address text,
  attempted_at timestamptz not null default now()
);

-- Index for "count attempts in last hour" per email
create index if not exists idx_password_reset_attempts_email_attempted_at
  on public.password_reset_attempts (email, attempted_at desc);

-- RLS: table is only accessed with service role (no anon/authenticated policies)
alter table public.password_reset_attempts enable row level security;

-- No policies: only service role can read/write (bypasses RLS)

-- Remove rows older than the rate-limit window (e.g. 1 hour) to keep table small
create or replace function public.cleanup_expired_password_reset_attempts()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.password_reset_attempts
  where attempted_at < now() - interval '1 hour';
$$;

comment on table public.password_reset_attempts is 'Tracks forgot-password requests for per-email rate limiting (e.g. 3 per hour).';
comment on function public.cleanup_expired_password_reset_attempts() is 'Deletes password_reset_attempts older than 1 hour; call at start of each forgot-password request.';
