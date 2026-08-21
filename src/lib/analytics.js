import { supabase } from './supabaseClient';

// Helper único para registrar eventos de analytics en toda la app.
// Reglas de diseño, a propósito:
//   1. Nunca bloquea — no se espera (await) desde donde se llama de
//      forma visible al usuario; es "fire and forget".
//   2. Nunca rompe la UI — si falla el insert (sin internet, etc.),
//      se traga el error. Medir no puede ser más importante que la
//      experiencia real de comprar café.
//   3. Funciona con o sin sesión — a alguien que todavía no se
//      registró también le contamos los eventos, con un id de sesión
//      anónima guardado en localStorage.

function idSesionAnonima() {
  try {
    let id = localStorage.getItem('cumbo_sesion_anonima');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('cumbo_sesion_anonima', id);
    }
    return id;
  } catch {
    return null; // localStorage puede fallar en navegación privada — no pasa nada, el evento igual se manda sin este id
  }
}

export function registrarEvento(nombre, propiedades = {}) {
  supabase.auth.getUser().then(({ data }) => {
    supabase
      .from('eventos_analytics')
      .insert({
        nombre,
        propiedades,
        usuario_id: data?.user?.id || null,
        sesion_anonima_id: idSesionAnonima(),
      })
      .then(
        () => {},
        () => {}
      ); // silenciar cualquier error a propósito — ver regla 2 arriba
  });
}
