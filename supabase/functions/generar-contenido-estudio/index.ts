// supabase/functions/generar-contenido-estudio/index.ts
//
// Cumbo Estudio: genera un calendario de contenido de marketing (varias
// piezas, cada una con día/plataforma/guion) para que un caficultor o
// vendedor promocione lo que vende — a partir de sus productos REALES,
// no genérico. Respeta el límite mensual de su plan (Chispa/Cosecha/
// Finca Completa, ver suscripciones_estudio).
//
// Requiere sesión válida (verify_jwt=true por defecto) y el secret
// ANTHROPIC_API_KEY.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Límites por plan — ajustables acá o directo en la tabla
// suscripciones_estudio sin tocar código. Esto NO cobra
// automáticamente cada mes, solo limita cuánto se puede generar —
// cobrar la suscripción recurrente es una pieza aparte, todavía no
// construida (ver README).
const LIMITES_PLAN: Record<string, number> = { chispa: 3, cosecha: 15, finca_completa: 50 };
const NOMBRE_PLAN: Record<string, string> = { chispa: 'Chispa', cosecha: 'Cosecha', finca_completa: 'Finca Completa' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { tema, cantidad_piezas, consentimiento_avatar } = await req.json();
    if (!tema?.trim()) {
      return new Response(JSON.stringify({ error: 'Falta el tema del contenido' }), { status: 400, headers: corsHeaders });
    }
    const numPiezas = Math.min(Math.max(parseInt(cantidad_piezas, 10) || 3, 1), 7);

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

    // Traemos (o creamos) la suscripción del vendedor, y reiniciamos
    // el contador si cambió el mes desde la última vez.
    const periodoActual = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
    let { data: suscripcion } = await supabase.from('suscripciones_estudio').select('*').eq('vendedor_id', user.id).maybeSingle();

    if (!suscripcion) {
      const { data: nueva } = await supabase
        .from('suscripciones_estudio')
        .insert({ vendedor_id: user.id, plan: 'chispa', usos_este_mes: 0, periodo_actual: periodoActual })
        .select()
        .single();
      suscripcion = nueva;
    } else if (suscripcion.periodo_actual !== periodoActual) {
      const { data: reiniciada } = await supabase
        .from('suscripciones_estudio')
        .update({ usos_este_mes: 0, periodo_actual: periodoActual })
        .eq('vendedor_id', user.id)
        .select()
        .single();
      suscripcion = reiniciada;
    }

    const limite = LIMITES_PLAN[suscripcion.plan] ?? LIMITES_PLAN.chispa;
    if (suscripcion.usos_este_mes >= limite) {
      return new Response(
        JSON.stringify({
          error: `Ya usaste los ${limite} contenidos de tu plan ${NOMBRE_PLAN[suscripcion.plan]} este mes. Escríbenos por WhatsApp para subir de plan.`,
        }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Productos reales del vendedor — el contenido se genera sobre lo
    // que de verdad vende, no genérico.
    const { data: productos } = await supabase.from('productos').select('nombre, precio, caracteristicas').eq('vendedor_id', user.id).eq('activo', true);
    const { data: fincas } = await supabase.from('fincas').select('nombre_finca, region, proceso, especie').eq('caficultor_id', user.id).eq('estado', 'validada');

    const catalogoTexto = [
      ...(productos || []).map((p) => `- ${p.nombre} ($${p.precio})${p.caracteristicas ? `: ${p.caracteristicas}` : ''}`),
      ...(fincas || []).map((f) => `- Café de ${f.nombre_finca}, ${f.region}, proceso ${f.proceso}, ${f.especie}`),
    ].join('\n');

    if (!catalogoTexto) {
      return new Response(JSON.stringify({ error: 'Todavía no tienes productos o una finca validada para generar contenido sobre ellos.' }), { status: 400, headers: corsHeaders });
    }

    const prompt = `Sos un asistente de marketing para Cumbo, una plataforma colombiana de café de especialidad. Generá un calendario de contenido de ${numPiezas} piezas sobre el tema "${tema}", basado ÚNICAMENTE en este catálogo real (nunca inventes productos que no estén acá):
${catalogoTexto}

${consentimiento_avatar ? 'El vendedor autorizó usar un avatar de IA — podés sugerir guiones para video corto con presentador.' : 'El vendedor NO autorizó avatar de IA — los guiones deben ser para foto/carrusel con texto, sin presentador ni video hablado.'}

Respondé ÚNICAMENTE con un array JSON (sin texto adicional, sin \`\`\`) con esta forma exacta, un objeto por pieza:
[{"dia": 1, "plataforma": "Instagram" | "WhatsApp Estados" | "Facebook", "guion": "texto corto y natural, listo para publicar, en español colombiano"}]`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 1200, messages: [{ role: 'user', content: prompt }] }),
    });

    if (!resp.ok) {
      console.error('Error de la API de Claude:', await resp.text());
      return new Response(JSON.stringify({ error: 'No se pudo generar el contenido en este momento' }), { status: 502, headers: corsHeaders });
    }

    const data = await resp.json();
    const textoRespuesta = data.content?.[0]?.text?.trim() || '[]';
    let piezas;
    try {
      piezas = JSON.parse(textoRespuesta.replace(/^```json\s*|\s*```$/g, '')).map((p: Record<string, unknown>) => ({ ...p, estado: 'borrador' }));
    } catch {
      return new Response(JSON.stringify({ error: 'La IA devolvió una respuesta que no se pudo interpretar. Intenta de nuevo.' }), { status: 502, headers: corsHeaders });
    }

    const { data: contenido, error: errInsert } = await supabase
      .from('contenido_marketing')
      .insert({ vendedor_id: user.id, tema: tema.trim(), piezas, consentimiento_avatar: !!consentimiento_avatar, tokens_consumidos: data.usage?.output_tokens || 0 })
      .select()
      .single();
    if (errInsert) throw errInsert;

    await supabase
      .from('suscripciones_estudio')
      .update({ usos_este_mes: suscripcion.usos_este_mes + 1, actualizado_en: new Date().toISOString() })
      .eq('vendedor_id', user.id);

    return new Response(JSON.stringify({ contenido, usos_restantes: limite - suscripcion.usos_este_mes - 1 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Error inesperado generando el contenido' }), { status: 500, headers: corsHeaders });
  }
});
