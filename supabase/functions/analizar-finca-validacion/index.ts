// supabase/functions/analizar-finca-validacion/index.ts
//
// Reemplaza y amplía a clasificar-calidad-cafe (que solo miraba la
// foto del grano): esto analiza la foto de cultivo + la foto de grano
// + si los datos declarados (altitud, humedad, proceso) son
// coherentes entre sí — y te da UNA recomendación de apoyo antes de
// que decidas validar o rechazar la finca.
//
// REGLA DE AUTONOMÍA: esto es puro apoyo, nunca decide. Nunca cambia
// `fincas.estado` — eso lo seguís haciendo vos con los botones que ya
// existían en Panel Cumbo. La calidad de taza real y la legitimidad
// de una finca las certifica una persona, no una foto analizada por
// IA — se lo dice así, explícitamente, hasta en la respuesta que
// genera.
//
// Requiere sesión de CEO y el secret ANTHROPIC_API_KEY.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

async function imagenABase64(url: string) {
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const tipo = resp.headers.get('content-type') || 'image/jpeg';
  const bytes = new Uint8Array(await resp.arrayBuffer());
  let binario = '';
  for (let i = 0; i < bytes.length; i++) binario += String.fromCharCode(bytes[i]);
  return { tipo, datos: btoa(binario) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { finca_id } = await req.json();
    if (!finca_id) {
      return new Response(JSON.stringify({ error: 'Falta finca_id' }), { status: 400, headers: corsHeaders });
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

    const { data: finca, error: errFinca } = await supabase.from('fincas').select('*').eq('id', finca_id).single();
    if (errFinca || !finca) {
      return new Response(JSON.stringify({ error: 'Finca no encontrada' }), { status: 404, headers: corsHeaders });
    }

    const [imagenCultivo, imagenGrano] = await Promise.all([
      imagenABase64(finca.certificacion_foto_cultivo),
      imagenABase64(finca.certificacion_foto_grano),
    ]);

    if (!imagenCultivo && !imagenGrano) {
      return new Response(JSON.stringify({ error: 'No se pudo descargar ninguna de las dos fotos' }), {
        status: 502,
        headers: corsHeaders,
      });
    }

    const datosDelcarados = `
Región declarada: ${finca.region}
Vereda: ${finca.vereda || 'N/D'}
Altitud declarada: ${finca.altitud_msnm || 'N/D'} msnm
Especie: ${finca.especie || 'N/D'}
Proceso: ${finca.proceso || 'N/D'}
Estado del grano: ${finca.estado_grano || 'N/D'}
Humedad del grano: ${finca.humedad_grano || 'N/D'}%
Malla: ${finca.malla_grano || 'N/D'}`;

    const prompt = `Eres un asistente que ayuda a un equipo de café de especialidad colombiano a hacer una PRIMERA lectura antes de validar una finca nueva en su plataforma — NUNCA reemplazás la verificación real de una persona ni una catación certificada, solo dás una lectura de apoyo.

Datos que el caficultor declaró al registrarse:
${datosDelcarados}

Con las fotos adjuntas (cultivo y/o grano, según cuáles se pudieron cargar) y estos datos, evaluá:
1. ¿Las fotos parecen mostrar de verdad un cultivo/grano de café real y coherente con lo declarado?
2. ¿Los datos numéricos son plausibles? (la altitud típica de café de especialidad en Colombia es 800-2200 msnm; la humedad de grano bien seco suele estar entre 10-13%; considerá si la región y altitud declaradas son geográficamente coherentes según tu conocimiento de las regiones cafeteras de Colombia)
3. ¿Hay algo inconsistente o que amerite pedirle más información al caficultor antes de decidir?

Respondé ÚNICAMENTE con un JSON (sin texto adicional, sin \`\`\`) con esta forma exacta:
{"riesgo": "bajo" | "medio" | "alto", "hallazgos": ["lista corta de observaciones concretas, en español"], "recomendacion": "1-2 frases con tu sugerencia — nunca 'validar' o 'rechazar' en automático, siempre como sugerencia para que el CEO decida"}`;

    const contenido: Record<string, unknown>[] = [];
    if (imagenCultivo)
      contenido.push({ type: 'image', source: { type: 'base64', media_type: imagenCultivo.tipo, data: imagenCultivo.datos } });
    if (imagenGrano) contenido.push({ type: 'image', source: { type: 'base64', media_type: imagenGrano.tipo, data: imagenGrano.datos } });
    contenido.push({ type: 'text', text: prompt });

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 600, messages: [{ role: 'user', content: contenido }] }),
    });

    if (!resp.ok) {
      console.error('Error de la API de Claude:', await resp.text());
      return new Response(JSON.stringify({ error: 'No se pudo analizar la finca en este momento' }), { status: 502, headers: corsHeaders });
    }

    const data = await resp.json();
    const textoRespuesta = data.content?.[0]?.text?.trim() || '{}';

    let analisis;
    try {
      analisis = JSON.parse(textoRespuesta.replace(/^```json\s*|\s*```$/g, ''));
    } catch {
      analisis = { riesgo: 'medio', hallazgos: ['No se pudo interpretar la respuesta de la IA.'], recomendacion: 'Revisar manualmente.' };
    }

    return new Response(JSON.stringify(analisis), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Error inesperado analizando la finca' }), { status: 500, headers: corsHeaders });
  }
});
