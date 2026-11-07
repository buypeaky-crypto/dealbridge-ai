-- DealBridge AI: minimal, idempotent PayPal webhook event storage.
-- Apply this migration in the Supabase SQL Editor before enabling webhook delivery.

create table if not exists public.paypal_webhook_events (
  event_id text primary key,
  event_type text not null,
  resource_id text,
  payment_status text,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

create unique index if not exists paypal_webhook_events_event_id_uidx
  on public.paypal_webhook_events (event_id);

alter table public.paypal_webhook_events enable row level security;

-- Intentionally create no anon/authenticated policies.
-- The server-side Supabase service-role key is used by the webhook function.
