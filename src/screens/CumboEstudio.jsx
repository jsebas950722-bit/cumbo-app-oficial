import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ArrowLeft,
  Sparkles,
  Calendar,
  Instagram,
  MessageCircle,
  Facebook,
  Image as ImageIcon,
  Radio,
  Eye,
  HeartHandshake,
  ShoppingCart,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useSesion } from '../context/SesionContext';

// Cumbo Estudio 2.0 — a pedido: ahora es una herramienta de embudo de
// conversión completo, no un generador de posts sueltos. El vendedor
// cuenta su INTENCIÓN (qué quiere lograr), elige el modelo de texto
// (Claude o Gemini — preferencia del vendedor, ambos generan texto
// igual de bien), y la IA arma un embudo real: piezas repartidas entre
// atracción, consideración y conversión, cada una con su llamado a la
// acción. Las imágenes SIEMPRE se generan con Gemini (Claude no genera
// imágenes — no es una opción, es una limitación real del modelo).
//
// El dashboard se actualiza en vivo (Supabase Realtime) — no hay que
// recargar la página para ver contenido nuevo o el uso del mes.

const NOMBRE_PLAN = { chispa: 'Chispa', cosecha: 'Cosecha', finca_completa: 'Finca Completa' };
const LIMITE_PLAN = { chispa: 3, cosecha: 15, finca_completa: 50 };

const ICONO_PLATAFORMA = { Instagram, Facebook, 'WhatsApp Estados': MessageCircle };

const ETAPA_INFO = {
  atraccion: { label: 'Atracción', Icono: Eye, color: '#185FA5' },
  consideracion: { label: 'Consideración', Icono: HeartHandshake, color: '#854F0B' },
  conversion: { label: 'Conversión', Icono: ShoppingCart, color: 'var(--exito)' },
};

