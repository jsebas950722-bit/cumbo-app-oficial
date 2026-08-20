import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Image as ImageIcon,
  Video,
  Plus,
  Trash2,
  Save,
  DollarSign,
  ShoppingBag,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Calendar,
  Radio,
  Sprout,
  MessageCircle,
  Package,
  Wallet,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useSesion } from '../context/SesionContext';

// Migrado desde: "Panel Cumbo.dc.html"
// Cambios respecto al prototipo:
//  - La pestaña "Fichas" del prototipo era de SOLO LECTURA (listaba
//    fichas de localStorage sin acción real de aprobar/rechazar). Acá
//    sí se puede validar o rechazar una finca de verdad — es lo que
//    Sebastián señaló como bloqueante: sin esto, las fincas enviadas
//    desde Portal Caficultor se quedan en "pendiente" para siempre.
//  - Pedidos: viene de Supabase real, con acciones reales para avanzar
//    el estado (pendiente → en_revision → confirmado → despachado →
//    entregado), no de un array hardcodeado de ejemplo.
//  - KPIs: contados de verdad desde la base, no del "modelador"
//    financiero ilustrativo del prototipo.
//  - Deliberadamente FUERA de esta pasada: el modelador financiero
//    completo del prototipo (competencia de precios, estacionalidad,
//    ranking de marcas socias, specs de creativos publicitarios,
//    facturación DIAN). Es una herramienta de inteligencia de negocio
//    grande y separada — no bloquea el flujo operativo, así que la
//    dejamos para una fase aparte.

function formatoCOP(n) {
  return '$' + Math.round(n || 0).toLocaleString('es-CO');
}

const SIGUIENTE_ESTADO = {
  pendiente: 'confirmado',
  en_revision: 'confirmado',
  confirmado: 'despachado',
  despachado: 'entregado',
};

const ETIQUETA_ESTADO = {
  pendiente: 'Pendiente',
  en_revision: 'En revisión',
  confirmado: 'Confirmado',
  despachado: 'Despachado',
  entregado: 'Entregado',
  devolucion: 'Devolución',
};

