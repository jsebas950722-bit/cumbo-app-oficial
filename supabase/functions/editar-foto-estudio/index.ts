// supabase/functions/editar-foto-estudio/index.ts
//
// Fase 2.2 del documento de arquitectura ("estilo Firefly"): edición
// SEGURA de fotos reales de finca/proceso/catación — nunca generación
// de contenido sintético nuevo. El documento tiene una regla explícita
// que no se puede tratar como sugerencia: "nunca generar imágenes
// sintéticas de personas reales (caficultores, catadores) — solo
// edición de fotografía real existente".
//
// Cómo se hace cumplir eso acá, en el código, no solo en un párrafo:
//   1. El usuario NO escribe un prompt libre — elige uno de 4 ajustes
//      acotados (mejorar luz, difuminar fondo, recorte cuadrado,
//      tono cálido). Un prompt libre podría pedir "quita a la persona
//      y pon otra" — con opciones fijas, esa instrucción no existe.
//   2. Cada llamada a Gemini incluye la foto real como entrada (no
//      solo una descripción de texto) — es edición de imagen a
//      imagen, no generación desde cero.
//   3. El prompt le exige explícitamente a Gemini conservar cualquier
//      persona en la foto exactamente como está, sin alterar su
//      apariencia — en cada uno de los 4 ajustes, sin excepción.
//
// Requiere sesión válida y el secret GEMINI_API_KEY.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const AJUSTES: Record<string, string> = {
  mejorar_luz: 'Mejorá la iluminación general de la foto (más luz natural, mejor exposición) sin cambiar la composición.',
  difuminar_fondo: 'Difuminá levemente el fondo (efecto de profundidad de campo) manteniendo el sujeto principal en foco nítido.',
  recorte_cuadrado: 'Recortá la imagen a formato cuadrado (1:1) centrando el elemento principal, sin distorsionar nada.',
  tono_calido: 'Ajustá el balance de color hacia tonos cálidos (dorados, ámbar) típicos de la hora dorada, sin cambiar el contenido de la imagen.',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { foto_url, tipo_ajuste } = await req.json();
    if (!foto_url || !AJUSTES[tipo_ajuste]) {
      return new Response(JSON.stringify({ error: 'Falta la foto o el ajuste no es válido' }), { status: 400, headers: corsHeaders });
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

    // Descargamos la foto real — Gemini edita SOBRE esta imagen, no
    // genera una nueva desde una descripción de texto.
    const respFoto = await fetch(foto_url);
    if (!respFoto.ok) {
      return new Response(JSON.stringify({ error: 'No se pudo descargar la foto original' }), { status: 502, headers: corsHeaders });
    }
    const tipoFoto = respFoto.headers.get('content-type') || 'image/jpeg';
    const bytesFoto = new Uint8Array(await respFoto.arrayBuffer());
    let binario = '';
    for (let i = 0; i < bytesFoto.length; i++) binario += String.fromCharCode(bytesFoto[i]);
    const base64Foto = btoa(binario);

    const prompt = `Esta es una edición de una fotografía REAL existente de una finca cafetera colombiana — NO es una generación de contenido nuevo.

Regla que no podés romper bajo ninguna circunstancia: si en la imagen aparece cualquier persona (caficultor, catador, trabajador), tenés que conservar su apariencia EXACTAMENTE como está en el original — mismo rostro, mismo cuerpo, misma ropa, sin alterar, reemplazar, ni generar a nadie. No agregues personas que no estén ya en la foto.

Ajuste solicitado (solo esto, nada más): ${AJUSTES[tipo_ajuste]}`;

    const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent', {
      method: 'POST',
      headers: { 'x-goog-api-key': Deno.env.get('GEMINI_API_KEY')!, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ inlineData: { mimeType: tipoFoto, data: base64Foto } }, { text: prompt }],
          },
        ],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    });

    if (!resp.ok) {
      const detalle = await resp.text();
      console.error('Error de Gemini (edición de foto):', detalle);
      return new Response(JSON.stringify({ error: 'No se pudo editar la foto en este momento' }), { status: 502, headers: corsHeaders });
    }

    const data = await resp.json();
    const partesImagen = data.candidates?.[0]?.content?.parts || [];
    const partImagen = partesImagen.find((p: Record<string, unknown>) => p.inlineData);
    if (!partImagen) {
      return new Response(JSON.stringify({ error: 'Gemini no devolvió una imagen editada. Intenta con otro ajuste.' }), { status: 502, headers: corsHeaders });
    }

    const base64Editada = partImagen.inlineData.data;
    const mimeType = partImagen.inlineData.mimeType || 'image/png';
    const extension = mimeType.includes('png') ? 'png' : 'jpg';
    const bytesEditados = Uint8Array.from(atob(base64Editada), (c) => c.charCodeAt(0));

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const ruta = `${user.id}/edicion-${tipo_ajuste}-${Date.now()}.${extension}`;
    const { error: errSubida } = await supabase.storage.from('estudio-imagenes').upload(ruta, bytesEditados, { contentType: mimeType });
    if (errSubida) throw errSubida;

    const urlEditada = supabase.storage.from('estudio-imagenes').getPublicUrl(ruta).data.publicUrl;

    await supabase.from('eventos_log').insert({
      entidad: 'foto_editada',
      entidad_id: null,
      accion: 'editada',
      datos: { tipo_ajuste, foto_original: foto_url },
      usuario_id: user.id,
    });

    return new Response(JSON.stringify({ imagen_url: urlEditada }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Error inesperado editando la foto' }), { status: 500, headers: corsHeaders });
  }
});
