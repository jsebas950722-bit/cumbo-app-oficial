import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useSesion } from '../context/SesionContext';

// Migrado desde: "Directorio Caficultores Cumbo.dc.html"
// Cambios respecto al prototipo:
//  - Los 3 caficultores hardcodeados se reemplazan por las fincas
//    realmente validadas en Supabase, con su caficultor real.
//  - "Disponibilidad" ya no es un campo fijo de ejemplo: se deriva del
//    stock real del producto de esa finca en el Marketplace (stock > 0
//    = Disponible, stock = 0 = Agotado, sin producto todavía = Próxima
//    cosecha).
//  - El directorio es solo para el equipo Cumbo (mismo criterio que
//    Panel Cumbo) — expone el WhatsApp personal de los caficultores,
//    así que no queda abierto a cualquier usuario logueado.

const COLOR_DISP = { Disponible: 'var(--verde-cumbre)', 'Próxima cosecha': 'var(--tierra-kraft)', Agotado: 'var(--canela-oscuro)' };

function calcularDisponibilidad(producto) {
  if (!producto) return 'Próxima cosecha';
  return producto.stock > 0 ? 'Disponible' : 'Agotado';
}

function urlWhatsapp(whatsapp, nombre, finca) {
  if (!whatsapp) return null;
  const telefono = whatsapp.replace(/[^0-9]/g, '');
  const mensaje = encodeURIComponent(`Hola ${nombre}, te escribo de Cumbo para validar disponibilidad y tipo de café de ${finca}.`);
  return `https://wa.me/${telefono}?text=${mensaje}`;
}

export default function DirectorioCaficultores() {
  const { sesion, perfil, cargando: cargandoSesion } = useSesion();
  const [fincas, setFincas] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (sesion && perfil?.rol === 'ceo') cargar();
  }, [sesion, perfil]);

  async function cargar() {
    setCargando(true);
    const { data } = await supabase
      .from('fincas')
      .select('*, usuarios(nombre_completo, whatsapp), productos(stock)')
      .eq('estado', 'validada')
      .order('nombre_finca');
    setFincas(data || []);
    setCargando(false);
  }

  if (cargandoSesion) return null;
  if (!sesion) return <Navigate to="/ingreso" replace />;
  if (perfil && perfil.rol !== 'ceo') {
    return (
      <div
        style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}
      >
        <div>
          <p style={{ fontSize: 13.5, color: 'var(--marron-tinta)', marginBottom: 12 }}>Este directorio es solo para el equipo Cumbo.</p>
          <Link to="/" style={{ color: 'var(--cafe-oscuro)', fontWeight: 'bold', fontSize: 13 }}>
            ← Volver al ecosistema
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fondo-calido)', paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'var(--superficie)' }}>
        <Link to="/" style={{ color: 'var(--marron-tinta)', display: 'flex' }}>
          <ArrowLeft size={20} />
        </Link>
        <div style={{ fontWeight: 'bold', fontSize: 15, color: 'var(--marron-tinta)', flex: 1 }}>Directorio de Caficultores</div>
        <img src="/assets/logo-cumbo.png" alt="Cumbo" style={{ height: 22, width: 'auto' }} />
      </div>

      <div style={{ maxWidth: 460, margin: '0 auto', padding: '14px 16px' }}>
        {cargando ? (
          <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 20 }}>Cargando…</p>
        ) : fincas.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 20 }}>Todavía no hay fincas validadas.</p>
        ) : (
          fincas.map((f) => {
            const disponibilidad = calcularDisponibilidad(f.productos?.[0]);
            const enlaceWhatsapp = urlWhatsapp(f.usuarios?.whatsapp, f.usuarios?.nombre_completo || 'caficultor', f.nombre_finca);
            return (
              <div key={f.id} style={{ background: '#fff', borderRadius: 18, padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: 14, color: 'var(--marron-tinta)' }}>
                      {f.usuarios?.nombre_completo || 'Caficultor'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--cafe-oscuro)' }}>
                      {f.nombre_finca} · {f.region}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 'bold',
                      color: '#fff',
                      background: COLOR_DISP[disponibilidad],
                      borderRadius: 9999,
                      padding: '4px 10px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {disponibilidad}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--marron-tinta)', margin: '8px 0' }}>
                  {f.proceso} — {f.region} · {f.especie}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {enlaceWhatsapp ? (
                    <a
                      href={enlaceWhatsapp}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-block',
                        background: 'var(--verde-cumbre)',
                        color: '#fff',
                        textDecoration: 'none',
                        borderRadius: 9999,
                        padding: '8px 16px',
                        fontSize: 12.5,
                        fontWeight: 'bold',
                      }}
                    >
                      WhatsApp →
                    </a>
                  ) : (
                    <span style={{ fontSize: 11.5, color: 'var(--cafe-oscuro)' }}>Sin WhatsApp registrado</span>
                  )}
                  <Link
                    to={`/panel?tab=pergamino&finca=${f.id}`}
                    style={{
                      display: 'inline-block',
                      background: 'var(--accion)',
                      color: '#fff',
                      textDecoration: 'none',
                      borderRadius: 9999,
                      padding: '8px 16px',
                      fontSize: 12.5,
                      fontWeight: 'bold',
                    }}
                  >
                    Comprar pergamino
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
