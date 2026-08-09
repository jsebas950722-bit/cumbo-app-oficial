// supabase/functions/generar-copy-producto/index.ts
//
// La primera de varias funciones de IA para Cumbo (en orden de menor a
// mayor complejidad, a pedido): genera una descripción de producto
// lista para publicar en el Marketplace, a partir de los datos que el
// vendedor ya escribió en el formulario de CRM Vendedor.
//
// El prototipo original llamaba a esto directo desde el navegador con
// `window.claude.complete` — una función que solo existe en el
// entorno de prototipado, no en una app real. Acá se resuelve bien:
// la llamada a la API de Claude vive en el servidor (Edge Function),
// nunca en el navegador — igual que con los tokens de pago, la clave
// de la API de Claude es privada y no puede exponerse en el cliente.
//
// Requiere el secret ANTHROPIC_API_KEY (tu propia clave de
// console.anthropic.com — no es la misma clave que usa Claude.ai).

import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { nombre, tipo, subtipo, calidad, caracteristicas_actuales } = await req.json();
    if (!nombre) {
      return new Response(JSON.stringify({ error: 'Falta el nombre del producto' }), { status: 400, headers: corsHeaders });
    }

    const prompt = `Escribe una descripción de producto para el Marketplace de Cumbo, una plataforma colombiana de café de especialidad y equipos de preparación.

Producto: ${nombre}
Tipo: ${tipo === 'metodo_preparacion' ? 'Método de preparación' : 'Accesorio'}
Subtipo/marca: ${subtipo || 'N/D'}
Calidad: ${calidad}
${caracteristicas_actuales ? `Notas del vendedor: ${caracteristicas_actuales}` : ''}

Requisitos:
- Máximo 3 frases cortas, tono cercano y directo, sin exagerar ni inventar características técnicas que no te di.
- No uses signos de exclamación en exceso ni lenguaje de venta agresivo.
- Responde SOLO con la descripción, sin comillas ni texto adicional.`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!resp.ok) {
      const detalle = await resp.text();
      console.error('Error de la API de Claude:', detalle);
      return new Response(JSON.stringify({ error: 'No se pudo generar la descripción en este momento' }), { status: 502, headers: corsHeaders });
    }

    const data = await resp.json();
    const texto = data.content?.[0]?.text?.trim() || '';

    return new Response(JSON.stringify({ descripcion: texto }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Error inesperado generando la descripción' }), { status: 500, headers: corsHeaders });
  }
});
