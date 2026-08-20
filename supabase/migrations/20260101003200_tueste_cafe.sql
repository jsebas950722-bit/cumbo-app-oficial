-- ============================================================
-- CUMBO — Tueste del café terminado
-- Ejecutar DESPUÉS de las 31 migraciones anteriores.
-- ============================================================
-- El tueste es una decisión de procesamiento que toma Cumbo al
-- tostar el café pergamino comprado — coherente con el modelo de
-- negocio corregido: el caficultor vende pergamino sin tostar, Cumbo
-- controla el producto terminado (ver 20260101003000_cafe_pergamino.sql).

create type tueste_cafe as enum ('claro', 'medio', 'oscuro');

alter table public.productos add column if not exists tueste tueste_cafe;
