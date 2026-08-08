import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Image as ImageIcon, Video, Plus, Trash2, Save } from 'lucide-react';
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
  const [tab, setTab] = useState('fichas'); // 'fichas' | 'pedidos' | 'resumen'

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
          { id: 'fichas', label: 'Fincas pendientes' },
          { id: 'pedidos', label: 'Pedidos' },
          { id: 'resumen', label: 'Resumen' },
          { id: 'contenido', label: 'Contenido' },
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
        {tab === 'fichas' && <TabFichas />}
        {tab === 'pedidos' && <TabPedidos />}
        {tab === 'resumen' && <TabResumen />}
        {tab === 'contenido' && <TabContenido />}
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

  useEffect(() => {
    cargar();
  }, []);

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

  useEffect(() => {
    cargarKpis();
  }, []);

  async function cargarKpis() {
    const [{ count: fincasPendientes }, { count: fincasValidadas }, { data: pedidos }] = await Promise.all([
      supabase.from('fincas').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente'),
      supabase.from('fincas').select('*', { count: 'exact', head: true }).eq('estado', 'validada'),
      supabase.from('pedidos').select('total, estado'),
    ]);

    const totalPedidos = pedidos?.length || 0;
    const ingresosConfirmados = (pedidos || [])
      .filter((p) => ['confirmado', 'despachado', 'entregado'].includes(p.estado))
      .reduce((acc, p) => acc + Number(p.total), 0);

    setKpis({ fincasPendientes: fincasPendientes || 0, fincasValidadas: fincasValidadas || 0, totalPedidos, ingresosConfirmados });
  }

  if (!kpis) return <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 20 }}>Cargando…</p>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <Kpi label="Fincas pendientes" valor={kpis.fincasPendientes} />
      <Kpi label="Fincas validadas" valor={kpis.fincasValidadas} />
      <Kpi label="Pedidos totales" valor={kpis.totalPedidos} />
      <Kpi label="Ingresos confirmados" valor={formatoCOP(kpis.ingresosConfirmados)} />
      <div style={{ gridColumn: '1 / -1', fontSize: 11, color: 'var(--cafe-oscuro)', textAlign: 'center', marginTop: 6 }}>
        El modelador financiero completo (competencia, estacionalidad, ranking de marcas socias, facturación DIAN) todavía no está migrado —
        queda para una fase aparte.
      </div>
    </div>
  );
}

function Kpi({ label, valor }) {
  return (
    <div style={{ background: 'var(--superficie)', borderRadius: 16, padding: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 'bold', color: 'var(--marron-tinta)' }}>{valor}</div>
      <div style={{ fontSize: 11, color: 'var(--cafe-oscuro)' }}>{label}</div>
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
