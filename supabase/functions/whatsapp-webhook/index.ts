// supabase/functions/whatsapp-webhook/index.ts
//
// Cuarta función de IA — la más grande de las cuatro, porque no es
// solo "llamar a Claude": necesita una integración real con WhatsApp
// (Twilio), validar que cada mensaje entrante sea de verdad de
// Twilio (no de cualquiera simulando el webhook), mantener el
// historial de la conversación (los webhooks no tienen memoria por sí
// solos), y sobre todo, decidir CUÁNDO la IA puede responder sola y
// cuándo tiene que avisarte a vos.
//
// Política de derivación a humano (decisión de producto, no solo de
// código): como Cumbo lo operás vos solo, "derivar a un humano" acá
// significa marcar la conversación para que la veas en Panel Cumbo →
// WhatsApp y respondas vos mismo — no hay un equipo de agentes atrás.
// La IA deriva cuando:
//   - el cliente pide explícitamente hablar con una persona
//   - la conversación es sobre un reembolso, un reclamo, o un pago
//   - la IA no tiene suficiente información real para responder bien
//
// Requiere estos secrets:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER
//   ANTHROPIC_API_KEY
//
// IMPORTANTE: esta función NO exige sesión de Supabase (verify_jwt
// desactivado para ella en config.toml) — Twilio no tiene ni puede
// tener una sesión de Cumbo. En cambio, valida la firma real de
// Twilio (X-Twilio-Signature) para confirmar que el mensaje es
// auténtico — el mismo principio que usan los webhooks de pago, pero
// con el mecanismo propio de Twilio.

import { createClient } from 'jsr:@supabase/supabase-js@2';

async function validarFirmaTwilio(url: string, params: Record<string, string>, firmaRecibida: string, authToken: string) {
  // Twilio firma: HMAC-SHA1(authToken, url + params ordenados y
  // concatenados como clave+valor) — documentado en
  // twilio-messaging-webhooks. Se reconstruye acá a mano porque el
  // SDK de Node de Twilio no corre nativo en Deno.
  const claves = Object.keys(params).sort();
  let datos = url;
  for (const clave of claves) datos += clave + params[clave];

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(authToken), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const firma = await crypto.subtle.sign('HMAC', key, encoder.encode(datos));
  const firmaBase64 = btoa(String.fromCharCode(...new Uint8Array(firma)));
  return firmaBase64 === firmaRecibida;
}

