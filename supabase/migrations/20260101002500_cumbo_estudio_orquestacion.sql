-- ============================================================
-- CUMBO ESTUDIO 2.0 — Fase 3: Orquestación y distribución
-- Ejecutar DESPUÉS de las 24 migraciones anteriores.
-- ============================================================
-- Implementa la Fase 3 del documento de arquitectura: calendario
-- editorial con estados, cola de aprobación obligatoria, y métricas
-- básicas por pieza (clics rastreables).
--
-- NOTA HONESTA sobre distribución por WhatsApp: el documento pedía
-- "envío a WhatsApp/redes" vía la integración de Twilio ya existente.
-- Se investigó y encontró un límite real que no se puede evitar:
-- WhatsApp Business API solo permite mandar mensajes libres dentro de
-- una ventana de 24 horas después de que el cliente escribió — mandar
-- contenido de marketing de forma proactiva (que es la naturaleza de
-- un calendario editorial) casi siempre cae fuera de esa ventana, y
-- exigiría plantillas pre-aprobadas por Meta que no existen todavía.
-- En vez de construir algo que falle en la práctica, la distribución
-- se resolvió con el botón nativo de compartir del teléfono (Web
-- Share API) — funciona hoy, sin restricciones, comparte a WhatsApp,
-- Instagram o cualquier app instalada.

-- Clics reales por pieza — el enlace de seguimiento pasa por acá antes
-- de mandar al Marketplace, así queda contado.
create table public.clics_contenido_estudio (
  id uuid primary key default gen_random_uuid(),
  contenido_id uuid not null references public.contenido_marketing(id) on delete cascade,
  indice_pieza integer not null,
  fecha timestamptz not null default now()
);

alter table public.clics_contenido_estudio enable row level security;

-- Cualquiera puede insertar un clic (el enlace de seguimiento es
-- público, lo hace clic gente que no necesariamente tiene cuenta) —
-- pero solo el dueño del contenido o el CEO pueden ver los conteos.
create policy "clics_estudio_insertar_publico" on public.clics_contenido_estudio
  for insert with check (true);

create policy "clics_estudio_ver_propio" on public.clics_contenido_estudio
  for select using (
    exists (select 1 from public.contenido_marketing c where c.id = contenido_id and c.vendedor_id = auth.uid())
  );

create policy "clics_estudio_ver_ceo" on public.clics_contenido_estudio
  for select using (public.usuario_es_ceo());
