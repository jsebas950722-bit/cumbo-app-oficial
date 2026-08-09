import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Search, Star, Coffee, X, MapPin, CreditCard } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useSesion } from '../context/SesionContext';
import { useCarrito } from '../context/CarritoContext';
import { CIUDAD_BASE, TAMANOS, DEPARTAMENTOS_COLOMBIA, TARIFAS_URBANAS, esCiudadBase, precioConTamano, formatoCOP } from '../lib/tarifas';

// Migrado desde: "Marketplace Cumbo.dc.html"
// Cambios respecto al prototipo:
//  - Los productos (café, métodos, accesorios) vienen de Supabase
//    (tabla productos + fincas), no de un array hardcodeado.
//  - El carrito vive en CarritoContext (memoria de la sesión), no en
//    localStorage — y ya es el mismo carrito que ve el badge en Ecosistema.
//  - "Confirmar pedido" crea filas reales en pedidos/pedido_items y un
//    evento en eventos_log — ya no es un mailto: simulado.
//  - Pendiente para una siguiente pasada: pago real (Wompi/ePayco/PayU,
//    definido en la Constitución Art. 29 — aún no conectado), envío de
//    correo de confirmación (Fase de WhatsApp/correo del roadmap), y la
//    calculadora de molienda por varietal/nota de sabor del prototipo.

const CATEGORIAS = [
  { id: 'finca', label: 'Café de finca' },
  { id: 'metodos', label: 'Métodos de preparación' },
  { id: 'accesorios', label: 'Accesorios' },
];

const METODOS_LISTA = ['V60', 'Chemex', 'Prensa francesa', 'Moka', 'Cafetera', 'Cápsulas'];
const TIPOS_ACCESORIO = ['Todos', 'Pocillos y jarras', 'Molinos', 'Básculas', 'Filtros y empaques', 'Otros'];

// Pago con pasarela online (Art. 29 de la Constitución del Ecosistema).
// Se exploró pago contraentrega y se descartó — el riesgo de
// devoluciones/no-entrega (10-30% según referencias del sector en
// Colombia) no vale la pena frente al cobro garantizado por adelantado.
// Pago real con Mercado Pago (Checkout Pro) — el cliente elige método de
// pago (tarjeta, PSE, Efecty, etc.) dentro del checkout de Mercado Pago,
// no en esta pantalla. Ver supabase/functions/crear-preferencia-pago.

// Cumbo despacha desde Bogotá. Dentro de la ciudad, mensajería urbana
// (Yango/Didi, mismo día); fuera de la ciudad, transportadora nacional.
// Tarifas ESTIMADAS de referencia — todavía no hay cotización en vivo
// conectada a ninguna API real (ver README). La lógica de tarifas y
// precios ya no vive acá — se extrajo a src/lib/tarifas.js para poder
// probarla con pruebas automatizadas reales (ver tarifas.test.js).

