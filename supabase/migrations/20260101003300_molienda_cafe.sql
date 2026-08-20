-- ============================================================
-- CUMBO — Molienda (reemplaza al tueste como variable del Sommelier)
-- Ejecutar DESPUÉS de las 32 migraciones anteriores.
-- ============================================================
-- Corrección: el tueste no varía (Cumbo siempre tuesta medio), así
-- que no tiene sentido como variable de recomendación del Sommelier.
-- Lo que sí varía según cómo cada quien prepara su café es la
-- MOLIENDA — eso es lo que reemplaza al tueste en el quiz.

create type molienda_cafe as enum ('fina', 'media', 'gruesa');

alter table public.productos add column if not exists molienda molienda_cafe;

-- El tueste queda en la tabla (por si algún día se quiere mostrar de
-- forma informativa en la ficha del producto), pero con un valor fijo
-- por defecto, ya que Cumbo siempre tuesta medio.
alter table public.productos alter column tueste set default 'medio';
