-- ============================================================
-- CUMBO — Esquema inicial de base de datos (Supabase / Postgres)
-- Basado en: Handoff a desarrollador - Cumbo (modelo de datos)
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- ------------------------------------------------------------
-- 0. EXTENSIONES
-- ------------------------------------------------------------
create extension if not exists "pgcrypto"; -- para gen_random_uuid()

-- ------------------------------------------------------------
-- 1. ENUMS
-- ------------------------------------------------------------
create type rol_usuario as enum ('cliente', 'caficultor', 'vendedor', 'logistica', 'ceo');
create type region_finca as enum ('Huila', 'Nariño', 'Cauca', 'Eje Cafetero', 'Tolima', 'Santander', 'Otra');
create type especie_cafe as enum ('Caturra', 'Castillo', 'Típica', 'Pink Bourbon', 'Otra');
create type proceso_cafe as enum ('Lavado', 'Honey', 'Natural');
create type estado_finca as enum ('pendiente', 'validada', 'rechazada');
create type tipo_producto as enum ('cafe_finca', 'metodo_preparacion', 'accesorio');
create type formato_producto as enum ('Libra', 'Media libra', 'Cápsulas', 'N/A');
create type calidad_producto as enum ('basica', 'media', 'alta');
create type estado_pedido as enum ('pendiente', 'en_revision', 'confirmado', 'despachado', 'entregado', 'devolucion');
create type transportadora_enum as enum ('Servientrega', 'Coordinadora', 'Envía', 'Interrapidísimo', 'TCC', 'Veloces', 'Didi', 'Yango');

-- ------------------------------------------------------------
-- 2. USUARIOS (perfil ligado a auth.users de Supabase)
-- ------------------------------------------------------------
-- No guardamos contraseña_hash nosotros: Supabase Auth ya maneja
-- eso en auth.users. Esta tabla es el perfil público/funcional.
create table public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre_completo text not null,
  correo text unique not null,
  rol rol_usuario not null default 'cliente',
  whatsapp text,
  ciudad_municipio text,
  perfil_sabor jsonb default '{}'::jsonb, -- scores por región, generado por el Sommelier
  fecha_creacion timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. FINCAS
-- ------------------------------------------------------------
create table public.fincas (
  id uuid primary key default gen_random_uuid(),
  caficultor_id uuid not null references public.usuarios(id) on delete cascade,
  nombre_finca text not null,
  region region_finca not null,
  vereda text,
  altitud_msnm integer,
  especie especie_cafe,
  proceso proceso_cafe,
  precio_kilo_propuesto numeric(12,2),
  certificacion_foto_cultivo text not null,
  certificacion_foto_grano text not null,
  certificacion_video text not null,
  cedula_documento text not null,
  estado estado_finca not null default 'pendiente',
  fecha_creacion timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 4. PRODUCTOS
-- ------------------------------------------------------------
create table public.productos (
  id uuid primary key default gen_random_uuid(),
  tipo tipo_producto not null,
  finca_id uuid references public.fincas(id) on delete set null,       -- si es café
  vendedor_id uuid references public.usuarios(id) on delete set null,   -- si es método/accesorio de marca socia
  nombre text not null,
  formato formato_producto default 'N/A',
  calidad calidad_producto,
  precio numeric(12,2) not null,
  stock integer not null default 0,
  fecha_creacion timestamptz not null default now(),
  constraint chk_producto_origen check (finca_id is not null or vendedor_id is not null)
);

-- ------------------------------------------------------------
-- 5. PEDIDOS + ITEMS (relacional, no JSON, para poder reportar ventas)
-- ------------------------------------------------------------
create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.usuarios(id) on delete cascade,
  subtotal numeric(12,2) not null default 0,
  costo_envio numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  estado estado_pedido not null default 'pendiente',
  guia_transportadora text,
  transportadora transportadora_enum,
  nps_respuesta smallint check (nps_respuesta between 0 and 10),
  fecha timestamptz not null default now()
);

