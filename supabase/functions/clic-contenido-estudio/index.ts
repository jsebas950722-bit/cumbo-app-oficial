// supabase/functions/clic-contenido-estudio/index.ts
//
// Fase 3 del documento: métrica real de clics por pieza. Este es el
// enlace que se comparte en vez del link directo al Marketplace —
// registra el clic y redirige, así queda un número real de cuánta
// gente llegó desde esa pieza específica, no una estimación.
//
// Es un endpoint PÚBLICO a propósito (verify_jwt=false en
// config.toml) — quien hace clic viene de WhatsApp/Instagram/donde
// sea, no tiene ni puede tener una sesión de Cumbo.

import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const contenidoId = url.searchParams.get('c');
  const indice = url.searchParams.get('i');
  const destino = Deno.env.get('FRONTEND_URL') ? `${Deno.env.get('FRONTEND_URL')}/marketplace` : '/marketplace';

  if (!contenidoId || indice === null) {
    return Response.redirect(destino, 302);
  }

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    await supabase.from('clics_contenido_estudio').insert({ contenido_id: contenidoId, indice_pieza: parseInt(indice, 10) });
  } catch (e) {
    // Si el registro del clic falla por lo que sea, la persona NO
    // debería quedarse sin poder llegar al Marketplace — se redirige
    // igual, solo se pierde ese conteo puntual.
    console.error('No se pudo registrar el clic:', e);
  }

  return Response.redirect(destino, 302);
});
