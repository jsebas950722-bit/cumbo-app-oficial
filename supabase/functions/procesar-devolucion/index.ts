// supabase/functions/procesar-devolucion/index.ts
//
// Se llama cuando el CEO aprueba una solicitud de devolución desde
// Panel Cumbo. Intenta el reembolso real contra la pasarela que se
// usó para pagar ese pedido.
//
// IMPORTANTE — esto no es simétrico entre pasarelas, y no lo
// fingimos:
//   - Mercado Pago tiene una API de reembolso self-service completa
//     (POST /v1/payments/{id}/refunds), funciona hasta 90 días
//     después del pago. Se automatiza acá de punta a punta.
//   - Wompi SOLO permite anular (void) una transacción de tarjeta el
//     mismo día, antes de que se liquide. Pasado ese punto — que es
//     el caso normal, porque las devoluciones se piden días después
//     de la compra — Wompi NO tiene una API de reembolso propia: hay
//     que pedirlo a su soporte manualmente con el código de
//     autorización. Cuando pasa esto, la función no finge que se
//     resolvió solo — marca la solicitud como
//     "reembolso_manual_pendiente" y le dice al CEO exactamente qué
//     hacer.
//
// Requiere sesión de CEO (verify_jwt=true por defecto ya lo exige;
// acá además se verifica el rol).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { solicitud_id } = await req.json();
    if (!solicitud_id) {
      return new Response(JSON.stringify({ error: 'Falta solicitud_id' }), { status: 400, headers: corsHeaders });
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

    // Solo el CEO puede aprobar/procesar devoluciones — verificado acá
    // además de las policies de RLS, como con las funciones de pago.
    const { data: perfil } = await supabase.from('usuarios').select('rol').eq('id', user.id).single();
    if (perfil?.rol !== 'ceo') {
      return new Response(JSON.stringify({ error: 'Solo el CEO puede procesar devoluciones' }), { status: 403, headers: corsHeaders });
    }

    const { data: solicitud, error: errSolicitud } = await supabase
      .from('solicitudes_devolucion')
      .select('*, pedidos(*)')
      .eq('id', solicitud_id)
      .single();
    if (errSolicitud || !solicitud) {
      return new Response(JSON.stringify({ error: 'Solicitud no encontrada' }), { status: 404, headers: corsHeaders });
    }

    const pedido = solicitud.pedidos;
    let resultado;

    if (pedido.pasarela_pago === 'wompi') {
      resultado = await intentarReembolsoWompi(pedido);
    } else {
      // Por defecto, Mercado Pago (es la pasarela por defecto desde el
      // inicio del checkout, así que un pedido viejo sin
      // `pasarela_pago` guardado también cae acá).
      resultado = await intentarReembolsoMercadoPago(pedido);
    }

    await supabase
      .from('solicitudes_devolucion')
      .update({ estado: resultado.estado, notas_ceo: resultado.nota, fecha_resolucion: new Date().toISOString() })
      .eq('id', solicitud_id);

    if (resultado.estado === 'reembolsada') {
      await supabase.from('pedidos').update({ estado: 'devolucion' }).eq('id', pedido.id);
    }

    await supabase.from('eventos_log').insert({
      entidad: 'pedido',
      entidad_id: pedido.id,
      accion: resultado.estado === 'reembolsada' ? 'devolucion_reembolsada' : 'devolucion_requiere_gestion_manual',
      datos: { pasarela: pedido.pasarela_pago, detalle: resultado.nota },
      usuario_id: user.id,
    });

    return new Response(JSON.stringify(resultado), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Error inesperado procesando la devolución' }), { status: 500, headers: corsHeaders });
  }
});

async function intentarReembolsoMercadoPago(pedido: any) {
  if (!pedido.mercadopago_payment_id) {
    return { estado: 'reembolso_manual_pendiente', nota: 'No se encontró el id del pago de Mercado Pago para este pedido — revisa manualmente en el dashboard de Mercado Pago.' };
  }

  const resp = await fetch(`https://api.mercadopago.com/v1/payments/${pedido.mercadopago_payment_id}/refunds`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('MP_ACCESS_TOKEN')}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({}), // body vacío = reembolso total
  });

  if (resp.ok) {
    return { estado: 'reembolsada', nota: 'Reembolso total procesado automáticamente en Mercado Pago.' };
  }

  const detalle = await resp.json().catch(() => ({}));
  return { estado: 'reembolso_manual_pendiente', nota: `Mercado Pago rechazó el reembolso automático: ${JSON.stringify(detalle)}. Revisa manualmente en su dashboard.` };
}

async function intentarReembolsoWompi(pedido: any) {
  if (!pedido.wompi_transaction_id) {
    return { estado: 'reembolso_manual_pendiente', nota: 'No se encontró el id de la transacción de Wompi para este pedido — revisa manualmente en el dashboard de Wompi.' };
  }

  // Wompi solo permite anular (void) el mismo día, antes de que la
  // transacción se liquide. Lo intentamos, pero es normal que falle
  // si ya pasaron días desde la compra — eso NO es un error nuestro,
  // es una limitación real de Wompi.
  const resp = await fetch(`https://production.wompi.co/v1/transactions/${pedido.wompi_transaction_id}/void`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('WOMPI_PRIVATE_KEY')}` },
  });

  if (resp.ok) {
    return { estado: 'reembolsada', nota: 'Transacción anulada automáticamente en Wompi (mismo día de la compra).' };
  }

  return {
    estado: 'reembolso_manual_pendiente',
    nota:
      'Wompi no permite anular esta transacción automáticamente (probablemente ya se liquidó). ' +
      'Acción manual necesaria: contactar al soporte de Wompi (WhatsApp +57 322 2804391 o su formulario de soporte) ' +
      `con el ID de transacción ${pedido.wompi_transaction_id} para solicitar la reversión con el banco.`,
  };
}
