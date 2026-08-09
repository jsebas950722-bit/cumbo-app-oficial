// supabase/functions/cotizar-envio/index.ts
//
// Cotiza tarifas reales de envío nacional usando la API de DrEnvío
// (https://docs.drenvio.com), que cubre Interrapidísimo, Coordinadora
// y Servientrega (como "serviEntrega") bajo un solo token — evita
// tener que negociar un convenio individual con cada transportadora,
// que es lo que exigirían sus APIs propias.
//
// Solo se usa para envío NACIONAL (fuera de Bogotá). Dentro de
// Bogotá se sigue usando la mensajería urbana estática (Yango/Didi) —
// DrEnvío no cubre esas dos, así que ese flujo no cambió.
//
// Requiere estos secrets:
//   DRENVIO_API_TOKEN
//   ORIGEN_CALLE, ORIGEN_NUMERO, ORIGEN_BARRIO, ORIGEN_CIUDAD,
//   ORIGEN_DEPARTAMENTO, ORIGEN_CODIGO_POSTAL
//   (la dirección real desde donde Cumbo despacha)

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Peso de referencia cuando un producto no tiene peso_kg cargado
// todavía — evita bloquear la cotización, pero es una aproximación,
// no un dato real. Se marca así en la respuesta.
const PESO_RESPALDO_KG = 0.5;

const TRANSPORTADORAS_COLOMBIA = ['interrapidisimo', 'coordinadora', 'serviEntrega'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { direccion_estructurada, ciudad, items } = await req.json();
    if (!direccion_estructurada?.codigo_postal || !ciudad || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: 'Faltan datos de dirección o del carrito' }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: productos } = await supabase
      .from('productos')
      .select('id, peso_kg')
      .in(
        'id',
        items.map((it: any) => it.producto_id)
      );

    let pesoUsoRespaldo = false;
    const pesoTotalKg = items.reduce((acc: number, it: any) => {
      const producto = productos?.find((p) => p.id === it.producto_id);
      const peso = producto?.peso_kg;
      if (!peso) pesoUsoRespaldo = true;
      return acc + (peso || PESO_RESPALDO_KG) * it.cantidad;
    }, 0);

    const body = {
      type: 'National',
      origin: {
        country: 'CO',
        postal_code: Deno.env.get('ORIGEN_CODIGO_POSTAL'),
        city: Deno.env.get('ORIGEN_CIUDAD'),
        state: Deno.env.get('ORIGEN_DEPARTAMENTO'),
        street: Deno.env.get('ORIGEN_CALLE'),
        number: Deno.env.get('ORIGEN_NUMERO'),
        district: Deno.env.get('ORIGEN_BARRIO'),
      },
      destination: {
        country: 'CO',
        postal_code: direccion_estructurada.codigo_postal,
        city: ciudad,
        state: direccion_estructurada.departamento,
        street: direccion_estructurada.calle,
        number: direccion_estructurada.numero,
        district: direccion_estructurada.barrio,
      },
      packages: [
        {
          weight: Math.max(0.1, Math.round(pesoTotalKg * 1000) / 1000),
          height: 15,
          width: 15,
          length: 20,
          type: 'box',
          main_weight: Math.max(0.1, Math.round(pesoTotalKg * 1000) / 1000),
        },
      ],
      carriers: TRANSPORTADORAS_COLOMBIA,
      insurance: 0,
    };

    const resp = await fetch('https://prod.api-drenvio.com/v2/shipments/rate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('DRENVIO_API_TOKEN')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const detalle = await resp.text();
      console.error('Error de DrEnvío:', detalle);
      return new Response(JSON.stringify({ error: 'No se pudo cotizar el envío en este momento', detalle }), { status: 502, headers: corsHeaders });
    }

    const cotizaciones = await resp.json();

    // Devolvemos solo lo que el checkout necesita para mostrar y
    // guardar la opción elegida — no toda la respuesta cruda de DrEnvío.
    const opciones = (Array.isArray(cotizaciones) ? cotizaciones : []).map((c: any) => ({
      id: `${c.carrier}_${c.service_id}`,
      transportadora: nombreLegible(c.carrier),
      servicio: c.service,
      costo: Math.round(c.price),
      tiempo: c.days,
      // Guardamos estos tres para poder generar la guía real después
      // sin volver a cotizar (ver supabase/functions/generar-guia-envio).
      _drenvio: { carrier: c.carrier, service_id: c.service_id, ObjectId: c.ObjectId, ShippingId: c.ShippingId, price: c.price, service: c.service },
    }));

    return new Response(JSON.stringify({ opciones, peso_estimado: pesoUsoRespaldo }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Error inesperado cotizando el envío' }), { status: 500, headers: corsHeaders });
  }
});

function nombreLegible(carrier: string) {
  const mapa: Record<string, string> = {
    interrapidisimo: 'Interrapidísimo',
    coordinadora: 'Coordinadora',
    serviEntrega: 'Servientrega',
  };
  return mapa[carrier] || carrier;
}
