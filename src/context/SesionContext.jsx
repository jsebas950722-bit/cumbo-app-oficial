import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const SesionContext = createContext(null);

export function SesionProvider({ children }) {
  const [sesion, setSesion] = useState(null);
  const [perfil, setPerfil] = useState(null); // fila de public.usuarios
  const [cargando, setCargando] = useState(true);

  async function cargarPerfil(userId) {
    const { data } = await supabase.from('usuarios').select('*').eq('id', userId).single();
    setPerfil(data ?? null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session);
      if (data.session) cargarPerfil(data.session.user.id);
      setCargando(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nuevaSesion) => {
      setSesion(nuevaSesion);
      if (nuevaSesion) cargarPerfil(nuevaSesion.user.id);
      else setPerfil(null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const nombreCompleto = perfil?.nombre_completo || sesion?.user?.email?.split('@')[0] || 'Invitado';

  const valor = {
    sesion,
    perfil,
    cargando,
    nombreCompleto,
    cerrarSesion: () => supabase.auth.signOut(),
  };

  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>;
}

export function useSesion() {
  const ctx = useContext(SesionContext);
  if (!ctx) throw new Error('useSesion debe usarse dentro de <SesionProvider>');
  return ctx;
}
