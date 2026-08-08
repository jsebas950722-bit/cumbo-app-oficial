// supabase/functions/eliminar-cuenta/index.ts
//
// Apple exige que si una app deja crear cuenta, también deje
// eliminarla desde la propia app (no solo escribiendo a soporte). El
// navegador NUNCA puede borrar un usuario de auth.users con la llave
// pública (anon key) — hace falta la service role key, que es privada.
// Por eso esto vive en una Edge Function, con el mismo patrón de
// seguridad que las funciones de pago: se exige sesión válida
// (verify_jwt=true por defecto) y la función solo puede borrar AL
// USUARIO QUE LLAMA, nunca a otro.
//
// Al borrar el usuario de auth.users, la base ya tiene configurado
// "on delete cascade" desde public.usuarios hacia auth.users — así que
// esto también elimina en cascada su perfil, fincas, productos y
// demás datos personales, cumpliendo con el derecho de supresión de
// la Ley 1581 de 2012 (Habeas Data).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
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

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Antes de borrar al usuario, limpiamos los datos de contacto en
    // texto libre de sus pedidos (dirección, teléfono) — el pedido en
    // sí se conserva (y su cliente_id queda en null automáticamente
    // por el "on delete set null" de la migración de anonimización),
    // porque hay que conservar el registro de venta por obligación
    // contable, pero no tiene sentido conservar la dirección exacta de
    // alguien que ya pidió que borráramos sus datos.
    await supabaseAdmin.from('pedidos').update({ direccion_entrega: null, telefono_contacto: null }).eq('cliente_id', user.id);

    const correoUsuario = user.email;
    const { error: errBorrado } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (errBorrado) throw errBorrado;

    // Registramos el evento DESPUÉS de confirmar que el borrado
    // funcionó de verdad — antes se registraba primero, así que si el
    // borrado fallaba igual quedaba un evento diciendo que la cuenta
    // se había eliminado, cosa que no era cierta.
    await supabaseAdmin.from('eventos_log').insert({
      entidad: 'usuario',
      entidad_id: null,
      accion: 'cuenta_eliminada',
      datos: { correo: correoUsuario },
      usuario_id: null,
    });

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'No se pudo eliminar la cuenta' }), { status: 500, headers: corsHeaders });
  }
});
