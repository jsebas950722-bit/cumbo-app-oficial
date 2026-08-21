import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Mail, Lock, User, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { registrarEvento } from '../lib/analytics';

// Migrado desde: "Ingreso Cumbo.dc.html"
// Cambio clave respecto al prototipo: la sesión ya NO se guarda en
// localStorage de forma simulada — se usa Supabase Auth real
// (auth.signUp / auth.signInWithPassword / auth.signInWithOAuth).
// Rediseño: fondo claro y tarjeta única (antes era un fondo oscuro de
// pantalla completa con una tarjeta blanca encima) — más cercano al
// login simple y directo de las apps de delivery/marketplace.

export default function Ingreso() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next') || '/';
  const [modo, setModo] = useState('iniciar'); // 'iniciar' | 'crear'
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [exito, setExito] = useState(false);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [log, setLog] = useState([]);

  const esCrearCuenta = modo === 'crear';
  const nombreUsuarioSesion = nombre || (correo ? correo.split('@')[0] : 'Invitado');

  function agregarLog(texto) {
    const hora = new Date().toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setLog((prev) => [...prev, { id: prev.length, hora, texto }]);
  }

  async function enviar() {
    if (!correo || !clave || (esCrearCuenta && !nombre)) {
      setError('Completa todos los campos para continuar.');
      return;
    }
    if (esCrearCuenta && !aceptaTerminos) {
      setError('Debes aceptar la Política de Privacidad y los Términos y Condiciones para crear tu cuenta.');
      return;
    }
    if (!correo.includes('@')) {
      setError('Escribe un correo válido.');
      return;
    }

    setError('');
    setCargando(true);

    try {
      if (esCrearCuenta) {
        // El perfil en `usuarios` ya NO se crea acá manualmente — un
        // trigger en la base de datos lo crea automáticamente en
        // cuanto se crea el usuario de autenticación (ver migración
        // 20260101001600_corregir_creacion_perfil.sql). El insert
        // manual que había antes fallaba en silencio porque a
        // `usuarios` le faltaba la policy de INSERT — este era un bug
        // real, no una simplificación de código.
        const { error: errSignUp } = await supabase.auth.signUp({
          email: correo,
          password: clave,
          options: {
            data: {
              nombre_completo: nombre,
              consentimiento_datos_en: new Date().toISOString(),
            },
          },
        });
        if (errSignUp) throw errSignUp;

        agregarLog(`Cuenta creada para ${correo}.`);
        registrarEvento('cuenta_creada', { metodo: 'correo' });
      } else {
        const { error: errLogin } = await supabase.auth.signInWithPassword({
          email: correo,
          password: clave,
        });
        if (errLogin) throw errLogin;
        agregarLog(`Inicio de sesión de ${correo}.`);
        registrarEvento('sesion_iniciada', { metodo: 'correo' });
      }

      setExito(true);
    } catch (e) {
      setError(traducirErrorSupabase(e));
    } finally {
      setCargando(false);
    }
  }

  async function continuarConGoogle() {
    setError('');
    const { error: errGoogle } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/ingreso${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}` },
    });
    if (errGoogle) {
      setError('No se pudo iniciar con Google. Intenta de nuevo.');
    }
  }

  function crearOtraCuenta() {
    setModo('crear');
    setNombre('');
    setCorreo('');
    setClave('');
    setError('');
    setExito(false);
  }

  const inicialAvatar = nombreUsuarioSesion.charAt(0).toUpperCase();
  const mensajeExitoTitulo = esCrearCuenta ? '¡Cuenta creada!' : '¡Bienvenido de nuevo!';
  const mensajeExitoTexto = esCrearCuenta
    ? 'Tu cuenta Cumbo quedó lista. Ya puedes explorar el ecosistema.'
    : 'Iniciaste sesión correctamente en tu cuenta Cumbo.';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--fondo-calido)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '28px 16px 36px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 400, display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
        <img src="/assets/logo-cumbo.png" alt="Cumbo" style={{ height: 38, width: 'auto' }} />
      </div>

      <div style={{ width: '100%', maxWidth: 400, background: 'var(--superficie)', borderRadius: 20, padding: '24px 22px 26px' }}>
        {!exito && (
          <div style={{ display: 'flex', background: 'var(--fondo-calido)', borderRadius: 9999, padding: 4, marginBottom: 20 }}>
            <button
              onClick={() => setModo('iniciar')}
              className="cumbo-tab"
              style={{
                flex: 1,
                border: 'none',
                borderRadius: 9999,
                padding: 10,
                fontSize: 13,
                fontWeight: 'bold',
                cursor: 'pointer',
                background: !esCrearCuenta ? 'var(--accion)' : 'transparent',
                color: !esCrearCuenta ? '#fff' : 'var(--cafe-oscuro)',
              }}
            >
              Iniciar sesión
            </button>
            <button
              onClick={() => setModo('crear')}
              className="cumbo-tab"
              style={{
                flex: 1,
                border: 'none',
                borderRadius: 9999,
                padding: 10,
                fontSize: 13,
                fontWeight: 'bold',
                cursor: 'pointer',
                background: esCrearCuenta ? 'var(--accion)' : 'transparent',
                color: esCrearCuenta ? '#fff' : 'var(--cafe-oscuro)',
              }}
            >
              Crear cuenta
            </button>
          </div>
        )}

        {exito ? (
          <div style={{ textAlign: 'center', padding: '10px 4px' }}>
            <CheckCircle2 size={44} color="var(--exito)" style={{ marginBottom: 10 }} />
            <div
              style={{
                width: 52,
                height: 52,
                margin: '0 auto 10px',
                borderRadius: '50%',
                background: 'var(--tierra-kraft)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 19,
                fontWeight: 'bold',
                color: '#fff',
              }}
            >
              {inicialAvatar}
            </div>
            <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--marron-tinta)', marginBottom: 12 }}>{nombreUsuarioSesion}</div>
            <div
              style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 18, color: 'var(--canela-oscuro)', marginBottom: 8 }}
            >
              {mensajeExitoTitulo}
            </div>
            <p style={{ fontSize: 13, color: 'var(--marron-tinta)', lineHeight: 1.5, margin: '0 0 16px' }}>{mensajeExitoTexto}</p>
            <div
              style={{
                fontSize: 11,
                color: 'var(--cafe-oscuro)',
                background: 'var(--fondo-calido)',
                borderRadius: 12,
                padding: '10px 14px',
                textAlign: 'left',
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 'bold', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1, fontSize: 10 }}>
                Registro de la sesión
              </div>
              {log.map((entrada) => (
                <div key={entrada.id}>
                  [{entrada.hora}] {entrada.texto}
                </div>
              ))}
            </div>
            <button
              onClick={() => navigate(next)}
              className="cumbo-btn"
              style={{
                display: 'block',
                width: '100%',
                marginTop: 16,
                background: 'var(--accion)',
                color: '#fff',
                border: 'none',
                padding: 14,
                borderRadius: 9999,
                fontSize: 14,
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              {next === '/portal-caficultor'
                ? 'Continuar a Portal Caficultor →'
                : next === '/crm-vendedor'
                  ? 'Continuar a CRM Vendedor →'
                  : 'Continuar al ecosistema →'}
            </button>
            <button
              onClick={crearOtraCuenta}
              style={{
                marginTop: 10,
                background: 'none',
                border: 'none',
                color: 'var(--cafe-oscuro)',
                fontSize: 12,
                fontWeight: 'bold',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Crear otra cuenta
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {esCrearCuenta && (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  fontSize: 11.5,
                  color: 'var(--marron-tinta)',
                  lineHeight: 1.4,
                  order: -1,
                }}
              >
                <input
                  type="checkbox"
                  checked={aceptaTerminos}
                  onChange={(e) => setAceptaTerminos(e.target.checked)}
                  style={{ marginTop: 2 }}
                />
                <span>
                  Acepto la{' '}
                  <Link to="/privacidad" target="_blank" style={{ color: 'var(--accion)', fontWeight: 'bold' }}>
                    Política de Privacidad
                  </Link>{' '}
                  y los{' '}
                  <Link to="/terminos" target="_blank" style={{ color: 'var(--accion)', fontWeight: 'bold' }}>
                    Términos y Condiciones
                  </Link>{' '}
                  de Cumbo — necesario para continuar, por Gmail o por correo.
                </span>
              </label>
            )}

            <button
              onClick={continuarConGoogle}
              disabled={esCrearCuenta && !aceptaTerminos}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                background: '#fff',
                border: '1px solid rgba(146,97,55,0.25)',
                borderRadius: 9999,
                padding: 12,
                fontSize: 13,
                fontWeight: 'bold',
                color: 'var(--marron-tinta)',
                cursor: esCrearCuenta && !aceptaTerminos ? 'not-allowed' : 'pointer',
                opacity: esCrearCuenta && !aceptaTerminos ? 0.5 : 1,
              }}
            >
              Continuar con Gmail
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--cafe-oscuro)', fontSize: 11 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(146,97,55,0.2)' }} />
              o ingresa con otro correo
              <div style={{ flex: 1, height: 1, background: 'rgba(146,97,55,0.2)' }} />
            </div>

            {esCrearCuenta && (
              <label
                style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 'bold', color: 'var(--cafe-oscuro)' }}
              >
                Nombre completo
                <div style={campoConIcono}>
                  <User size={16} color="var(--cafe-oscuro)" />
                  <input
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Tu nombre"
                    style={inputSinBorde}
                  />
                </div>
              </label>
            )}

            <label
              style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 'bold', color: 'var(--cafe-oscuro)' }}
            >
              Correo electrónico
              <div style={campoConIcono}>
                <Mail size={16} color="var(--cafe-oscuro)" />
                <input
                  type="email"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  placeholder="tu@correo.com"
                  style={inputSinBorde}
                />
              </div>
            </label>

            <label
              style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 'bold', color: 'var(--cafe-oscuro)' }}
            >
              Contraseña
              <div style={campoConIcono}>
                <Lock size={16} color="var(--cafe-oscuro)" />
                <input
                  type="password"
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  placeholder="••••••••"
                  style={inputSinBorde}
                />
              </div>
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
                }}
              >
                {error}
              </div>
            )}

            <button
              onClick={enviar}
              disabled={cargando}
              className="cumbo-btn"
              style={{
                background: 'var(--accion)',
                color: '#fff',
                border: 'none',
                padding: 14,
                borderRadius: 9999,
                fontSize: 14,
                fontWeight: 'bold',
                cursor: cargando ? 'default' : 'pointer',
                marginTop: 4,
                opacity: cargando ? 0.7 : 1,
              }}
            >
              {cargando ? 'Un momento…' : esCrearCuenta ? 'Crear cuenta' : 'Iniciar sesión'}
            </button>

            <p style={{ fontSize: 10.5, color: 'var(--cafe-oscuro)', textAlign: 'center', lineHeight: 1.5, margin: '2px 0 0' }}>
              Tus datos se guardan solo para tu perfil Cumbo — nunca se comparten sin avisarte.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const campoConIcono = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  border: '1px solid rgba(146,97,55,0.25)',
  borderRadius: 12,
  padding: '11px 14px',
  background: '#fff',
};

const inputSinBorde = {
  border: 'none',
  outline: 'none',
  flex: 1,
  fontSize: 13.5,
  color: 'var(--marron-tinta)',
  background: 'none',
};

function traducirErrorSupabase(e) {
  const msg = e?.message || '';
  if (msg.includes('already registered')) return 'Ya existe una cuenta con ese correo. Intenta iniciar sesión.';
  if (msg.includes('Invalid login credentials')) return 'Correo o contraseña incorrectos.';
  if (msg.includes('Password should be')) return 'La contraseña debe tener al menos 6 caracteres.';
  return 'Algo salió mal. Intenta de nuevo en un momento.';
}
