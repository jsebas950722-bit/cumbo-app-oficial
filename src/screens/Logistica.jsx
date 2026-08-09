import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useSesion } from '../context/SesionContext';

// Migrado desde: "Logistica Cumbo.dc.html"
// Cambios respecto al prototipo:
//  - Los 3 envíos y las 3 alertas de ejemplo se reemplazan por pedidos
//    y eventos reales de Supabase.
//  - Se agregó algo que faltaba en todo el flujo hasta ahora: un lugar
//    real para escribir la guía y la transportadora al despachar un
//    pedido. Panel Cumbo podía avanzar un pedido a "despachado", pero
//    ninguna pantalla permitía ingresar la guía real — quedaba huérfano.
//  - Solo visible para `rol: 'logistica'` o `'ceo'` (mismo criterio que
//    Panel Cumbo y Directorio de Caficultores).
//  - Deliberadamente FUERA de esta pasada: integración en vivo con la
//    API de una transportadora o agregador (Servientrega, Coordinadora,
//    etc.) para cotizar tarifas o rastrear en tiempo real dentro de la
//    app — todavía no se ha elegido con cuál integrar. Mientras tanto,
//    el botón de rastreo lleva al sitio oficial de cada transportadora
//    (enlaces reales, no inventados).

const URLS_SEGUIMIENTO = {
  Servientrega: 'https://www.servientrega.com/wps/portal/rastreo-envio',
  Coordinadora: 'https://coordinadora.com/rastreo/rastreo-de-guia/',
  Envía: 'https://envia.co/',
  Interrapidísimo: 'https://interrapidisimo.com/',
  TCC: 'https://www.tcc.com.co/rastreo-de-guias/',
  Veloces: 'https://www.velocesa.com/',
  Didi: 'https://didi-cl.freshdesk.com/',
  Yango: 'https://yango.com/',
};

const TRANSPORTADORAS = Object.keys(URLS_SEGUIMIENTO);

const COLOR_ESTADO = { confirmado: 'var(--canela-oscuro)', despachado: 'var(--tierra-kraft)', entregado: 'var(--verde-cumbre)' };
const ETIQUETA_ESTADO = { confirmado: 'Por despachar', despachado: 'En tránsito', entregado: 'Entregado' };

function nombreLegibleTransportadora(carrier) {
  const mapa = { interrapidisimo: 'Interrapidísimo', coordinadora: 'Coordinadora', serviEntrega: 'Servientrega' };
  return mapa[carrier] || carrier;
}

function formatoCOP(n) {
  return '$' + Math.round(n || 0).toLocaleString('es-CO');
}

