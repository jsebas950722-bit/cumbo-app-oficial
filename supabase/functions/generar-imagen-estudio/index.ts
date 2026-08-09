// supabase/functions/generar-imagen-estudio/index.ts
//
// Genera una imagen real para una pieza de contenido de Cumbo Estudio.
// Siempre usa Gemini, sin importar qué modelo eligió el vendedor para
// el texto — Claude no genera imágenes, así que esto no es una
// opción, es la única forma real de conseguir la imagen.
//
// Requiere sesión válida y el secret GEMINI_API_KEY.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { contenido_id, indice_pieza, descripcion } = await req.json();
    if (!contenido_id || indice_pieza === undefined || !descripcion?.trim()) {
      return new Response(JSON.stringify({ error: 'Faltan datos para generar la imagen' }), { status: 400, headers: corsHeaders });
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

    // Verificamos que el contenido sea del que llama, antes de gastar
    // una generación de imagen en algo que no le pertenece.
    const { data: contenido, error: errContenido } = await supabase.from('contenido_marketing').select('*').eq('id', contenido_id).eq('vendedor_id', user.id).single();
    if (errContenido || !contenido) {
      return new Response(JSON.stringify({ error: 'Contenido no encontrado' }), { status: 404, headers: corsHeaders });
    }

    const prompt = `Fotografía publicitaria de alta calidad, estilo comercial limpio, para redes sociales de una marca de café colombiano de especialidad. ${descripcion}. Iluminación natural cálida, composición profesional, sin texto superpuesto, sin logos.`;

    const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent', {
      method: 'POST',
      headers: { 'x-goog-api-key': Deno.env.get('GEMINI_API_KEY')!, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    });

    if (!resp.ok) {
      const detalle = await resp.text();
      console.error('Error de Gemini (imagen):', detalle);
      return new Response(JSON.stringify({ error: 'No se pudo generar la imagen en este momento' }), { status: 502, headers: corsHeaders });
    }

    const data = await resp.json();
    const partesImagen = data.candidates?.[0]?.content?.parts || [];
    const partImagen = partesImagen.find((p: Record<string, unknown>) => p.inlineData);
    if (!partImagen) {
      return new Response(JSON.stringify({ error: 'Gemini no devolvió ninguna imagen. Intenta con otra descripción.' }), { status: 502, headers: corsHeaders });
    }

    const base64Imagen = partImagen.inlineData.data;
    const mimeType = partImagen.inlineData.mimeType || 'image/png';
    const extension = mimeType.includes('png') ? 'png' : 'jpg';
    const bytesImagen = Uint8Array.from(atob(base64Imagen), (c) => c.charCodeAt(0));

    const ruta = `${user.id}/${contenido_id}-${indice_pieza}-${Date.now()}.${extension}`;
    const { error: errSubida } = await supabase.storage.from('estudio-imagenes').upload(ruta, bytesImagen, { contentType: mimeType });
    if (errSubida) throw errSubida;

    const urlImagen = supabase.storage.from('estudio-imagenes').getPublicUrl(ruta).data.publicUrl;

    // Actualizamos la pieza puntual dentro del jsonb con la imagen ya generada.
    const piezasActualizadas = [...(contenido.piezas || [])];
    if (piezasActualizadas[indice_pieza]) {
      piezasActualizadas[indice_pieza] = { ...piezasActualizadas[indice_pieza], imagen_url: urlImagen };
    }
    await supabase.from('contenido_marketing').update({ piezas: piezasActualizadas }).eq('id', contenido_id);

    return new Response(JSON.stringify({ imagen_url: urlImagen }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Error inesperado generando la imagen' }), { status: 500, headers: corsHeaders });
  }
});
