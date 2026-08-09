// supabase/functions/clasificar-calidad-cafe/index.ts
//
// Segunda función de IA (en orden de menor a mayor complejidad):
// analiza la foto del grano que el caficultor sube en Portal
// Caficultor, y le da al CEO una lectura de apoyo en Panel Cumbo antes
// de validar o rechazar una finca.
//
// IMPORTANTE — esto es una herramienta de asistencia, no un
// certificado de calidad real. La calidad real del café de
// especialidad se determina catando (protocolo SCA), no con una foto.
// El prompt y la respuesta lo dejan explícito, y la interfaz de Panel
// Cumbo también — para que nadie confunda "la IA dijo que es buena"
// con una certificación real.
//
// Requiere sesión de CEO (verify_jwt=true por defecto ya lo exige,
// acá además se verifica el rol) y el secret ANTHROPIC_API_KEY.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { foto_grano_url } = await req.json();
    if (!foto_grano_url) {
      return new Response(JSON.stringify({ error: 'Falta foto_grano_url' }), { status: 400, headers: corsHeaders });
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
      return new Response(JSON.stringify({ error: 'Solo el CEO puede usar esta herramienta' }), { status: 403, headers: corsHeaders });
    }

    // Traemos la imagen y la convertimos a base64 — la API de Claude
    // necesita los bytes de la imagen, no solo el link.
    const respImagen = await fetch(foto_grano_url);
    if (!respImagen.ok) {
      return new Response(JSON.stringify({ error: 'No se pudo descargar la foto del grano' }), { status: 502, headers: corsHeaders });
    }
    const tipoImagen = respImagen.headers.get('content-type') || 'image/jpeg';
    const bytesImagen = new Uint8Array(await respImagen.arrayBuffer());
    let binario = '';
    for (let i = 0; i < bytesImagen.length; i++) binario += String.fromCharCode(bytesImagen[i]);
    const base64Imagen = btoa(binario);

    const prompt = `Eres un asistente que ayuda a un equipo de café de especialidad a hacer una PRIMERA lectura visual del grano antes de una validación manual — NUNCA reemplazas la catación real (protocolo SCA), que es la única forma confiable de determinar calidad de taza.

Mirando la foto del grano de café, responde ÚNICAMENTE con un JSON (sin texto adicional, sin \`\`\`) con esta forma exacta:
{
  "defectos_visibles": ["lista corta de defectos visibles, ej: grano partido, insecto, decoloración — vacío si no ves ninguno"],
  "uniformidad": "alta" | "media" | "baja",
  "resumen": "1-2 frases describiendo lo que ves, en español, tono neutral y objetivo",
  "confianza": "alta" | "media" | "baja"
}

Si la imagen no muestra granos de café con claridad, dilo en "resumen" y pon confianza "baja".`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: tipoImagen, data: base64Imagen } },
              { type: 'text', text: prompt },
            ],
          },
        ],
      }),
    });

    if (!resp.ok) {
      const detalle = await resp.text();
      console.error('Error de la API de Claude:', detalle);
      return new Response(JSON.stringify({ error: 'No se pudo analizar la imagen en este momento' }), { status: 502, headers: corsHeaders });
    }

    const data = await resp.json();
    const textoRespuesta = data.content?.[0]?.text?.trim() || '{}';

    let analisis;
    try {
      analisis = JSON.parse(textoRespuesta.replace(/^```json\s*|\s*```$/g, ''));
    } catch {
      analisis = { resumen: 'No se pudo interpretar la respuesta de la IA.', confianza: 'baja', defectos_visibles: [], uniformidad: 'media' };
    }

    return new Response(JSON.stringify(analisis), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Error inesperado analizando la imagen' }), { status: 500, headers: corsHeaders });
  }
});
