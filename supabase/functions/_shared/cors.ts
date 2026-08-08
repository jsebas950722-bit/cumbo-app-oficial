// CORS restringido al dominio real de la app cuando esté configurado
// (variable de entorno FRONTEND_URL) — antes era '*' fijo, lo que
// permitía que cualquier sitio web invocara estas funciones desde el
// navegador de un usuario que tuviera sesión abierta en Cumbo. Si
// todavía no configuraste FRONTEND_URL, cae de vuelta a '*' para no
// romper el desarrollo local — pero hay que configurarlo antes de
// producción.
const origenPermitido = Deno.env.get('FRONTEND_URL') || '*';

export const corsHeaders = {
  'Access-Control-Allow-Origin': origenPermitido,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
