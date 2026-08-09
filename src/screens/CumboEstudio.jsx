import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Calendar, Instagram, MessageCircle, Facebook } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useSesion } from '../context/SesionContext';

// Cumbo Estudio — módulo aparte del ecosistema (no era una pantalla
// que faltara migrar del prototipo, nunca existió como tal). Genera
// contenido de marketing real sobre lo que el vendedor/caficultor
// vende de verdad, con un límite de uso mensual según su plan
// (Chispa/Cosecha/Finca Completa — nombres ya definidos en la
// Constitución del Ecosistema).
//
// IMPORTANTE: esto controla el LÍMITE de uso, no el cobro de la
// suscripción — cobrar automáticamente cada mes es una pieza aparte
// (suscripciones recurrentes), todavía no construida. Por ahora, subir
// de plan se gestiona por WhatsApp con el equipo Cumbo.

const NOMBRE_PLAN = { chispa: 'Chispa', cosecha: 'Cosecha', finca_completa: 'Finca Completa' };
const LIMITE_PLAN = { chispa: 3, cosecha: 15, finca_completa: 50 };

const ICONO_PLATAFORMA = { Instagram, Facebook, 'WhatsApp Estados': MessageCircle };

export default function CumboEstudio() {
  const { sesion, cargando: cargandoSesion } = useSesion();
  const [suscripcion, setSuscripcion] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [tema, setTema] = useState('');
  const [cantidadPiezas, setCantidadPiezas] = useState(3);
  const [consentimientoAvatar, setConsentimientoAvatar] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (sesion) cargar();
  }, [sesion]);

  async function cargar() {
    setCargando(true);
    const [{ data: sus }, { data: hist }] = await Promise.all([
      supabase.from('suscripciones_estudio').select('*').eq('vendedor_id', sesion.user.id).maybeSingle(),
      supabase.from('contenido_marketing').select('*').eq('vendedor_id', sesion.user.id).order('fecha_creacion', { ascending: false }),
    ]);
    setSuscripcion(sus || { plan: 'chispa', usos_este_mes: 0 });
    setHistorial(hist || []);
    setCargando(false);
  }

  async function generar() {
    if (!tema.trim()) return;
    setGenerando(true);
    setError('');
    try {
      const { data, error: errFn } = await supabase.functions.invoke('generar-contenido-estudio', {
        body: { tema: tema.trim(), cantidad_piezas: cantidadPiezas, consentimiento_avatar: consentimientoAvatar },
      });
      if (errFn || data?.error) {
        setError(data?.error || 'No se pudo generar el contenido. Intenta de nuevo.');
      } else {
        setTema('');
        cargar();
      }
    } finally {
      setGenerando(false);
    }
  }

  if (cargandoSesion) return null;
  if (!sesion) return <Navigate to="/ingreso?next=/cumbo-estudio" replace />;

  const plan = suscripcion?.plan || 'chispa';
  const usados = suscripcion?.usos_este_mes || 0;
  const limite = LIMITE_PLAN[plan];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fondo-calido)', paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'var(--superficie)' }}>
        <Link to="/perfil" style={{ color: 'var(--marron-tinta)', display: 'flex' }}>
          <ArrowLeft size={20} />
        </Link>
        <div style={{ fontWeight: 'bold', fontSize: 15, color: 'var(--marron-tinta)', flex: 1 }}>Cumbo Estudio</div>
      </div>

      <div style={{ maxWidth: 460, margin: '0 auto', padding: '14px 16px' }}>
        <div style={{ background: 'var(--superficie)', borderRadius: 16, padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--marron-tinta)' }}>Plan {NOMBRE_PLAN[plan]}</div>
            <span style={{ fontSize: 11.5, color: 'var(--cafe-oscuro)' }}>
              {usados} / {limite} este mes
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: '#e8ddc8', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, (usados / limite) * 100)}%`,
                background: usados >= limite ? 'var(--canela-oscuro)' : 'var(--accion)',
              }}
            />
          </div>
          {usados >= limite && (
            <p style={{ fontSize: 11.5, color: 'var(--canela-oscuro)', marginTop: 8 }}>
              Alcanzaste el límite de este mes. Escríbenos por WhatsApp para subir de plan.
            </p>
          )}
        </div>

        <div style={{ background: 'var(--superficie)', borderRadius: 16, padding: 16, marginBottom: 14 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 'bold',
              color: 'var(--marron-tinta)',
              marginBottom: 10,
            }}
          >
            <Sparkles size={15} color="var(--accion)" /> Generar contenido nuevo
          </div>
          <input
            value={tema}
            onChange={(e) => setTema(e.target.value)}
            placeholder="Tema: ej. 'Cosecha de octubre', 'Nueva prensa francesa'"
            style={{
              width: '100%',
              border: '1px solid rgba(146,97,55,0.25)',
              borderRadius: 10,
              padding: '9px 12px',
              fontSize: 13,
              marginBottom: 8,
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: 'var(--cafe-oscuro)' }}>Cantidad de piezas:</label>
            <select
              value={cantidadPiezas}
              onChange={(e) => setCantidadPiezas(e.target.value)}
              style={{ border: '1px solid rgba(146,97,55,0.25)', borderRadius: 8, padding: '4px 8px', fontSize: 12.5 }}
            >
              {[1, 2, 3, 5, 7].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              fontSize: 11.5,
              color: 'var(--marron-tinta)',
              marginBottom: 12,
              lineHeight: 1.4,
            }}
          >
            <input
              type="checkbox"
              checked={consentimientoAvatar}
              onChange={(e) => setConsentimientoAvatar(e.target.checked)}
              style={{ marginTop: 2 }}
            />
            Autorizo generar guiones para video con avatar de IA (si no marcás esto, el contenido es para foto/texto, sin video hablado)
          </label>
          {error && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--canela-oscuro)',
                background: '#fdf3e6',
                border: '1px solid var(--tierra-kraft)',
                borderRadius: 10,
                padding: '9px 12px',
                marginBottom: 10,
              }}
            >
              {error}
            </div>
          )}
          <button
            onClick={generar}
            disabled={generando || !tema.trim() || usados >= limite}
            style={{
              width: '100%',
              background: 'var(--accion)',
              color: '#fff',
              border: 'none',
              padding: 12,
              borderRadius: 9999,
              fontSize: 13.5,
              fontWeight: 'bold',
              cursor: 'pointer',
              opacity: generando || !tema.trim() || usados >= limite ? 0.6 : 1,
            }}
          >
            {generando ? 'Generando…' : 'Generar calendario de contenido'}
          </button>
        </div>

        <div
          style={{
            fontSize: 13,
            fontWeight: 'bold',
            color: 'var(--marron-tinta)',
            marginBottom: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Calendar size={15} /> Tu contenido generado
        </div>

        {cargando ? (
          <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 20 }}>Cargando…</p>
        ) : historial.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 20 }}>Todavía no generaste contenido.</p>
        ) : (
          historial.map((c) => (
            <div key={c.id} style={{ background: 'var(--superficie)', borderRadius: 16, padding: 16, marginBottom: 12 }}>
              <div style={{ fontWeight: 'bold', fontSize: 13, color: 'var(--marron-tinta)', marginBottom: 8 }}>{c.tema}</div>
              {(c.piezas || []).map((p, i) => {
                const Icono = ICONO_PLATAFORMA[p.plataforma] || MessageCircle;
                return (
                  <div
                    key={i}
                    style={{ display: 'flex', gap: 10, padding: '8px 0', borderTop: i > 0 ? '1px solid var(--fondo-calido)' : 'none' }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: 'var(--accion-suave)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icono size={14} color="var(--accion)" />
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 'bold', color: 'var(--cafe-oscuro)' }}>
                        Día {p.dia} · {p.plataforma}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--marron-tinta)' }}>{p.guion}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
