import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ArrowUpCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useSesion } from '../context/SesionContext';

// Migrado desde: "Portal Caficultor Cumbo.dc.html"
// Cambios respecto al prototipo:
//  - Las fotos/video/cédula se suben de verdad a Supabase Storage
//    (bucket "fincas-certificaciones"), no son solo un nombre de
//    archivo guardado en memoria.
//  - Al enviar, se crea una fila real en `fincas` (estado: 'pendiente',
//    a la espera de validación del CEO en Panel Cumbo) y otra en
//    `fincas_datos_pago` (banco/cédula — tabla separada y con RLS
//    restringida, no expuesta en el Marketplace).
//  - Se registra un evento en `eventos_log`.
//  - Quedó pendiente a propósito: el simulador de tarifas de envío y el
//    rastreo de guía del prototipo — son más relevantes una vez la finca
//    ya tiene pedidos despachándose, así que los dejamos para cuando
//    migremos Logística.

const REGIONES_CAFETERAS = [
  'Huila',
  'Tolima',
  'Nariño',
  'Cauca',
  'Santander',
  'Eje Cafetero',
  'Antioquia',
  'Valle del Cauca',
  'Cundinamarca',
  'Boyacá',
  'Santanderes del norte y Sierra Nevada',
];

// Regiones que existen como `enum region_finca` en la base de datos hoy.
// Las demás son válidas en el formulario pero quedan como 'Otra' hasta
// que se agreguen al enum (ver nota en el segundo dropdown de región).
const REGIONES_EN_ENUM = ['Huila', 'Nariño', 'Cauca', 'Eje Cafetero', 'Otra'];

const ESPECIES = [
  'Arábica — Castillo',
  'Arábica — Caturra',
  'Arábica — Colombia',
  'Arábica — Típica',
  'Arábica — Bourbon',
  'Arábica — Tabi',
  'Arábica — Cenicafé 1',
  'Arábica — Castillo Naranjal',
  'Arábica — Maragogipe',
  'Arábica — Geisha',
  'Arábica — Pink Bourbon',
  'Arábica — Variedad San Bernardo',
];

// Precios de referencia por carga (125kg) — ilustrativos, a actualizar a
// mano con el precio interno vigente de la Federación Nacional de
// Cafeteros (todavía no hay conexión en vivo a la FNC).
const PRECIOS_REFERENCIA_CARGA = {
  'Arábica — Castillo': 2150000,
  'Arábica — Caturra': 2200000,
  'Arábica — Colombia': 2180000,
  'Arábica — Típica': 2250000,
  'Arábica — Bourbon': 2400000,
  'Arábica — Tabi': 2500000,
  'Arábica — Cenicafé 1': 2200000,
  'Arábica — Castillo Naranjal': 2150000,
  'Arábica — Maragogipe': 2600000,
  'Arábica — Geisha': 4200000,
  'Arábica — Pink Bourbon': 3600000,
  'Arábica — Variedad San Bernardo': 2300000,
};

const ESTADOS_GRANO = ['Cereza', 'Pergamino', 'Trillado', 'Verde (excelso)'];
const MALLAS_GRANO = ['Supremo (malla 17+)', 'Excelso (malla 15-16)', 'UGQ (bajo grado)'];

function formatoCOP(n) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

function mapearRegionAEnum(region) {
  return REGIONES_EN_ENUM.includes(region) ? region : 'Otra';
}

function mapearEspecieAEnum(especieUI) {
  // El enum especie_cafe de la base tiene: Caturra, Castillo, Típica, Pink Bourbon, Otra
  if (especieUI.includes('Castillo')) return 'Castillo';
  if (especieUI.includes('Caturra')) return 'Caturra';
  if (especieUI.includes('Típica')) return 'Típica';
  if (especieUI.includes('Pink Bourbon')) return 'Pink Bourbon';
  return 'Otra';
}

const CAMPOS_INICIALES = {
  finca: '',
  region: 'Huila',
  pueblo: '',
  altitud: '',
  proceso: 'Lavado',
  notasSabor: '',
  fechaRecoleccion: '',
  especie: 'Arábica — Castillo',
  precioKilo: '',
  estadoGrano: 'Pergamino',
  humedadGrano: '',
  mallaGrano: 'Supremo (malla 17+)',
  banco: '',
  tipoCuenta: 'Ahorros',
  numeroCuenta: '',
  titularCuenta: '',
  cedulaNumero: '',
  contactoWhatsapp: '',
};

