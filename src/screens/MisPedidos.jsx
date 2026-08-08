import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Package, Truck, MapPin, ChevronDown, ChevronUp, ShoppingBag, Clock } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useSesion } from '../context/SesionContext';

// Pantalla nueva (no estaba en el handoff original) — el cliente
// necesitaba una forma de ver el estado real de sus propios pedidos.
// Antes, el seguimiento con guía y alertas solo existía en Logística,
// que es una herramienta interna (rol logística/CEO) — el cliente no
// tenía dónde consultarlo.
//
// Usa las mismas fuentes reales que ya existían: `pedidos` (estado,
// transportadora, guía) y `eventos_log` (alertas/cambios de estado).
// Nota de seguridad: esto solo funciona correctamente después de
// cumbo_schema_mis_pedidos.sql, que corrige una policy de eventos_log
// que antes dejaba ver el log de CUALQUIER pedido a CUALQUIER usuario
// autenticado.

const ETIQUETA_ESTADO = {
  pendiente: 'Pendiente de confirmación',
  en_revision: 'En revisión',
  confirmado: 'Confirmado',
  despachado: 'En camino',
  entregado: 'Entregado',
  devolucion: 'Devolución',
};

const ETIQUETA_DEVOLUCION = {
  pendiente: 'En revisión',
  aprobada: 'Aprobada — procesando',
  rechazada: 'Rechazada',
  reembolsada: 'Reembolsada',
  reembolso_manual_pendiente: 'Aprobada — el reembolso se está gestionando manualmente',
};

const COLOR_ESTADO = {
  pendiente: 'var(--tierra-kraft)',
  en_revision: 'var(--canela-oscuro)',
  confirmado: 'var(--accion)',
  despachado: 'var(--tierra-kraft)',
  entregado: 'var(--exito)',
  devolucion: 'var(--canela-oscuro)',
};

function formatoCOP(n) {
  return '$' + Math.round(n || 0).toLocaleString('es-CO');
}

