// supabase/functions/crear-pago-wompi/index.ts
//
// Wompi (la pasarela de Bancolombia) incluye tarjetas, PSE, Nequi y
// Efecty dentro de un mismo checkout — no hay que integrar cada uno
// por separado. Esta función arma el link de ese checkout para un
// pedido real.
//
// Por qué esto no se puede hacer solo en el navegador: Wompi exige una
// "firma de integridad" (un hash SHA-256 de referencia+monto+moneda+
// secreto) para que nadie pueda alterar el monto a cobrar desde el
// navegador. Ese secreto (`WOMPI_INTEGRITY_SECRET`) es privado — tiene
// que calcularse en el servidor, igual que el access token de Mercado
// Pago.
//
// Requiere estos secrets configurados en Supabase:
//   WOMPI_PUBLIC_KEY        → llave pública de Wompi (pub_...)
//   WOMPI_INTEGRITY_SECRET  → secreto de integridad (del dashboard de Wompi)
//   FRONTEND_URL            → URL pública de tu app
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY → ya vienen inyectadas por Supabase

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
    const { pedido_id } = await req.json();
    if (!pedido_id) {
      return new Response(JSON.stringify({ error: 'Falta pedido_id' }), { status: 400, headers: corsHeaders });
    }

    // Identificamos QUIÉN llama, usando su propio token — no la service
    // role key. Igual que en crear-preferencia-pago: verify_jwt=true ya
    // exige sesión válida, pero acá confirmamos que sea DUEÑA del pedido.
    const supabaseComoUsuario = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } },
    });
    const { data: { user }, error: errUsuario } = await supabaseComoUsuario.auth.getUser();
    if (errUsuario || !user) {
      return new Response(JSON.stringify({ error: 'Sesión inválida' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: pedido, error: errPedido } = await supabase.from('pedidos').select('id, total, cliente_id').eq('id', pedido_id).single();
    if (errPedido || !pedido) {
      return new Response(JSON.stringify({ error: 'Pedido no encontrado' }), { status: 404, headers: corsHeaders });
    }

    if (pedido.cliente_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Este pedido no te pertenece' }), { status: 403, headers: corsHeaders });
    }

    // Wompi cobra en centavos — $45.000 COP = 4500000.
    const amountInCents = Math.round(Number(pedido.total) * 100);
    const currency = 'COP';
    const reference = pedido.id; // referencia única — usamos el mismo id del pedido

    const secreto = Deno.env.get('WOMPI_INTEGRITY_SECRET')!;
    const cadenaFirma = `${reference}${amountInCents}${currency}${secreto}`;
    const firma = await sha256Hex(cadenaFirma);

    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'http://localhost:5173';
    const redirectUrl = `${frontendUrl}/mis-pedidos?pago=exitoso`;

    const parametros = new URLSearchParams({
      'public-key': Deno.env.get('WOMPI_PUBLIC_KEY')!,
      currency,
      'amount-in-cents': String(amountInCents),
      reference,
      'signature:integrity': firma,
      'redirect-url': redirectUrl,
    });

    const checkoutUrl = `https://checkout.wompi.co/p/?${parametros.toString()}`;

    await supabase.from('pedidos').update({ pasarela_pago: 'wompi' }).eq('id', pedido_id);

    return new Response(JSON.stringify({ init_point: checkoutUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Error inesperado creando el pago con Wompi' }), { status: 500, headers: corsHeaders });
  }
});
