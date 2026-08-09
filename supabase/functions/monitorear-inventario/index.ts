// supabase/functions/monitorear-inventario/index.ts
//
// Cuarto y último agente de la lista priorizada. Detecta dos cosas:
//   - Stock bajo (<=5 unidades) en un producto activo.
//   - Sin ventas: un producto activo, con stock, que lleva más de 60
//     días sin una sola venta (y existe desde hace más de 60 días —
//     si no, un producto recién publicado se marcaría injustamente).
//
// REGLA DE AUTONOMÍA — distinta a los otros 3 agentes, y por qué:
// esto no toca dinero ni decide sobre confianza, solo detecta y
// avisa. El peor caso de que se equivoque es un aviso de menos valor,
// no una decisión de negocio incorrecta — por eso inserta y resuelve
// alertas directo, sin necesitar que nadie las apruebe primero.
//
// Honestidad sobre el canal de aviso: NO manda WhatsApp — un aviso
// proactivo de este tipo caería en el mismo límite de la ventana de
// 24 horas que ya encontramos con la distribución de contenido de
// Cumbo Estudio, y todavía no hay correo transaccional configurado.
// El aviso vive DENTRO de la app — el vendedor lo ve al entrar a CRM
// Vendedor/Portal Caficultor, y el CEO lo ve en Panel Cumbo.
//
// Se puede llamar con sesión de CEO (botón manual) o con el secret
// compartido CRON_SECRET (para programarlo con pg_cron, mismo patrón
// que conciliar-pagos).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const UMBRAL_STOCK_BAJO = 5;
const DIAS_SIN_VENTAS = 60;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const secretRecibido = req.headers.get('X-Cron-Secret');
    let autorizado = secretRecibido && secretRecibido === Deno.env.get('CRON_SECRET');

    if (!autorizado) {
      const auth = req.headers.get('Authorization');
      if (auth) {
        const supabaseComoUsuario = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
          global: { headers: { Authorization: auth } },
        });
        const {
          data: { user },
        } = await supabaseComoUsuario.auth.getUser();
        if (user) {
          const { data: perfil } = await supabase.from('usuarios').select('rol').eq('id', user.id).single();
          autorizado = perfil?.rol === 'ceo';
        }
      }
    }

    if (!autorizado) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: corsHeaders });
    }

    const { data: productos } = await supabase.from('productos').select('id, nombre, stock, fecha_creacion').eq('activo', true);

    const hace60dias = new Date(Date.now() - DIAS_SIN_VENTAS * 86400000).toISOString();

    // pedido_items no tiene fecha propia — se llega a la fecha de la
    // venta a través de pedidos.fecha. Traemos de una sola vez los
    // ids de producto vendidos en los últimos 60 días, para no hacer
    // una consulta por producto.
    const { data: pedidosRecientes } = await supabase.from('pedidos').select('id').gte('fecha', hace60dias);
    const idsPedidosRecientes = (pedidosRecientes || []).map((p) => p.id);
    let productosVendidosRecientemente = new Set<string>();
    if (idsPedidosRecientes.length) {
      const { data: itemsRecientes } = await supabase.from('pedido_items').select('producto_id').in('pedido_id', idsPedidosRecientes);
      productosVendidosRecientemente = new Set((itemsRecientes || []).map((i) => i.producto_id));
    }

    let alertasActivas = 0;
    let alertasResueltas = 0;

    for (const producto of productos || []) {
      // --- Stock bajo ---
      if (producto.stock <= UMBRAL_STOCK_BAJO && producto.stock > 0) {
        const { error, count } = await supabase
          .from('alertas_inventario')
          .upsert(
            {
              producto_id: producto.id,
              tipo: 'stock_bajo',
              detalle: `Quedan ${producto.stock} unidades de "${producto.nombre}".`,
              resuelta: false,
            },
            { onConflict: 'producto_id,tipo', ignoreDuplicates: false }
          );
        if (!error) alertasActivas++;
      } else {
        const { data: resueltas } = await supabase
          .from('alertas_inventario')
          .update({ resuelta: true })
          .eq('producto_id', producto.id)
          .eq('tipo', 'stock_bajo')
          .eq('resuelta', false)
          .select('id');
        alertasResueltas += resueltas?.length || 0;
      }

      // --- Sin ventas (solo si el producto ya existe hace más de 60 días) ---
      const existeHaceMasDe60Dias = new Date(producto.fecha_creacion).getTime() < Date.now() - DIAS_SIN_VENTAS * 86400000;
      if (existeHaceMasDe60Dias && producto.stock > 0) {
        const tuvoVentaReciente = productosVendidosRecientemente.has(producto.id);

        if (!tuvoVentaReciente) {
          const { error } = await supabase
            .from('alertas_inventario')
            .upsert(
              {
                producto_id: producto.id,
                tipo: 'sin_ventas',
                detalle: `"${producto.nombre}" no ha tenido ventas en los últimos ${DIAS_SIN_VENTAS} días.`,
                resuelta: false,
              },
              { onConflict: 'producto_id,tipo', ignoreDuplicates: false }
            );
          if (!error) alertasActivas++;
        } else {
          const { data: resueltas } = await supabase
            .from('alertas_inventario')
            .update({ resuelta: true })
            .eq('producto_id', producto.id)
            .eq('tipo', 'sin_ventas')
            .eq('resuelta', false)
            .select('id');
          alertasResueltas += resueltas?.length || 0;
        }
      }
    }

    return new Response(JSON.stringify({ productosRevisados: (productos || []).length, alertasActivas, alertasResueltas }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Error inesperado monitoreando el inventario' }), { status: 500, headers: corsHeaders });
  }
});
