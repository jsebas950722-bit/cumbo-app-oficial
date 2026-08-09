// supabase/functions/analizar-devolucion/index.ts
//
// Analiza una solicitud de devolución antes de que el CEO la apruebe
// o rechace: historial real de devoluciones de ese cliente, y si el
// plazo del derecho de retracto (5 días hábiles desde la entrega,
// Ley 1480 de 2011) todavía aplica.
//
// REGLA DE AUTONOMÍA: puro apoyo, igual que los otros agentes. Nunca
// cambia `solicitudes_devolucion.estado` — eso sigue siendo un botón
// que aprieta el CEO en Panel Cumbo. Ni siquiera cuando el plazo legal
// ya pasó esto rechaza solo: se lo señala al CEO como un dato más a
// considerar, no como una regla automática, porque puede haber
// excepciones razonables (ej: garantía por producto dañado no tiene
// el mismo plazo que el retracto).
//
// Requiere sesión de CEO y el secret ANTHROPIC_API_KEY.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

function diasHabilesEntre(desde: Date, hasta: Date) {
  let contador = 0;
  const cursor = new Date(desde);
  while (cursor < hasta) {
    cursor.setDate(cursor.getDate() + 1);
    const diaSemana = cursor.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) contador++;
  }
  return contador;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { solicitud_id } = await req.json();
    if (!solicitud_id) {
      return new Response(JSON.stringify({ error: 'Falta solicitud_id' }), { status: 400, headers: corsHeaders });
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

    const { data: solicitud, error: errSolicitud } = await supabase
      .from('solicitudes_devolucion')
      .select('*, pedidos(id, total, estado, fecha, cliente_id)')
      .eq('id', solicitud_id)
      .single();
    if (errSolicitud || !solicitud) {
      return new Response(JSON.stringify({ error: 'Solicitud no encontrada' }), { status: 404, headers: corsHeaders });
    }

    const clienteId = solicitud.pedidos?.cliente_id;

    // Historial real de este cliente: cuántos pedidos tiene en total,
    // y cuántas devoluciones ha pedido antes (y cómo se resolvieron).
    const [{ count: totalPedidos }, { data: devolucionesPrevias }, { data: eventoEntrega }] = await Promise.all([
      clienteId
        ? supabase.from('pedidos').select('*', { count: 'exact', head: true }).eq('cliente_id', clienteId)
        : Promise.resolve({ count: null }),
      clienteId
        ? supabase
            .from('solicitudes_devolucion')
            .select('estado, tipo, fecha_solicitud')
            .eq('cliente_id', clienteId)
            .neq('id', solicitud_id)
        : Promise.resolve({ data: [] }),
      supabase
        .from('eventos_log')
        .select('fecha')
        .eq('entidad', 'pedido')
        .eq('entidad_id', solicitud.pedido_id)
        .eq('accion', 'cambio_estado')
        .contains('datos', { a: 'entregado' })
        .order('fecha', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    let diasHabilesDesdeEntrega: number | null = null;
    if (eventoEntrega?.fecha) {
      diasHabilesDesdeEntrega = diasHabilesEntre(new Date(eventoEntrega.fecha), new Date(solicitud.fecha_solicitud));
    }

    const resumenHistorial = `
Total de pedidos de este cliente: ${totalPedidos ?? 'desconocido'}
Devoluciones previas (sin contar esta): ${devolucionesPrevias?.length || 0}
${(devolucionesPrevias || []).map((d) => `  - ${d.tipo}, resultado: ${d.estado}`).join('\n')}
Tipo de esta solicitud: ${solicitud.tipo}
Motivo declarado: "${solicitud.motivo}"
${
  diasHabilesDesdeEntrega !== null
    ? `Días hábiles desde que se marcó como entregado hasta esta solicitud: ${diasHabilesDesdeEntrega} (el derecho de retracto de la Ley 1480/2011 aplica hasta el día hábil 5)`
    : 'No se encontró registro de cuándo se entregó este pedido.'
}`;

    const prompt = `Eres un asistente que ayuda a un equipo de e-commerce colombiano a evaluar una solicitud de devolución antes de que una persona decida aprobarla o rechazarla. NUNCA decidís vos — solo dás un análisis de apoyo.

${resumenHistorial}

Evaluá:
1. ¿El patrón de devoluciones de este cliente es razonable, o hay señales de abuso (muchas devoluciones, motivos vagos o repetidos)?
2. Si es "retracto": ¿sigue dentro del plazo legal de 5 días hábiles? (esto es informativo, no significa que haya que rechazar automáticamente si se pasó — puede haber excepciones razonables).
3. ¿El motivo declarado es específico y creíble, o es vago?

Respondé ÚNICAMENTE con un JSON (sin texto adicional, sin \`\`\`) con esta forma exacta:
{"riesgo": "bajo" | "medio" | "alto", "hallazgos": ["lista corta de observaciones concretas, en español"], "recomendacion": "1-2 frases con tu sugerencia — nunca un veredicto final, siempre presentado como sugerencia para que decida la persona"}`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
    });

    if (!resp.ok) {
      console.error('Error de la API de Claude:', await resp.text());
      return new Response(JSON.stringify({ error: 'No se pudo analizar la solicitud en este momento' }), {
        status: 502,
        headers: corsHeaders,
      });
    }

    const data = await resp.json();
    const textoRespuesta = data.content?.[0]?.text?.trim() || '{}';

    let analisis;
    try {
      analisis = JSON.parse(textoRespuesta.replace(/^```json\s*|\s*```$/g, ''));
    } catch {
      analisis = { riesgo: 'medio', hallazgos: ['No se pudo interpretar la respuesta de la IA.'], recomendacion: 'Revisar manualmente.' };
    }
    analisis.dias_habiles_desde_entrega = diasHabilesDesdeEntrega;

    return new Response(JSON.stringify(analisis), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Error inesperado analizando la solicitud' }), { status: 500, headers: corsHeaders });
  }
});