function respuestaTwiml(mensaje: string) {
  // No usamos el SDK de Twilio (no corre en Deno) — TwiML es solo XML,
  // se puede construir a mano sin problema.
  const escapado = mensaje.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapado}</Message></Response>`, {
    headers: { 'Content-Type': 'text/xml' },
  });
}

function respuestaVacia() {
  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response/>', { headers: { 'Content-Type': 'text/xml' } });
}

Deno.serve(async (req) => {
  try {
    const bodyTexto = await req.text();
    const params = Object.fromEntries(new URLSearchParams(bodyTexto));

    const firmaValida = await validarFirmaTwilio(req.url, params, req.headers.get('X-Twilio-Signature') || '', Deno.env.get('TWILIO_AUTH_TOKEN')!);
    if (!firmaValida) {
      console.error('Firma de Twilio inválida — se ignora el mensaje por seguridad.');
      return new Response('firma inválida', { status: 403 });
    }

    const telefono = params.From?.replace('whatsapp:', '') || '';
    const mensajeEntrante = params.Body || '';
    if (!telefono || !mensajeEntrante) return respuestaVacia();

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: conversacion } = await supabase.from('whatsapp_conversaciones').select('*').eq('telefono', telefono).maybeSingle();
    const historialPrevio = conversacion?.historial || [];

    // Si ya está marcada como "requiere humano", no respondemos con
    // IA — solo guardamos el mensaje para que lo veas en Panel Cumbo.
    // No queremos que la IA siga contestando mientras vos ya estás en
    // medio de esa conversación.
    if (conversacion?.requiere_humano) {
      await supabase
        .from('whatsapp_conversaciones')
        .update({ historial: [...historialPrevio, { rol: 'usuario', texto: mensajeEntrante, fecha: new Date().toISOString() }], actualizado_en: new Date().toISOString() })
        .eq('telefono', telefono);
      return respuestaVacia();
    }

    // Buscamos el pedido más reciente de este número, para poder
    // responder preguntas de estado con datos reales — nunca
    // inventados.
    const { data: pedidoReciente } = await supabase
      .from('pedidos')
      .select('id, estado, total, transportadora, guia_transportadora, fecha')
      .eq('telefono_contacto', telefono)
      .order('fecha', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: faqData } = await supabase.from('contenido_app').select('valor').eq('clave', 'home_faq').maybeSingle();
    const preguntasFrecuentes = (faqData?.valor || []).map((f: any) => f.pregunta).join('\n');

    const contextoPedido = pedidoReciente
      ? `Su pedido más reciente (#${pedidoReciente.id.slice(0, 8)}): estado "${pedidoReciente.estado}"${pedidoReciente.transportadora ? `, transportadora ${pedidoReciente.transportadora}` : ''}${pedidoReciente.guia_transportadora ? `, guía ${pedidoReciente.guia_transportadora}` : ''}, total $${pedidoReciente.total}.`
      : 'No se encontró ningún pedido asociado a este número.';

    const systemPrompt = `Eres el asistente de atención al cliente de Cumbo, por WhatsApp. Tono breve, cálido, directo — WhatsApp no es para párrafos largos.

DATOS REALES que podés usar (nunca inventes nada que no esté acá):
${contextoPedido}

Preguntas frecuentes que la gente suele hacer (como referencia de qué se puede responder con confianza):
${preguntasFrecuentes || '(sin preguntas frecuentes cargadas)'}

REGLA MÁS IMPORTANTE: si el cliente pide hablar con una persona, si el tema es un reembolso/reclamo/problema de pago, o si no tenés información real para responder bien, terminá tu mensaje con esta línea exacta en una línea aparte: [[DERIVAR_HUMANO]]
Cuando derives, tu mensaje visible debe avisarle a la persona que en breve alguien del equipo le responde — nunca prometas tiempos ni resultados que no podés garantizar.`;

    const mensajesParaClaude = [...historialPrevio.map((m: any) => ({ role: m.rol === 'usuario' ? 'user' : 'assistant', content: m.texto })), { role: 'user', content: mensajeEntrante }];

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 350, system: systemPrompt, messages: mensajesParaClaude }),
    });

    if (!resp.ok) {
      console.error('Error de la API de Claude:', await resp.text());
      // Si la IA falla, mejor derivar a humano que dejar al cliente sin respuesta.
      await supabase
        .from('whatsapp_conversaciones')
        .upsert({ telefono, historial: [...historialPrevio, { rol: 'usuario', texto: mensajeEntrante, fecha: new Date().toISOString() }], requiere_humano: true, actualizado_en: new Date().toISOString() });
      return respuestaTwiml('Gracias por escribirnos — en breve alguien del equipo Cumbo te responde por acá.');
    }

    const data = await resp.json();
    let textoRespuesta = data.content?.[0]?.text?.trim() || '';
    const debeDerivar = textoRespuesta.includes('[[DERIVAR_HUMANO]]');
    textoRespuesta = textoRespuesta.replace('[[DERIVAR_HUMANO]]', '').trim();

    const nuevoHistorial = [
      ...historialPrevio,
      { rol: 'usuario', texto: mensajeEntrante, fecha: new Date().toISOString() },
      { rol: 'cumbito', texto: textoRespuesta, fecha: new Date().toISOString() },
    ];

    await supabase
      .from('whatsapp_conversaciones')
      .upsert({ telefono, historial: nuevoHistorial, requiere_humano: debeDerivar, actualizado_en: new Date().toISOString() });

    return respuestaTwiml(textoRespuesta);
  } catch (e) {
    console.error(e);
    return respuestaVacia();
  }
});