create table public.pedido_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  producto_id uuid not null references public.productos(id),
  cantidad integer not null check (cantidad > 0),
  precio numeric(12,2) not null -- precio congelado al momento de la compra
);

-- ------------------------------------------------------------
-- 6. CONTENIDO DE MARKETING (Cumbo Estudio)
-- ------------------------------------------------------------
create table public.contenido_marketing (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references public.usuarios(id) on delete cascade,
  tema text not null,
  piezas jsonb not null default '[]'::jsonb, -- [{dia, plataforma, guion, estado}, ...]
  consentimiento_avatar boolean not null default false,
  tokens_consumidos integer not null default 0,
  fecha_creacion timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 7. LOG INMUTABLE (Constitución del Ecosistema, Art. sobre trazabilidad)
-- ------------------------------------------------------------
create table public.eventos_log (
  id uuid primary key default gen_random_uuid(),
  entidad text not null,          -- 'pedido', 'finca', 'producto', 'contenido_marketing', etc.
  entidad_id uuid not null,
  accion text not null,           -- 'creado', 'precio_validado', 'publicado', 'aprobado', etc.
  datos jsonb not null default '{}'::jsonb,
  evento_anterior_id uuid references public.eventos_log(id), -- referencia para "corregir sin borrar"
  usuario_id uuid references public.usuarios(id),
  fecha timestamptz not null default now()
);

-- Bloquear UPDATE y DELETE sobre eventos_log a nivel de base de datos.
-- Cualquier "corrección" debe ser un INSERT nuevo que referencia al anterior.
create or replace function public.bloquear_modificacion_log()
returns trigger as $$
begin
  raise exception 'eventos_log es inmutable: no se permite UPDATE ni DELETE';
end;
$$ language plpgsql;

create trigger trg_bloquear_update_log
  before update on public.eventos_log
  for each row execute function public.bloquear_modificacion_log();

create trigger trg_bloquear_delete_log
  before delete on public.eventos_log
  for each row execute function public.bloquear_modificacion_log();

-- ------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (primera pasada — se refina por rol después)
-- ------------------------------------------------------------
alter table public.usuarios enable row level security;
alter table public.fincas enable row level security;
alter table public.productos enable row level security;
alter table public.pedidos enable row level security;
alter table public.pedido_items enable row level security;
alter table public.contenido_marketing enable row level security;
alter table public.eventos_log enable row level security;

-- Usuarios: cada persona ve y edita su propio perfil
create policy "usuarios_ver_propio" on public.usuarios
  for select using (auth.uid() = id);
create policy "usuarios_editar_propio" on public.usuarios
  for update using (auth.uid() = id);

-- Productos y fincas: lectura pública (marketplace), escritura solo del dueño
create policy "productos_lectura_publica" on public.productos
  for select using (true);
create policy "fincas_lectura_publica" on public.fincas
  for select using (true);

create policy "fincas_editar_propio" on public.fincas
  for all using (auth.uid() = caficultor_id);

-- Pedidos: cada cliente ve solo los suyos
create policy "pedidos_ver_propio" on public.pedidos
  for select using (auth.uid() = cliente_id);
create policy "pedidos_crear_propio" on public.pedidos
  for insert with check (auth.uid() = cliente_id);

-- eventos_log: solo lectura (nadie inserta directo desde el cliente,
-- se inserta desde funciones/backend con service_role)
create policy "eventos_log_lectura_autenticados" on public.eventos_log
  for select using (auth.role() = 'authenticated');

-- NOTA: estas políticas son un punto de partida funcional, no la versión
-- final. Faltan reglas específicas para CEO (ve todo), vendedor (ve sus
-- productos/pedidos), logística (ve pedidos despachados), etc. Las
-- afinamos cuando conectemos Panel Cumbo y CRM Vendedor.