export default function PanelCumbo() {
  const { sesion, perfil, cargando: cargandoSesion } = useSesion();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') || 'operacion'); // 'operacion' | 'fichas' | 'pedidos' | 'resumen' | ...

  if (cargandoSesion) return null;
  if (!sesion) return <Navigate to="/ingreso" replace />;
  if (perfil && perfil.rol !== 'ceo') {
    return (
      <div
        style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}
      >
        <div>
          <p style={{ fontSize: 13.5, color: 'var(--marron-tinta)', marginBottom: 12 }}>Este panel es solo para el equipo Cumbo.</p>
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
        <div style={{ fontWeight: 'bold', fontSize: 15, color: 'var(--marron-tinta)', flex: 1 }}>Panel Cumbo</div>
        <img src="/assets/logo-cumbo.png" alt="Cumbo" style={{ height: 22, width: 'auto' }} />
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '14px 16px 6px', maxWidth: 480, margin: '0 auto' }}>
        {[
          { id: 'operacion', label: 'Operación' },
          { id: 'fichas', label: 'Fincas pendientes' },
          { id: 'pedidos', label: 'Pedidos' },
          { id: 'resumen', label: 'Resumen' },
          { id: 'contenido', label: 'Contenido' },
          { id: 'devoluciones', label: 'Devoluciones' },
          { id: 'whatsapp', label: 'WhatsApp' },
          { id: 'estudio', label: 'Cumbo Estudio' },
          { id: 'voz-marca', label: 'Voz de marca' },
          { id: 'conciliacion', label: 'Conciliación de pagos' },
          { id: 'inventario', label: 'Inventario' },
          { id: 'pergamino', label: 'Compras Pergamino' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              border: 'none',
              borderRadius: 9999,
              padding: '9px 6px',
              fontSize: 11.5,
              fontWeight: 'bold',
              cursor: 'pointer',
              background: tab === t.id ? 'var(--accion)' : 'var(--superficie)',
              color: tab === t.id ? '#fff' : 'var(--cafe-oscuro)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '10px 16px' }}>
        {tab === 'operacion' && <TabOperacion irA={setTab} />}
        {tab === 'fichas' && <TabFichas />}
        {tab === 'pedidos' && <TabPedidos />}
        {tab === 'resumen' && <TabResumen />}
        {tab === 'contenido' && <TabContenido />}
        {tab === 'devoluciones' && <TabDevoluciones />}
        {tab === 'whatsapp' && <TabWhatsApp />}
        {tab === 'estudio' && <TabEstudio />}
        {tab === 'voz-marca' && <TabVozMarca />}
        {tab === 'conciliacion' && <TabConciliacion />}
        {tab === 'inventario' && <TabInventario />}
        {tab === 'pergamino' && <TabPergamino fincaPreseleccionada={searchParams.get('finca')} />}
      </div>
    </div>
  );
}

// ================= FINCAS PENDIENTES =================

function TabFichas() {
  const [fincas, setFincas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(null);
  const [error, setError] = useState('');
  const [analisisPorFinca, setAnalisisPorFinca] = useState({});
  const [analizando, setAnalizando] = useState(null);

  useEffect(() => {
    cargar();
  }, []);

  async function analizarFinca(finca) {
    setAnalizando(finca.id);
    const { data, error: errFn } = await supabase.functions.invoke('analizar-finca-validacion', {
      body: { finca_id: finca.id },
    });
    if (!errFn && !data?.error) {
      setAnalisisPorFinca((prev) => ({ ...prev, [finca.id]: data }));
    } else {
      setError(data?.error || 'No se pudo analizar la finca. Intenta de nuevo.');
    }
    setAnalizando(null);
  }

  async function cargar() {
    setCargando(true);
    const { data, error: err } = await supabase
      .from('fincas')
      .select('*, usuarios(nombre_completo, whatsapp)')
      .eq('estado', 'pendiente')
      .order('fecha_creacion', { ascending: false });
    if (err) setError('No se pudieron cargar las fincas pendientes.');
    setFincas(data || []);
    setCargando(false);
  }

  async function decidir(finca, nuevoEstado) {
    setProcesando(finca.id);
    setError('');
    try {
      const { error: errUpd } = await supabase.from('fincas').update({ estado: nuevoEstado }).eq('id', finca.id);
      if (errUpd) throw errUpd;

      await supabase.from('eventos_log').insert({
        entidad: 'finca',
        entidad_id: finca.id,
        accion: nuevoEstado === 'validada' ? 'validada' : 'rechazada',
        datos: { nombre_finca: finca.nombre_finca },
      });

      setFincas((prev) => prev.filter((f) => f.id !== finca.id));

      // Si se valida, además creamos el producto de café en el Marketplace
      // (si no existe todavía uno para esta finca).
      if (nuevoEstado === 'validada') {
        const { data: existente } = await supabase.from('productos').select('id').eq('finca_id', finca.id).maybeSingle();
        if (!existente) {
          await supabase.from('productos').insert({
            tipo: 'cafe_finca',
            finca_id: finca.id,
            vendedor_id: finca.caficultor_id,
            nombre: finca.nombre_finca,
            formato: 'Libra',
            calidad: 'alta',
            precio: finca.precio_kilo_propuesto,
            stock: 50,
          });
        }
      }
    } catch (e) {
      setError('No se pudo procesar la finca. Intenta de nuevo.');
    } finally {
      setProcesando(null);
    }
  }

  if (cargando) return <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 20 }}>Cargando…</p>;

  return (
    <div>
      {error && <div style={mensajeError}>{error}</div>}
      {fincas.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 20 }}>
          No hay fincas pendientes de validación.
        </p>
      ) : (
        fincas.map((f) => (
          <div key={f.id} style={tarjeta}>
            <div style={{ fontWeight: 'bold', fontSize: 14.5, color: 'var(--marron-tinta)' }}>{f.nombre_finca}</div>
            <div style={{ fontSize: 12, color: 'var(--cafe-oscuro)', marginBottom: 6 }}>
              {f.usuarios?.nombre_completo || 'Caficultor'} · {f.usuarios?.whatsapp || 'sin WhatsApp'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--marron-tinta)', marginBottom: 6 }}>
              {f.region} · {f.vereda} · {f.altitud_msnm} msnm · {f.especie} · {f.proceso}
            </div>
            <div style={{ fontSize: 12, color: 'var(--marron-tinta)', marginBottom: 6 }}>
              Precio propuesto: <strong>{formatoCOP(f.precio_kilo_propuesto)}/kg</strong> · Humedad: {f.humedad_grano ?? 'N/D'}% · Malla:{' '}
              {f.malla_grano || 'N/D'}
            </div>
            {f.notas_sabor && (
              <div style={{ fontSize: 12, color: 'var(--marron-tinta)', marginBottom: 8, fontStyle: 'italic' }}>“{f.notas_sabor}”</div>
            )}

            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {f.certificacion_foto_cultivo && (
                <a href={f.certificacion_foto_cultivo} target="_blank" rel="noreferrer" style={enlaceArchivo}>
                  <ImageIcon size={12} /> Foto cultivo
                </a>
              )}
              {f.certificacion_foto_grano && (
                <a href={f.certificacion_foto_grano} target="_blank" rel="noreferrer" style={enlaceArchivo}>
                  <ImageIcon size={12} /> Foto grano
                </a>
              )}
              {f.certificacion_video && (
                <a href={f.certificacion_video} target="_blank" rel="noreferrer" style={enlaceArchivo}>
                  <Video size={12} /> Video
                </a>
              )}
            </div>

            {(f.certificacion_foto_cultivo || f.certificacion_foto_grano) && (
              <div style={{ marginBottom: 10 }}>
                {!analisisPorFinca[f.id] ? (
                  <button
                    onClick={() => analizarFinca(f)}
                    disabled={analizando === f.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      background: 'none',
                      border: 'none',
                      color: 'var(--accion)',
                      fontSize: 11.5,
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    <Sparkles size={13} /> {analizando === f.id ? 'Analizando finca…' : 'Analizar con IA antes de decidir'}
                  </button>
                ) : (
                  <div
                    style={{
                      background: 'var(--accion-suave)',
                      borderRadius: 10,
                      padding: '8px 10px',
                      fontSize: 11.5,
                      color: 'var(--marron-tinta)',
                    }}
                  >
                    <div
                      style={{
                        display: 'inline-flex',
                        fontWeight: 'bold',
                        color: '#fff',
                        background:
                          analisisPorFinca[f.id].riesgo === 'alto'
                            ? 'var(--canela-oscuro)'
                            : analisisPorFinca[f.id].riesgo === 'medio'
                              ? '#b8860b'
                              : 'var(--exito)',
                        borderRadius: 999,
                        padding: '2px 10px',
                        fontSize: 10,
                        marginBottom: 5,
                      }}
                    >
                      Riesgo {analisisPorFinca[f.id].riesgo}
                    </div>
                    {analisisPorFinca[f.id].hallazgos?.length > 0 && (
                      <ul style={{ margin: '4px 0', paddingLeft: 16 }}>
                        {analisisPorFinca[f.id].hallazgos.map((h, i) => (
                          <li key={i}>{h}</li>
                        ))}
                      </ul>
                    )}
                    <div style={{ fontWeight: 'bold', marginTop: 4 }}>{analisisPorFinca[f.id].recomendacion}</div>
                    <div style={{ fontSize: 10, color: 'var(--cafe-oscuro)', marginTop: 4 }}>
                      Esto es una lectura de apoyo, no reemplaza la verificación real — la decisión de validar o rechazar es siempre tuya.
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => decidir(f, 'validada')}
                disabled={procesando === f.id}
                style={{ ...botonAccion, background: 'var(--exito)' }}
              >
                <CheckCircle size={14} /> Validar
              </button>
              <button
                onClick={() => decidir(f, 'rechazada')}
                disabled={procesando === f.id}
                style={{ ...botonAccion, background: 'var(--canela-oscuro)' }}
              >
                <XCircle size={14} /> Rechazar
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ================= PEDIDOS =================

function TabPedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    const { data, error: err } = await supabase
      .from('pedidos')
      .select('*, usuarios(nombre_completo), pedido_items(cantidad, precio, productos(nombre))')
      .order('fecha', { ascending: false });
    if (err) setError('No se pudieron cargar los pedidos.');
    setPedidos(data || []);
    setCargando(false);
  }

  async function avanzarEstado(pedido) {
    const siguiente = SIGUIENTE_ESTADO[pedido.estado];
    if (!siguiente) return;
    setProcesando(pedido.id);
    try {
      const { error: errUpd } = await supabase.from('pedidos').update({ estado: siguiente }).eq('id', pedido.id);
      if (errUpd) throw errUpd;
      await supabase.from('eventos_log').insert({
        entidad: 'pedido',
        entidad_id: pedido.id,
        accion: 'cambio_estado',
        datos: { de: pedido.estado, a: siguiente },
      });
      setPedidos((prev) => prev.map((p) => (p.id === pedido.id ? { ...p, estado: siguiente } : p)));
    } catch (e) {
      setError('No se pudo actualizar el pedido.');
    } finally {
      setProcesando(null);
    }
  }

  if (cargando) return <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 20 }}>Cargando…</p>;

  return (
    <div>
      {error && <div style={mensajeError}>{error}</div>}
      {pedidos.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 20 }}>Todavía no hay pedidos.</p>
      ) : (
        pedidos.map((p) => (
          <div key={p.id} style={tarjeta}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontWeight: 'bold', fontSize: 13.5, color: 'var(--marron-tinta)' }}>#{p.id.slice(0, 8)}</div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 'bold',
                  color: '#fff',
                  background: colorEstado(p.estado),
                  borderRadius: 9999,
                  padding: '3px 10px',
                }}
              >
                {ETIQUETA_ESTADO[p.estado] || p.estado}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--cafe-oscuro)', marginBottom: 6 }}>
              {p.usuarios?.nombre_completo || 'Cliente'} · {new Date(p.fecha).toLocaleDateString('es-CO')}
            </div>
            {p.pedido_items?.map((it, i) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--marron-tinta)' }}>
                {it.cantidad}x {it.productos?.nombre} — {formatoCOP(it.precio * it.cantidad)}
              </div>
            ))}
            <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--marron-tinta)', marginTop: 6 }}>Total: {formatoCOP(p.total)}</div>

            {SIGUIENTE_ESTADO[p.estado] && (
              <button
                onClick={() => avanzarEstado(p)}
                disabled={procesando === p.id}
                style={{ ...botonAccion, background: 'var(--accion)', marginTop: 10, width: '100%' }}
              >
                Marcar como {ETIQUETA_ESTADO[SIGUIENTE_ESTADO[p.estado]]}
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function colorEstado(estado) {
  if (estado === 'entregado' || estado === 'confirmado') return 'var(--exito)';
  if (estado === 'devolucion') return 'var(--canela-oscuro)';
  return 'var(--tierra-kraft)';
}

// ================= RESUMEN (KPIs reales) =================

function TabResumen() {
  const [kpis, setKpis] = useState(null);
  const [serieSemanal, setSerieSemanal] = useState([]);
  const [actividadReciente, setActividadReciente] = useState([]);

  useEffect(() => {
    cargarKpis();
  }, []);

  async function cargarKpis() {
    const [{ count: fincasPendientes }, { count: fincasValidadas }, { data: pedidos }, { data: eventos }] = await Promise.all([
      supabase.from('fincas').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente'),
      supabase.from('fincas').select('*', { count: 'exact', head: true }).eq('estado', 'validada'),
      supabase.from('pedidos').select('total, estado, fecha'),
      supabase.from('eventos_log').select('*').order('fecha', { ascending: false }).limit(6),
    ]);

    const listaPedidos = pedidos || [];
    const totalPedidos = listaPedidos.length;
    const ingresosConfirmados = listaPedidos
      .filter((p) => ['confirmado', 'despachado', 'entregado'].includes(p.estado))
      .reduce((acc, p) => acc + Number(p.total), 0);
    const pedidosEnRevision = listaPedidos.filter((p) => p.estado === 'en_revision').length;

    // Comparación real contra la semana anterior — no un número inventado.
    const hoy = Date.now();
    const hace7dias = hoy - 7 * 86400000;
    const hace14dias = hoy - 14 * 86400000;
    const pedidosEstaSemana = listaPedidos.filter((p) => new Date(p.fecha).getTime() >= hace7dias).length;
    const pedidosSemanaAnterior = listaPedidos.filter((p) => {
      const t = new Date(p.fecha).getTime();
      return t >= hace14dias && t < hace7dias;
    }).length;
    const tendenciaPedidos =
      pedidosSemanaAnterior === 0 ? null : Math.round(((pedidosEstaSemana - pedidosSemanaAnterior) / pedidosSemanaAnterior) * 100);

    // Serie de las últimas 6 semanas, para el gráfico de barras.
    const semanas = Array.from({ length: 6 }, (_, i) => {
      const desde = hoy - (6 - i) * 7 * 86400000;
      const hasta = hoy - (5 - i) * 7 * 86400000;
      const cantidad = listaPedidos.filter((p) => {
        const t = new Date(p.fecha).getTime();
        return t >= desde && t < hasta;
      }).length;
      return { semana: i + 1, cantidad };
    });

    setKpis({
      fincasPendientes: fincasPendientes || 0,
      fincasValidadas: fincasValidadas || 0,
      totalPedidos,
      ingresosConfirmados,
      pedidosEnRevision,
      tendenciaPedidos,
    });
    setSerieSemanal(semanas);
    setActividadReciente(eventos || []);
  }

  if (!kpis) return <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 20 }}>Cargando…</p>;

  const maxSemana = Math.max(1, ...serieSemanal.map((s) => s.cantidad));

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <Kpi label="Ingresos confirmados" valor={formatoCOP(kpis.ingresosConfirmados)} Icono={DollarSign} color="var(--exito)" />
        <Kpi label="Pedidos totales" valor={kpis.totalPedidos} Icono={ShoppingBag} tendencia={kpis.tendenciaPedidos} />
        <Kpi label="Fincas validadas" valor={kpis.fincasValidadas} Icono={CheckCircle} color="var(--exito)" />
        <Kpi
          label="Por revisar"
          valor={kpis.fincasPendientes + kpis.pedidosEnRevision}
          Icono={AlertTriangle}
          color={kpis.fincasPendientes + kpis.pedidosEnRevision > 0 ? 'var(--alerta)' : 'var(--cafe-oscuro)'}
        />
      </div>

      <div style={tarjeta}>
        <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--marron-tinta)', marginBottom: 12 }}>Pedidos por semana</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 90 }}>
          {serieSemanal.map((s) => (
            <div key={s.semana} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div
                style={{
                  width: '100%',
                  height: `${Math.max(6, (s.cantidad / maxSemana) * 70)}px`,
                  background: 'var(--accion)',
                  borderRadius: 4,
                }}
              />
              <span style={{ fontSize: 9.5, color: 'var(--cafe-oscuro)' }}>{s.cantidad}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: 'var(--cafe-oscuro)', textAlign: 'center', marginTop: 6 }}>Últimas 6 semanas</div>
      </div>

      <div style={tarjeta}>
        <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--marron-tinta)', marginBottom: 10 }}>Actividad reciente</div>
        {actividadReciente.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--cafe-oscuro)' }}>Sin actividad registrada todavía.</p>
        ) : (
          actividadReciente.map((ev) => (
            <div
              key={ev.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '7px 0',
                borderBottom: '1px solid var(--fondo-calido)',
                fontSize: 11.5,
              }}
            >
              <span style={{ color: 'var(--marron-tinta)' }}>{etiquetaEvento(ev)}</span>
              <span style={{ color: 'var(--cafe-oscuro)', flexShrink: 0, marginLeft: 8 }}>{haceTiempoCorto(ev.fecha)}</span>
            </div>
          ))
        )}
      </div>

      <div style={{ fontSize: 11, color: 'var(--cafe-oscuro)', textAlign: 'center', marginTop: 6 }}>
        El modelador financiero completo (competencia, estacionalidad, ranking de marcas socias, facturación DIAN) todavía no está migrado —
        queda para una fase aparte.
      </div>
    </div>
  );
}

