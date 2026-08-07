// supabase/functions/webhook-wompi/index.ts
//
// Wompi llama a esta URL cuando una transacción llega a un estado final
// (aprobada, rechazada, etc.) — igual que con Mercado Pago, esta es la
// única fuente de verdad confiable sobre si de verdad se cobró. La
// redirección que ve el cliente al volver es solo informativa.
//
// Configurar esta URL en el panel de Wompi → Desarrolladores → URL de
// eventos (tanto en Sandbox como en producción).
//
// Requiere el secret WOMPI_EVENTS_SECRET (distinto del
// WOMPI_INTEGRITY_SECRET — Wompi los llama "secreto de eventos" y
// "secreto de integridad", son dos llaves separadas en su dashboard).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

async function sha256Hex(texto: string) {
  const datos = new TextEncoder().encode(texto);
  const hashBuffer = await crypto.subtle.digest('SHA-256', datos);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const transaccion = body?.data?.transaction;
    if (!transaccion) return new Response('ok', { headers: corsHeaders });

    // Validamos que el evento de verdad viene de Wompi (y no de alguien
    // simulando la llamada) recalculando su firma con nuestro secreto.
    const eventKey = Deno.env.get('WOMPI_EVENTS_SECRET')!;
    const cadena = `${transaccion.id}${transaccion.status}${transaccion.amount_in_cents}${body.timestamp}${eventKey}`;
    const firmaCalculada = await sha256Hex(cadena);

    if (firmaCalculada !== body?.signature?.checksum) {
      console.error('Firma de Wompi inválida — se ignora el evento por seguridad.');
      return new Response('firma inválida', { status: 400, headers: corsHeaders });
    }

    const pedidoId = transaccion.reference; // usamos el id del pedido como referencia
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    if (transaccion.status === 'APPROVED') {
      await supabase
        .from('pedidos')
        .update({ pago_confirmado: true, wompi_transaction_id: transaccion.id, estado: 'confirmado' })
        .eq('id', pedidoId);

      await supabase.from('eventos_log').insert({
        entidad: 'pedido',
        entidad_id: pedidoId,
        accion: 'pago_aprobado',
        datos: { pasarela: 'wompi', wompi_transaction_id: transaccion.id, metodo: transaccion.payment_method_type, monto: transaccion.amount_in_cents / 100 },
      });
    } else if (['DECLINED', 'ERROR', 'VOIDED'].includes(transaccion.status)) {
      await supabase.from('eventos_log').insert({
        entidad: 'pedido',
        entidad_id: pedidoId,
        accion: 'pago_rechazado',
        datos: { pasarela: 'wompi', wompi_transaction_id: transaccion.id, estado: transaccion.status },
      });
    }
    // PENDING (común en PSE/Efecty, que tardan en confirmar) — esperamos
    // el siguiente evento, no hacemos nada todavía.

    return new Response('ok', { headers: corsHeaders });
  } catch (e) {
    console.error(e);
    return new Response('ok', { headers: corsHeaders });
  }
});