export default function Marketplace() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { sesion } = useSesion();
  const carrito = useCarrito();

  const [categoria, setCategoria] = useState('finca');
  const [busqueda, setBusqueda] = useState(searchParams.get('q') || '');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [productosCafe, setProductosCafe] = useState([]);
  const [productosMetodo, setProductosMetodo] = useState([]);
  const [productosAccesorio, setProductosAccesorio] = useState([]);

  const [tamanoPorProducto, setTamanoPorProducto] = useState({});
  const [cantidadPorProducto, setCantidadPorProducto] = useState({});
  const [metodoActivo, setMetodoActivo] = useState('V60');
  const [tipoAccesorioActivo, setTipoAccesorioActivo] = useState('Todos');

  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [calleEntrega, setCalleEntrega] = useState('');
  const [numeroEntrega, setNumeroEntrega] = useState('');
  const [barrioEntrega, setBarrioEntrega] = useState('');
  const [ciudadEntrega, setCiudadEntrega] = useState('');
  const [departamentoEntrega, setDepartamentoEntrega] = useState('');
  const [codigoPostalEntrega, setCodigoPostalEntrega] = useState('');
  const [telefonoContacto, setTelefonoContacto] = useState('');
  const [enviandoPedido, setEnviandoPedido] = useState(false);
  const [pasarelaPago, setPasarelaPago] = useState('mercadopago'); // 'mercadopago' | 'wompi'
  const [opcionesEnvioNacional, setOpcionesEnvioNacional] = useState([]);
  const [cotizandoEnvio, setCotizandoEnvio] = useState(false);
  const [errorCotizacion, setErrorCotizacion] = useState('');

  const enBogota = esCiudadBase(ciudadEntrega);
  // Fuera de Bogotá, las opciones son las que devolvió DrEnvío en vivo
  // (cotizadas contra Interrapidísimo/Coordinadora/Servientrega reales)
  // — ya no son tarifas fijas de referencia. Dentro de Bogotá se sigue
  // usando la mensajería urbana estática (Yango/Didi), que esa API no cubre.
  const opcionesEnvio = enBogota ? TARIFAS_URBANAS : opcionesEnvioNacional;

  const direccionCompleta =
    calleEntrega.trim() &&
    numeroEntrega.trim() &&
    ciudadEntrega.trim() &&
    (enBogota || (departamentoEntrega.trim() && codigoPostalEntrega.trim()));

  // Cotiza en vivo cuando la dirección nacional está completa. Se
  // recalcula si el cliente cambia cualquier dato de la dirección.
  useEffect(() => {
    if (enBogota || !direccionCompleta || carrito.listaItems.length === 0) {
      setOpcionesEnvioNacional([]);
      return;
    }
    let cancelado = false;
    setCotizandoEnvio(true);
    setErrorCotizacion('');
    supabase.functions
      .invoke('cotizar-envio', {
        body: {
          direccion_estructurada: {
            calle: calleEntrega,
            numero: numeroEntrega,
            barrio: barrioEntrega,
            departamento: departamentoEntrega,
            codigo_postal: codigoPostalEntrega,
          },
          ciudad: ciudadEntrega,
          items: carrito.listaItems.map((it) => ({ producto_id: it.producto_id, cantidad: it.cantidad })),
        },
      })
      .then(({ data, error: errFn }) => {
        if (cancelado) return;
        if (errFn || data?.error) {
          setErrorCotizacion('No se pudo cotizar el envío en este momento. Intenta de nuevo en un momento.');
          setOpcionesEnvioNacional([]);
        } else {
          setOpcionesEnvioNacional(data.opciones || []);
        }
        setCotizandoEnvio(false);
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enBogota, direccionCompleta, calleEntrega, numeroEntrega, barrioEntrega, ciudadEntrega, departamentoEntrega, codigoPostalEntrega]);

  // Si el cliente cambia de ciudad (ej: de Bogotá a otra ciudad),
  // la tarifa que había elegido puede dejar de aplicar — se resetea
  // para que no quede seleccionada una opción que ya no corresponde.
  useEffect(() => {
    if (carrito.tarifaEnvio && !opcionesEnvio.some((o) => o.id === carrito.tarifaEnvio.id)) {
      carrito.seleccionarTarifaEnvio(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opcionesEnvio]);

  useEffect(() => {
    cargarProductos();
  }, []);

  async function cargarProductos() {
    setCargando(true);
    setError('');
    const { data, error: errFetch } = await supabase
      .from('productos')
      .select('*, fincas(nombre_finca, region, proceso, especie, altitud_msnm)')
      .eq('activo', true)
      .order('nombre');

    if (errFetch) {
      setError('No se pudo cargar el catálogo. Verifica tu conexión a Supabase.');
      setCargando(false);
      return;
    }

    setProductosCafe(data.filter((p) => p.tipo === 'cafe_finca'));
    setProductosMetodo(data.filter((p) => p.tipo === 'metodo_preparacion'));
    setProductosAccesorio(data.filter((p) => p.tipo === 'accesorio'));
    setCargando(false);
  }

  function agregarCafeAlCarrito(producto) {
    const tamano = tamanoPorProducto[producto.id] || 'Libra';
    const cantidad = cantidadPorProducto[producto.id] || 1;
    const precio = precioConTamano(producto.precio, tamano);
    carrito.agregar({
      key: `${producto.id}|${tamano}`,
      producto_id: producto.id,
      nombre: `${producto.nombre} — ${tamano}`,
      precio,
      cantidad,
    });
  }

  function agregarProductoSimple(producto) {
    const cantidad = cantidadPorProducto[producto.id] || 1;
    carrito.agregar({
      key: `${producto.id}`,
      producto_id: producto.id,
      nombre: producto.marca_externa ? `${producto.nombre} (${producto.marca_externa})` : producto.nombre,
      precio: producto.precio,
      cantidad,
    });
  }

  // Búsqueda real: filtra por nombre — llega prellenada si el cliente
  // buscó desde el Home, o se puede escribir directo acá.
  const textoBusqueda = busqueda.trim().toLowerCase();

  const productosCafeFiltrados = useMemo(
    () => (textoBusqueda ? productosCafe.filter((p) => p.nombre.toLowerCase().includes(textoBusqueda)) : productosCafe),
    [productosCafe, textoBusqueda]
  );

  const metodosAgrupados = useMemo(() => {
    const grupos = {};
    for (const m of METODOS_LISTA) grupos[m] = [];
    const fuente = textoBusqueda
      ? productosMetodo.filter(
          (p) => p.nombre.toLowerCase().includes(textoBusqueda) || (p.marca_externa || '').toLowerCase().includes(textoBusqueda)
        )
      : productosMetodo;
    for (const p of fuente) {
      if (!grupos[p.subtipo]) grupos[p.subtipo] = [];
      grupos[p.subtipo].push(p);
    }
    return grupos;
  }, [productosMetodo, textoBusqueda]);

  const accesoriosFiltrados = useMemo(() => {
    let lista = tipoAccesorioActivo === 'Todos' ? productosAccesorio : productosAccesorio.filter((p) => p.subtipo === tipoAccesorioActivo);
    if (textoBusqueda)
      lista = lista.filter(
        (p) => p.nombre.toLowerCase().includes(textoBusqueda) || (p.marca_externa || '').toLowerCase().includes(textoBusqueda)
      );
    return lista;
  }, [productosAccesorio, tipoAccesorioActivo, textoBusqueda]);

  async function confirmarPedido() {
    if (!sesion) {
      navigate('/ingreso');
      return;
    }
    if (carrito.listaItems.length === 0) return;
    if (!direccionCompleta || !telefonoContacto.trim()) {
      setError('Completa la dirección de entrega y el teléfono para poder despachar tu pedido.');
      return;
    }
    if (!carrito.tarifaEnvio) {
      setError('Elige una tarifa de envío para continuar.');
      return;
    }

    setEnviandoPedido(true);
    try {
      const direccionMostrada = `${calleEntrega.trim()} ${numeroEntrega.trim()}${barrioEntrega.trim() ? `, ${barrioEntrega.trim()}` : ''}`;
      const { data: pedido, error: errPedido } = await supabase
        .from('pedidos')
        .insert({
          cliente_id: sesion.user.id,
          subtotal: carrito.subtotal,
          costo_envio: carrito.costoEnvio,
          total: carrito.total,
          estado: carrito.requiereRevision ? 'en_revision' : 'pendiente',
          direccion_entrega: direccionMostrada,
          ciudad_entrega: ciudadEntrega.trim(),
          telefono_contacto: telefonoContacto.trim(),
          transportadora: carrito.tarifaEnvio.transportadora,
          direccion_estructurada: enBogota
            ? null
            : {
                calle: calleEntrega.trim(),
                numero: numeroEntrega.trim(),
                barrio: barrioEntrega.trim(),
                departamento: departamentoEntrega,
                codigo_postal: codigoPostalEntrega.trim(),
              },
          // Guardamos la cotización real de DrEnvío elegida (si aplica)
          // para poder generar la guía real después sin volver a cotizar.
          cotizacion_envio: carrito.tarifaEnvio._drenvio || null,
        })
        .select()
        .single();
      if (errPedido) throw errPedido;

      const filasItems = carrito.listaItems.map((it) => ({
        pedido_id: pedido.id,
        producto_id: it.producto_id,
        cantidad: it.cantidad,
        precio: it.precio,
      }));
      const { error: errItems } = await supabase.from('pedido_items').insert(filasItems);
      if (errItems) throw errItems;

      await supabase.from('eventos_log').insert({
        entidad: 'pedido',
        entidad_id: pedido.id,
        accion: 'creado',
        datos: { total: carrito.total, transportadora: carrito.tarifaEnvio.transportadora, requiere_revision: carrito.requiereRevision },
        usuario_id: sesion.user.id,
      });

      // Pago real: el cliente elige pasarela (Mercado Pago o Wompi —
      // Wompi ya incluye PSE, Efecty, Nequi y tarjetas). Le pedimos a la
      // Edge Function correspondiente que cree el link de pago y
      // redirigimos ahí. La confirmación real llega después por webhook
      // (ver supabase/functions/webhook-mercadopago y webhook-wompi) —
      // esta pantalla ya no finge que el pedido quedó pagado, solo lo
      // crea y te lleva a pagarlo de verdad.
      const nombreFuncion = pasarelaPago === 'wompi' ? 'crear-pago-wompi' : 'crear-preferencia-pago';
      const { data: pago, error: errPago } = await supabase.functions.invoke(nombreFuncion, {
        body: { pedido_id: pedido.id },
      });
      if (errPago || !pago?.init_point) throw errPago || new Error('Sin init_point');

      carrito.vaciar();
      window.location.href = pago.init_point;
    } catch (e) {
      setError('No se pudo iniciar el pago. Intenta de nuevo en un momento.');
    } finally {
      setEnviandoPedido(false);
    }
  }

  if (cargando) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--cafe-oscuro)' }}>Cargando catálogo…</div>;
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fondo-calido)', paddingBottom: carrito.totalUnidades > 0 ? 150 : 90 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'var(--superficie)' }}>
        <Link to="/" style={{ color: 'var(--marron-tinta)', display: 'flex' }}>
          <ArrowLeft size={20} />
        </Link>
        <img src="/assets/logo-cumbo.png" alt="Cumbo" style={{ height: 20, width: 'auto' }} />
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--fondo-calido)',
            borderRadius: 12,
            padding: '9px 12px',
          }}
        >
          <Search size={16} color="var(--cafe-oscuro)" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Busca café, método o accesorio"
            style={{ border: 'none', background: 'none', flex: 1, fontSize: 13, color: 'var(--marron-tinta)' }}
          />
        </div>
        <button
          onClick={() => setCarritoAbierto(true)}
          style={{
            position: 'relative',
            background: 'none',
            border: 'none',
            color: 'var(--marron-tinta)',
            cursor: 'pointer',
            display: 'flex',
          }}
        >
          <ShoppingCart size={21} />
          {carrito.totalUnidades > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -6,
                right: -8,
                background: 'var(--accion)',
                color: '#fff',
                borderRadius: '50%',
                width: 17,
                height: 17,
                fontSize: 9.5,
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {carrito.totalUnidades}
            </span>
          )}
        </button>
      </div>

      {/* Tabs de categoría */}
      <div style={{ display: 'flex', gap: 8, padding: '14px 16px 6px', maxWidth: 440, margin: '0 auto' }}>
        {CATEGORIAS.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategoria(c.id)}
            style={{
              flex: 1,
              border: 'none',
              borderRadius: 9999,
              padding: '9px 6px',
              fontSize: 11.5,
              fontWeight: 'bold',
              cursor: 'pointer',
              background: categoria === c.id ? 'var(--accion)' : 'var(--superficie)',
              color: categoria === c.id ? '#fff' : 'var(--cafe-oscuro)',
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {error && (
        <div
          style={{
            margin: '10px 16px',
            fontSize: 12.5,
            color: 'var(--canela-oscuro)',
            background: '#fdf3e6',
            border: '1px solid var(--tierra-kraft)',
            borderRadius: 10,
            padding: '9px 12px',
          }}
        >
          {error}
        </div>
      )}

      <div style={{ maxWidth: 440, margin: '0 auto', padding: '10px 16px' }}>
        {/* ---- Café de finca ---- */}
        {categoria === 'finca' &&
          (productosCafeFiltrados.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: 30 }}>
              No encontramos café con ese nombre.
            </p>
          ) : (
            productosCafeFiltrados.map((p) => {
              const tamano = tamanoPorProducto[p.id] || 'Libra';
              const cantidad = cantidadPorProducto[p.id] || 1;
              const precio = precioConTamano(p.precio, tamano);
              const finca = p.fincas;
              return (
                <div
                  key={p.id}
                  style={{ background: 'var(--superficie)', borderRadius: 16, padding: 14, marginBottom: 12, display: 'flex', gap: 12 }}
                >
                  <div
                    style={{
                      width: 68,
                      height: 68,
                      borderRadius: 12,
                      background: 'var(--accion-suave)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      overflow: 'hidden',
                    }}
                  >
                    {p.imagen_url ? (
                      <img src={p.imagen_url} alt={p.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Coffee size={28} color="var(--accion)" />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 'bold', fontSize: 14, color: 'var(--marron-tinta)' }}>{p.nombre}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--cafe-oscuro)', marginBottom: 2 }}>
                      {finca?.region} · {finca?.proceso}
                    </div>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--cafe-oscuro)', marginBottom: 8 }}
                    >
                      {p.calificacion && (
                        <>
                          <Star size={12} color="#EF9F27" fill="#EF9F27" /> {p.calificacion} ({p.num_resenas}) ·
                        </>
                      )}
                      {finca?.especie} · {finca?.altitud_msnm} msnm
                    </div>

                    <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                      {TAMANOS.map((t) => (
                        <button
                          key={t.valor}
                          onClick={() => setTamanoPorProducto((prev) => ({ ...prev, [p.id]: t.valor }))}
                          style={{
                            border: '1px solid rgba(146,97,55,0.3)',
                            borderRadius: 9999,
                            padding: '5px 10px',
                            fontSize: 11,
                            cursor: 'pointer',
                            background: tamano === t.valor ? 'var(--cafe-oscuro)' : '#fff',
                            color: tamano === t.valor ? '#fff' : 'var(--cafe-oscuro)',
                          }}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontWeight: 'bold', color: 'var(--marron-tinta)' }}>{formatoCOP(precio)}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          onClick={() => setCantidadPorProducto((prev) => ({ ...prev, [p.id]: Math.max(1, cantidad - 1) }))}
                          style={botonCantidadStyle}
                        >
                          −
                        </button>
                        <span style={{ minWidth: 16, textAlign: 'center' }}>{cantidad}</span>
                        <button
                          onClick={() => setCantidadPorProducto((prev) => ({ ...prev, [p.id]: cantidad + 1 }))}
                          style={botonCantidadStyle}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <button onClick={() => agregarCafeAlCarrito(p)} className="cumbo-btn" style={botonAgregarStyle}>
                      Agregar al carrito
                    </button>
                  </div>
                </div>
              );
            })
          ))}

        {/* ---- Métodos de preparación ---- */}
        {categoria === 'metodos' && (
          <>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 12, paddingBottom: 4 }}>
              {METODOS_LISTA.map((m) => (
                <button
                  key={m}
                  onClick={() => setMetodoActivo(m)}
                  style={{
                    whiteSpace: 'nowrap',
                    border: 'none',
                    borderRadius: 9999,
                    padding: '7px 14px',
                    fontSize: 11.5,
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    background: metodoActivo === m ? 'var(--accion)' : '#fff',
                    color: metodoActivo === m ? '#fff' : 'var(--cafe-oscuro)',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>

            {(metodosAgrupados[metodoActivo] || []).map((p) => (
              <div
                key={p.id}
                style={{
                  background: '#fff',
                  borderRadius: 18,
                  padding: 16,
                  marginBottom: 10,
                  boxShadow: '0 6px 16px rgba(45,27,13,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 10,
                    background: 'var(--accion-suave)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    overflow: 'hidden',
                  }}
                >
                  {p.imagen_url ? (
                    <img src={p.imagen_url} alt={p.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Coffee size={22} color="var(--accion)" />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 'bold', color: 'var(--cafe-oscuro)', textTransform: 'uppercase' }}>
                    {etiquetaCalidad(p.calidad)}
                  </div>
                  <div style={{ fontWeight: 'bold', fontSize: 13.5, color: 'var(--marron-tinta)' }}>{p.marca_externa || p.nombre}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--cafe-oscuro)' }}>{p.caracteristicas}</div>
                  <div style={{ fontWeight: 'bold', marginTop: 4 }}>{formatoCOP(p.precio)}</div>
                </div>
                <button
                  onClick={() => agregarProductoSimple(p)}
                  className="cumbo-btn"
                  style={{ ...botonAgregarStyle, marginTop: 0, whiteSpace: 'nowrap', width: 'auto', padding: '10px 14px' }}
                >
                  Agregar
                </button>
              </div>
            ))}
          </>
        )}

        {/* ---- Accesorios ---- */}
        {categoria === 'accesorios' && (
          <>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 12, paddingBottom: 4 }}>
              {TIPOS_ACCESORIO.map((t) => (
                <button
                  key={t}
                  onClick={() => setTipoAccesorioActivo(t)}
                  style={{
                    whiteSpace: 'nowrap',
                    border: 'none',
                    borderRadius: 9999,
                    padding: '7px 14px',
                    fontSize: 11.5,
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    background: tipoAccesorioActivo === t ? 'var(--accion)' : '#fff',
                    color: tipoAccesorioActivo === t ? '#fff' : 'var(--cafe-oscuro)',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            {accesoriosFiltrados.map((p) => (
              <div
                key={p.id}
                style={{
                  background: '#fff',
                  borderRadius: 18,
                  padding: 16,
                  marginBottom: 10,
                  boxShadow: '0 6px 16px rgba(45,27,13,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 10,
                    background: 'var(--accion-suave)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    overflow: 'hidden',
                  }}
                >
                  {p.imagen_url ? (
                    <img src={p.imagen_url} alt={p.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Coffee size={22} color="var(--accion)" />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 'bold', fontSize: 13.5, color: 'var(--marron-tinta)' }}>{p.nombre}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--cafe-oscuro)' }}>
                    {p.marca_externa ? `${p.marca_externa} · ` : ''}
                    {p.caracteristicas}
                  </div>
                  <div style={{ fontWeight: 'bold', marginTop: 4 }}>{formatoCOP(p.precio)}</div>
                </div>
                <button
                  onClick={() => agregarProductoSimple(p)}
                  className="cumbo-btn"
                  style={{ ...botonAgregarStyle, marginTop: 0, whiteSpace: 'nowrap', width: 'auto', padding: '10px 14px' }}
                >
                  Agregar
                </button>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Barra de carrito flotante — patrón Rappi/MercadoLibre */}
      {carrito.totalUnidades > 0 && !carritoAbierto && (
        <div
          style={{
            position: 'fixed',
            bottom: 62,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            padding: '0 16px',
            zIndex: 30,
          }}
        >
          <button
            onClick={() => setCarritoAbierto(true)}
            className="cumbo-btn"
            style={{
              width: '100%',
              maxWidth: 408,
              background: 'var(--accion)',
              color: '#fff',
              border: 'none',
              borderRadius: 9999,
              padding: '13px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 'bold' }}>
              <ShoppingCart size={17} /> {carrito.totalUnidades} producto{carrito.totalUnidades > 1 ? 's' : ''} ·{' '}
              {formatoCOP(carrito.subtotal)}
            </span>
            <span style={{ fontSize: 13, fontWeight: 'bold' }}>Ver carrito ›</span>
          </button>
        </div>
      )}

      {/* ---- Panel de carrito / checkout ---- */}
      {carritoAbierto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-end',
            zIndex: 50,
          }}
        >
          <div
            style={{
              background: '#fff',
              width: '100%',
              maxWidth: 440,
              borderRadius: '24px 24px 0 0',
              padding: 20,
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
          >
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontWeight: 'bold', fontSize: 15, color: 'var(--marron-tinta)' }}>Tu carrito</div>
                <button
                  onClick={() => setCarritoAbierto(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--marron-tinta)' }}
                >
                  <X size={20} />
                </button>
              </div>

              {carrito.listaItems.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--cafe-oscuro)', textAlign: 'center', padding: '20px 0' }}>Tu carrito está vacío.</p>
              ) : (
                <>
                  {carrito.listaItems.map((it) => (
                    <div
                      key={it.key}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 0',
                        borderBottom: '1px solid #f0e9dd',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--marron-tinta)' }}>{it.nombre}</div>
                        <div style={{ fontSize: 12, color: 'var(--cafe-oscuro)' }}>{formatoCOP(it.precio)} c/u</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button onClick={() => carrito.decrementar(it.key)} style={botonCantidadStyle}>
                          −
                        </button>
                        <span style={{ minWidth: 16, textAlign: 'center' }}>{it.cantidad}</span>
                        <button onClick={() => carrito.incrementar(it.key)} style={botonCantidadStyle}>
                          +
                        </button>
                      </div>
                    </div>
                  ))}

                  <div style={{ marginTop: 14 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 12.5,
                        fontWeight: 'bold',
                        color: 'var(--cafe-oscuro)',
                        marginBottom: 6,
                      }}
                    >
                      <MapPin size={14} /> Datos de entrega
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          value={calleEntrega}
                          onChange={(e) => setCalleEntrega(e.target.value)}
                          placeholder="Calle / Carrera"
                          style={{ ...inputEntregaStyle, flex: 2 }}
                        />
                        <input
                          value={numeroEntrega}
                          onChange={(e) => setNumeroEntrega(e.target.value)}
                          placeholder="# -  -"
                          style={{ ...inputEntregaStyle, flex: 1 }}
                        />
                      </div>
                      <input
                        value={barrioEntrega}
                        onChange={(e) => setBarrioEntrega(e.target.value)}
                        placeholder="Barrio (opcional)"
                        style={inputEntregaStyle}
                      />
                      <input
                        value={ciudadEntrega}
                        onChange={(e) => setCiudadEntrega(e.target.value)}
                        placeholder="Ciudad"
                        style={inputEntregaStyle}
                      />
                      {!enBogota && (
                        <>
                          <select
                            value={departamentoEntrega}
                            onChange={(e) => setDepartamentoEntrega(e.target.value)}
                            style={inputEntregaStyle}
                          >
                            <option value="">Departamento</option>
                            {DEPARTAMENTOS_COLOMBIA.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                          <input
                            value={codigoPostalEntrega}
                            onChange={(e) => setCodigoPostalEntrega(e.target.value)}
                            placeholder="Código postal (6 dígitos)"
                            style={inputEntregaStyle}
                          />
                          <p style={{ fontSize: 10.5, color: 'var(--cafe-oscuro)', margin: 0 }}>
                            ¿No sabes tu código postal?{' '}
                            <a
                              href="https://www.4-72.com.co/codigo-postal/"
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: 'var(--accion)', fontWeight: 'bold' }}
                            >
                              Consúltalo acá
                            </a>
                            .
                          </p>
                        </>
                      )}
                      <input
                        value={telefonoContacto}
                        onChange={(e) => setTelefonoContacto(e.target.value)}
                        placeholder="Teléfono de contacto"
                        style={inputEntregaStyle}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 'bold', color: 'var(--cafe-oscuro)', marginBottom: 6 }}>
                      Elige tu tarifa de envío
                    </div>
                    {!direccionCompleta ? (
                      <p style={{ fontSize: 11.5, color: 'var(--cafe-oscuro)' }}>
                        Completa la dirección arriba para ver las opciones de envío.
                      </p>
                    ) : cotizandoEnvio ? (
                      <p style={{ fontSize: 11.5, color: 'var(--cafe-oscuro)' }}>Cotizando con las transportadoras…</p>
                    ) : errorCotizacion ? (
                      <p style={{ fontSize: 11.5, color: 'var(--canela-oscuro)' }}>{errorCotizacion}</p>
                    ) : (
                      <>
                        <div style={{ fontSize: 10.5, color: 'var(--cafe-oscuro)', marginBottom: 6 }}>
                          {enBogota
                            ? `Dentro de ${CIUDAD_BASE} — mensajería urbana`
                            : 'Fuera de Bogotá — cotización en vivo con la transportadora'}
                        </div>
                        {opcionesEnvio.length === 0 ? (
                          <p style={{ fontSize: 11.5, color: 'var(--cafe-oscuro)' }}>
                            No encontramos opciones de envío para esa dirección. Revisa los datos.
                          </p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {opcionesEnvio.map((t) => (
                              <label
                                key={t.id}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  border:
                                    carrito.tarifaEnvio?.id === t.id ? '1.5px solid var(--accion)' : '1.5px solid rgba(146,97,55,0.2)',
                                  borderRadius: 12,
                                  padding: '10px 12px',
                                  cursor: 'pointer',
                                  background: carrito.tarifaEnvio?.id === t.id ? 'var(--accion-suave)' : '#fff',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <input
                                    type="radio"
                                    name="tarifaEnvio"
                                    checked={carrito.tarifaEnvio?.id === t.id}
                                    onChange={() => carrito.seleccionarTarifaEnvio(t)}
                                  />
                                  <div>
                                    <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--marron-tinta)' }}>{t.transportadora}</div>
                                    <div style={{ fontSize: 11, color: 'var(--cafe-oscuro)' }}>
                                      {t.tiempo} · {t.nota || t.servicio}
                                    </div>
                                  </div>
                                </div>
                                <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--marron-tinta)' }}>{formatoCOP(t.costo)}</div>
                              </label>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                    <p style={{ fontSize: 10, color: 'var(--cafe-oscuro)', marginTop: 6 }}>
                      {enBogota
                        ? 'Tarifas estimadas de referencia — todavía no hay una cotización en vivo conectada para mensajería urbana.'
                        : 'Tarifas cotizadas en vivo con la transportadora al momento de tu compra.'}
                    </p>
                  </div>

                  <div style={{ marginTop: 14, fontSize: 13, color: 'var(--marron-tinta)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>Subtotal</span>
                      <span>{formatoCOP(carrito.subtotal)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>Envío</span>
                      <span>{carrito.tarifaEnvio ? formatoCOP(carrito.costoEnvio) : '—'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 14.5, marginTop: 6 }}>
                      <span>Total</span>
                      <span>{formatoCOP(carrito.total)}</span>
                    </div>
                    {carrito.requiereRevision && (
                      <p style={{ fontSize: 11.5, color: 'var(--canela-oscuro)', marginTop: 8 }}>
                        Este pedido supera $1.000.000 — pasará por revisión manual antes de despacharse.
                      </p>
                    )}
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 12.5,
                        fontWeight: 'bold',
                        color: 'var(--cafe-oscuro)',
                        marginBottom: 6,
                      }}
                    >
                      <CreditCard size={14} /> Elige cómo pagar
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 13,
                          color: 'var(--marron-tinta)',
                          border: pasarelaPago === 'mercadopago' ? '1.5px solid var(--accion)' : '1.5px solid rgba(146,97,55,0.2)',
                          borderRadius: 12,
                          padding: '10px 12px',
                          cursor: 'pointer',
                          background: pasarelaPago === 'mercadopago' ? 'var(--accion-suave)' : '#fff',
                        }}
                      >
                        <input
                          type="radio"
                          name="pasarela"
                          checked={pasarelaPago === 'mercadopago'}
                          onChange={() => setPasarelaPago('mercadopago')}
                        />
                        <div>
                          <div style={{ fontWeight: 'bold' }}>Mercado Pago</div>
                          <div style={{ fontSize: 10.5, color: 'var(--cafe-oscuro)' }}>Tarjeta, PSE, Efecty y más</div>
                        </div>
                      </label>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 13,
                          color: 'var(--marron-tinta)',
                          border: pasarelaPago === 'wompi' ? '1.5px solid var(--accion)' : '1.5px solid rgba(146,97,55,0.2)',
                          borderRadius: 12,
                          padding: '10px 12px',
                          cursor: 'pointer',
                          background: pasarelaPago === 'wompi' ? 'var(--accion-suave)' : '#fff',
                        }}
                      >
                        <input type="radio" name="pasarela" checked={pasarelaPago === 'wompi'} onChange={() => setPasarelaPago('wompi')} />
                        <div>
                          <div style={{ fontWeight: 'bold' }}>Wompi</div>
                          <div style={{ fontSize: 10.5, color: 'var(--cafe-oscuro)' }}>Tarjeta, PSE, Nequi y Efecty</div>
                        </div>
                      </label>
                    </div>
                    <p style={{ fontSize: 10.5, color: 'var(--cafe-oscuro)', marginTop: 6 }}>
                      Al confirmar te llevamos al checkout de {pasarelaPago === 'wompi' ? 'Wompi' : 'Mercado Pago'} para completar el pago.
                    </p>
                  </div>

                  {error && (
                    <div
                      style={{
                        marginTop: 12,
                        fontSize: 12,
                        color: 'var(--canela-oscuro)',
                        background: '#fdf3e6',
                        border: '1px solid var(--tierra-kraft)',
                        borderRadius: 10,
                        padding: '9px 12px',
                      }}
                    >
                      {error}
                    </div>
                  )}

                  <button
                    onClick={confirmarPedido}
                    disabled={enviandoPedido || !carrito.tarifaEnvio}
                    className="cumbo-btn"
                    style={{ ...botonAgregarStyle, marginTop: 16, opacity: enviandoPedido || !carrito.tarifaEnvio ? 0.6 : 1 }}
                  >
                    {enviandoPedido ? 'Redirigiendo a Mercado Pago…' : 'Confirmar y pagar'}
                  </button>
                </>
              )}
            </>
          </div>
        </div>
      )}
    </div>
  );
}

function etiquetaCalidad(calidad) {
  if (calidad === 'basica') return 'Básica';
  if (calidad === 'media') return 'Media';
  if (calidad === 'alta') return 'Alta';
  return calidad || '';
}

const botonCantidadStyle = {
  width: 24,
  height: 24,
  borderRadius: '50%',
  border: '1px solid rgba(146,97,55,0.3)',
  background: '#fff',
  cursor: 'pointer',
  fontSize: 13,
};

const botonAgregarStyle = {
  width: '100%',
  marginTop: 10,
  background: 'var(--accion)',
  color: '#fff',
  border: 'none',
  padding: 12,
  borderRadius: 9999,
  fontSize: 13.5,
  fontWeight: 'bold',
  cursor: 'pointer',
};

const inputEntregaStyle = {
  border: '1.5px solid rgba(146,97,55,0.25)',
  borderRadius: 12,
  padding: '10px 12px',
  fontSize: 13,
  color: 'var(--marron-tinta)',
  background: '#fff',
  width: '100%',
};
