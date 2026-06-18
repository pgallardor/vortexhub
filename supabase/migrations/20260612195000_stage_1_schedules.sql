create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'vortexhub-event-completion',
  '*/5 * * * *',
  'select public.complete_due_events()'
);

select cron.schedule(
  'vortexhub-weekly-occurrence-generation',
  '0 * * * *',
  'select public.generate_weekly_occurrences()'
);

select cron.schedule(
  'vortexhub-event-archival',
  '15 3 * * *',
  'select public.archive_due_events()'
);

select cron.schedule(
  'vortexhub-invitation-maintenance',
  '20 * * * *',
  'select public.maintain_invitations()'
);

select cron.schedule(
  'vortexhub-premium-asset-maintenance',
  '30 * * * *',
  'select public.maintain_premium_assets()'
);

select cron.schedule(
  'vortexhub-account-anonymization',
  '30 4 * * *',
  'select public.anonymize_due_accounts()'
);

select cron.schedule(
  'vortexhub-audit-retention',
  '45 4 * * *',
  'select public.retain_audit_events()'
);
