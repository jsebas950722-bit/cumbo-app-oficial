import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useSesion } from '../context/SesionContext';

// Migrado desde: "CRM Vendedor Cumbo.dc.html"
// Cambios respecto al prototipo:
//  - Los productos se guardan de verdad en Supabase (tabla `productos`,
//    con `vendedor_id` = el usuario logueado) — ya no en localStorage.
//  - El historial de ventas viene de `pedido_items` reales, no de un
//    array de ejemplo.
//  - No hizo falta ningún cambio de esquema: `productos` ya soportaba
//    vendedor_id, subtipo, calidad, caracteristicas desde que migramos
//    Marketplace.
//  - Deliberadamente FUERA de esta pasada (todo necesita una función de
//    backend real con la API de Claude — el prototipo la llamaba
//    directo desde el navegador con `window.claude.complete`, algo que
//    solo existe en el entorno de prototipado, no en producción):
//      · Clasificación automática de calidad por foto (IA de visión)
//      · Generación automática de copy de venta (IA de texto)
//      · El embudo de contenido de Cumbo Estudio (es un módulo aparte)
//      · Comparador/simulador de tarifas de transportadoras (Logística)
//    Mientras tanto, calidad y descripción se completan a mano.

const METODOS = ['V60', 'Chemex', 'Prensa francesa', 'Moka', 'Cafetera', 'Cápsulas', 'Accesorios y repuestos'];
const CALIDADES = [
  { ui: 'Básica', db: 'basica' },
  { ui: 'Media', db: 'media' },
  { ui: 'Alta', db: 'alta' },
];
const COMISION_PCT = 0.08;
const CUOTA_AFILIACION_PCT = 0.03;

function formatoCOP(n) {
  return '$' + Math.round(n || 0).toLocaleString('es-CO');
}

function mapearMetodoATipo(metodo) {
  return metodo === 'Accesorios y repuestos' ? 'accesorio' : 'metodo_preparacion';
}

const FORM_INICIAL = { nombre: '', metodo: 'V60', calidad: 'media', precio: '', stock: '', descripcion: '', peso: '' };