function formatoFechaHora(fechaIso) {
  return new Date(fechaIso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function MisPedidos() {
  const { sesion, cargando: cargandoSesion } = useSesion();
  const [searchParams] = useSearchParams();
  const pago = searchParams.get('pago'); // 'exitoso' | 'pendiente' — llega de vuelta de Mercado Pago
  const [pedidos, setPedidos] = useState([]);
  const [alertasPorPedido, setAlertasPorPedido] = useState({});
  const [cargando, setCargando] = useState(true);
  const [expandidoId, setExpandidoId] = useState('');
  const [solicitudesDevolucion, setSolicitudesDevolucion] = useState({}); // { [pedido_id]: solicitud }
  const [formDevolucion, setFormDevolucion] = useState(null); // pedido_id abierto para solicitar
  const [motivoDevolucion, setMotivoDevolucion] = useState('');
  const [tipoDevolucion, setTipoDevolucion] = useState('retracto');
  const [enviandoDevolucion, setEnviandoDevolucion] = useState(false);

  useEffect(() => {
    if (sesion) cargar();
  }, [sesion]);

  async function cargar() {
    setCargando(true);
    const { data: pedidosData } = await supabase
      .from('pedidos')
      .select('*, pedido_items(cantidad, precio, productos(nombre))')
      .eq('cliente_id', sesion.user.id)
      .order('fecha', { ascending: false });

    setPedidos(pedidosData || []);

    if (pedidosData?.length) {
      const { data: eventosData } = await supabase
        .from('eventos_log')
        .select('*')
        .eq('entidad', 'pedido')
        .in(
          'entidad_id',
          pedidosData.map((p) => p.id)
        )
        .order('fecha', { ascending: false });

      const agrupado = {};
      (eventosData || []).forEach((ev) => {
        if (!agrupado[ev.entidad_id]) agrupado[ev.entidad_id] = [];
        agrupado[ev.entidad_id].push(ev);
      });
      setAlertasPorPedido(agrupado);

      const { data: devolucionesData } = await supabase
        .from('solicitudes_devolucion')
        .select('*')
        .in(
          'pedido_id',
          pedidosData.map((p) => p.id)
        );
      const porPedido = {};
      (devolucionesData || []).forEach((d) => {
        porPedido[d.pedido_id] = d;
      });
      setSolicitudesDevolucion(porPedido);
    }
    setCargando(false);
  }

  async function enviarSolicitudDevolucion(pedidoId) {
    if (!motivoDevolucion.trim()) return;
    setEnviandoDevolucion(true);
    const { error } = await supabase.from('solicitudes_devolucion').insert({
      pedido_id: pedidoId,
      cliente_id: sesion.user.id,
      tipo: tipoDevolucion,
      motivo: motivoDevolucion.trim(),
    });
    setEnviandoDevolucion(false);
    if (!error) {
      setFormDevolucion(null);
      setMotivoDevolucion('');
      cargar();
    }
  }

  if (cargandoSesion) return null;
  if (!sesion) return <Navigate to="/ingreso" replace />;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fondo-calido)', paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'var(--superficie)' }}>
        <Link to="/" style={{ color: 'var(--marron-tinta)', display: 'flex' }}>
          <ArrowLeft size={20} />
        </Link>
        <div style={{ fontWeight: 'bold', fontSize: 15, color: 'var(--marron-tinta)', flex: 1 }}>Mis pedidos</div>
        <img src="/assets/logo-cumbo.png" alt="Cumbo" style={{ height: 22, width: 'auto' }} />
      </div>

      <div style={{ maxWidth: 460, margin: '0 auto', padding: '14px 16px' }}>
        {pago && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: pago === 'exitoso' ? '#eaf1e7' : '#fdf3e6',
              border: `1px solid ${pago === 'exitoso' ? 'var(--verde-cumbre)' : 'var(--tierra-kraft)'}`,
              borderRadius: 12,
              padding: '10px 14px',
              marginBottom: 14,
              fontSize: 12.5,
              color: 'var(--marron-tinta)',
            }}
          >
            <Clock size={16} color={pago === 'exitoso' ? 'var(--exito)' : 'var(--pendiente)'} />
            {pago === 'exitoso'
              ? 'Pago recibido por Mercado Pago — confirmando tu pedido, puede tardar unos segundos en reflejarse abajo.'
              : 'Tu pago quedó pendiente de confirmación (por ejemplo, si pagaste en efectivo por Efecty). Te avisaremos cuando se confirme.'}
          </div>
        )}
        {cargando ? (
          <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 20 }}>Cargando…</p>
        ) : pedidos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <ShoppingBag size={36} color="var(--tierra-kraft)" style={{ marginBottom: 10 }} />
            <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', marginBottom: 14 }}>Todavía no has hecho ningún pedido.</p>
            <Link to="/marketplace" style={{ color: 'var(--accion)', fontWeight: 'bold', fontSize: 13, textDecoration: 'none' }}>
              Ir al Marketplace →
            </Link>
          </div>
        ) : (
          pedidos.map((p) => {
            const expandido = expandidoId === p.id;
            const alertas = alertasPorPedido[p.id] || [];
            return (
              <div key={p.id} style={{ background: 'var(--superficie)', borderRadius: 16, padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontWeight: 'bold',
                      fontSize: 13.5,
                      color: 'var(--marron-tinta)',
                    }}
                  >
                    <Package size={15} color="var(--cafe-oscuro)" /> Pedido #{p.id.slice(0, 8)}
                  </div>
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
                    {ETIQUETA_ESTADO[p.estado] || p.estado}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--cafe-oscuro)', marginBottom: 8 }}>
                  {new Date(p.fecha).toLocaleDateString('es-CO')}
                </div>

                {p.pedido_items?.map((it, i) => (
                  <div key={i} style={{ fontSize: 12.5, color: 'var(--marron-tinta)' }}>
                    {it.cantidad}x {it.productos?.nombre}
                  </div>
                ))}
                <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--marron-tinta)', marginTop: 6 }}>
                  Total: {formatoCOP(p.total)}
                </div>

                {p.transportadora && (
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--marron-tinta)',
                      marginTop: 8,
                      background: 'var(--fondo-calido)',
                      borderRadius: 10,
                      padding: '8px 10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Truck size={13} color="var(--cafe-oscuro)" />
                      {p.transportadora}
                      {p.guia_transportadora ? ` · Guía: ${p.guia_transportadora}` : ' · guía pendiente de asignar'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--cafe-oscuro)', marginTop: 3 }}>
                      <MapPin size={13} /> {p.direccion_entrega}
                      {p.ciudad_entrega ? `, ${p.ciudad_entrega}` : ''}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setExpandidoId(expandido ? '' : p.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'none',
                    border: 'none',
                    color: 'var(--accion)',
                    fontSize: 11.5,
                    fontWeight: 'bold',
                    marginTop: 10,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  {expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {expandido ? 'Ocultar seguimiento' : `Ver seguimiento (${alertas.length})`}
                </button>

                {expandido && (
                  <div style={{ marginTop: 8 }}>
                    {alertas.length === 0 ? (
                      <p style={{ fontSize: 11.5, color: 'var(--cafe-oscuro)' }}>Sin novedades registradas todavía.</p>
                    ) : (
                      alertas.map((a) => (
                        <div
                          key={a.id}
                          style={{
                            fontSize: 11.5,
                            color: 'var(--marron-tinta)',
                            padding: '4px 0',
                            borderTop: '1px solid var(--fondo-calido)',
                          }}
                        >
                          <span style={{ color: 'var(--cafe-oscuro)' }}>{formatoFechaHora(a.fecha)}</span> — {textoEvento(a)}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {p.estado === 'entregado' &&
                  (() => {
                    const solicitud = solicitudesDevolucion[p.id];
                    if (solicitud) {
                      return (
                        <div
                          style={{
                            marginTop: 10,
                            fontSize: 11.5,
                            color: 'var(--marron-tinta)',
                            background: 'var(--fondo-calido)',
                            borderRadius: 10,
                            padding: '8px 10px',
                          }}
                        >
                          Solicitud de devolución: <strong>{ETIQUETA_DEVOLUCION[solicitud.estado]}</strong>
                          {solicitud.notas_ceo && <div style={{ marginTop: 4, color: 'var(--cafe-oscuro)' }}>{solicitud.notas_ceo}</div>}
                        </div>
                      );
                    }
                    if (formDevolucion === p.id) {
                      return (
                        <div style={{ marginTop: 10 }}>
                          <select
                            value={tipoDevolucion}
                            onChange={(e) => setTipoDevolucion(e.target.value)}
                            style={{
                              width: '100%',
                              border: '1px solid rgba(146,97,55,0.25)',
                              borderRadius: 10,
                              padding: 8,
                              fontSize: 12,
                              marginBottom: 6,
                            }}
                          >
                            <option value="retracto">Ya no lo quiero (derecho de retracto)</option>
                            <option value="garantia">Llegó dañado o incorrecto (garantía)</option>
                          </select>
                          <textarea
                            value={motivoDevolucion}
                            onChange={(e) => setMotivoDevolucion(e.target.value)}
                            placeholder="Cuéntanos qué pasó"
                            style={{
                              width: '100%',
                              border: '1px solid rgba(146,97,55,0.25)',
                              borderRadius: 10,
                              padding: 8,
                              fontSize: 12,
                              minHeight: 50,
                              marginBottom: 6,
                            }}
                          />
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              onClick={() => setFormDevolucion(null)}
                              style={{
                                flex: 1,
                                border: '1px solid rgba(146,97,55,0.25)',
                                background: 'none',
                                borderRadius: 999,
                                padding: 9,
                                fontSize: 12,
                                color: 'var(--marron-tinta)',
                                cursor: 'pointer',
                              }}
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => enviarSolicitudDevolucion(p.id)}
                              disabled={enviandoDevolucion || !motivoDevolucion.trim()}
                              style={{
                                flex: 1,
                                border: 'none',
                                background: 'var(--accion)',
                                color: '#fff',
                                borderRadius: 999,
                                padding: 9,
                                fontSize: 12,
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                opacity: enviandoDevolucion || !motivoDevolucion.trim() ? 0.6 : 1,
                              }}
                            >
                              {enviandoDevolucion ? 'Enviando…' : 'Enviar solicitud'}
                            </button>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <button
                        onClick={() => setFormDevolucion(p.id)}
                        style={{
                          display: 'block',
                          marginTop: 10,
                          background: 'none',
                          border: 'none',
                          color: 'var(--accion)',
                          fontSize: 11.5,
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        Solicitar devolución
                      </button>
                    );
                  })()}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function textoEvento(evento) {
  if (evento.accion === 'creado') return 'Pedido creado.';
  if (evento.accion === 'cambio_estado') {
    const a = evento.datos?.a;
    if (a === 'despachado')
      return `Despachado con ${evento.datos?.transportadora || 'la transportadora'} (guía ${evento.datos?.guia || 'pendiente'}).`;
    if (a === 'entregado') return 'Entregado.';
    if (a === 'confirmado') return 'Pedido confirmado.';
    return `Cambio de estado a ${a}.`;
  }
  return evento.accion;
}
