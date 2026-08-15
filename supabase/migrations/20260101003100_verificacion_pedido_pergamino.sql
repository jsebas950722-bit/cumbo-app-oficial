-- ============================================================
-- CUMBO — Verificación del caficultor sobre el pedido a Cumbo
-- Ejecutar DESPUÉS de las 30 migraciones anteriores.
-- ============================================================
-- Sebastián aclaró el flujo real: cada "compra" de pergamino que él
-- registra es en realidad un PEDIDO que le hace al caficultor — y el
-- único seguimiento que tiene el caficultor sobre eso es VERIFICARLO
-- (confirmar que los datos son correctos). No edita cantidad, no
-- edita precio, no edita nada más — solo confirma.

alter table public.compras_pergamino add column if not exists verificado boolean not null default false;
alter table public.compras_pergamino add column if not exists fecha_verificacion timestamptz;

-- El caficultor puede actualizar su propio registro — en la práctica,
-- la interfaz solo le deja tocar el botón de verificar, nunca cambiar
-- cantidad/precio/estado de pago (eso lo sigue controlando el CEO).
create policy "compras_pergamino_verificar_propia" on public.compras_pergamino
  for update using (auth.uid() = caficultor_id);
