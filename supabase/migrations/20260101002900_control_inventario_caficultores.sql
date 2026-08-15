-- ============================================================
-- CUMBO — Control de inventario real para caficultores
-- Ejecutar DESPUÉS de las 28 migraciones anteriores.
-- ============================================================
-- BUG REAL ENCONTRADO: cuando el CEO valida una finca, se crea
-- automáticamente el producto de café en el Marketplace — pero nunca
-- quedaba vinculado al caficultor (`vendedor_id` se dejaba vacío).
-- Como la política de edición de productos exige
-- `vendedor_id = auth.uid()`, el caficultor NUNCA podía ajustar su
-- propio stock a medida que vendía — quedaba fijo en las 50 unidades
-- iniciales para siempre, sin que nadie pudiera corregirlo desde la
-- app. Se detectó al construir el control de inventario que se pidió
-- explícitamente para caficultores, vendedores y CEO.

-- Repara los productos de café ya creados que quedaron sin dueño,
-- vinculándolos al caficultor real de su finca.
update public.productos p
set vendedor_id = f.caficultor_id
from public.fincas f
where p.finca_id = f.id
  and p.vendedor_id is null
  and f.caficultor_id is not null;