export default function CumboEstudio() {
  const { sesion, cargando: cargandoSesion } = useSesion();
  const [suscripcion, setSuscripcion] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [intencion, setIntencion] = useState('');
  const [cantidadPiezas, setCantidadPiezas] = useState(3);
  const [modelo, setModelo] = useState('claude');
  const [consentimientoAvatar, setConsentimientoAvatar] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [generandoImagen, setGenerandoImagen] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [enVivo, setEnVivo] = useState(false);

  useEffect(() => {
    if (!sesion) return;
    cargar();

    // Tiempo real: si algo cambia en tus tablas de Estudio (por
    // ejemplo, generaste contenido desde otra pestaña, o el CEO te
    // cambió el plan), el dashboard se actualiza solo, sin recargar.
    const canal = supabase
      .channel('cumbo-estudio-propio')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contenido_marketing', filter: `vendedor_id=eq.${sesion.user.id}` },
        () => {
          cargar();
          setEnVivo(true);
          setTimeout(() => setEnVivo(false), 2000);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'suscripciones_estudio', filter: `vendedor_id=eq.${sesion.user.id}` },
        () => cargar()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesion]);

  async function cargar() {
    const [{ data: sus }, { data: hist }] = await Promise.all([
      supabase.from('suscripciones_estudio').select('*').eq('vendedor_id', sesion.user.id).maybeSingle(),
      supabase.from('contenido_marketing').select('*').eq('vendedor_id', sesion.user.id).order('fecha_creacion', { ascending: false }),
    ]);
    setSuscripcion(sus || { plan: 'chispa', usos_este_mes: 0 });
    setHistorial(hist || []);
    setCargando(false);
  }

  async function generar() {
    if (!intencion.trim()) return;
    setGenerando(true);
    setError('');
    try {
      const { data, error: errFn } = await supabase.functions.invoke('generar-contenido-estudio', {
        body: { intencion: intencion.trim(), cantidad_piezas: cantidadPiezas, consentimiento_avatar: consentimientoAvatar, modelo },
      });
      if (errFn || data?.error) {
        setError(data?.error || 'No se pudo generar el contenido. Intenta de nuevo.');
      } else {
        setIntencion('');
        cargar();
      }
    } finally {
      setGenerando(false);
    }
  }

  async function generarImagen(contenidoId, indice, guion) {
    setGenerandoImagen(`${contenidoId}-${indice}`);
    const { data, error: errFn } = await supabase.functions.invoke('generar-imagen-estudio', {
      body: { contenido_id: contenidoId, indice_pieza: indice, descripcion: guion },
    });
    if (errFn || data?.error) {
      setError(data?.error || 'No se pudo generar la imagen.');
    } else {
      cargar();
    }
    setGenerandoImagen('');
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
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 10,
            fontWeight: 'bold',
            color: enVivo ? 'var(--exito)' : '#b0a596',
          }}
        >
          <Radio size={11} /> {enVivo ? 'Actualizado' : 'En vivo'}
        </span>
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
                transition: 'width .3s',
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
              marginBottom: 4,
            }}
          >
            <Sparkles size={15} color="var(--accion)" /> Diseña tu embudo de conversión
          </div>
          <p style={{ fontSize: 11, color: 'var(--cafe-oscuro)', margin: '0 0 10px' }}>
            Contanos qué querés lograr — nosotros armamos el embudo completo (atracción → consideración → conversión), no solo posts
            sueltos.
          </p>
          <textarea
            value={intencion}
            onChange={(e) => setIntencion(e.target.value)}
            placeholder="Ej: 'Quiero vender más libras de mi café de Huila antes de fin de mes' o 'Nadie conoce mi finca todavía, quiero darla a conocer'"
            style={{
              width: '100%',
              border: '1px solid rgba(146,97,55,0.25)',
              borderRadius: 10,
              padding: '9px 12px',
              fontSize: 13,
              minHeight: 60,
              marginBottom: 10,
            }}
          />

          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button
              onClick={() => setModelo('claude')}
              style={{
                flex: 1,
                border: `1.5px solid ${modelo === 'claude' ? 'var(--accion)' : 'rgba(146,97,55,0.25)'}`,
                background: modelo === 'claude' ? 'var(--accion-suave)' : '#fff',
                borderRadius: 10,
                padding: '8px 0',
                fontSize: 12,
                fontWeight: 'bold',
                color: 'var(--marron-tinta)',
                cursor: 'pointer',
              }}
            >
              Claude
            </button>
            <button
              onClick={() => setModelo('gemini')}
              style={{
                flex: 1,
                border: `1.5px solid ${modelo === 'gemini' ? 'var(--accion)' : 'rgba(146,97,55,0.25)'}`,
                background: modelo === 'gemini' ? 'var(--accion-suave)' : '#fff',
                borderRadius: 10,
                padding: '8px 0',
                fontSize: 12,
                fontWeight: 'bold',
                color: 'var(--marron-tinta)',
                cursor: 'pointer',
              }}
            >
              Gemini
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: 'var(--cafe-oscuro)' }}>Cantidad de piezas:</label>
            <select
              value={cantidadPiezas}
              onChange={(e) => setCantidadPiezas(e.target.value)}
              style={{ border: '1px solid rgba(146,97,55,0.25)', borderRadius: 8, padding: '4px 8px', fontSize: 12.5 }}
            >
              {[3, 5, 7].map((n) => (
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
            disabled={generando || !intencion.trim() || usados >= limite}
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
              opacity: generando || !intencion.trim() || usados >= limite ? 0.6 : 1,
            }}
          >
            {generando ? 'Diseñando tu embudo…' : 'Generar embudo de conversión'}
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
          <Calendar size={15} /> Tus embudos generados
        </div>

        {cargando ? (
          <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 20 }}>Cargando…</p>
        ) : historial.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 20 }}>Todavía no generaste ningún embudo.</p>
        ) : (
          historial.map((c) => (
            <div key={c.id} style={{ background: 'var(--superficie)', borderRadius: 16, padding: 16, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontWeight: 'bold', fontSize: 13, color: 'var(--marron-tinta)' }}>{c.tema}</div>
                <span style={{ fontSize: 9.5, fontWeight: 'bold', color: 'var(--cafe-oscuro)', textTransform: 'uppercase' }}>
                  {c.modelo_usado || 'claude'}
                </span>
              </div>
              {(c.piezas || []).map((p, i) => {
                const IconoPlataforma = ICONO_PLATAFORMA[p.plataforma] || MessageCircle;
                const etapa = ETAPA_INFO[p.etapa_embudo] || ETAPA_INFO.atraccion;
                const IconoEtapa = etapa.Icono;
                return (
                  <div key={i} style={{ padding: '10px 0', borderTop: i > 0 ? '1px solid var(--fondo-calido)' : 'none' }}>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
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
                        <IconoPlataforma size={14} color="var(--accion)" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 3,
                              fontSize: 9.5,
                              fontWeight: 'bold',
                              color: etapa.color,
                              background: `${etapa.color}1a`,
                              borderRadius: 999,
                              padding: '2px 8px',
                            }}
                          >
                            <IconoEtapa size={10} /> {etapa.label}
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--cafe-oscuro)' }}>
                            Día {p.dia} · {p.plataforma}
                          </span>
                        </div>
                        <div style={{ fontSize: 12.5, color: 'var(--marron-tinta)' }}>{p.guion}</div>
                        {p.cta && <div style={{ fontSize: 11, color: 'var(--accion)', fontWeight: 'bold', marginTop: 4 }}>→ {p.cta}</div>}
                      </div>
                    </div>

                    {p.imagen_url ? (
                      <img src={p.imagen_url} alt="" style={{ width: '100%', borderRadius: 10, marginTop: 4 }} />
                    ) : (
                      <button
                        onClick={() => generarImagen(c.id, i, p.guion)}
                        disabled={generandoImagen === `${c.id}-${i}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          background: 'none',
                          border: '1px dashed rgba(146,97,55,0.35)',
                          borderRadius: 10,
                          padding: '7px 10px',
                          color: 'var(--accion)',
                          fontSize: 11,
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          marginTop: 4,
                          width: '100%',
                          justifyContent: 'center',
                        }}
                      >
                        <ImageIcon size={13} />{' '}
                        {generandoImagen === `${c.id}-${i}` ? 'Generando imagen con Gemini…' : 'Generar imagen con Gemini'}
                      </button>
                    )}
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
