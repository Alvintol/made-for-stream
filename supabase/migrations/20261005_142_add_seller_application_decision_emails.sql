-- Records every email sent to an applicant about a creator-application
-- decision (approved, needs changes, rejected). The API writes one row per
-- attempt (POST /api/creator-applications/:id/send-decision-email) and reads
-- the newest sent row to avoid emailing the same decision twice.
--
-- Service role only: RLS is on with no policies. Applicants can update their
-- own seller_applications row, so this state lives in its own table where
-- they cannot touch it.
-- Playbook: docs/support/creators/applications.md (APP-006).
create table if not exists public.seller_application_decision_emails (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null
    references public.seller_applications(id) on delete cascade,
  status text not null
    check (status in ('approved', 'needs_changes', 'rejected')),
  email_status text not null
    check (email_status in ('sent', 'failed')),
  provider_message_id text null,
  failed_reason text null,
  sent_by_admin_user_id uuid null,
  attempted_at timestamptz not null default now()
);

create index if not exists seller_application_decision_emails_application_idx
  on public.seller_application_decision_emails (application_id, attempted_at desc);

alter table public.seller_application_decision_emails enable row level security;

revoke all on table public.seller_application_decision_emails
  from anon, authenticated;

notify pgrst, 'reload schema';