function etiquetaEvento(ev) {
  const mapa = {
    creado: 'Pedido nuevo creado',
    validada: 'Finca validada',
    rechazada: 'Finca rechazada',
    cambio_estado: `Pedido → ${ev.datos?.a || ''}`,
    pago_aprobado: 'Pago aprobado',
    pago_rechazado: 'Pago rechazado',
    publicado: `Producto publicado: ${ev.datos?.nombre || ''}`,
    editado: 'Contenido del Home editado',
    cuenta_eliminada: 'Una cuenta se eliminó',
  };
  return mapa[ev.accion] || ev.accion;
}

function haceTiempoCorto(fechaIso) {
  const diffMs = Date.now() - new Date(fechaIso).getTime();
  const horas = Math.floor(diffMs / 3600000);
  if (horas < 1) return 'hace instantes';
  if (horas < 24) return `hace ${horas}h`;
  return `hace ${Math.floor(horas / 24)}d`;
}

function Kpi({ label, valor, Icono, tendencia, color }) {
  return (
    <div style={{ background: 'var(--superficie)', borderRadius: 16, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        {Icono && <Icono size={17} color={color || 'var(--accion)'} />}
        {tendencia !== null && tendencia !== undefined && (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              fontSize: 10.5,
              fontWeight: 'bold',
              color: tendencia >= 0 ? 'var(--exito)' : 'var(--canela-oscuro)',
            }}
          >
            {tendencia >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(tendencia)}%
          </span>
        )}
      </div>
      <div style={{ fontSize: 18, fontWeight: 'bold', color: 'var(--marron-tinta)' }}>{valor}</div>
      <div style={{ fontSize: 10.5, color: 'var(--cafe-oscuro)' }}>{label}</div>
    </div>
  );
}

// ================= CONTENIDO (texto y audiovisual editable) =================
// Antes, el FAQ y los videos del Home estaban escritos directo en
// Ecosistema.jsx — cualquier cambio de texto necesitaba a un
// programador. Acá el CEO edita ese contenido de verdad, se guarda en
// la tabla `contenido_app`, y Ecosistema lo lee de ahí.