export default function CRMVendedor() {
  const { sesion, perfil, cargando: cargandoSesion } = useSesion();
  const [tab, setTab] = useState('productos'); // 'productos' | 'ventas'
  const [productos, setProductos] = useState([]);
  const [alertasInventario, setAlertasInventario] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [form, setForm] = useState(FORM_INICIAL);
  const [foto, setFoto] = useState(null);
  const [error, setError] = useState('');
  const [publicando, setPublicando] = useState(false);
  const [generandoDescripcion, setGenerandoDescripcion] = useState(false);

  async function generarDescripcionIA() {
    setGenerandoDescripcion(true);
    try {
      const { data, error: errFn } = await supabase.functions.invoke('generar-copy-producto', {
        body: {
          nombre: form.nombre,
          tipo: mapearMetodoATipo(form.metodo),
          subtipo: form.metodo,
          calidad: form.calidad,
          caracteristicas_actuales: form.descripcion,
        },
      });
      if (errFn || data?.error) {
        setError('No se pudo generar la descripción. Intenta de nuevo, o escríbela tú mismo.');
      } else {
        setForm((f) => ({ ...f, descripcion: data.descripcion }));
        setError('');
      }
    } finally {
      setGenerandoDescripcion(false);
    }
  }

  useEffect(() => {
    if (sesion) cargarProductos();
  }, [sesion]);

  useEffect(() => {
    if (sesion && tab === 'ventas') cargarVentas();
  }, [sesion, tab]);

  async function cargarProductos() {
    setCargando(true);
    const { data } = await supabase.from('productos').select('*').eq('vendedor_id', sesion.user.id).order('nombre');
    setProductos(data || []);
    setCargando(false);

    if (data?.length) {
      const { data: alertas } = await supabase
        .from('alertas_inventario')
        .select('*')
        .in(
          'producto_id',
          data.map((p) => p.id)
        )
        .eq('resuelta', false);
      setAlertasInventario(alertas || []);
    }
  }

  async function cargarVentas() {
    const { data } = await supabase
      .from('pedido_items')
      .select('cantidad, precio, productos!inner(nombre, vendedor_id), pedidos(fecha, estado)')
      .eq('productos.vendedor_id', sesion.user.id);
    setVentas(data || []);
  }

  const totalVendidoCOP = useMemo(() => ventas.reduce((acc, v) => acc + v.precio * v.cantidad, 0), [ventas]);
  const comisionCumbo = totalVendidoCOP * COMISION_PCT;

  if (cargandoSesion) return null;
  if (!sesion) return <Navigate to="/ingreso?next=/crm-vendedor" replace />;

  async function publicarProducto() {
    setError('');
    if (!form.nombre || !form.precio || !form.stock) {
      setError('Completa nombre, precio y stock inicial para publicar.');
      return;
    }
    setPublicando(true);
    try {
      let imagenUrl = null;
      if (foto) {
        const ruta = `${sesion.user.id}/${Date.now()}-${foto.name}`;
        const { error: errSubida } = await supabase.storage.from('productos-imagenes').upload(ruta, foto);
        if (errSubida) throw errSubida;
        imagenUrl = supabase.storage.from('productos-imagenes').getPublicUrl(ruta).data.publicUrl;
      }

      const tipo = mapearMetodoATipo(form.metodo);
      const { error: errIns } = await supabase.from('productos').insert({
        tipo,
        vendedor_id: sesion.user.id,
        nombre: form.nombre,
        subtipo: form.metodo === 'Accesorios y repuestos' ? 'Otros' : form.metodo,
        calidad: form.calidad,
        precio: parseInt(form.precio, 10) || 0,
        stock: parseInt(form.stock, 10) || 0,
        caracteristicas: form.descripcion || null,
        peso_kg: form.peso ? parseFloat(form.peso) : null,
        imagen_url: imagenUrl,
      });
      if (errIns) throw errIns;

      await supabase.from('eventos_log').insert({
        entidad: 'producto',
        entidad_id: null,
        accion: 'publicado',
        datos: { nombre: form.nombre, metodo: form.metodo },
        usuario_id: sesion.user.id,
      });

      if (perfil?.rol !== 'vendedor' && perfil?.rol !== 'ceo') {
        await supabase.from('usuarios').update({ rol: 'vendedor' }).eq('id', sesion.user.id);
      }

      setForm(FORM_INICIAL);
      setFoto(null);
      cargarProductos();
    } catch (e) {
      setError('No se pudo publicar el producto. Intenta de nuevo.');
    } finally {
      setPublicando(false);
    }
  }

  async function actualizarStock(id, valor) {
    const stock = parseInt(valor, 10) || 0;
    setProductos((prev) => prev.map((p) => (p.id === id ? { ...p, stock } : p)));
    await supabase.from('productos').update({ stock }).eq('id', id);
  }

  async function alternarActivo(producto) {
    const nuevoValor = !producto.activo;
    // Actualización optimista, pero esta vez SÍ revisamos si falló y
    // revertimos — antes, un error acá se ignoraba por completo.
    setProductos((prev) => prev.map((p) => (p.id === producto.id ? { ...p, activo: nuevoValor } : p)));
    const { error } = await supabase.from('productos').update({ activo: nuevoValor }).eq('id', producto.id);
    if (error) {
      setProductos((prev) => prev.map((p) => (p.id === producto.id ? { ...p, activo: producto.activo } : p)));
      setError('No se pudo actualizar el producto. Intenta de nuevo.');
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fondo-calido)', paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'var(--superficie)' }}>
        <Link to="/" style={{ color: 'var(--marron-tinta)', display: 'flex' }}>
          <ArrowLeft size={20} />
        </Link>
        <div style={{ fontWeight: 'bold', fontSize: 15, color: 'var(--marron-tinta)', flex: 1 }}>CRM Vendedor</div>
        <img src="/assets/logo-cumbo.png" alt="Cumbo" style={{ height: 22, width: 'auto' }} />
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '14px 16px 6px', maxWidth: 460, margin: '0 auto' }}>
        {[
          { id: 'productos', label: 'Mis productos' },
          { id: 'ventas', label: 'Ventas' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              border: 'none',
              borderRadius: 9999,
              padding: '9px 6px',
              fontSize: 12,
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

      <div style={{ maxWidth: 460, margin: '0 auto', padding: '10px 16px' }}>
        {tab === 'productos' && (
          <>
            {/* Formulario para publicar */}
            <div style={{ background: '#fff', borderRadius: 18, padding: 18, marginBottom: 16 }}>
              <div style={{ fontSize: 13.5, fontWeight: 'bold', color: 'var(--marron-tinta)', marginBottom: 10 }}>
                Publicar producto nuevo
              </div>

              <Campo label="Nombre">
                <input
                  style={inputStyle}
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: V60 Hario cerámica"
                />
              </Campo>
              <Campo label="Método / categoría">
                <select style={inputStyle} value={form.metodo} onChange={(e) => setForm((f) => ({ ...f, metodo: e.target.value }))}>
                  {METODOS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Calidad">
                <select style={inputStyle} value={form.calidad} onChange={(e) => setForm((f) => ({ ...f, calidad: e.target.value }))}>
                  {CALIDADES.map((c) => (
                    <option key={c.db} value={c.db}>
                      {c.ui}
                    </option>
                  ))}
                </select>
              </Campo>
              <div style={{ display: 'flex', gap: 10 }}>
                <Campo label="Precio (COP)" flex>
                  <input
                    style={inputStyle}
                    value={form.precio}
                    onChange={(e) => setForm((f) => ({ ...f, precio: e.target.value }))}
                    placeholder="85000"
                  />
                </Campo>
                <Campo label="Stock inicial" flex>
                  <input
                    style={inputStyle}
                    value={form.stock}
                    onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                    placeholder="20"
                  />
                </Campo>
              </div>
              <Campo label="Peso por unidad, en kg (para cotizar el envío)">
                <input
                  style={inputStyle}
                  value={form.peso}
                  onChange={(e) => setForm((f) => ({ ...f, peso: e.target.value }))}
                  placeholder="Ej: 0.5"
                />
              </Campo>
              <Campo label="Foto del producto (opcional)">
                <div
                  style={{
                    border: '1.5px dashed rgba(146,97,55,0.35)',
                    borderRadius: 12,
                    padding: '10px 12px',
                    fontSize: 12,
                    color: foto ? 'var(--marron-tinta)' : 'var(--cafe-oscuro)',
                  }}
                >
                  {foto ? foto.name : 'Sin foto — se muestra un ícono genérico'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFoto(e.target.files?.[0] || null)}
                    style={{ display: 'block', marginTop: 6, fontSize: 11, width: '100%' }}
                  />
                </div>
              </Campo>
              <Campo label="Descripción (opcional)">
                <textarea
                  style={{ ...inputStyle, minHeight: 60 }}
                  value={form.descripcion}
                  onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Características del producto"
                />
                <button
                  type="button"
                  onClick={generarDescripcionIA}
                  disabled={generandoDescripcion || !form.nombre.trim()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 6,
                    background: 'none',
                    border: 'none',
                    color: 'var(--accion)',
                    fontSize: 12,
                    fontWeight: 'bold',
                    cursor: generandoDescripcion || !form.nombre.trim() ? 'default' : 'pointer',
                    opacity: generandoDescripcion || !form.nombre.trim() ? 0.5 : 1,
                    padding: 0,
                  }}
                >
                  <Sparkles size={14} /> {generandoDescripcion ? 'Generando…' : 'Generar con IA'}
                </button>
                {!form.nombre.trim() && (
                  <p style={{ fontSize: 10.5, color: 'var(--cafe-oscuro)', margin: '4px 0 0' }}>Escribe el nombre del producto primero.</p>
                )}
              </Campo>

              {error && <div style={mensajeError}>{error}</div>}

              <button
                onClick={publicarProducto}
                disabled={publicando}
                className="cumbo-btn"
                style={{ ...botonPrimario, opacity: publicando ? 0.7 : 1 }}
              >
                {publicando ? 'Publicando…' : 'Publicar producto'}
              </button>
              <p style={{ fontSize: 10.5, color: 'var(--cafe-oscuro)', textAlign: 'center', marginTop: 8 }}>
                Cumbo cobra {Math.round(COMISION_PCT * 100)}% de comisión por venta. Cuota de afiliación:{' '}
                {Math.round(CUOTA_AFILIACION_PCT * 100)}%.
              </p>
            </div>

            {/* Lista de productos */}
            {alertasInventario.length > 0 && (
              <div
                style={{
                  background: '#fdf3e6',
                  border: '1px solid var(--tierra-kraft)',
                  borderRadius: 12,
                  padding: '10px 12px',
                  marginBottom: 12,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--canela-oscuro)', marginBottom: 4 }}>Avisos de inventario</div>
                {alertasInventario.map((a) => (
                  <div key={a.id} style={{ fontSize: 11.5, color: 'var(--marron-tinta)' }}>
                    • {a.detalle}
                  </div>
                ))}
              </div>
            )}

            {cargando ? (
              <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center' }}>Cargando…</p>
            ) : productos.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 20 }}>
                Todavía no has publicado productos.
              </p>
            ) : (
              productos.map((p) => (
                <div key={p.id} style={tarjeta}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: 13.5, color: 'var(--marron-tinta)' }}>{p.nombre}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--cafe-oscuro)' }}>
                        {p.subtipo} · {etiquetaCalidad(p.calidad)}
                      </div>
                      <div style={{ fontWeight: 'bold', marginTop: 4 }}>{formatoCOP(p.precio)}</div>
                    </div>
                    <button
                      onClick={() => alternarActivo(p)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: p.activo ? 'var(--canela-oscuro)' : 'var(--exito)',
                        fontSize: 12,
                        fontWeight: 'bold',
                        cursor: 'pointer',
                      }}
                    >
                      {p.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                  {!p.activo && (
                    <div style={{ fontSize: 10.5, color: 'var(--cafe-oscuro)', marginTop: 4 }}>
                      Desactivado — no aparece en el Marketplace, pero se conserva en el historial de quien ya lo compró.
                    </div>
                  )}
                  <label
                    style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12, color: 'var(--cafe-oscuro)' }}
                  >
                    Stock:
                    <input
                      type="number"
                      defaultValue={p.stock}
                      onBlur={(e) => actualizarStock(p.id, e.target.value)}
                      style={{ ...inputStyle, width: 70, padding: '6px 8px' }}
                    />
                  </label>
                </div>
              ))
            )}
          </>
        )}

        {tab === 'ventas' && (
          <>
            <div style={{ background: '#fff', borderRadius: 18, padding: 18, marginBottom: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 'bold', color: 'var(--marron-tinta)' }}>{formatoCOP(totalVendidoCOP)}</div>
              <div style={{ fontSize: 11, color: 'var(--cafe-oscuro)' }}>Vendido en total</div>
              <div style={{ fontSize: 11.5, color: 'var(--canela-oscuro)', marginTop: 6 }}>
                Comisión Cumbo estimada: {formatoCOP(comisionCumbo)}
              </div>
            </div>

            {ventas.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 20 }}>
                Todavía no tienes ventas registradas.
              </p>
            ) : (
              ventas.map((v, i) => (
                <div key={i} style={tarjeta}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--marron-tinta)' }}>{v.productos?.nombre}</div>
                    <div style={{ fontSize: 13, fontWeight: 'bold' }}>{formatoCOP(v.precio * v.cantidad)}</div>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--cafe-oscuro)' }}>
                    {v.cantidad} unidad(es) · {v.pedidos?.fecha ? new Date(v.pedidos.fecha).toLocaleDateString('es-CO') : ''} ·{' '}
                    {v.pedidos?.estado}
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}

