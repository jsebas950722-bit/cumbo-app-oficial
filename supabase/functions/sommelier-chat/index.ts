// supabase/functions/sommelier-chat/index.ts
//
// Tercera función de IA (en orden de menor a mayor complejidad):
// una conversación real con Cumbito, alternativa al quiz de 5
// preguntas de reglas fijas — que sigue existiendo tal cual, esto no
// lo reemplaza, es una segunda forma de llegar a una recomendación
// para quien prefiere simplemente contar lo que le gusta en sus
// propias palabras.
//
// Lo más importante de esta función: SIEMPRE le pasamos a Claude el
// catálogo real de café en stock, y le pedimos explícitamente que
// solo recomiende productos de esa lista — nunca un café inventado
// que no existe en el Marketplace. Esto evita el problema típico de
// un chatbot de producto que "alucina" cosas que no vendés.
//
// Requiere el secret ANTHROPIC_API_KEY.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { mensajes } = await req.json();
    if (!Array.isArray(mensajes) || mensajes.length === 0) {
      return new Response(JSON.stringify({ error: 'Falta la conversación' }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Catálogo real de café en stock — esto es lo único que Cumbito
    // puede recomendar. Si mañana cambia el stock, esta lista cambia
    // sola, no hay que tocar el prompt.
    const { data: cafes } = await supabase
      .from('productos')
      .select('id, nombre, precio, fincas(region, proceso, especie, altitud_msnm)')
      .eq('tipo', 'cafe_finca')
      .eq('activo', true)
      .gt('stock', 0);

    const catalogoTexto = (cafes || [])
      .map((c) => `- ${c.nombre} (id: ${c.id}) — ${c.fincas?.region}, proceso ${c.fincas?.proceso}, ${c.fincas?.especie}, ${c.fincas?.altitud_msnm} msnm — $${c.precio}`)
      .join('\n');

    const systemPrompt = `Eres Cumbito, el asistente de café de Cumbo — una plataforma colombiana de café de especialidad directo del caficultor. Tu tono es cercano, breve y cálido, nunca vendedor agresivo.

Tu trabajo es charlar con la persona sobre sus gustos de café (cuerpo, acidez, notas dulces/frutales/achocolatadas, cómo lo prepara) y, cuando tengas suficiente información, recomendarle UN café específico.

REGLA MÁS IMPORTANTE: Solo podés recomendar cafés de esta lista real de stock — nunca inventes un café que no esté acá:
${catalogoTexto || '(No hay café en stock en este momento — avísale a la persona amablemente y no recomiendes nada.)'}

Cuando recomiendes un café, sé explícito con el nombre exacto tal como aparece en la lista, y al final de tu mensaje agregá una línea separada con exactamente este formato (para que la app pueda mostrar el producto): [[RECOMENDACION:id_del_producto]]
Si todavía no tenés suficiente información para recomendar, seguí preguntando — máximo 3 preguntas antes de recomendar algo con lo que tengas.`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 400,
        system: systemPrompt,
        messages: mensajes.map((m: any) => ({ role: m.rol === 'usuario' ? 'user' : 'assistant', content: m.texto })),
      }),
    });

    if (!resp.ok) {
      const detalle = await resp.text();
      console.error('Error de la API de Claude:', detalle);
      return new Response(JSON.stringify({ error: 'Cumbito no está disponible en este momento' }), { status: 502, headers: corsHeaders });
    }

    const data = await resp.json();
    let texto = data.content?.[0]?.text?.trim() || '';

    // Separamos la recomendación (si la hay) del texto que se muestra,
    // y verificamos que el id exista de verdad en el catálogo — si
    // Claude se equivocara con el id, no mostramos un producto falso.
    let productoRecomendadoId = null;
    const match = texto.match(/\[\[RECOMENDACION:([a-f0-9-]+)\]\]/i);
    if (match) {
      const idPropuesto = match[1];
      if ((cafes || []).some((c) => c.id === idPropuesto)) {
        productoRecomendadoId = idPropuesto;
      }
      texto = texto.replace(match[0], '').trim();
    }

    return new Response(JSON.stringify({ texto, producto_recomendado_id: productoRecomendadoId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Error inesperado en la conversación' }), { status: 500, headers: corsHeaders });
  }
});
