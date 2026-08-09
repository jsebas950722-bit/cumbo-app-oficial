// supabase/functions/generar-contenido-estudio/index.ts
//
// Cumbo Estudio 2.0: genera un EMBUDO de contenido real (no piezas
// sueltas) a partir de la intención del vendedor — qué quiere lograr
// (dar a conocer su finca, vender un producto puntual, etc.). Cada
// pieza queda etiquetada con su etapa del embudo (atracción,
// consideración, conversión) y un llamado a la acción coherente con
// esa etapa.
//
// El vendedor elige el modelo de texto (Claude o Gemini) — ambos
// generan texto igual de bien, es una preferencia del vendedor, no
// una limitación técnica. Las imágenes SIEMPRE se generan con Gemini
// en una función aparte (generar-imagen-estudio), porque Claude no
// genera imágenes — eso no es una opción, es una limitación real del
// modelo.
//
// Requiere sesión válida y el secret ANTHROPIC_API_KEY y/o
// GEMINI_API_KEY (según el modelo que se use).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Límites por plan — ajustables acá o directo en la tabla
// suscripciones_estudio sin tocar código. Esto NO cobra
// automáticamente cada mes, solo limita cuánto se puede generar —
// cobrar la suscripción recurrente es una pieza aparte, todavía no
// construida (ver README).
const LIMITES_PLAN: Record<string, number> = { chispa: 3, cosecha: 15, finca_completa: 50 };
const NOMBRE_PLAN: Record<string, string> = { chispa: 'Chispa', cosecha: 'Cosecha', finca_completa: 'Finca Completa' };

function promptEmbudo(
  intencion: string,
  numPiezas: number,
  catalogoTexto: string,
  consentimientoAvatar: boolean,
  vozDeMarcaTexto: string,
  perfilTono: string
) {
  const NOMBRE_TONO: Record<string, string> = {
    tecnico_catador: 'técnico/catador — vocabulario de catación preciso, para gente que ya conoce de café de especialidad',
    cercano_consumidor: 'cercano/consumidor final — cálido y simple, sin tecnicismos, para alguien que recién descubre el café de especialidad',
    educativo_academy: 'educativo — explica el "por qué" detrás de cada dato (por qué importa el proceso, la altitud, etc.), tono de quien enseña con paciencia',
  };

  return `Sos el motor de voz de marca de Cumbo, una plataforma colombiana de café de especialidad con trazabilidad de origen real. Tu trabajo es diseñar un EMBUDO DE CONVERSIÓN completo — no piezas sueltas — a partir de esta intención del vendedor:

"${intencion}"

${vozDeMarcaTexto ? `CÓMO SUENA CUMBO (fragmentos reales de la marca — imitá este tono y vocabulario, no genérico de marketing de café):\n${vozDeMarcaTexto}\n` : ''}
Perfil de tono para esta pieza: ${NOMBRE_TONO[perfilTono] || NOMBRE_TONO.cercano_consumidor}

CATÁLOGO REAL (nunca inventes productos, fincas, altitudes, procesos o puntajes que no estén acá — esta es la regla más importante):
${catalogoTexto}

GUARDRAIL DE DATOS — muy importante: los datos marcados como "(sin verificar)" en el catálogo son auto-reportados por el caficultor, no han sido validados independientemente. Si los usás en el contenido, tenés que conservar esa honestidad (ej: "según nos cuenta el caficultor..." en vez de afirmarlo como un hecho verificado). Nunca le quites el matiz de "sin verificar" a un dato que lo tiene.

${consentimientoAvatar ? 'El vendedor autorizó usar un avatar de IA — podés sugerir guiones para video corto con presentador.' : 'El vendedor NO autorizó avatar de IA — los guiones deben ser para foto/carrusel con texto, sin presentador ni video hablado.'}

Diseñá ${numPiezas} piezas distribuidas de forma realista a lo largo de las 3 etapas de un embudo:
- "atraccion": capta la atención de alguien que todavía no conoce el producto (curiosidad, historia, valor).
- "consideracion": ya lo conoce, ahora hay que resolverle dudas y generar confianza (beneficios concretos, comparación, prueba social).
- "conversion": está listo para comprar, necesita el empujón final (oferta clara, urgencia honesta, llamado a la acción directo).

No pongas todas las piezas en la misma etapa — un embudo real avanza a la persona de una etapa a la siguiente.

Respondé ÚNICAMENTE con un array JSON (sin texto adicional, sin \`\`\`), un objeto por pieza, con esta forma exacta:
[{"dia": 1, "plataforma": "Instagram" | "WhatsApp Estados" | "Facebook", "etapa_embudo": "atraccion" | "consideracion" | "conversion", "guion": "texto corto y natural en español colombiano, listo para publicar", "cta": "el llamado a la acción exacto de esa pieza, ej: 'Escríbenos por WhatsApp' o 'Compra ahora en el Marketplace'", "datos_sin_verificar": ["lista de qué datos citados en el guion son sin verificar — vacío si no citaste ninguno"]}]`;
}