function etiquetaCalidad(c) {
  if (c === 'basica') return 'Básica';
  if (c === 'media') return 'Media';
  if (c === 'alta') return 'Alta';
  return c || '';
}

function Campo({ label, children, flex }) {
  return (
    <label
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        fontSize: 12,
        fontWeight: 'bold',
        color: 'var(--cafe-oscuro)',
        marginBottom: 12,
        flex: flex ? 1 : undefined,
      }}
    >
      {label}
      {children}
    </label>
  );
}

const inputStyle = {
  border: '1.5px solid rgba(146,97,55,0.25)',
  borderRadius: 12,
  padding: '10px 12px',
  fontSize: 13.5,
  color: 'var(--marron-tinta)',
  background: '#fff',
  width: '100%',
};

const botonPrimario = {
  width: '100%',
  background: 'var(--accion)',
  color: '#fff',
  border: 'none',
  padding: 12,
  borderRadius: 9999,
  fontSize: 13.5,
  fontWeight: 'bold',
  cursor: 'pointer',
  marginTop: 4,
};

const tarjeta = { background: '#fff', borderRadius: 16, padding: 14, marginBottom: 10 };
const mensajeError = {
  fontSize: 12,
  color: 'var(--canela-oscuro)',
  background: '#fdf3e6',
  border: '1px solid var(--tierra-kraft)',
  borderRadius: 10,
  padding: '8px 10px',
  marginBottom: 10,
};
