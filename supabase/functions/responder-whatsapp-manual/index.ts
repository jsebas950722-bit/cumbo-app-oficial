// supabase/functions/responder-whatsapp-manual/index.ts
//
// Cuando una conversación queda marcada como "requiere_humano", el CEO
// la ve en Panel Cumbo → WhatsApp y responde desde ahí. Esta función
// manda ese mensaje de verdad por WhatsApp (vía la API de Twilio) y
// marca la conversación como resuelta.
//
// Nota real sobre WhatsApp que no se puede evitar: si pasaron más de
// 24 horas desde el último mensaje del cliente, Twilio/WhatsApp NO
// permite mandar un mensaje libre — hay que usar una plantilla
// pre-aprobada por Meta (ver twilio-content-template-builder). Esta
// función intenta el mensaje libre primero; si Twilio lo rechaza por
// la ventana de 24 horas, te avisa exactamente por qué en vez de
// fallar en silencio.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { telefono, mensaje } = await req.json();
    if (!telefono || !mensaje?.trim()) {
      return new Response(JSON.stringify({ error: 'Falta el teléfono o el mensaje' }), { status: 400, headers: corsHeaders });
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
    const { data: perfil } = await supabase.from('usuarios').select('rol').eq('id', user.id).single();
    if (perfil?.rol !== 'ceo') {
      return new Response(JSON.stringify({ error: 'Solo el CEO puede responder desde acá' }), { status: 403, headers: corsHeaders });
    }

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')!;
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')!;
    const numeroTwilio = Deno.env.get('TWILIO_WHATSAPP_NUMBER')!; // formato: whatsapp:+1415...

    const cuerpo = new URLSearchParams({
      From: numeroTwilio,
      To: `whatsapp:${telefono}`,
      Body: mensaje.trim(),
    });

    const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: cuerpo,
    });

    if (!resp.ok) {
      const detalle = await resp.json().catch(() => ({}));
      console.error('Error de Twilio:', detalle);
      const fueraDeVentana = detalle?.code === 63016 || detalle?.code === 63015;
      return new Response(
        JSON.stringify({
          error: fueraDeVentana
            ? 'Pasaron más de 24h desde el último mensaje del cliente — WhatsApp exige una plantilla pre-aprobada para escribirle de nuevo, no se puede mandar un mensaje libre.'
            : 'No se pudo enviar el mensaje por WhatsApp.',
          detalle,
        }),
        { status: 502, headers: corsHeaders }
      );
    }

    const { data: conversacion } = await supabase.from('whatsapp_conversaciones').select('historial').eq('telefono', telefono).single();
    await supabase
      .from('whatsapp_conversaciones')
      .update({
        historial: [...(conversacion?.historial || []), { rol: 'ceo', texto: mensaje.trim(), fecha: new Date().toISOString() }],
        requiere_humano: false,
        actualizado_en: new Date().toISOString(),
      })
      .eq('telefono', telefono);

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Error inesperado enviando el mensaje' }), { status: 500, headers: corsHeaders });
  }
});