async function generarConClaude(prompt: string) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!resp.ok) throw new Error(`Claude: ${await resp.text()}`);
  const data = await resp.json();
  const texto = data.content?.[0]?.text?.trim() || '[]';
  return { texto, tokens: data.usage?.output_tokens || 0 };
}

async function generarConGemini(prompt: string) {
  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': Deno.env.get('GEMINI_API_KEY')!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!resp.ok) throw new Error(`Gemini: ${await resp.text()}`);
  const data = await resp.json();
  const texto = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '[]';
  const tokens = data.usageMetadata?.candidatesTokenCount || 0;
  return { texto, tokens };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { tema, intencion, cantidad_piezas, consentimiento_avatar, modelo, perfil_tono } = await req.json();
    const intencionFinal = (intencion || tema || '').trim(); // 'tema' se mantiene por compatibilidad con la versión anterior
    if (!intencionFinal) {
      return new Response(JSON.stringify({ error: 'Falta contarnos qué querés lograr con este contenido' }), { status: 400, headers: corsHeaders });
    }
    const modeloElegido = modelo === 'gemini' ? 'gemini' : 'claude';
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
    const { data: fincas } = await supabase
      .from('fincas')
      .select('nombre_finca, region, proceso, especie, altitud_msnm, notas_sabor, humedad_grano, estado_grano, malla_grano')
      .eq('caficultor_id', user.id)
      .eq('estado', 'validada');

    // Guardrail de datos (lo que pide el documento de arquitectura):
    // región/proceso/especie/altitud quedaron confirmados cuando el
    // CEO validó la finca — pero notas de sabor, humedad y malla son
    // datos que el caficultor reportó él mismo al registrarse, nadie
    // los verificó de forma independiente. Se marcan así de forma
    // explícita para que la IA nunca los presente como un hecho
    // comprobado.
    const catalogoTexto = [
      ...(productos || []).map((p) => `- ${p.nombre} ($${p.precio})${p.caracteristicas ? `: ${p.caracteristicas}` : ''}`),
      ...(fincas || []).map((f) => {
        const base = `- Café de ${f.nombre_finca}, ${f.region}, proceso ${f.proceso}, ${f.especie}, ${f.altitud_msnm} msnm`;
        const sinVerificar = [];
        if (f.notas_sabor) sinVerificar.push(`notas de sabor "${f.notas_sabor}" (sin verificar)`);
        if (f.humedad_grano) sinVerificar.push(`humedad ${f.humedad_grano}% (sin verificar)`);
        if (f.estado_grano) sinVerificar.push(`estado del grano "${f.estado_grano}" (sin verificar)`);
        if (f.malla_grano) sinVerificar.push(`malla "${f.malla_grano}" (sin verificar)`);
        return sinVerificar.length ? `${base}. Datos adicionales: ${sinVerificar.join(', ')}` : base;
      }),
    ].join('\n');

    if (!catalogoTexto) {
      return new Response(JSON.stringify({ error: 'Todavía no tienes productos o una finca validada para generar contenido sobre ellos.' }), { status: 400, headers: corsHeaders });
    }

    // Motor de voz de marca: fragmentos reales curados por el CEO
    // (Constitución del Ecosistema, Gobernanza de Conocimiento de
    // Café, conversaciones destacadas del Sommelier) — la fuente de
    // verdad de tono que pide el documento, no un prompt suelto.
    const { data: ejemplosVoz } = await supabase.from('voz_de_marca').select('contenido').eq('activo', true).limit(8);
    const vozDeMarcaTexto = (ejemplosVoz || []).map((v) => `- ${v.contenido}`).join('\n');

    const perfilTonoFinal = ['tecnico_catador', 'cercano_consumidor', 'educativo_academy'].includes(perfil_tono) ? perfil_tono : 'cercano_consumidor';

    const prompt = promptEmbudo(intencionFinal, numPiezas, catalogoTexto, !!consentimiento_avatar, vozDeMarcaTexto, perfilTonoFinal);

    let resultado;
    try {
      resultado = modeloElegido === 'gemini' ? await generarConGemini(prompt) : await generarConClaude(prompt);
    } catch (e) {
      console.error(`Error generando con ${modeloElegido}:`, e);
      return new Response(JSON.stringify({ error: `No se pudo generar el contenido con ${modeloElegido === 'gemini' ? 'Gemini' : 'Claude'} en este momento.` }), { status: 502, headers: corsHeaders });
    }

    let piezas;
    try {
      piezas = JSON.parse(resultado.texto.replace(/^```json\s*|\s*```$/g, '')).map((p: Record<string, unknown>) => ({
        ...p,
        estado_editorial: 'generado_ia', // generado_ia → revisado → programado → publicado
        imagen_url: null,
      }));
    } catch {
      return new Response(JSON.stringify({ error: 'La IA devolvió una respuesta que no se pudo interpretar. Intenta de nuevo.' }), { status: 502, headers: corsHeaders });
    }

    const { data: contenido, error: errInsert } = await supabase
      .from('contenido_marketing')
      .insert({
        vendedor_id: user.id,
        tema: intencionFinal,
        piezas,
        consentimiento_avatar: !!consentimiento_avatar,
        tokens_consumidos: resultado.tokens,
        modelo_usado: modeloElegido,
      })
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