function TabContenido() {
  const { sesion } = useSesion();
  const [faq, setFaq] = useState([]);
  const [videos, setVideos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    const { data } = await supabase.from('contenido_app').select('clave, valor').in('clave', ['home_faq', 'home_videos']);
    setFaq(data?.find((d) => d.clave === 'home_faq')?.valor || []);
    setVideos(data?.find((d) => d.clave === 'home_videos')?.valor || []);
    setCargando(false);
  }

  function actualizarFaq(i, campo, valor) {
    setFaq((prev) => prev.map((f, idx) => (idx === i ? { ...f, [campo]: valor } : f)));
  }

  function agregarFaq() {
    setFaq((prev) => [...prev, { pregunta: '' }]);
  }

  function eliminarFaq(i) {
    setFaq((prev) => prev.filter((_, idx) => idx !== i));
  }

  function actualizarVideo(i, valor) {
    setVideos((prev) => prev.map((v, idx) => (idx === i ? valor : v)));
  }

  function agregarVideo() {
    setVideos((prev) => [...prev, '']);
  }

  function eliminarVideo(i) {
    setVideos((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function guardar() {
    setGuardando(true);
    setMensaje('');
    try {
      const faqLimpio = faq.filter((f) => f.pregunta.trim());
      const videosLimpios = videos.filter((v) => v.trim());

      await supabase.from('contenido_app').upsert({
        clave: 'home_faq',
        tipo: 'faq',
        valor: faqLimpio,
        actualizado_por: sesion.user.id,
        actualizado_en: new Date().toISOString(),
      });
      await supabase.from('contenido_app').upsert({
        clave: 'home_videos',
        tipo: 'videos',
        valor: videosLimpios,
        actualizado_por: sesion.user.id,
        actualizado_en: new Date().toISOString(),
      });

      await supabase.from('eventos_log').insert({
        entidad: 'contenido_app',
        entidad_id: null,
        accion: 'editado',
        datos: { secciones: ['home_faq', 'home_videos'] },
        usuario_id: sesion.user.id,
      });

      setMensaje('Guardado — ya se ve así en el Home de la app.');
    } catch (e) {
      setMensaje('No se pudo guardar. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 20 }}>Cargando…</p>;

  return (
    <div>
      <div style={tarjeta}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--marron-tinta)' }}>Videos del Home</div>
          <button
            onClick={agregarVideo}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              color: 'var(--accion)',
              fontSize: 12,
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            <Plus size={14} /> Agregar
          </button>
        </div>
        {videos.length === 0 && <p style={{ fontSize: 12, color: 'var(--cafe-oscuro)' }}>Sin videos — la app usará los de respaldo.</p>}
        {videos.map((v, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input
              value={v}
              onChange={(e) => actualizarVideo(i, e.target.value)}
              placeholder="/videos/archivo.mp4 o URL completa"
              style={inputEditor}
            />
            <button onClick={() => eliminarVideo(i)} style={botonEliminar}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <p style={{ fontSize: 10.5, color: 'var(--cafe-oscuro)', marginTop: 4 }}>
          Poné la ruta del archivo (si ya lo subiste al proyecto) o una URL completa de un video alojado en Supabase Storage.
        </p>
      </div>

      <div style={tarjeta}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--marron-tinta)' }}>Preguntas rápidas del chat de WhatsApp</div>
          <button
            onClick={agregarFaq}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              color: 'var(--accion)',
              fontSize: 12,
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            <Plus size={14} /> Agregar
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--cafe-oscuro)', marginBottom: 10 }}>
          Estas preguntas aparecen como accesos rápidos en el chat flotante de WhatsApp del Home — al tocarlas, se abre WhatsApp con la
          pregunta ya escrita.
        </p>
        {faq.map((f, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input
              value={f.pregunta}
              onChange={(e) => actualizarFaq(i, 'pregunta', e.target.value)}
              placeholder="Pregunta"
              style={inputEditor}
            />
            <button onClick={() => eliminarFaq(i)} style={botonEliminar}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {mensaje && (
        <div style={{ fontSize: 12.5, color: mensaje.startsWith('Guardado') ? 'var(--exito)' : 'var(--canela-oscuro)', marginBottom: 10 }}>
          {mensaje}
        </div>
      )}

      <button
        onClick={guardar}
        disabled={guardando}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          width: '100%',
          border: 'none',
          borderRadius: 9999,
          padding: 12,
          color: '#fff',
          background: 'var(--accion)',
          fontSize: 13,
          fontWeight: 'bold',
          cursor: 'pointer',
          opacity: guardando ? 0.7 : 1,
        }}
      >
        <Save size={15} /> {guardando ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </div>
  );
}

const inputEditor = {
  flex: 1,
  border: '1px solid rgba(146,97,55,0.25)',
  borderRadius: 10,
  padding: '9px 11px',
  fontSize: 12.5,
  color: 'var(--marron-tinta)',
  background: '#fff',
};

const botonEliminar = {
  border: 'none',
  background: 'var(--fondo-calido)',
  color: 'var(--canela-oscuro)',
  borderRadius: 10,
  width: 34,
  cursor: 'pointer',
};

const tarjeta = { background: 'var(--superficie)', borderRadius: 18, padding: 16, marginBottom: 12 };
const mensajeError = {
  fontSize: 12.5,
  color: 'var(--canela-oscuro)',
  background: '#fdf3e6',
  border: '1px solid var(--tierra-kraft)',
  borderRadius: 10,
  padding: '9px 12px',
  marginBottom: 12,
};
const enlaceArchivo = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 11,
  background: 'var(--fondo-calido)',
  color: 'var(--cafe-oscuro)',
  borderRadius: 9999,
  padding: '5px 10px',
  textDecoration: 'none',
  fontWeight: 'bold',
};
const botonAccion = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 5,
  flex: 1,
  border: 'none',
  borderRadius: 9999,
  padding: '9px 0',
  color: '#fff',
  fontSize: 12.5,
  fontWeight: 'bold',
  cursor: 'pointer',
};

// ================= DEVOLUCIONES =================
// El cliente solicita desde Mis Pedidos (ver MisPedidos.jsx). Acá el
// CEO aprueba o rechaza. Al aprobar, se llama a la Edge Function
// procesar-devolucion, que intenta el reembolso real — automático en
// Mercado Pago, con aviso de gestión manual en Wompi si la transacción
// ya se liquidó (Wompi no tiene API de reembolso post-liquidación).

const ETIQUETA_ESTADO_DEVOLUCION = {
  pendiente: 'Pendiente de revisión',
  aprobada: 'Aprobada — procesando',
  rechazada: 'Rechazada',
  reembolsada: 'Reembolsada',
  reembolso_manual_pendiente: 'Requiere gestión manual',
};

function TabDevoluciones() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState('');
  const [notaRechazo, setNotaRechazo] = useState({});
  const [analisisPorSolicitud, setAnalisisPorSolicitud] = useState({});
  const [analizando, setAnalizando] = useState('');

  useEffect(() => {
    cargar();
  }, []);

  async function analizarSolicitud(id) {
    setAnalizando(id);
    const { data, error: errFn } = await supabase.functions.invoke('analizar-devolucion', { body: { solicitud_id: id } });
    if (!errFn && !data?.error) {
      setAnalisisPorSolicitud((prev) => ({ ...prev, [id]: data }));
    }
    setAnalizando('');
  }

  async function cargar() {
    setCargando(true);
    const { data } = await supabase
      .from('solicitudes_devolucion')
      .select('*, pedidos(id, total, transportadora), usuarios(nombre_completo, correo)')
      .order('fecha_solicitud', { ascending: false });
    setSolicitudes(data || []);
    setCargando(false);
  }

  async function aprobar(solicitud) {
    setProcesando(solicitud.id);
    const { data, error } = await supabase.functions.invoke('procesar-devolucion', { body: { solicitud_id: solicitud.id } });
    if (error) {
      alert('No se pudo procesar la devolución. Intenta de nuevo.');
    } else if (data?.estado === 'reembolso_manual_pendiente') {
      alert(`Atención — requiere que lo gestiones tú manualmente:\n\n${data.nota}`);
    }
    setProcesando('');
    cargar();
  }

  async function rechazar(solicitud) {
    setProcesando(solicitud.id);
    await supabase
      .from('solicitudes_devolucion')
      .update({
        estado: 'rechazada',
        notas_ceo: notaRechazo[solicitud.id] || 'Sin motivo especificado.',
        fecha_resolucion: new Date().toISOString(),
      })
      .eq('id', solicitud.id);
    setProcesando('');
    cargar();
  }

  if (cargando) return <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 20 }}>Cargando…</p>;
  if (solicitudes.length === 0)
    return (
      <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 20 }}>
        No hay solicitudes de devolución todavía.
      </p>
    );

  return (
    <div>
      {solicitudes.map((s) => (
        <div key={s.id} style={tarjeta}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontWeight: 'bold', fontSize: 13.5, color: 'var(--marron-tinta)' }}>Pedido #{s.pedido_id.slice(0, 8)}</div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 'bold',
                color: '#fff',
                borderRadius: 9999,
                padding: '3px 10px',
                background:
                  s.estado === 'reembolsada'
                    ? 'var(--exito)'
                    : s.estado === 'rechazada'
                      ? 'var(--canela-oscuro)'
                      : s.estado === 'reembolso_manual_pendiente'
                        ? '#b8860b'
                        : 'var(--tierra-kraft)',
              }}
            >
              {ETIQUETA_ESTADO_DEVOLUCION[s.estado]}
            </span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--cafe-oscuro)', marginBottom: 6 }}>
            {s.usuarios?.nombre_completo || 'Cliente'} · {s.tipo === 'retracto' ? 'Derecho de retracto' : 'Garantía'} · Total del pedido:{' '}
            {formatoCOP(s.pedidos?.total || 0)}
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: 'var(--marron-tinta)',
              background: 'var(--fondo-calido)',
              borderRadius: 10,
              padding: '8px 10px',
              marginBottom: 8,
            }}
          >
            {s.motivo}
          </div>

          {s.estado === 'pendiente' && (
            <>
              {!analisisPorSolicitud[s.id] ? (
                <button
                  onClick={() => analizarSolicitud(s.id)}
                  disabled={analizando === s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    background: 'none',
                    border: 'none',
                    color: 'var(--accion)',
                    fontSize: 11.5,
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    padding: 0,
                    marginBottom: 10,
                  }}
                >
                  <Sparkles size={13} /> {analizando === s.id ? 'Analizando…' : 'Analizar con IA antes de decidir'}
                </button>
              ) : (
                <div
                  style={{
                    background: 'var(--accion-suave)',
                    borderRadius: 10,
                    padding: '8px 10px',
                    fontSize: 11.5,
                    color: 'var(--marron-tinta)',
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      display: 'inline-flex',
                      fontWeight: 'bold',
                      color: '#fff',
                      background:
                        analisisPorSolicitud[s.id].riesgo === 'alto'
                          ? 'var(--canela-oscuro)'
                          : analisisPorSolicitud[s.id].riesgo === 'medio'
                            ? '#b8860b'
                            : 'var(--exito)',
                      borderRadius: 999,
                      padding: '2px 10px',
                      fontSize: 10,
                      marginBottom: 5,
                    }}
                  >
                    Riesgo {analisisPorSolicitud[s.id].riesgo}
                  </div>
                  {analisisPorSolicitud[s.id].dias_habiles_desde_entrega !== null && (
                    <div style={{ fontSize: 10.5, color: 'var(--cafe-oscuro)' }}>
                      {analisisPorSolicitud[s.id].dias_habiles_desde_entrega} días hábiles desde la entrega
                    </div>
                  )}
                  {analisisPorSolicitud[s.id].hallazgos?.length > 0 && (
                    <ul style={{ margin: '4px 0', paddingLeft: 16 }}>
                      {analisisPorSolicitud[s.id].hallazgos.map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  )}
                  <div style={{ fontWeight: 'bold', marginTop: 4 }}>{analisisPorSolicitud[s.id].recomendacion}</div>
                  <div style={{ fontSize: 10, color: 'var(--cafe-oscuro)', marginTop: 4 }}>
                    Lectura de apoyo — la decisión sigue siendo siempre tuya.
                  </div>
                </div>
              )}

              <textarea
                placeholder="Nota si vas a rechazar (opcional)"
                value={notaRechazo[s.id] || ''}
                onChange={(e) => setNotaRechazo((prev) => ({ ...prev, [s.id]: e.target.value }))}
                style={{
                  width: '100%',
                  border: '1px solid rgba(146,97,55,0.25)',
                  borderRadius: 10,
                  padding: 8,
                  fontSize: 12,
                  marginBottom: 8,
                  minHeight: 44,
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => aprobar(s)} disabled={procesando === s.id} style={{ ...botonAccion, background: 'var(--exito)' }}>
                  <CheckCircle size={14} /> Aprobar y reembolsar
                </button>
                <button
                  onClick={() => rechazar(s)}
                  disabled={procesando === s.id}
                  style={{ ...botonAccion, background: 'var(--canela-oscuro)' }}
                >
                  <XCircle size={14} /> Rechazar
                </button>
              </div>
            </>
          )}

          {s.notas_ceo && s.estado !== 'pendiente' && (
            <div style={{ fontSize: 11, color: 'var(--cafe-oscuro)', marginTop: 4 }}>Nota: {s.notas_ceo}</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ================= WHATSAPP (bandeja de conversaciones derivadas) =================
// La IA responde sola lo que puede responder con datos reales — esto
// es la bandeja de lo que decidió NO responder sola: pedidos de
// hablar con una persona, reembolsos, reclamos, o casos donde no tuvo
// información suficiente. El CEO responde de acá mismo y se manda de
// verdad por WhatsApp.

function TabWhatsApp() {
  const [conversaciones, setConversaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [respuestaPorTelefono, setRespuestaPorTelefono] = useState({});
  const [enviando, setEnviando] = useState('');
  const [errorEnvio, setErrorEnvio] = useState('');
  const [soloDerivadas, setSoloDerivadas] = useState(true);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    const { data } = await supabase.from('whatsapp_conversaciones').select('*').order('actualizado_en', { ascending: false });
    setConversaciones(data || []);
    setCargando(false);
  }

  async function enviarRespuesta(telefono) {
    const mensaje = respuestaPorTelefono[telefono];
    if (!mensaje?.trim()) return;
    setEnviando(telefono);
    setErrorEnvio('');
    const { data, error } = await supabase.functions.invoke('responder-whatsapp-manual', { body: { telefono, mensaje } });
    if (error || data?.error) {
      setErrorEnvio(data?.error || 'No se pudo enviar el mensaje.');
    } else {
      setRespuestaPorTelefono((prev) => ({ ...prev, [telefono]: '' }));
      cargar();
    }
    setEnviando('');
  }

  if (cargando) return <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 20 }}>Cargando…</p>;

  const visibles = soloDerivadas ? conversaciones.filter((c) => c.requiere_humano) : conversaciones;

  return (
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--marron-tinta)', marginBottom: 12 }}>
        <input type="checkbox" checked={soloDerivadas} onChange={(e) => setSoloDerivadas(e.target.checked)} />
        Mostrar solo las que necesitan tu respuesta
      </label>

      {visibles.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 20 }}>
          {soloDerivadas ? 'Nada pendiente — la IA está resolviendo todo sola por ahora.' : 'Sin conversaciones todavía.'}
        </p>
      ) : (
        visibles.map((c) => (
          <div key={c.telefono} style={tarjeta}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 'bold', fontSize: 13, color: 'var(--marron-tinta)' }}>{c.telefono}</div>
              {c.requiere_humano && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 'bold',
                    color: '#fff',
                    borderRadius: 9999,
                    padding: '3px 10px',
                    background: 'var(--alerta)',
                  }}
                >
                  Necesita tu respuesta
                </span>
              )}
            </div>

            <div style={{ maxHeight: 180, overflowY: 'auto', marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(c.historial || []).slice(-8).map((m, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: m.rol === 'usuario' ? 'flex-start' : 'flex-end',
                    maxWidth: '85%',
                    background: m.rol === 'usuario' ? 'var(--fondo-calido)' : 'var(--accion-suave)',
                    borderRadius: 10,
                    padding: '6px 10px',
                    fontSize: 12,
                    color: 'var(--marron-tinta)',
                  }}
                >
                  {m.rol === 'ceo' && <strong>Tú: </strong>}
                  {m.texto}
                </div>
              ))}
            </div>

            {c.requiere_humano && (
              <div>
                <textarea
                  value={respuestaPorTelefono[c.telefono] || ''}
                  onChange={(e) => setRespuestaPorTelefono((prev) => ({ ...prev, [c.telefono]: e.target.value }))}
                  placeholder="Escribe tu respuesta…"
                  style={{
                    width: '100%',
                    border: '1px solid rgba(146,97,55,0.25)',
                    borderRadius: 10,
                    padding: 8,
                    fontSize: 12.5,
                    minHeight: 50,
                    marginBottom: 6,
                  }}
                />
                {errorEnvio && <p style={{ fontSize: 11, color: 'var(--canela-oscuro)', marginBottom: 6 }}>{errorEnvio}</p>}
                <button
                  onClick={() => enviarRespuesta(c.telefono)}
                  disabled={enviando === c.telefono || !respuestaPorTelefono[c.telefono]?.trim()}
                  style={{ ...botonAccion, background: 'var(--accion)', width: '100%' }}
                >
                  {enviando === c.telefono ? 'Enviando…' : 'Enviar por WhatsApp'}
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ================= CUMBO ESTUDIO (asignar planes) =================
// Cobrar la suscripción recurrente automáticamente es una pieza
// aparte, todavía no construida (necesitaría cobros recurrentes con
// Mercado Pago/Wompi). Por ahora, el vendedor paga por fuera y el CEO
// le asigna el plan acá manualmente.

const NOMBRE_PLAN_ESTUDIO = { chispa: 'Chispa', cosecha: 'Cosecha', finca_completa: 'Finca Completa' };
const LIMITE_PLAN_ESTUDIO = { chispa: 3, cosecha: 15, finca_completa: 50 };

function TabEstudio() {
  const [suscripciones, setSuscripciones] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [serieSemanal, setSerieSemanal] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState('');
  const [enVivo, setEnVivo] = useState(false);

  useEffect(() => {
    cargar();

    // Tiempo real: el dashboard del CEO se actualiza solo apenas
    // cualquier vendedor genera contenido o cambia su plan — sin
    // recargar la página.
    const canal = supabase
      .channel('cumbo-estudio-ceo')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contenido_marketing' }, () => {
        cargar();
        setEnVivo(true);
        setTimeout(() => setEnVivo(false), 2000);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suscripciones_estudio' }, () => cargar())
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  async function cargar() {
    setCargando(true);
    const [{ data: sus }, { data: contenidos }] = await Promise.all([
      supabase.from('suscripciones_estudio').select('*, usuarios(nombre_completo, correo)').order('actualizado_en', { ascending: false }),
      supabase.from('contenido_marketing').select('piezas, fecha_creacion'),
    ]);
    setSuscripciones(sus || []);

    const listaContenidos = contenidos || [];
    const periodoActual = new Date().toISOString().slice(0, 7);
    const generacionesEsteMes = listaContenidos.filter((c) => c.fecha_creacion.slice(0, 7) === periodoActual).length;
    const piezasTotales = listaContenidos.reduce((acc, c) => acc + (c.piezas?.length || 0), 0);
    const vendedoresActivos = (sus || []).filter((s) => s.usos_este_mes > 0).length;

    const conteoPlanes = {};
    (sus || []).forEach((s) => {
      conteoPlanes[s.plan] = (conteoPlanes[s.plan] || 0) + 1;
    });
    const planMasPopular = Object.entries(conteoPlanes).sort((a, b) => b[1] - a[1])[0]?.[0];

    // Tendencia real: generaciones de esta semana vs. la anterior.
    const hoy = Date.now();
    const hace7dias = hoy - 7 * 86400000;
    const hace14dias = hoy - 14 * 86400000;
    const estaSemana = listaContenidos.filter((c) => new Date(c.fecha_creacion).getTime() >= hace7dias).length;
    const semanaAnterior = listaContenidos.filter((c) => {
      const t = new Date(c.fecha_creacion).getTime();
      return t >= hace14dias && t < hace7dias;
    }).length;
    const tendencia = semanaAnterior === 0 ? null : Math.round(((estaSemana - semanaAnterior) / semanaAnterior) * 100);

    const semanas = Array.from({ length: 6 }, (_, i) => {
      const desde = hoy - (6 - i) * 7 * 86400000;
      const hasta = hoy - (5 - i) * 7 * 86400000;
      const cantidad = listaContenidos.filter((c) => {
        const t = new Date(c.fecha_creacion).getTime();
        return t >= desde && t < hasta;
      }).length;
      return { semana: i + 1, cantidad };
    });

    setKpis({ generacionesEsteMes, piezasTotales, vendedoresActivos, planMasPopular, tendencia });
    setSerieSemanal(semanas);
    setCargando(false);
  }

  async function cambiarPlan(vendedorId, nuevoPlan) {
    setGuardando(vendedorId);
    await supabase.from('suscripciones_estudio').update({ plan: nuevoPlan }).eq('vendedor_id', vendedorId);
    setGuardando('');
    cargar();
  }

  if (cargando || !kpis) return <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 20 }}>Cargando…</p>;

  const maxSemana = Math.max(1, ...serieSemanal.map((s) => s.cantidad));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <Kpi label="Contenidos este mes" valor={kpis.generacionesEsteMes} Icono={Sparkles} tendencia={kpis.tendencia} />
        <Kpi label="Piezas totales generadas" valor={kpis.piezasTotales} Icono={Calendar} />
        <Kpi label="Vendedores activos" valor={kpis.vendedoresActivos} Icono={ShoppingBag} color="var(--exito)" />
        <Kpi label="Plan más popular" valor={NOMBRE_PLAN_ESTUDIO[kpis.planMasPopular] || 'N/D'} Icono={TrendingUp} />
      </div>

      <div style={tarjeta}>
        <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--marron-tinta)', marginBottom: 12 }}>
          Contenidos generados por semana
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 90 }}>
          {serieSemanal.map((s) => (
            <div key={s.semana} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div
                style={{
                  width: '100%',
                  height: `${Math.max(6, (s.cantidad / maxSemana) * 70)}px`,
                  background: 'var(--accion)',
                  borderRadius: 4,
                }}
              />
              <span style={{ fontSize: 9.5, color: 'var(--cafe-oscuro)' }}>{s.cantidad}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: 'var(--cafe-oscuro)', textAlign: 'center', marginTop: 6 }}>Últimas 6 semanas</div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--marron-tinta)', margin: '4px 0 10px' }}>Planes por vendedor</div>
      <p style={{ fontSize: 11.5, color: 'var(--cafe-oscuro)', marginBottom: 12 }}>
        Esto asigna el plan manualmente — el cobro recurrente automático todavía no está construido. El vendedor paga por fuera y vos le
        asignás el plan acá.
      </p>
      {suscripciones.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 20 }}>Nadie usó Cumbo Estudio todavía.</p>
      ) : (
        suscripciones.map((s) => (
          <div key={s.vendedor_id} style={tarjeta}>
            <div style={{ fontWeight: 'bold', fontSize: 13, color: 'var(--marron-tinta)' }}>
              {s.usuarios?.nombre_completo || 'Vendedor'}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--cafe-oscuro)', marginBottom: 10 }}>
              {s.usuarios?.correo} · {s.usos_este_mes}/{LIMITE_PLAN_ESTUDIO[s.plan]} usados este mes
            </div>
            <select
              value={s.plan}
              onChange={(e) => cambiarPlan(s.vendedor_id, e.target.value)}
              disabled={guardando === s.vendedor_id}
              style={{ border: '1px solid rgba(146,97,55,0.25)', borderRadius: 10, padding: '8px 10px', fontSize: 12.5, width: '100%' }}
            >
              {Object.entries(NOMBRE_PLAN_ESTUDIO).map(([valor, nombre]) => (
                <option key={valor} value={valor}>
                  {nombre} ({LIMITE_PLAN_ESTUDIO[valor]}/mes)
                </option>
              ))}
            </select>
          </div>
        ))
      )}
    </div>
  );
}