function haceTiempo(fechaIso) {
  const diffMs = Date.now() - new Date(fechaIso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 60) return `hace ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `hace ${horas} h`;
  return `hace ${Math.floor(horas / 24)} d`;
}

export default function Logistica() {
  const { sesion, perfil, cargando: cargandoSesion } = useSesion();
  const [pedidos, setPedidos] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [formPorPedido, setFormPorPedido] = useState({}); // { [pedidoId]: { transportadora, guia } }
  const [procesando, setProcesando] = useState(null);
  const [transportadoraRastreo, setTransportadoraRastreo] = useState('Servientrega');

  useEffect(() => {
    if (sesion && perfil && ['logistica', 'ceo'].includes(perfil.rol)) cargar();
  }, [sesion, perfil]);

  async function cargar() {
    setCargando(true);
    const [{ data: pedidosData }, { data: eventosData }] = await Promise.all([
      supabase
        .from('pedidos')
        .select('*, usuarios(nombre_completo)')
        .in('estado', ['confirmado', 'despachado', 'entregado'])
        .order('fecha', { ascending: false }),
      supabase
        .from('eventos_log')
        .select('*')
        .eq('entidad', 'pedido')
        .eq('accion', 'cambio_estado')
        .order('fecha', { ascending: false })
        .limit(10),
    ]);
    setPedidos(pedidosData || []);
    setAlertas(eventosData || []);
    setCargando(false);
  }

  if (cargandoSesion) return null;
  if (!sesion) return <Navigate to="/ingreso" replace />;
  if (perfil && !['logistica', 'ceo'].includes(perfil.rol)) {
    return (
      <div
        style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}
      >
        <div>
          <p style={{ fontSize: 13.5, color: 'var(--marron-tinta)', marginBottom: 12 }}>
            Esta pantalla es solo para logística y el equipo Cumbo.
          </p>
          <Link to="/" style={{ color: 'var(--cafe-oscuro)', fontWeight: 'bold', fontSize: 13 }}>
            ← Volver al ecosistema
          </Link>
        </div>
      </div>
    );
  }

  function actualizarForm(pedidoId, campo, valor) {
    setFormPorPedido((prev) => ({ ...prev, [pedidoId]: { ...prev[pedidoId], [campo]: valor } }));
  }

  async function despachar(pedido) {
    // Si el pedido tiene una cotización real de DrEnvío (envío
    // nacional), generamos la guía real automáticamente — nada de
    // escribir un número a mano. Los pedidos de mensajería urbana
    // (Yango/Didi, dentro de Bogotá) no tienen esa cotización, así
    // que siguen con el formulario manual como hasta ahora.
    if (pedido.cotizacion_envio) {
      setProcesando(pedido.id);
      const { data, error } = await supabase.functions.invoke('generar-guia-envio', { body: { pedido_id: pedido.id } });
      setProcesando(null);
      if (error || data?.error) {
        alert(
          `No se pudo generar la guía automáticamente: ${data?.error || 'error desconocido'}. Puedes intentar de nuevo o contactar soporte de DrEnvío.`
        );
        return;
      }
      cargar();
      return;
    }

    const datos = formPorPedido[pedido.id] || {};
    if (!datos.transportadora || !datos.guia) return;

    setProcesando(pedido.id);
    try {
      await supabase
        .from('pedidos')
        .update({ transportadora: datos.transportadora, guia_transportadora: datos.guia, estado: 'despachado' })
        .eq('id', pedido.id);
      await supabase.from('eventos_log').insert({
        entidad: 'pedido',
        entidad_id: pedido.id,
        accion: 'cambio_estado',
        datos: { de: 'confirmado', a: 'despachado', transportadora: datos.transportadora, guia: datos.guia },
        usuario_id: sesion.user.id,
      });
      cargar();
    } finally {
      setProcesando(null);
    }
  }

  async function marcarEntregado(pedido) {
    setProcesando(pedido.id);
    try {
      await supabase.from('pedidos').update({ estado: 'entregado' }).eq('id', pedido.id);
      await supabase.from('eventos_log').insert({
        entidad: 'pedido',
        entidad_id: pedido.id,
        accion: 'cambio_estado',
        datos: { de: 'despachado', a: 'entregado' },
        usuario_id: sesion.user.id,
      });
      cargar();
    } finally {
      setProcesando(null);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fondo-calido)', paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'var(--superficie)' }}>
        <Link to="/" style={{ color: 'var(--marron-tinta)', display: 'flex' }}>
          <ArrowLeft size={20} />
        </Link>
        <div style={{ fontWeight: 'bold', fontSize: 15, color: 'var(--marron-tinta)', flex: 1 }}>Logística</div>
        <img src="/assets/logo-cumbo.png" alt="Cumbo" style={{ height: 22, width: 'auto' }} />
      </div>

      <div style={{ maxWidth: 460, margin: '0 auto', padding: '14px 16px' }}>
        {/* Rastreo rápido */}
        <div style={{ background: '#fff', borderRadius: 18, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--marron-tinta)', marginBottom: 10 }}>Rastreo rápido</div>
          <select value={transportadoraRastreo} onChange={(e) => setTransportadoraRastreo(e.target.value)} style={inputStyle}>
            {TRANSPORTADORAS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <a
            href={URLS_SEGUIMIENTO[transportadoraRastreo]}
            target="_blank"
            rel="noreferrer"
            className="cumbo-btn"
            style={{
              display: 'block',
              textAlign: 'center',
              textDecoration: 'none',
              marginTop: 10,
              background: 'var(--accion)',
              color: '#fff',
              padding: 12,
              borderRadius: 9999,
              fontSize: 13,
              fontWeight: 'bold',
            }}
          >
            Ir al sitio de {transportadoraRastreo} →
          </a>
          <p style={{ fontSize: 10.5, color: 'var(--cafe-oscuro)', marginTop: 8 }}>
            Todavía no hay integración en vivo con la transportadora — este enlace lleva a su sitio oficial de rastreo.
          </p>
        </div>

        {cargando ? (
          <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 20 }}>Cargando…</p>
        ) : (
          <>
            <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--marron-tinta)', marginBottom: 10 }}>Envíos</div>
            {pedidos.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 20 }}>
                No hay pedidos por despachar todavía.
              </p>
            ) : (
              pedidos.map((p) => {
                const form = formPorPedido[p.id] || {};
                return (
                  <div key={p.id} style={tarjeta}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ fontWeight: 'bold', fontSize: 13, color: 'var(--marron-tinta)' }}>#{p.id.slice(0, 8)}</div>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 'bold',
                          color: '#fff',
                          background: COLOR_ESTADO[p.estado],
                          borderRadius: 9999,
                          padding: '3px 10px',
                        }}
                      >
                        {ETIQUETA_ESTADO[p.estado]}
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--cafe-oscuro)', marginBottom: 4 }}>
                      {p.usuarios?.nombre_completo || 'Cliente'}
                    </div>
                    {(p.direccion_entrega || p.telefono_contacto) && (
                      <div
                        style={{
                          fontSize: 11.5,
                          color: 'var(--marron-tinta)',
                          marginBottom: 8,
                          background: 'var(--fondo-calido)',
                          borderRadius: 10,
                          padding: '6px 10px',
                        }}
                      >
                        {p.direccion_entrega}
                        {p.ciudad_entrega ? `, ${p.ciudad_entrega}` : ''} · 📞 {p.telefono_contacto}
                        <div style={{ fontWeight: 'bold', marginTop: 2 }}>Total: {formatoCOP(p.total)}</div>
                      </div>
                    )}

                    {p.estado === 'confirmado' &&
                      (p.cotizacion_envio ? (
                        <div>
                          <div style={{ fontSize: 11.5, color: 'var(--cafe-oscuro)', marginBottom: 8 }}>
                            {nombreLegibleTransportadora(p.cotizacion_envio.carrier)} · {p.cotizacion_envio.service} · Cotizado en el
                            checkout: {formatoCOP(p.cotizacion_envio.price)}
                          </div>
                          <button onClick={() => despachar(p)} disabled={procesando === p.id} style={botonAccion}>
                            {procesando === p.id ? 'Generando guía…' : 'Generar guía real y despachar'}
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <select
                            value={form.transportadora || ''}
                            onChange={(e) => actualizarForm(p.id, 'transportadora', e.target.value)}
                            style={inputStyle}
                          >
                            <option value="">Elegir transportadora…</option>
                            {TRANSPORTADORAS.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                          <input
                            placeholder="Número de guía"
                            value={form.guia || ''}
                            onChange={(e) => actualizarForm(p.id, 'guia', e.target.value)}
                            style={inputStyle}
                          />
                          <button
                            onClick={() => despachar(p)}
                            disabled={procesando === p.id || !form.transportadora || !form.guia}
                            style={botonAccion}
                          >
                            Marcar como despachado
                          </button>
                        </div>
                      ))}

                    {p.estado === 'despachado' && (
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--marron-tinta)', marginBottom: 8 }}>
                          {p.transportadora} · Guía: <strong>{p.guia_transportadora}</strong>
                          {p.etiqueta_envio_url && (
                            <>
                              {' · '}
                              <a
                                href={p.etiqueta_envio_url}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: 'var(--accion)', fontWeight: 'bold' }}
                              >
                                Ver etiqueta
                              </a>
                            </>
                          )}
                        </div>
                        <button
                          onClick={() => marcarEntregado(p)}
                          disabled={procesando === p.id}
                          style={{ ...botonAccion, background: 'var(--verde-cumbre)' }}
                        >
                          Marcar como entregado
                        </button>
                      </div>
                    )}

                    {p.estado === 'entregado' && (
                      <div style={{ fontSize: 12, color: 'var(--marron-tinta)' }}>
                        {p.transportadora} · Guía: {p.guia_transportadora}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--marron-tinta)', margin: '18px 0 10px' }}>Alertas recientes</div>
            {alertas.length === 0 ? (
              <p style={{ fontSize: 12.5, color: 'var(--cafe-oscuro)' }}>Sin actividad reciente.</p>
            ) : (
              alertas.map((a) => (
                <div key={a.id} style={{ background: '#fff', borderRadius: 14, padding: 12, marginBottom: 8 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--marron-tinta)' }}>
                    Pedido #{a.entidad_id?.slice(0, 8)}: {a.datos?.de} → <strong>{a.datos?.a}</strong>
                    {a.datos?.transportadora && ` (${a.datos.transportadora}, guía ${a.datos.guia})`}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--cafe-oscuro)' }}>{haceTiempo(a.fecha)}</div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  border: '1.5px solid rgba(146,97,55,0.25)',
  borderRadius: 12,
  padding: '9px 12px',
  fontSize: 13,
  color: 'var(--marron-tinta)',
  background: '#fff',
  width: '100%',
};

const tarjeta = { background: '#fff', borderRadius: 16, padding: 14, marginBottom: 10 };
const botonAccion = {
  width: '100%',
  border: 'none',
  borderRadius: 9999,
  padding: 10,
  color: '#fff',
  background: 'var(--accion)',
  fontSize: 12.5,
  fontWeight: 'bold',
  cursor: 'pointer',
};
