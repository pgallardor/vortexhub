select cron.unschedule('vortexhub-event-completion')
where exists (
  select 1
  from cron.job
  where jobname = 'vortexhub-event-completion'
);

select cron.schedule(
  'vortexhub-event-completion',
  '0 * * * *',
  'select public.complete_due_events()'
);