export default function PortalCaficultor() {
  const { sesion, perfil, cargando: cargandoSesion } = useSesion();

  const [campos, setCampos] = useState(CAMPOS_INICIALES);
  const [archivos, setArchivos] = useState({ fotoCultivo: null, fotoGrano: null, fotoHumedad: null, video: null, cedulaDocumento: null });
  const [certifico, setCertifico] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  function setCampo(nombre, valor) {
    setCampos((c) => ({ ...c, [nombre]: valor }));
  }

  function setArchivo(nombre, file) {
    setArchivos((a) => ({ ...a, [nombre]: file }));
  }

  const progresoPct = useMemo(() => {
    const camposObligatorios = [
      campos.finca,
      campos.region,
      campos.altitud,
      campos.fechaRecoleccion,
      campos.humedadGrano,
      campos.precioKilo,
      campos.banco,
      campos.numeroCuenta,
      campos.titularCuenta,
      campos.cedulaNumero,
      campos.notasSabor,
    ];
    const archivosObligatorios = [archivos.fotoCultivo, archivos.fotoGrano, archivos.video, archivos.cedulaDocumento];
    const completos = camposObligatorios.filter(Boolean).length + archivosObligatorios.filter(Boolean).length;
    const total = camposObligatorios.length + archivosObligatorios.length;
    return Math.round((completos / total) * 100);
  }, [campos, archivos]);

  const precioReferencia = PRECIOS_REFERENCIA_CARGA[campos.especie] || 0;
  const precioReferenciaKilo = precioReferencia / 125;
  const precioKiloIngresado = parseFloat((campos.precioKilo || '').toString().replace(/\./g, '').replace(/,/g, '.')) || 0;

  const validacionPrecio = (() => {
    if (!precioReferencia || !precioKiloIngresado)
      return { ok: null, texto: 'Escribe tu precio por kilo para comparar contra la referencia.' };
    if (precioKiloIngresado > precioReferenciaKilo) {
      return { ok: false, texto: 'Tu precio está por encima de la referencia de mercado — la ficha no se puede enviar así.' };
    }
    const precioConBono = precioKiloIngresado * 1.03;
    return { ok: true, texto: `Validado dentro del precio de mercado — Cumbo te paga 3% extra: ${formatoCOP(precioConBono)}/kg.` };
  })();

  if (cargandoSesion) return null;
  if (!sesion) return <Navigate to="/ingreso?next=/portal-caficultor" replace />;

  async function subirArchivo(file, tipo) {
    const ruta = `${sesion.user.id}/${tipo}-${Date.now()}-${file.name}`;
    const { error: errSubida } = await supabase.storage.from('fincas-certificaciones').upload(ruta, file);
    if (errSubida) throw errSubida;
    const { data } = supabase.storage.from('fincas-certificaciones').getPublicUrl(ruta);
    return data.publicUrl;
  }

  async function enviar() {
    setError('');

    const faltantes = [];
    if (!campos.finca) faltantes.push('nombre de la finca');
    if (!campos.altitud) faltantes.push('altitud');
    if (!campos.fechaRecoleccion) faltantes.push('fecha de recolección');
    if (!campos.humedadGrano) faltantes.push('humedad del grano');
    if (!campos.precioKilo) faltantes.push('precio por kilo');
    if (!campos.notasSabor) faltantes.push('notas de sabor');
    if (!campos.banco) faltantes.push('banco');
    if (!campos.numeroCuenta) faltantes.push('número de cuenta');
    if (!campos.titularCuenta) faltantes.push('titular de la cuenta');
    if (!campos.cedulaNumero) faltantes.push('número de cédula');
    if (!archivos.fotoCultivo) faltantes.push('foto del cultivo');
    if (!archivos.fotoGrano) faltantes.push('foto del grano');
    if (!archivos.video) faltantes.push('video del cultivo');
    if (!archivos.cedulaDocumento) faltantes.push('foto o PDF de la cédula');

    if (faltantes.length > 0) {
      setError(`Faltan datos obligatorios: ${faltantes.join(', ')}.`);
      return;
    }
    if (!certifico) {
      setError('Debes marcar la certificación del cultivo para enviar la ficha.');
      return;
    }
    if (validacionPrecio.ok === false) {
      setError(validacionPrecio.texto);
      return;
    }

    setEnviando(true);
    try {
      // 1. Actualizar el WhatsApp del perfil si lo dio distinto
      if (campos.contactoWhatsapp) {
        await supabase.from('usuarios').update({ whatsapp: campos.contactoWhatsapp }).eq('id', sesion.user.id);
      }

      // 2. Subir archivos
      const [urlCultivo, urlGrano, urlVideo, urlCedula, urlHumedad] = await Promise.all([
        subirArchivo(archivos.fotoCultivo, 'foto-cultivo'),
        subirArchivo(archivos.fotoGrano, 'foto-grano'),
        subirArchivo(archivos.video, 'video'),
        subirArchivo(archivos.cedulaDocumento, 'cedula'),
        archivos.fotoHumedad ? subirArchivo(archivos.fotoHumedad, 'foto-humedad') : Promise.resolve(null),
      ]);

      // 3. Crear la finca (queda 'pendiente' de validación del CEO)
      const { data: finca, error: errFinca } = await supabase
        .from('fincas')
        .insert({
          caficultor_id: sesion.user.id,
          nombre_finca: campos.finca,
          region: mapearRegionAEnum(campos.region),
          vereda: campos.pueblo || null,
          altitud_msnm: parseInt(campos.altitud, 10) || null,
          especie: mapearEspecieAEnum(campos.especie),
          proceso: campos.proceso,
          precio_kilo_propuesto: precioKiloIngresado,
          notas_sabor: campos.notasSabor,
          fecha_recoleccion: campos.fechaRecoleccion,
          estado_grano: campos.estadoGrano,
          humedad_grano: parseFloat(campos.humedadGrano) || null,
          malla_grano: campos.mallaGrano,
          certificacion_foto_cultivo: urlCultivo,
          certificacion_foto_grano: urlGrano,
          certificacion_video: urlVideo,
          certificacion_foto_humedad: urlHumedad,
          estado: 'pendiente',
        })
        .select()
        .single();
      if (errFinca) throw errFinca;

      // 4. Datos bancarios / identidad — tabla separada
      const { error: errPago } = await supabase.from('fincas_datos_pago').insert({
        finca_id: finca.id,
        banco: campos.banco,
        tipo_cuenta: campos.tipoCuenta,
        numero_cuenta: campos.numeroCuenta,
        titular_cuenta: campos.titularCuenta,
        cedula_numero: campos.cedulaNumero,
        cedula_documento_url: urlCedula,
      });
      if (errPago) throw errPago;

      // 5. Evento en el log inmutable
      await supabase.from('eventos_log').insert({
        entidad: 'finca',
        entidad_id: finca.id,
        accion: 'creada',
        datos: { nombre_finca: campos.finca, region: campos.region },
        usuario_id: sesion.user.id,
      });

      // 6. Si todavía no tenía rol de caficultor, se lo asignamos ahora
      if (perfil?.rol !== 'caficultor') {
        await supabase.from('usuarios').update({ rol: 'caficultor' }).eq('id', sesion.user.id);
      }

      setEnviado(true);
    } catch (e) {
      setError('No se pudo enviar la ficha. Verifica tu conexión e intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  function enviarOtra() {
    setCampos(CAMPOS_INICIALES);
    setArchivos({ fotoCultivo: null, fotoGrano: null, fotoHumedad: null, video: null, cedulaDocumento: null });
    setCertifico(false);
    setEnviado(false);
  }

  if (enviado) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--fondo-calido)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <CheckCircle2 size={44} color="var(--exito)" style={{ marginBottom: 8 }} />
        <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 19, color: 'var(--canela-oscuro)', marginBottom: 8 }}>
          Ficha enviada
        </div>
        <p style={{ fontSize: 13.5, color: 'var(--marron-tinta)', maxWidth: 340, lineHeight: 1.5, marginBottom: 18 }}>
          Tu finca quedó registrada y en revisión. El equipo Cumbo valida la certificación antes de publicarla en el Marketplace.
        </p>
        <button onClick={enviarOtra} className="cumbo-btn" style={botonPrimario}>
          Registrar otra finca
        </button>
        <Link to="/" style={{ marginTop: 12, color: 'var(--cafe-oscuro)', fontSize: 13, fontWeight: 'bold' }}>
          ← Volver al ecosistema
        </Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fondo-calido)', paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'var(--superficie)' }}>
        <Link to="/" style={{ color: 'var(--marron-tinta)', display: 'flex' }}>
          <ArrowLeft size={20} />
        </Link>
        <div style={{ fontWeight: 'bold', fontSize: 15, color: 'var(--marron-tinta)', flex: 1 }}>Portal Caficultor</div>
        <img src="/assets/logo-cumbo.png" alt="Cumbo" style={{ height: 22, width: 'auto' }} />
      </div>

      {/* Barra de progreso */}
      <div style={{ maxWidth: 440, margin: '14px auto 0', padding: '0 16px' }}>
        <div style={{ fontSize: 11, color: 'var(--cafe-oscuro)', marginBottom: 4 }}>Ficha completa: {progresoPct}%</div>
        <div style={{ height: 6, borderRadius: 9999, background: '#e8ddc8', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progresoPct}%`, background: 'var(--accion)', transition: 'width .2s' }} />
        </div>
      </div>

      <div style={{ maxWidth: 440, margin: '0 auto', padding: '14px 16px' }}>
        <Seccion titulo="Datos de la finca">
          <Campo label="Nombre de la finca">
            <input
              style={inputStyle}
              value={campos.finca}
              onChange={(e) => setCampo('finca', e.target.value)}
              placeholder="Ej: Finca La Esperanza"
            />
          </Campo>
          <Campo label="Contacto de WhatsApp">
            <input
              style={inputStyle}
              value={campos.contactoWhatsapp}
              onChange={(e) => setCampo('contactoWhatsapp', e.target.value)}
              placeholder="+57 300 000 0000"
            />
          </Campo>
          <Campo label="Región">
            <select style={inputStyle} value={campos.region} onChange={(e) => setCampo('region', e.target.value)}>
              {REGIONES_CAFETERAS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Pueblo / vereda">
            <input
              style={inputStyle}
              value={campos.pueblo}
              onChange={(e) => setCampo('pueblo', e.target.value)}
              placeholder="Ej: El Rosario"
            />
          </Campo>
          <Campo label="Altitud (msnm)">
            <input
              type="number"
              style={inputStyle}
              value={campos.altitud}
              onChange={(e) => setCampo('altitud', e.target.value)}
              placeholder="1780"
            />
          </Campo>
          <Campo label="Proceso">
            <select style={inputStyle} value={campos.proceso} onChange={(e) => setCampo('proceso', e.target.value)}>
              {['Lavado', 'Honey', 'Natural'].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Notas de sabor">
            <textarea
              style={{ ...inputStyle, minHeight: 60 }}
              value={campos.notasSabor}
              onChange={(e) => setCampo('notasSabor', e.target.value)}
              placeholder="Ej: dulce, notas de panela y cítricos suaves"
            />
          </Campo>
          <Campo label="Fecha de recolección">
            <input
              type="date"
              style={inputStyle}
              value={campos.fechaRecoleccion}
              onChange={(e) => setCampo('fechaRecoleccion', e.target.value)}
            />
          </Campo>
        </Seccion>

        <Seccion titulo="Café y precio">
          <Campo label="Especie / variedad">
            <select style={inputStyle} value={campos.especie} onChange={(e) => setCampo('especie', e.target.value)}>
              {ESPECIES.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </Campo>
          <div style={{ fontSize: 11.5, color: 'var(--cafe-oscuro)', marginBottom: 10 }}>
            Referencia de mercado: {formatoCOP(precioReferencia)}/carga (125kg) · {formatoCOP(precioReferenciaKilo)}/kg
          </div>
          <Campo label="Tu precio por kilo (COP)">
            <input
              style={inputStyle}
              value={campos.precioKilo}
              onChange={(e) => setCampo('precioKilo', e.target.value)}
              placeholder="70000"
            />
          </Campo>
          {validacionPrecio.ok !== null && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                color: validacionPrecio.ok ? 'var(--exito)' : 'var(--canela-oscuro)',
                marginBottom: 6,
              }}
            >
              {validacionPrecio.ok ? <CheckCircle2 size={13} /> : <span>✗</span>} {validacionPrecio.texto}
            </div>
          )}
        </Seccion>

        <Seccion titulo="Estado del grano">
          <Campo label="Estado">
            <select style={inputStyle} value={campos.estadoGrano} onChange={(e) => setCampo('estadoGrano', e.target.value)}>
              {ESTADOS_GRANO.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Humedad del grano (%)">
            <input
              type="number"
              style={inputStyle}
              value={campos.humedadGrano}
              onChange={(e) => setCampo('humedadGrano', e.target.value)}
              placeholder="11.5"
            />
          </Campo>
          <Campo label="Malla">
            <select style={inputStyle} value={campos.mallaGrano} onChange={(e) => setCampo('mallaGrano', e.target.value)}>
              {MALLAS_GRANO.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Campo>
          <CampoArchivo
            label="Foto de la humedad del grano (opcional)"
            file={archivos.fotoHumedad}
            onChange={(f) => setArchivo('fotoHumedad', f)}
            accept="image/*"
          />
        </Seccion>

        <Seccion titulo="Certificación (obligatoria)">
          <CampoArchivo
            label="Foto del cultivo"
            file={archivos.fotoCultivo}
            onChange={(f) => setArchivo('fotoCultivo', f)}
            accept="image/*"
          />
          <CampoArchivo
            label="Foto del grano cosechado"
            file={archivos.fotoGrano}
            onChange={(f) => setArchivo('fotoGrano', f)}
            accept="image/*"
          />
          <CampoArchivo
            label="Video mostrando el cultivo"
            file={archivos.video}
            onChange={(f) => setArchivo('video', f)}
            accept="video/*"
          />
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, color: 'var(--marron-tinta)', marginTop: 8 }}>
            <input type="checkbox" checked={certifico} onChange={(e) => setCertifico(e.target.checked)} style={{ marginTop: 2 }} />
            Certifico que la foto y el video corresponden a mi cultivo real y son de mi autoría.
          </label>
        </Seccion>

        <Seccion titulo="Datos de pago">
          <Campo label="Banco">
            <input
              style={inputStyle}
              value={campos.banco}
              onChange={(e) => setCampo('banco', e.target.value)}
              placeholder="Ej: Bancolombia"
            />
          </Campo>
          <Campo label="Tipo de cuenta">
            <select style={inputStyle} value={campos.tipoCuenta} onChange={(e) => setCampo('tipoCuenta', e.target.value)}>
              {['Ahorros', 'Corriente'].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Número de cuenta">
            <input style={inputStyle} value={campos.numeroCuenta} onChange={(e) => setCampo('numeroCuenta', e.target.value)} />
          </Campo>
          <Campo label="Titular de la cuenta">
            <input style={inputStyle} value={campos.titularCuenta} onChange={(e) => setCampo('titularCuenta', e.target.value)} />
          </Campo>
        </Seccion>

        <Seccion titulo="Identidad">
          <Campo label="Número de cédula">
            <input style={inputStyle} value={campos.cedulaNumero} onChange={(e) => setCampo('cedulaNumero', e.target.value)} />
          </Campo>
          <CampoArchivo
            label="Foto o PDF de la cédula"
            file={archivos.cedulaDocumento}
            onChange={(f) => setArchivo('cedulaDocumento', f)}
            accept="image/*,application/pdf"
          />
        </Seccion>

        {error && (
          <div
            style={{
              fontSize: 12.5,
              color: 'var(--canela-oscuro)',
              background: '#fdf3e6',
              border: '1px solid var(--tierra-kraft)',
              borderRadius: 10,
              padding: '10px 12px',
              marginBottom: 14,
            }}
          >
            {error}
          </div>
        )}

        <button onClick={enviar} disabled={enviando} className="cumbo-btn" style={{ ...botonPrimario, opacity: enviando ? 0.7 : 1 }}>
          {enviando ? 'Enviando ficha…' : 'Enviar ficha de finca'}
        </button>
        <p style={{ fontSize: 10.5, color: 'var(--cafe-oscuro)', textAlign: 'center', marginTop: 8 }}>
          Tus datos bancarios y de identidad solo los ve el equipo Cumbo — nunca se muestran en el Marketplace.
        </p>
      </div>
    </div>
  );
}

function Seccion({ titulo, children }) {
  return (
    <div style={{ background: 'var(--superficie)', borderRadius: 18, padding: 18, marginBottom: 14 }}>
      <div style={{ fontSize: 13.5, fontWeight: 'bold', color: 'var(--marron-tinta)', marginBottom: 12 }}>{titulo}</div>
      {children}
    </div>
  );
}

function Campo({ label, children }) {
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
      }}
    >
      {label}
      {children}
    </label>
  );
}

function CampoArchivo({ label, file, onChange, accept }) {
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
      }}
    >
      {label}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          border: '1.5px dashed rgba(146,97,55,0.35)',
          borderRadius: 12,
          padding: '10px 12px',
          fontSize: 12,
          color: file ? 'var(--marron-tinta)' : 'var(--cafe-oscuro)',
        }}
      >
        <ArrowUpCircle size={16} color="var(--cafe-oscuro)" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          {file ? file.name : 'Sin archivo — toca para subir'}
          <input
            type="file"
            accept={accept}
            onChange={(e) => onChange(e.target.files?.[0] || null)}
            style={{ display: 'block', marginTop: 6, fontSize: 11, width: '100%' }}
          />
        </div>
      </div>
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
};

const botonPrimario = {
  width: '100%',
  background: 'var(--accion)',
  color: '#fff',
  border: 'none',
  padding: 14,
  borderRadius: 9999,
  fontSize: 14,
  fontWeight: 'bold',
  cursor: 'pointer',
};
