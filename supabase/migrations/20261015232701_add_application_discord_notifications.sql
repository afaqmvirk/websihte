alter table public.applications
  add column discord_notification_status text not null default 'pending'
    check (discord_notification_status in ('pending', 'sending', 'sent', 'failed')),
  add column discord_notification_claim_id uuid,
  add column discord_notification_attempted_at timestamptz,
  add column discord_notification_id text,
  add column discord_notification_sent_at timestamptz,
  add constraint sent_discord_notification_has_receipt check (
    discord_notification_status <> 'sent' or (
      discord_notification_id is not null and discord_notification_sent_at is not null
    )
  );

comment on column public.applications.discord_notification_status is
  'Organizer webhook delivery. A short claim lease prevents concurrent duplicate notifications; failed attempts can retry.';