// ================= VOZ DE MARCA (Motor de Voz — Fase 1 del documento) =================
// Fuente de verdad de tono, tal como la pide el documento de
// arquitectura: fragmentos reales de la Constitución del Ecosistema,
// la Gobernanza de Conocimiento de Café, o conversaciones del
// Sommelier que salieron especialmente bien — no prompts sueltos.
// Cada función de IA de Cumbo Estudio lee estos ejemplos activos
// antes de generar contenido.

const CATEGORIA_VOZ = {
  constitucion: 'Constitución del Ecosistema',
  gobernanza: 'Gobernanza de Conocimiento de Café',
  sommelier_destacado: 'Conversación destacada del Sommelier',
  ficha_producto: 'Ficha de producto',
  otro: 'Otro',
};

function TabVozMarca() {
  const [ejemplos, setEjemplos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [categoria, setCategoria] = useState('constitucion');
  const [contenido, setContenido] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    const { data } = await supabase.from('voz_de_marca').select('*').order('creado_en', { ascending: false });
    setEjemplos(data || []);
    setCargando(false);
  }

  async function agregar() {
    if (!contenido.trim()) return;
    setGuardando(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from('voz_de_marca').insert({ categoria, contenido: contenido.trim(), creado_por: user?.id });
    setContenido('');
    setGuardando(false);
    cargar();
  }

  async function alternarActivo(ejemplo) {
    await supabase.from('voz_de_marca').update({ activo: !ejemplo.activo }).eq('id', ejemplo.id);
    cargar();
  }

  return (
    <div>
      <p style={{ fontSize: 11.5, color: 'var(--cafe-oscuro)', marginBottom: 12 }}>
        Esto es lo que la IA lee para sonar a Cumbo y no a marketing genérico de café — pegá acá fragmentos reales de tus documentos
        maestros o conversaciones del Sommelier que hayan salido especialmente bien.
      </p>

      <div style={tarjeta}>
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          style={{
            width: '100%',
            border: '1px solid rgba(146,97,55,0.25)',
            borderRadius: 10,
            padding: '8px 10px',
            fontSize: 12.5,
            marginBottom: 8,
          }}
        >
          {Object.entries(CATEGORIA_VOZ).map(([valor, nombre]) => (
            <option key={valor} value={valor}>
              {nombre}
            </option>
          ))}
        </select>
        <textarea
          value={contenido}
          onChange={(e) => setContenido(e.target.value)}
          placeholder="Pegá acá el fragmento real…"
          style={{
            width: '100%',
            border: '1px solid rgba(146,97,55,0.25)',
            borderRadius: 10,
            padding: 8,
            fontSize: 12.5,
            minHeight: 80,
            marginBottom: 8,
          }}
        />
        <button
          onClick={agregar}
          disabled={guardando || !contenido.trim()}
          style={{
            width: '100%',
            border: 'none',
            background: 'var(--accion)',
            color: '#fff',
            borderRadius: 999,
            padding: 10,
            fontSize: 12.5,
            fontWeight: 'bold',
            cursor: 'pointer',
            opacity: guardando || !contenido.trim() ? 0.6 : 1,
          }}
        >
          {guardando ? 'Guardando…' : 'Agregar a la voz de marca'}
        </button>
      </div>

      {cargando ? (
        <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 20 }}>Cargando…</p>
      ) : ejemplos.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 20 }}>
          Todavía no cargaste ningún fragmento — mientras tanto, la IA genera con un tono genérico razonable.
        </p>
      ) : (
        ejemplos.map((e) => (
          <div key={e.id} style={{ ...tarjeta, opacity: e.activo ? 1 : 0.5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 'bold', color: 'var(--accion)', textTransform: 'uppercase' }}>
                {CATEGORIA_VOZ[e.categoria]}
              </span>
              <button
                onClick={() => alternarActivo(e)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: e.activo ? 'var(--canela-oscuro)' : 'var(--exito)',
                  fontSize: 11,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                {e.activo ? 'Desactivar' : 'Activar'}
              </button>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--marron-tinta)' }}>{e.contenido}</div>
          </div>
        ))
      )}
    </div>
  );
}

