-- ============================================================
-- CUMBO — Consentimiento de datos personales (Ley 1581 de 2012)
-- Ejecutar DESPUÉS de las 13 migraciones anteriores.
-- ============================================================

-- Queda registro de CUÁNDO cada usuario aceptó la Política de
-- Privacidad y los Términos y Condiciones — es la prueba de
-- autorización que exige el Habeas Data (Ley 1581 de 2012, Art. 4).
alter table public.usuarios add column if not exists consentimiento_datos_en timestamptz;

-- El usuario_id de eventos_log ya era nullable desde antes (referencia
-- a usuarios), así que un evento de "cuenta eliminada" con
-- usuario_id=null es válido sin cambios adicionales — se deja este
-- comentario como referencia de por qué eliminar-cuenta no falla ahí.
