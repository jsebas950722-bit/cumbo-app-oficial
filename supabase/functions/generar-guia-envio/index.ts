// supabase/functions/generar-guia-envio/index.ts
//
// Se llama cuando Logística despacha un pedido que se cotizó con
// DrEnvío (envío nacional, fuera de Bogotá). Usa la cotización que ya
// se guardó en `pedidos.cotizacion_envio` al momento del checkout —
// no vuelve a cotizar, genera la guía real con esos datos exactos.
//
// Devuelve el número de guía real y el link a la etiqueta (PDF) para
// imprimir — reemplaza el número de guía escrito a mano que Logística
// usaba antes para transportadora nacional.
//
// Los pedidos de mensajería urbana (Yango/Didi, dentro de Bogotá) NO
// pasan por acá — esas dos no están en DrEnvío, siguen con guía manual
// como hasta ahora.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { pedido_id } = await req.json();
    if (!pedido_id) {
      return new Response(JSON.stringify({ error: 'Falta pedido_id' }), { status: 400, headers: corsHeaders });
    }

    const supabaseComoUsuario = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } },
    });
    const {
      data: { user },
      error: errUsuario,
    } = await supabaseComoUsuario.auth.getUser();
    if (errUsuario || !user) {
      return new Response(JSON.stringify({ error: 'Sesión inválida' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Solo CEO o logística pueden despachar/generar guías.
    const { data: perfil } = await supabase.from('usuarios').select('rol').eq('id', user.id).single();
    if (!['ceo', 'logistica'].includes(perfil?.rol)) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 403, headers: corsHeaders });
    }

    const { data: pedido, error: errPedido } = await supabase
      .from('pedidos')
      .select('*, usuarios(nombre_completo, whatsapp), pedido_items(cantidad, precio, productos(nombre, peso_kg))')
      .eq('id', pedido_id)
      .single();
    if (errPedido || !pedido) {
      return new Response(JSON.stringify({ error: 'Pedido no encontrado' }), { status: 404, headers: corsHeaders });
    }
    if (!pedido.cotizacion_envio || !pedido.direccion_estructurada) {
      return new Response(JSON.stringify({ error: 'Este pedido no tiene una cotización de DrEnvío asociada (¿es de mensajería urbana?)' }), { status: 400, headers: corsHeaders });
    }

    const dir = pedido.direccion_estructurada;
    const cot = pedido.cotizacion_envio;
    const pesoTotalKg = (pedido.pedido_items || []).reduce((acc: number, it: any) => acc + (it.productos?.peso_kg || 0.5) * it.cantidad, 0);

    const body = {
      type: 'National',
      origin: {
        country: 'CO',
        postal_code: Deno.env.get('ORIGEN_CODIGO_POSTAL'),
        city: Deno.env.get('ORIGEN_CIUDAD'),
        state: Deno.env.get('ORIGEN_DEPARTAMENTO'),
        street: Deno.env.get('ORIGEN_CALLE'),
        number: Deno.env.get('ORIGEN_NUMERO'),
        district: Deno.env.get('ORIGEN_BARRIO'),
        name: 'Café Cumbo',
        company: 'Café Cumbo',
        email: 'contacto@cumbo.co',
        phone: Deno.env.get('ORIGEN_TELEFONO') || '0000000000',
      },
      destination: {
        country: 'CO',
        postal_code: dir.codigo_postal,
        city: pedido.ciudad_entrega,
        state: dir.departamento,
        street: dir.calle,
        number: dir.numero,
        district: dir.barrio || 'N/A',
        name: pedido.usuarios?.nombre_completo || 'Cliente Cumbo',
        company: 'N/A',
        email: 'contacto@cumbo.co',
        phone: pedido.telefono_contacto || pedido.usuarios?.whatsapp || '0000000000',
      },
      shipment: {
        carrier: cot.carrier,
        ObjectId: cot.ObjectId,
        ShippingId: cot.ShippingId,
        service: cot.service,
        price: cot.price,
        contentExplanation: 'Café tostado y/o accesorios de preparación de café',
        contentQuantity: (pedido.pedido_items || []).length || 1,
      },
      packages: [
        {
          weight: Math.max(0.1, pesoTotalKg),
          height: 15,
          width: 15,
          length: 20,
          type: 'box',
          name: 'Pedido Cumbo',
          content: (pedido.pedido_items || []).map((it: any) => it.productos?.nombre).join(', ') || 'Café Cumbo',
          contentQuantity: (pedido.pedido_items || []).length || 1,
          declared_value: pedido.total,
        },
      ],
      service_id: cot.service_id,
      carriers: [cot.carrier],
      insurance: 0,
    };

    const resp = await fetch('https://prod.api-drenvio.com/v2/shipments/generate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('DRENVIO_API_TOKEN')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const detalle = await resp.text();
      console.error('Error generando guía en DrEnvío:', detalle);
      return new Response(JSON.stringify({ error: 'No se pudo generar la guía. Verifica los datos del pedido.', detalle }), { status: 502, headers: corsHeaders });
    }

    const guia = await resp.json();

    await supabase
      .from('pedidos')
      .update({
        estado: 'despachado',
        guia_transportadora: guia.tracking,
        etiqueta_envio_url: guia.label,
      })
      .eq('id', pedido_id);

    await supabase.from('eventos_log').insert({
      entidad: 'pedido',
      entidad_id: pedido_id,
      accion: 'cambio_estado',
      datos: { a: 'despachado', transportadora: cot.carrier, guia: guia.tracking, generado_automaticamente: true },
      usuario_id: user.id,
    });

    return new Response(JSON.stringify({ tracking: guia.tracking, etiqueta_url: guia.label }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Error inesperado generando la guía' }), { status: 500, headers: corsHeaders });
  }
});
