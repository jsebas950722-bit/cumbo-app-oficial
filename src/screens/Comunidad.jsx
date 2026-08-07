import { useEffect, useState } from 'react';
import { ArrowLeft, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useSesion } from '../context/SesionContext';

// Migrado desde: "Comunidad Cumbo.dc.html"
// Cambios respecto al prototipo:
//  - Las publicaciones vienen de Supabase (tabla `publicaciones`), no
//    de un array hardcodeado de 3 ejemplos.
//  - Los likes son reales y persistentes (tabla `publicaciones_likes`,
//    una fila por usuario+publicación) — en el prototipo el "like" se
//    perdía al recargar la página porque solo vivía en memoria.
//  - Si el usuario tiene rol `caficultor`, puede publicar una
//    actualización real desde acá (nuevo, el prototipo no tenía esto).

export default function Comunidad() {
  const { sesion, perfil } = useSesion();
  const [publicaciones, setPublicaciones] = useState([]);
  const [misLikes, setMisLikes] = useState(new Set());
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState('');
  const [publicando, setPublicando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    cargar();
  }, [sesion]);

  async function cargar() {
    setCargando(true);
    const { data: pubs } = await supabase
      .from('publicaciones')
      .select('*, usuarios(nombre_completo), fincas(nombre_finca, region), publicaciones_likes(usuario_id)')
      .order('fecha_creacion', { ascending: false });

    setPublicaciones(pubs || []);

    if (sesion) {
      const mios = new Set();
      (pubs || []).forEach((p) => {
        if (p.publicaciones_likes?.some((l) => l.usuario_id === sesion.user.id)) mios.add(p.id);
      });
      setMisLikes(mios);
    }
    setCargando(false);
  }

  async function toggleLike(publicacionId) {
    if (!sesion) return;
    const yaLeDiLike = misLikes.has(publicacionId);

    setMisLikes((prev) => {
      const next = new Set(prev);
      if (yaLeDiLike) next.delete(publicacionId);
      else next.add(publicacionId);
      return next;
    });
    setPublicaciones((prev) =>
      prev.map((p) =>
        p.id === publicacionId
          ? {
              ...p,
              publicaciones_likes: yaLeDiLike
                ? p.publicaciones_likes.filter((l) => l.usuario_id !== sesion.user.id)
                : [...p.publicaciones_likes, { usuario_id: sesion.user.id }],
            }
          : p
      )
    );

    if (yaLeDiLike) {
      await supabase.from('publicaciones_likes').delete().eq('publicacion_id', publicacionId).eq('usuario_id', sesion.user.id);
    } else {
      await supabase.from('publicaciones_likes').insert({ publicacion_id: publicacionId, usuario_id: sesion.user.id });
    }
  }

  async function publicar() {
    if (!texto.trim()) return;
    setPublicando(true);
    setError('');
    try {
      // Buscar una finca del caficultor para asociarla (si tiene varias, usamos la primera validada)
      const { data: finca } = await supabase.from('fincas').select('id').eq('caficultor_id', sesion.user.id).limit(1).maybeSingle();

      const { error: errIns } = await supabase.from('publicaciones').insert({
        caficultor_id: sesion.user.id,
        finca_id: finca?.id || null,
        texto: texto.trim(),
      });
      if (errIns) throw errIns;

      setTexto('');
      cargar();
    } catch (e) {
      setError('No se pudo publicar. Intenta de nuevo.');
    } finally {
      setPublicando(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fondo-calido)', paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'var(--superficie)' }}>
        <Link to="/" style={{ color: 'var(--marron-tinta)', display: 'flex' }}>
          <ArrowLeft size={20} />
        </Link>
        <div style={{ fontWeight: 'bold', fontSize: 15, color: 'var(--marron-tinta)', flex: 1 }}>Comunidad</div>
        <img src="/assets/logo-cumbo.png" alt="Cumbo" style={{ height: 22, width: 'auto' }} />
      </div>

      <div style={{ maxWidth: 460, margin: '0 auto', padding: '14px 16px' }}>
        {perfil?.rol === 'caficultor' && (
          <div style={{ background: '#fff', borderRadius: 18, padding: 16, marginBottom: 16 }}>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Cuéntale a la comunidad cómo va tu cosecha…"
              style={{
                width: '100%',
                minHeight: 60,
                border: '1.5px solid rgba(146,97,55,0.25)',
                borderRadius: 12,
                padding: 10,
                fontSize: 13,
                color: 'var(--marron-tinta)',
                marginBottom: 8,
              }}
            />
            {error && <div style={{ fontSize: 12, color: 'var(--canela-oscuro)', marginBottom: 8 }}>{error}</div>}
            <button
              onClick={publicar}
              disabled={publicando || !texto.trim()}
              className="cumbo-btn"
              style={{
                background: 'var(--accion)',
                color: '#fff',
                border: 'none',
                padding: '10px 18px',
                borderRadius: 9999,
                fontSize: 13,
                fontWeight: 'bold',
                cursor: 'pointer',
                opacity: publicando ? 0.7 : 1,
              }}
            >
              {publicando ? 'Publicando…' : 'Publicar'}
            </button>
          </div>
        )}

        {cargando ? (
          <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 20 }}>Cargando…</p>
        ) : publicaciones.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 20 }}>
            Todavía no hay publicaciones de la comunidad.
          </p>
        ) : (
          publicaciones.map((p) => {
            const leDiLike = misLikes.has(p.id);
            const totalLikes = p.publicaciones_likes?.length || 0;
            return (
              <div key={p.id} style={{ background: '#fff', borderRadius: 18, padding: 16, marginBottom: 12 }}>
                <div style={{ fontWeight: 'bold', fontSize: 13.5, color: 'var(--marron-tinta)' }}>
                  {p.usuarios?.nombre_completo || 'Caficultor Cumbo'}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--cafe-oscuro)', marginBottom: 8 }}>
                  {p.fincas?.nombre_finca ? `${p.fincas.nombre_finca}, ${p.fincas.region}` : 'Finca Cumbo'}
                </div>
                <p style={{ fontSize: 13, color: 'var(--marron-tinta)', lineHeight: 1.5, marginBottom: 10 }}>{p.texto}</p>
                <button
                  onClick={() => toggleLike(p.id)}
                  disabled={!sesion}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    background: 'none',
                    border: 'none',
                    cursor: sesion ? 'pointer' : 'default',
                    color: leDiLike ? 'var(--accion)' : 'var(--cafe-oscuro)',
                    fontSize: 13,
                    fontWeight: 'bold',
                  }}
                >
                  <Heart size={15} fill={leDiLike ? 'var(--accion)' : 'none'} /> {totalLikes}
                </button>
              </div>
            );
          })
        )}

        {!sesion && (
          <p style={{ fontSize: 11.5, color: 'var(--cafe-oscuro)', textAlign: 'center', marginTop: 10 }}>
            <Link to="/ingreso" style={{ color: 'var(--cafe-oscuro)', fontWeight: 'bold' }}>
              Inicia sesión
            </Link>{' '}
            para darle like a las publicaciones.
          </p>
        )}
      </div>
    </div>
  );
}
