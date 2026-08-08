-- ============================================================
-- CUMBO — CORRECCIÓN CRÍTICA: el perfil de usuario nunca se creaba
-- de forma confiable
-- ============================================================
-- Se encontraron DOS bugs relacionados al auditar el flujo de
-- registro completo:
--
-- 1. La tabla `usuarios` nunca tuvo una policy de INSERT. El insert
--    manual que hacía Ingreso.jsx después de auth.signUp() ha estado
--    fallando en silencio desde el primer esquema — la cuenta de
--    autenticación se creaba bien, pero la fila de perfil en
--    `usuarios` nunca se guardaba. Esto significa que `perfil` quedó
--    null para cualquier cuenta creada así, rompiendo el rol, el
--    nombre completo, el consentimiento de datos, todo lo que depende
--    de esa tabla.
--
-- 2. El botón "Continuar con Gmail" NUNCA insertaba nada en `usuarios`
--    — ni siquiera lo intentaba. Cualquiera que se registrara con
--    Google se quedaba sin perfil para siempre.
--
-- La solución correcta no es solo agregar la policy de INSERT (eso
-- arreglaría el caso 1 pero no el caso 2) — es un trigger en la base
-- de datos que crea el perfil automáticamente cuando se crea el
-- usuario de autenticación, sin importar por qué puerta entró
-- (correo o Google). Es el patrón estándar de Supabase para esto.

create or replace function public.manejar_usuario_nuevo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (id, nombre_completo, correo, rol, consentimiento_datos_en)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'nombre_completo',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.email,
    'cliente',
    (new.raw_user_meta_data->>'consentimiento_datos_en')::timestamptz
  )
  on conflict (id) do nothing; -- por si ya existiera (no debería, pero no falla si pasa)
  return new;
end;
$$;

drop trigger if exists trg_usuario_nuevo on auth.users;
create trigger trg_usuario_nuevo
  after insert on auth.users
  for each row execute function public.manejar_usuario_nuevo();

-- ------------------------------------------------------------
-- Policy de INSERT como defensa adicional (el trigger corre con
-- SECURITY DEFINER y no la necesita, pero la dejamos por si algo más
-- necesita insertar legítimamente su propia fila en el futuro).
-- ------------------------------------------------------------
create policy "usuarios_crear_propio" on public.usuarios
  for insert with check (auth.uid() = id);

-- NOTA IMPORTANTE que queda pendiente (no es un bug de código, es una
-- decisión de producto/legal): el consentimiento de datos personales
-- (Ley 1581 de 2012) hoy solo se pide con un checkbox explícito en el
-- registro por correo. Quien se registra con Google nunca ve ese
-- checkbox, así que `consentimiento_datos_en` queda en null para esas
-- cuentas. Falta decidir cómo pedir ese consentimiento también en el
-- flujo de Google antes de publicar la app.
