// supabase/functions/crear-preferencia-pago/index.ts
//
// Recibe un pedido_id ya creado en la tabla `pedidos` (Marketplace.jsx lo
// crea primero, exactamente igual que antes) y le pide a Mercado Pago una
// "preferencia de pago" — el objeto que genera el link de checkout al que
// redirigimos al cliente.
//
// Por qué esto tiene que ser una Edge Function y no código del navegador:
// el ACCESS_TOKEN de Mercado Pago es una clave privada. Si se pusiera en
// el frontend, cualquiera podría verla abriendo las herramientas de
// desarrollador y usarla para operar tu cuenta de Mercado Pago. Por eso
// vive acá, como variable de entorno del servidor (secret de Supabase),
// nunca en el bundle de React.
//
// Requiere las variables de entorno (secrets) configuradas en Supabase:
//   MP_ACCESS_TOKEN   → tu access token de producción o de prueba de Mercado Pago
//   FRONTEND_URL      → la URL pública de tu app (para las back_urls)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY → ya vienen inyectadas por Supabase

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { pedido_id } = await req.json();
    if (!pedido_id) {
      return new Response(JSON.stringify({ error: 'Falta pedido_id' }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Traemos el pedido con sus items reales — el precio que se cobra es
    // el que ya quedó guardado en pedido_items al confirmar el carrito,
    // nunca uno que mande el navegador en esta llamada.
    const { data: pedido, error: errPedido } = await supabase
      .from('pedidos')
      .select('*, pedido_items(cantidad, precio, productos(nombre))')
      .eq('id', pedido_id)
      .single();

    if (errPedido || !pedido) {
      return new Response(JSON.stringify({ error: 'Pedido no encontrado' }), { status: 404, headers: corsHeaders });
    }

    const items = (pedido.pedido_items || []).map((it: any) => ({
      title: it.productos?.nombre || 'Producto Cumbo',
      quantity: it.cantidad,
      unit_price: Number(it.precio),
      currency_id: 'COP',
    }));

    if (pedido.costo_envio > 0) {
      items.push({ title: 'Envío', quantity: 1, unit_price: Number(pedido.costo_envio), currency_id: 'COP' });
    }

    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:5173';

    const respuestaMp = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('MP_ACCESS_TOKEN')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items,
        external_reference: pedido_id,
        back_urls: {
          success: `${frontendUrl}/mis-pedidos?pago=exitoso`,
          failure: `${frontendUrl}/marketplace?pago=fallido`,
          pending: `${frontendUrl}/mis-pedidos?pago=pendiente`,
        },
        auto_return: 'approved',
        notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/webhook-mercadopago`,
      }),
    });

    const preferencia = await respuestaMp.json();

    if (!respuestaMp.ok) {
      console.error('Error de Mercado Pago:', preferencia);
      return new Response(JSON.stringify({ error: 'No se pudo crear la preferencia de pago', detalle: preferencia }), { status: 502, headers: corsHeaders });
    }

    // Guardamos el id de preferencia para poder rastrear el pago después.
    await supabase.from('pedidos').update({ mercadopago_preference_id: preferencia.id }).eq('id', pedido_id);

    return new Response(JSON.stringify({ init_point: preferencia.init_point }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Error inesperado creando la preferencia' }), { status: 500, headers: corsHeaders });
  }
});
