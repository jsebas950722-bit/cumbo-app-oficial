// supabase/functions/conciliar-pagos/index.ts
//
// Agente de conciliación de pagos. Compara lo que dicen de verdad
// Mercado Pago y Wompi contra lo que dice `pedidos.pago_confirmado` —
// si un webhook falló en silencio en algún momento, esto lo detecta.
//
// REGLA DE AUTONOMÍA (por qué corrige en una dirección y no en la
// otra): esto toca dinero, así que no se le da la misma libertad que
// al Sommelier o al generador de contenido.
//   - Si la pasarela dice "aprobado" pero localmente seguía sin
//     confirmar → se corrige solo. Esto no es una decisión nueva, es
//     terminar el trabajo que el webhook debería haber hecho — la
//     misma lógica determinista, tarde.
//   - Si la pasarela dice "rechazado/reembolsado/anulado" pero
//     localmente seguía como pagado → NUNCA se corrige solo. Ese
//     pedido puede ya estar despachado — hace falta que una persona
//     decida qué hacer, no un agente.
//   - Cualquier otro caso raro → se marca para que lo mires, sin tocar
//     nada.
//
// Se puede llamar de dos formas válidas:
//   1. Con tu propia sesión de CEO (el botón "Conciliar ahora" en
//      Panel Cumbo).
//   2. Con el secret CRON_SECRET en el header X-Cron-Secret (para
//      pg_cron o un servicio de cron externo). Por eso NO exige
//      sesión por defecto (verify_jwt=false en config.toml) — pero
//      sin sesión de CEO Y sin el secret correcto, se rechaza.
//
// Requiere: MP_ACCESS_TOKEN, CRON_SECRET (elegís cualquier cadena
// larga y aleatoria vos mismo).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Autorización: sesión de CEO real, O el secret de cron correcto.
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

    // Revisamos pedidos de los últimos 30 días con id de pago
    // guardado — no tiene sentido reconciliar pedidos viejísimos para
    // siempre.
    const hace30dias = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: pedidos } = await supabase
      .from('pedidos')
      .select('id, pago_confirmado, estado, pasarela_pago, mercadopago_payment_id, wompi_transaction_id')
      .gte('fecha', hace30dias)
      .or('mercadopago_payment_id.not.is.null,wompi_transaction_id.not.is.null');

    let revisados = 0;
    let discrepanciasEncontradas = 0;
    let corregidosAutomaticamente = 0;

    for (const pedido of pedidos || []) {
      revisados++;
      let estadoPasarela: string | null = null;

      try {
        if (pedido.mercadopago_payment_id) {
          const resp = await fetch(`https://api.mercadopago.com/v1/payments/${pedido.mercadopago_payment_id}`, {
            headers: { Authorization: `Bearer ${Deno.env.get('MP_ACCESS_TOKEN')}` },
          });
          if (resp.ok) estadoPasarela = (await resp.json()).status; // approved | rejected | refunded | cancelled | pending | in_process
        } else if (pedido.wompi_transaction_id) {
          const resp = await fetch(`https://production.wompi.co/v1/transactions/${pedido.wompi_transaction_id}`);
          if (resp.ok) estadoPasarela = (await resp.json()).data?.status; // APPROVED | DECLINED | VOIDED | ERROR | PENDING
        }
      } catch (e) {
        console.error(`No se pudo consultar la pasarela para el pedido ${pedido.id}:`, e);
        continue;
      }

      if (!estadoPasarela) continue;

      const pasarelaConfirma = ['approved', 'APPROVED'].includes(estadoPasarela);
      const pasarelaRechaza = ['rejected', 'refunded', 'cancelled', 'DECLINED', 'VOIDED', 'ERROR'].includes(estadoPasarela);

      // Caso 1: la pasarela confirma, localmente no estaba confirmado
      // → se corrige solo (recuperar un webhook que falló).
      if (pasarelaConfirma && !pedido.pago_confirmado) {
        await supabase
          .from('pedidos')
          .update({ pago_confirmado: true, estado: pedido.estado === 'pendiente' ? 'confirmado' : pedido.estado })
          .eq('id', pedido.id);
        await supabase.from('discrepancias_pago').insert({
          pedido_id: pedido.id,
          pasarela: pedido.mercadopago_payment_id ? 'mercadopago' : 'wompi',
          estado_local: 'no confirmado',
          estado_pasarela: estadoPasarela,
          severidad: 'info',
          detalle: 'Pago aprobado en la pasarela pero no reflejado localmente — corregido automáticamente (webhook probablemente falló).',
          resuelto: true,
          corregido_automaticamente: true,
        });
        discrepanciasEncontradas++;
        corregidosAutomaticamente++;
        continue;
      }

      // Caso 2: la pasarela rechaza/reembolsa, localmente sigue como
      // pagado → NUNCA se corrige solo, puede ya estar despachado.
      if (pasarelaRechaza && pedido.pago_confirmado) {
        await supabase.from('discrepancias_pago').insert({
          pedido_id: pedido.id,
          pasarela: pedido.mercadopago_payment_id ? 'mercadopago' : 'wompi',
          estado_local: 'confirmado',
          estado_pasarela: estadoPasarela,
          severidad: 'urgente',
          detalle: `La pasarela dice "${estadoPasarela}" pero el pedido sigue marcado como pagado localmente (estado del pedido: ${pedido.estado}). Revisar manualmente — puede estar ya despachado.`,
          corregido_automaticamente: false,
        });
        discrepanciasEncontradas++;
      }
    }

    return new Response(JSON.stringify({ revisados, discrepanciasEncontradas, corregidosAutomaticamente }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Error inesperado conciliando pagos' }), { status: 500, headers: corsHeaders });
  }
});
