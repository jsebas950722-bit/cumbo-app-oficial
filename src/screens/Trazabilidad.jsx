import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

// Migrado desde: "Trazabilidad Cumbo.dc.html"
// Cambios respecto al prototipo:
//  - Los 3 lotes hardcodeados se reemplazan por las fincas realmente
//    validadas en Supabase (las mismas que ya se ven en el Marketplace).
//  - El prototipo mostraba fechas específicas por paso (recolección,
//    lavado, secado, trilla, tueste) como si estuvieran registradas una
//    por una. Eso no existe todavía en la base — así que en vez de
//    inventar fechas, mostramos una CRONOLOGÍA ESTIMADA a partir de la
//    fecha de recolección real, dejándolo dicho explícitamente. Si más
//    adelante Sebastián quiere fechas exactas por paso, eso implica
//    agregar una tabla de eventos por lote (candidato natural: extender
//    `eventos_log`, que ya existe).

const PASOS_BASE = [
  { titulo: 'Recolección en finca', diasDesdeRecoleccion: 0 },
  { titulo: 'Beneficio (despulpado y proceso)', diasDesdeRecoleccion: 1 },
  { titulo: 'Secado', diasDesdeRecoleccion: 6 },
  { titulo: 'Trilla y selección por densidad', diasDesdeRecoleccion: 20 },
  { titulo: 'Tueste en Cumbo', diasDesdeRecoleccion: 34 },
];

function formatoFecha(fecha) {
  return new Date(fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function sumarDias(fechaBase, dias) {
  const f = new Date(fechaBase);
  f.setDate(f.getDate() + dias);
  return f;
}

export default function Trazabilidad() {
  const [fincas, setFincas] = useState([]);
  const [seleccionada, setSeleccionada] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    const { data, error: err } = await supabase
      .from('fincas')
      .select('*, usuarios(nombre_completo)')
      .eq('estado', 'validada')
      .order('fecha_creacion', { ascending: false });
    if (err) setError('No se pudieron cargar las fincas.');
    setFincas(data || []);
    setCargando(false);
  }

  if (cargando) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--cafe-oscuro)' }}>Cargando trazabilidad…</div>;
  }

  const finca = fincas[seleccionada];
  const fechaAncla = finca?.fecha_recoleccion || finca?.fecha_creacion;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fondo-calido)', paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'var(--superficie)' }}>
        <Link to="/" style={{ color: 'var(--marron-tinta)', display: 'flex' }}>
          <ArrowLeft size={20} />
        </Link>
        <div style={{ fontWeight: 'bold', fontSize: 15, color: 'var(--marron-tinta)', flex: 1 }}>Trazabilidad</div>
        <img src="/assets/logo-cumbo.png" alt="Cumbo" style={{ height: 22, width: 'auto' }} />
      </div>

      <div style={{ maxWidth: 440, margin: '0 auto', padding: '14px 16px' }}>
        {error && (
          <div
            style={{
              fontSize: 12.5,
              color: 'var(--canela-oscuro)',
              background: '#fdf3e6',
              border: '1px solid var(--tierra-kraft)',
              borderRadius: 10,
              padding: '9px 12px',
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        {fincas.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 30 }}>
            Todavía no hay fincas validadas para mostrar trazabilidad.
          </p>
        ) : (
          <>
            {/* Selector de lote */}
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 16, paddingBottom: 4 }}>
              {fincas.map((f, i) => (
                <button
                  key={f.id}
                  onClick={() => setSeleccionada(i)}
                  style={{
                    whiteSpace: 'nowrap',
                    border: 'none',
                    borderRadius: 14,
                    padding: '10px 14px',
                    fontSize: 12,
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    background: i === seleccionada ? 'var(--accion)' : 'var(--superficie)',
                    color: i === seleccionada ? '#fff' : 'var(--cafe-oscuro)',
                    textAlign: 'left',
                  }}
                >
                  <div>Lote CMB-{f.id.slice(0, 6).toUpperCase()}</div>
                  <div style={{ fontSize: 10.5, opacity: 0.85 }}>{f.nombre_finca}</div>
                </button>
              ))}
            </div>

            {/* Detalle del lote seleccionado */}
            <div style={{ background: 'var(--superficie)', borderRadius: 20, padding: 20, marginBottom: 16 }}>
              <div style={{ fontWeight: 'bold', fontSize: 16, color: 'var(--marron-tinta)' }}>{finca.nombre_finca}</div>
              <div style={{ fontSize: 12.5, color: 'var(--cafe-oscuro)', marginBottom: 10 }}>
                {finca.region} · {finca.altitud_msnm} msnm · {finca.especie} · {finca.proceso}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--marron-tinta)', marginBottom: 4 }}>
                Caficultor: <strong>{finca.usuarios?.nombre_completo || 'Sin registrar'}</strong>
              </div>
              {finca.humedad_grano && (
                <div style={{ fontSize: 12.5, color: 'var(--marron-tinta)', marginBottom: 4 }}>
                  Humedad al secado: <strong>{finca.humedad_grano}%</strong>
                </div>
              )}
              {finca.notas_sabor && (
                <div style={{ fontSize: 12.5, color: 'var(--marron-tinta)', fontStyle: 'italic', marginTop: 6 }}>“{finca.notas_sabor}”</div>
              )}
            </div>

            {/* Cronología */}
            <div style={{ background: 'var(--superficie)', borderRadius: 20, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--marron-tinta)', marginBottom: 4 }}>Del cultivo a tu taza</div>
              {fechaAncla ? (
                <p style={{ fontSize: 11, color: 'var(--cafe-oscuro)', marginBottom: 14 }}>
                  Cronología estimada a partir de la fecha de recolección — las fechas exactas por paso se registrarán cuando conectemos el
                  seguimiento detallado de lote.
                </p>
              ) : (
                <p style={{ fontSize: 11, color: 'var(--cafe-oscuro)', marginBottom: 14 }}>
                  Todavía no hay fecha de recolección registrada para este lote — se muestran los pasos sin fechas.
                </p>
              )}

              {PASOS_BASE.map((paso, i) => (
                <div key={paso.titulo} style={{ display: 'flex', gap: 10, marginBottom: i === PASOS_BASE.length - 1 ? 0 : 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--accion)' }} />
                    {i !== PASOS_BASE.length - 1 && <div style={{ width: 2, flex: 1, background: '#e8ddc8', marginTop: 2 }} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--marron-tinta)' }}>{paso.titulo}</div>
                    {fechaAncla && (
                      <div style={{ fontSize: 11.5, color: 'var(--cafe-oscuro)' }}>
                        {formatoFecha(sumarDias(fechaAncla, paso.diasDesdeRecoleccion))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
