-- ============================================================
-- CUMBO — Conversaciones de WhatsApp (para la 4ta función de IA)
-- Ejecutar DESPUÉS de las 20 migraciones anteriores.
-- ============================================================
-- Los webhooks de Twilio son sin estado — cada mensaje entrante llega
-- como una llamada independiente. Esta tabla guarda el historial por
-- número de teléfono para que Claude tenga contexto de la
-- conversación completa, no solo del último mensaje.

create table public.whatsapp_conversaciones (
  telefono text primary key, -- formato E.164, ej: +573001234567
  historial jsonb not null default '[]'::jsonb,
  requiere_humano boolean not null default false,
  actualizado_en timestamptz not null default now()
);

alter table public.whatsapp_conversaciones enable row level security;

-- Solo el CEO puede ver/gestionar la bandeja de WhatsApp desde Panel
-- Cumbo. Los Edge Functions usan la service role key, así que no
-- necesitan estas policies para leer/escribir.
create policy "whatsapp_conversaciones_ceo" on public.whatsapp_conversaciones
  for all using (public.usuario_es_ceo());