// ================= CONCILIACIÓN DE PAGOS (agente) =================
// Compara lo que dicen de verdad Mercado Pago/Wompi contra lo que
// dice `pedidos.pago_confirmado` — detecta si un webhook falló en
// silencio en algún momento. Corrige solo (y lo marca 'resuelto')
// cuando la pasarela confirma un pago que localmente no lo estaba —
// eso es terminar un trabajo que el webhook debería haber hecho. Si
// la pasarela dice que algo se rechazó/reembolsó pero localmente
// sigue como pagado, NUNCA lo corrige solo — ese pedido puede ya
// estar despachado, así que queda marcado como 'urgente' para que lo
// resuelvas vos.

const ETIQUETA_SEVERIDAD = { info: 'Informativo', atencion: 'Atención', urgente: 'Urgente' };
const COLOR_SEVERIDAD = { info: 'var(--cafe-oscuro)', atencion: '#b8860b', urgente: 'var(--canela-oscuro)' };

function TabConciliacion() {
  const [discrepancias, setDiscrepancias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [conciliando, setConciliando] = useState(false);
  const [ultimoResultado, setUltimoResultado] = useState(null);
  const [soloUrgentes, setSoloUrgentes] = useState(true);

  useEffect(() => {
    cargar();

    const canal = supabase
      .channel('conciliacion-pagos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'discrepancias_pago' }, () => cargar())
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  async function cargar() {
    setCargando(true);
    const { data } = await supabase
      .from('discrepancias_pago')
      .select('*, pedidos(total, cliente_id)')
      .order('fecha', { ascending: false })
      .limit(50);
    setDiscrepancias(data || []);
    setCargando(false);
  }

  async function conciliarAhora() {
    setConciliando(true);
    setUltimoResultado(null);
    const { data, error } = await supabase.functions.invoke('conciliar-pagos');
    setConciliando(false);
    if (error || data?.error) {
      setUltimoResultado({ error: true, mensaje: data?.error || 'No se pudo conciliar en este momento.' });
    } else {
      setUltimoResultado({ error: false, ...data });
      cargar();
    }
  }

  async function marcarResuelto(id) {
    await supabase.from('discrepancias_pago').update({ resuelto: true }).eq('id', id);
    cargar();
  }

  const visibles = soloUrgentes ? discrepancias.filter((d) => !d.resuelto && d.severidad === 'urgente') : discrepancias;

  return (
    <div>
      <p style={{ fontSize: 11.5, color: 'var(--cafe-oscuro)', marginBottom: 12 }}>
        Compara lo que dicen Mercado Pago y Wompi contra tu base de datos real. Corrige solo cuando la pasarela confirma un pago que acá no
        estaba confirmado — el resto queda marcado para que lo decidas vos, porque puede ya estar despachado.
      </p>

      <button
        onClick={conciliarAhora}
        disabled={conciliando}
        style={{
          width: '100%',
          background: 'var(--accion)',
          color: '#fff',
          border: 'none',
          padding: 12,
          borderRadius: 9999,
          fontSize: 13,
          fontWeight: 'bold',
          cursor: 'pointer',
          opacity: conciliando ? 0.6 : 1,
          marginBottom: 10,
        }}
      >
        {conciliando ? 'Conciliando…' : 'Conciliar ahora'}
      </button>

      {ultimoResultado && (
        <div
          style={{
            fontSize: 12,
            padding: '9px 12px',
            borderRadius: 10,
            marginBottom: 12,
            background: ultimoResultado.error ? '#fdf3e6' : 'var(--accion-suave)',
            color: ultimoResultado.error ? 'var(--canela-oscuro)' : 'var(--marron-tinta)',
          }}
        >
          {ultimoResultado.error
            ? ultimoResultado.mensaje
            : `Revisados ${ultimoResultado.revisados} pedidos — ${ultimoResultado.discrepanciasEncontradas} discrepancias, ${ultimoResultado.corregidosAutomaticamente} corregidas solas.`}
        </div>
      )}

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--marron-tinta)', marginBottom: 12 }}>
        <input type="checkbox" checked={soloUrgentes} onChange={(e) => setSoloUrgentes(e.target.checked)} />
        Mostrar solo urgentes sin resolver
      </label>

      {cargando ? (
        <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 20 }}>Cargando…</p>
      ) : visibles.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 20 }}>
          {soloUrgentes ? 'Nada urgente pendiente.' : 'Sin discrepancias registradas todavía.'}
        </p>
      ) : (
        visibles.map((d) => (
          <div key={d.id} style={tarjeta}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 'bold',
                  color: '#fff',
                  background: COLOR_SEVERIDAD[d.severidad],
                  borderRadius: 999,
                  padding: '3px 10px',
                }}
              >
                {ETIQUETA_SEVERIDAD[d.severidad]}
              </span>
              <span style={{ fontSize: 10.5, color: 'var(--cafe-oscuro)', textTransform: 'uppercase' }}>{d.pasarela}</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--marron-tinta)', marginBottom: 6 }}>{d.detalle}</div>
            <div style={{ fontSize: 11, color: 'var(--cafe-oscuro)', marginBottom: 8 }}>
              Pedido #{d.pedido_id.slice(0, 8)} · Total: {formatoCOP(d.pedidos?.total || 0)}
            </div>
            {!d.resuelto && (
              <button
                onClick={() => marcarResuelto(d.id)}
                style={{
                  background: 'none',
                  border: '1px solid rgba(146,97,55,0.25)',
                  borderRadius: 999,
                  padding: '6px 14px',
                  fontSize: 11.5,
                  fontWeight: 'bold',
                  color: 'var(--marron-tinta)',
                  cursor: 'pointer',
                }}
              >
                Marcar como resuelto
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ================= INVENTARIO (agente de monitoreo) =================
// Cuarto y último agente de la lista priorizada. A diferencia de los
// otros tres, este no toca dinero ni decide sobre confianza — solo
// detecta y avisa. Por eso las alertas se insertan/resuelven solas,
// sin necesitar tu aprobación primero.

const ETIQUETA_TIPO_ALERTA = { stock_bajo: 'Stock bajo', sin_ventas: 'Sin ventas recientes' };

function TabInventario() {
  const [alertas, setAlertas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [monitoreando, setMonitoreando] = useState(false);
  const [ultimoResultado, setUltimoResultado] = useState(null);

  useEffect(() => {
    cargar();

    const canal = supabase
      .channel('inventario-ceo')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alertas_inventario' }, () => cargar())
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  async function cargar() {
    setCargando(true);
    const { data } = await supabase
      .from('alertas_inventario')
      .select('*, productos(nombre, vendedor_id, usuarios(nombre_completo))')
      .eq('resuelta', false)
      .order('fecha', { ascending: false });
    setAlertas(data || []);
    setCargando(false);
  }

  async function monitorearAhora() {
    setMonitoreando(true);
    setUltimoResultado(null);
    const { data, error } = await supabase.functions.invoke('monitorear-inventario');
    setMonitoreando(false);
    if (error || data?.error) {
      setUltimoResultado({ error: true, mensaje: data?.error || 'No se pudo monitorear en este momento.' });
    } else {
      setUltimoResultado({ error: false, ...data });
      cargar();
    }
  }

  return (
    <div>
      <p style={{ fontSize: 11.5, color: 'var(--cafe-oscuro)', marginBottom: 12 }}>
        Detecta stock bajo (5 unidades o menos) y productos activos que no han tenido ventas en 60 días. No toca dinero ni decide nada —
        solo avisa, así que actualiza las alertas directo, sin pedir tu aprobación primero.
      </p>

      <button
        onClick={monitorearAhora}
        disabled={monitoreando}
        style={{
          width: '100%',
          background: 'var(--accion)',
          color: '#fff',
          border: 'none',
          padding: 12,
          borderRadius: 9999,
          fontSize: 13,
          fontWeight: 'bold',
          cursor: 'pointer',
          opacity: monitoreando ? 0.6 : 1,
          marginBottom: 10,
        }}
      >
        {monitoreando ? 'Monitoreando…' : 'Ejecutar monitoreo ahora'}
      </button>

      {ultimoResultado && (
        <div
          style={{
            fontSize: 12,
            padding: '9px 12px',
            borderRadius: 10,
            marginBottom: 12,
            background: ultimoResultado.error ? '#fdf3e6' : 'var(--accion-suave)',
            color: ultimoResultado.error ? 'var(--canela-oscuro)' : 'var(--marron-tinta)',
          }}
        >
          {ultimoResultado.error
            ? ultimoResultado.mensaje
            : `Revisados ${ultimoResultado.productosRevisados} productos — ${ultimoResultado.alertasActivas} alertas activas, ${ultimoResultado.alertasResueltas} resueltas.`}
        </div>
      )}

      {cargando ? (
        <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 20 }}>Cargando…</p>
      ) : alertas.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 20 }}>Sin alertas activas — todo en orden.</p>
      ) : (
        alertas.map((a) => (
          <div key={a.id} style={tarjeta}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 'bold', color: 'var(--accion)', textTransform: 'uppercase' }}>
                {ETIQUETA_TIPO_ALERTA[a.tipo]}
              </span>
              <span style={{ fontSize: 10.5, color: 'var(--cafe-oscuro)' }}>{a.productos?.usuarios?.nombre_completo || 'Vendedor'}</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--marron-tinta)' }}>{a.detalle}</div>
          </div>
        ))
      )}
    </div>
  );
}

