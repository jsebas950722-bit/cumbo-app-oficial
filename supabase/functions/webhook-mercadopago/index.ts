// supabase/functions/webhook-mercadopago/index.ts
//
// Mercado Pago llama a esta URL automáticamente cada vez que el estado de
// un pago cambia (aprobado, rechazado, pendiente...). Es la ÚNICA fuente
// de verdad confiable sobre si de verdad se cobró — la pantalla de éxito
// que ve el cliente al volver del checkout es solo una señal optimista,
// nunca hay que confiar en ella sola para marcar un pedido como pagado.
//
// Configurar esta URL en el panel de Mercado Pago (o se configura sola,
// porque ya se la mandamos en `notification_url` al crear la preferencia).
//
// Requiere las mismas variables de entorno que crear-preferencia-pago.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const url = new URL(req.url);

    // Mercado Pago manda el id del pago a veces por query string, a veces
    // en el body — cubrimos ambos casos.
    const paymentId = body?.data?.id || url.searchParams.get('id') || url.searchParams.get('data.id');
    const tipo = body?.type || url.searchParams.get('type');

    if (tipo !== 'payment' || !paymentId) {
      // Mercado Pago también manda notificaciones de otros tipos
      // (merchant_order, etc.) — las ignoramos silenciosamente.
      return new Response('ok', { headers: corsHeaders });
    }

    // Consultamos el pago real a la API de Mercado Pago — nunca confiamos
    // en los datos del webhook por sí solos, siempre se verifica contra
    // su API con nuestro access token.
    const respuestaPago = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${Deno.env.get('MP_ACCESS_TOKEN')}` },
    });
    const pago = await respuestaPago.json();

    const pedidoId = pago.external_reference;
    if (!pedidoId) return new Response('ok', { headers: corsHeaders });

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    if (pago.status === 'approved') {
      await supabase
        .from('pedidos')
        .update({ pago_confirmado: true, mercadopago_payment_id: String(paymentId), estado: 'confirmado' })
        .eq('id', pedidoId);

      await supabase.from('eventos_log').insert({
        entidad: 'pedido',
        entidad_id: pedidoId,
        accion: 'pago_aprobado',
        datos: { mercadopago_payment_id: paymentId, monto: pago.transaction_amount },
      });
    } else if (pago.status === 'rejected') {
      await supabase.from('eventos_log').insert({
        entidad: 'pedido',
        entidad_id: pedidoId,
        accion: 'pago_rechazado',
        datos: { mercadopago_payment_id: paymentId, motivo: pago.status_detail },
      });
    }
    // Si está "pending" (ej: Efecty en efectivo) no hacemos nada todavía —
    // esperamos la siguiente notificación cuando de verdad se confirme.

    return new Response('ok', { headers: corsHeaders });
  } catch (e) {
    console.error(e);
    // Respondemos 200 igual — si le devolvemos error a Mercado Pago,
    // reintenta la notificación varias veces innecesariamente.
    return new Response('ok', { headers: corsHeaders });
  }
});