// ================= COMPRAS PERGAMINO (registro de compra a caficultores) =================
// Cumbo compra el café en pergamino (sin procesar) a los caficultores
// por bultos — es una compra mayorista, no una venta directa del
// caficultor en el Marketplace. El stock del producto terminado
// (Panel Cumbo → Inventario, o el propio campo `stock` en `productos`)
// lo sigue controlando el CEO manualmente cuando corresponda ajustarlo
// según lo que se procesa de cada compra.

function TabPergamino({ fincaPreseleccionada }) {
  const [fincas, setFincas] = useState([]);
  const [compras, setCompras] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [fincaId, setFincaId] = useState(fincaPreseleccionada || '');
  const [cantidadBultos, setCantidadBultos] = useState('');
  const [pesoPorBulto, setPesoPorBulto] = useState('70');
  const [precioPorKilo, setPrecioPorKilo] = useState('');
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setCargando(true);
    const [{ data: fincasData }, { data: comprasData }] = await Promise.all([
      supabase.from('fincas').select('id, nombre_finca, region').eq('estado', 'validada').order('nombre_finca'),
      supabase.from('compras_pergamino').select('*, fincas(nombre_finca)').order('fecha_compra', { ascending: false }).limit(30),
    ]);
    setFincas(fincasData || []);
    setCompras(comprasData || []);
    setCargando(false);
  }

  async function registrarCompra() {
    if (!fincaId || !cantidadBultos || !precioPorKilo) return;
    setGuardando(true);
    const { data: fincaCompleta } = await supabase.from('fincas').select('caficultor_id').eq('id', fincaId).single();
    await supabase.from('compras_pergamino').insert({
      finca_id: fincaId,
      caficultor_id: fincaCompleta?.caficultor_id || null,
      cantidad_bultos: parseInt(cantidadBultos, 10),
      peso_por_bulto_kg: parseFloat(pesoPorBulto) || 70,
      precio_por_kilo: parseFloat(precioPorKilo),
      notas: notas || null,
    });
    setFincaId('');
    setCantidadBultos('');
    setPrecioPorKilo('');
    setNotas('');
    setGuardando(false);
    cargar();
  }

  async function marcarPagado(id) {
    await supabase.from('compras_pergamino').update({ estado_pago: 'pagado' }).eq('id', id);
    cargar();
  }

  if (cargando) return <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 20 }}>Cargando…</p>;

  return (
    <div>
      <div style={tarjeta}>
        <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--marron-tinta)', marginBottom: 10 }}>
          Registrar compra de pergamino
        </div>
        <select
          value={fincaId}
          onChange={(e) => setFincaId(e.target.value)}
          style={{
            width: '100%',
            border: '1px solid rgba(146,97,55,0.25)',
            borderRadius: 10,
            padding: '8px 10px',
            fontSize: 12.5,
            marginBottom: 8,
          }}
        >
          <option value="">Elegir finca…</option>
          {fincas.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nombre_finca} ({f.region})
            </option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            type="number"
            value={cantidadBultos}
            onChange={(e) => setCantidadBultos(e.target.value)}
            placeholder="Bultos"
            style={{ flex: 1, border: '1px solid rgba(146,97,55,0.25)', borderRadius: 10, padding: '8px 10px', fontSize: 12.5 }}
          />
          <input
            type="number"
            value={pesoPorBulto}
            onChange={(e) => setPesoPorBulto(e.target.value)}
            placeholder="Kg/bulto"
            style={{ flex: 1, border: '1px solid rgba(146,97,55,0.25)', borderRadius: 10, padding: '8px 10px', fontSize: 12.5 }}
          />
          <input
            type="number"
            value={precioPorKilo}
            onChange={(e) => setPrecioPorKilo(e.target.value)}
            placeholder="$/kg"
            style={{ flex: 1, border: '1px solid rgba(146,97,55,0.25)', borderRadius: 10, padding: '8px 10px', fontSize: 12.5 }}
          />
        </div>
        <input
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Notas (opcional)"
          style={{
            width: '100%',
            border: '1px solid rgba(146,97,55,0.25)',
            borderRadius: 10,
            padding: '8px 10px',
            fontSize: 12.5,
            marginBottom: 10,
          }}
        />
        {cantidadBultos && pesoPorBulto && precioPorKilo && (
          <div style={{ fontSize: 12, color: 'var(--cafe-oscuro)', marginBottom: 10 }}>
            Total: <strong>{formatoCOP(cantidadBultos * pesoPorBulto * precioPorKilo)}</strong>
          </div>
        )}
        <button
          onClick={registrarCompra}
          disabled={guardando || !fincaId || !cantidadBultos || !precioPorKilo}
          style={{
            width: '100%',
            background: 'var(--accion)',
            color: '#fff',
            border: 'none',
            padding: 11,
            borderRadius: 9999,
            fontSize: 12.5,
            fontWeight: 'bold',
            cursor: 'pointer',
            opacity: guardando || !fincaId || !cantidadBultos || !precioPorKilo ? 0.6 : 1,
          }}
        >
          {guardando ? 'Guardando…' : 'Registrar compra'}
        </button>
      </div>

      <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--marron-tinta)', margin: '16px 0 10px' }}>Compras recientes</div>
      {compras.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 20 }}>Sin compras registradas todavía.</p>
      ) : (
        compras.map((c) => (
          <div key={c.id} style={tarjeta}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
              <div style={{ fontWeight: 'bold', fontSize: 13, color: 'var(--marron-tinta)' }}>{c.fincas?.nombre_finca}</div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 'bold',
                    color: '#fff',
                    background: c.verificado ? 'var(--verde-cumbre)' : '#b8860b',
                    borderRadius: 999,
                    padding: '3px 9px',
                  }}
                >
                  {c.verificado ? 'Verificado por caficultor' : 'Sin verificar'}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 'bold',
                    color: '#fff',
                    background: c.estado_pago === 'pagado' ? 'var(--exito)' : 'var(--canela-oscuro)',
                    borderRadius: 999,
                    padding: '3px 9px',
                  }}
                >
                  {c.estado_pago === 'pagado' ? 'Pagado' : 'Pendiente'}
                </span>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--cafe-oscuro)', marginBottom: 8 }}>
              {c.cantidad_bultos} bultos × {c.peso_por_bulto_kg}kg · {formatoCOP(c.precio_por_kilo)}/kg · Total:{' '}
              {formatoCOP(c.total_pagado)}
            </div>
            {c.estado_pago !== 'pagado' && (
              <button
                onClick={() => marcarPagado(c.id)}
                style={{
                  background: 'none',
                  border: '1px solid rgba(146,97,55,0.25)',
                  borderRadius: 999,
                  padding: '6px 14px',
                  fontSize: 11.5,
                  fontWeight: 'bold',
                  color: 'var(--marron-tinta)',
                  cursor: 'pointer',
                }}
              >
                Marcar como pagado
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ================= CENTRO DE OPERACIÓN (tablero unificado) =================
// Un solo lugar para ver, de un vistazo y en vivo, qué necesita
// atención en cada área operativa — sin tener que ir pestaña por
// pestaña a buscarlo. Cada tarjeta es real (cuenta filas reales de
// cada tabla, no un número decorativo) y lleva directo a la pestaña
// correspondiente al tocarla.

function TabOperacion({ irA }) {
  const [conteos, setConteos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [enVivo, setEnVivo] = useState(false);

  useEffect(() => {
    cargar();

    const canal = supabase
      .channel('centro-operacion')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fincas' }, () => actualizar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => actualizar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'compras_pergamino' }, () => actualizar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alertas_inventario' }, () => actualizar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'discrepancias_pago' }, () => actualizar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_conversaciones' }, () => actualizar())
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  function actualizar() {
    cargar();
    setEnVivo(true);
    setTimeout(() => setEnVivo(false), 2000);
  }

  async function cargar() {
    const [
      { count: fincasPendientes },
      { count: pedidosPorAtender },
      { count: pergaminoSinVerificar },
      { count: pergaminoSinPagar },
      { count: alertasInventario },
      { count: pagosUrgentes },
      { count: whatsappPendiente },
    ] = await Promise.all([
      supabase.from('fincas').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente'),
      supabase.from('pedidos').select('*', { count: 'exact', head: true }).in('estado', ['pendiente', 'en_revision', 'confirmado']),
      supabase.from('compras_pergamino').select('*', { count: 'exact', head: true }).eq('verificado', false),
      supabase.from('compras_pergamino').select('*', { count: 'exact', head: true }).eq('estado_pago', 'pendiente'),
      supabase.from('alertas_inventario').select('*', { count: 'exact', head: true }).eq('resuelta', false),
      supabase.from('discrepancias_pago').select('*', { count: 'exact', head: true }).eq('severidad', 'urgente').eq('resuelto', false),
      supabase.from('whatsapp_conversaciones').select('*', { count: 'exact', head: true }).eq('requiere_humano', true),
    ]);

    setConteos({
      fincasPendientes: fincasPendientes || 0,
      pedidosPorAtender: pedidosPorAtender || 0,
      pergaminoSinVerificar: pergaminoSinVerificar || 0,
      pergaminoSinPagar: pergaminoSinPagar || 0,
      alertasInventario: alertasInventario || 0,
      pagosUrgentes: pagosUrgentes || 0,
      whatsappPendiente: whatsappPendiente || 0,
    });
    setCargando(false);
  }

  if (cargando || !conteos) return <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 20 }}>Cargando…</p>;

  const tarjetas = [
    { id: 'fichas', label: 'Fincas por validar', valor: conteos.fincasPendientes, Icono: Sprout, color: 'var(--accion)' },
    { id: 'pedidos', label: 'Pedidos por atender', valor: conteos.pedidosPorAtender, Icono: Package, color: 'var(--accion)' },
    { id: 'pergamino', label: 'Pergamino sin verificar', valor: conteos.pergaminoSinVerificar, Icono: Sprout, color: '#b8860b' },
    { id: 'pergamino', label: 'Pergamino sin pagar', valor: conteos.pergaminoSinPagar, Icono: Wallet, color: 'var(--canela-oscuro)' },
    {
      id: 'inventario',
      label: 'Alertas de inventario',
      valor: conteos.alertasInventario,
      Icono: AlertTriangle,
      color: 'var(--canela-oscuro)',
    },
    { id: 'conciliacion', label: 'Pagos urgentes', valor: conteos.pagosUrgentes, Icono: DollarSign, color: 'var(--canela-oscuro)' },
    {
      id: 'whatsapp',
      label: 'WhatsApp esperando respuesta',
      valor: conteos.whatsappPendiente,
      Icono: MessageCircle,
      color: 'var(--canela-oscuro)',
    },
  ];

  const totalPendiente = tarjetas.reduce((acc, t) => acc + t.valor, 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--cafe-oscuro)' }}>
          {totalPendiente === 0 ? 'Todo al día — nada pendiente ahora mismo.' : `${totalPendiente} cosas pendientes en total.`}
        </div>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {tarjetas.map((t, i) => (
          <button
            key={i}
            onClick={() => irA(t.id)}
            style={{
              textAlign: 'left',
              background: 'var(--superficie)',
              border: 'none',
              borderRadius: 16,
              padding: 14,
              cursor: 'pointer',
              borderLeft: t.valor > 0 ? `3px solid ${t.color}` : '3px solid transparent',
            }}
          >
            <t.Icono size={17} color={t.valor > 0 ? t.color : 'var(--cafe-oscuro)'} />
            <div style={{ fontSize: 22, fontWeight: 'bold', color: 'var(--marron-tinta)', marginTop: 8 }}>{t.valor}</div>
            <div style={{ fontSize: 11, color: 'var(--cafe-oscuro)' }}>{t.label}</div>
          </button>
        ))}
      </div>

      <p style={{ fontSize: 10.5, color: 'var(--cafe-oscuro)', textAlign: 'center', marginTop: 16 }}>
        Cada número es real y en vivo — tocá cualquier tarjeta para ir directo a esa sección.
      </p>
    </div>
  );
}
