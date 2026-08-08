import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  MapPin,
  Users,
  Store,
  Sprout,
  LayoutGrid,
  Contact,
  Truck,
  LogOut,
  LogIn,
  Shield,
  FileText,
  Trash2,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useSesion } from '../context/SesionContext';

// Pantalla nueva — no estaba en el handoff original ni en el prototipo.
// Reemplaza los menús desplegables "Cumbo ▾" / "Afiliados ▾" que tenía
// Ecosistema: ningún destino se perdió, solo se reorganizaron acá,
// siguiendo el patrón de "Perfil" de Rappi/MercadoLibre — la pestaña
// donde viven cuenta, historial y accesos secundarios.

const ITEMS_TODOS = [
  { to: '/recetario', label: 'Recetario', Icono: BookOpen },
  { to: '/trazabilidad', label: 'Trazabilidad', Icono: MapPin },
  { to: '/comunidad', label: 'Comunidad', Icono: Users },
];

const ITEMS_POR_ROL = {
  caficultor: [{ to: '/portal-caficultor', label: 'Portal Caficultor', Icono: Sprout }],
  vendedor: [{ to: '/crm-vendedor', label: 'CRM Vendedor', Icono: Store }],
  ceo: [
    { to: '/panel', label: 'Panel Cumbo', Icono: LayoutGrid },
    { to: '/directorio-caficultores', label: 'Directorio de caficultores', Icono: Contact },
    { to: '/logistica', label: 'Logística', Icono: Truck },
  ],
  logistica: [{ to: '/logistica', label: 'Logística', Icono: Truck }],
};

// Cualquier persona puede convertirse en caficultor o vendedor al
// publicar su primera finca/producto (ver PortalCaficultor.jsx y
// CRMVendedor.jsx) — así que esos dos accesos se muestran siempre,
// no solo cuando ya se tiene el rol.
const ACCESOS_ABIERTOS = [
  { to: '/portal-caficultor', label: 'Vender mi café (Portal Caficultor)', Icono: Sprout },
  { to: '/crm-vendedor', label: 'Vender equipos (CRM Vendedor)', Icono: Store },
];

export default function Perfil() {
  const { sesion, perfil, nombreCompleto, cerrarSesion } = useSesion();
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState('');

  const itemsRol = perfil?.rol ? ITEMS_POR_ROL[perfil.rol] || [] : [];
  const yaTieneAccesoAbierto = (to) => itemsRol.some((i) => i.to === to);

  async function eliminarCuenta() {
    setEliminando(true);
    setErrorEliminar('');
    try {
      const { data, error } = await supabase.functions.invoke('eliminar-cuenta');
      if (error || data?.error) throw error || new Error(data.error);
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (e) {
      setErrorEliminar('No se pudo eliminar tu cuenta. Intenta de nuevo o escríbenos por WhatsApp.');
      setEliminando(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fondo-calido)' }}>
      <div style={{ padding: '20px 16px 16px', background: 'var(--superficie)' }}>
        <img src="/assets/logo-cumbo.png" alt="Cumbo" style={{ height: 22, width: 'auto', marginBottom: 14 }} />
        {sesion ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'var(--tierra-kraft)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                fontWeight: 'bold',
                color: '#fff',
              }}
            >
              {nombreCompleto.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: 16, color: 'var(--marron-tinta)' }}>{nombreCompleto}</div>
              <div style={{ fontSize: 12, color: 'var(--cafe-oscuro)' }}>{sesion.user.email}</div>
            </div>
          </div>
        ) : (
          <Link
            to="/ingreso"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              textDecoration: 'none',
              color: 'var(--accion)',
              fontWeight: 'bold',
              fontSize: 14,
            }}
          >
            <LogIn size={18} /> Inicia sesión o crea tu cuenta
          </Link>
        )}
      </div>

      <div style={{ padding: '16px' }}>
        <Seccion titulo="Explorar">
          {ITEMS_TODOS.map((i) => (
            <ItemPerfil key={i.to} {...i} />
          ))}
        </Seccion>

        <Seccion titulo="Vender en Cumbo">
          {ACCESOS_ABIERTOS.filter((a) => !yaTieneAccesoAbierto(a.to)).map((i) => (
            <ItemPerfil key={i.to} {...i} to={sesion ? i.to : `/ingreso?next=${i.to}`} />
          ))}
          {itemsRol
            .filter((i) => i.to === '/portal-caficultor' || i.to === '/crm-vendedor')
            .map((i) => (
              <ItemPerfil key={i.to} {...i} />
            ))}
        </Seccion>

        {perfil?.rol && ['ceo', 'logistica'].includes(perfil.rol) && (
          <Seccion titulo="Equipo Cumbo">
            {itemsRol
              .filter((i) => i.to !== '/portal-caficultor' && i.to !== '/crm-vendedor')
              .map((i) => (
                <ItemPerfil key={i.to} {...i} />
              ))}
          </Seccion>
        )}

        {sesion && (
          <button
            onClick={cerrarSesion}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'none',
              border: 'none',
              color: 'var(--canela-oscuro)',
              fontSize: 13.5,
              fontWeight: 'bold',
              cursor: 'pointer',
              padding: '14px 4px',
            }}
          >
            <LogOut size={17} /> Cerrar sesión
          </button>
        )}

        <Seccion titulo="Legal">
          <ItemPerfil to="/privacidad" label="Política de Privacidad" Icono={Shield} />
          <ItemPerfil to="/terminos" label="Términos y Condiciones" Icono={FileText} />
        </Seccion>

        {sesion && (
          <button
            onClick={() => setConfirmandoEliminar(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'none',
              border: 'none',
              color: '#a3947e',
              fontSize: 12.5,
              cursor: 'pointer',
              padding: '4px 4px 14px',
            }}
          >
            <Trash2 size={15} /> Eliminar mi cuenta
          </button>
        )}
      </div>

      {confirmandoEliminar && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 50,
          }}
        >
          <div style={{ background: 'var(--superficie)', borderRadius: 18, padding: 22, maxWidth: 340, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontWeight: 'bold', fontSize: 15, color: 'var(--marron-tinta)' }}>¿Eliminar tu cuenta?</div>
              <button
                onClick={() => setConfirmandoEliminar(false)}
                style={{ background: 'none', border: 'none', color: 'var(--marron-tinta)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--marron-tinta)', lineHeight: 1.5, marginBottom: 16 }}>
              Esto elimina tu cuenta y tus datos personales de forma permanente — incluidas tus fincas o productos publicados, si los
              tienes. No se puede deshacer. Tu historial de pedidos se conserva de forma anónima por obligación contable, sin datos que te
              identifiquen.
            </p>
            {errorEliminar && <p style={{ fontSize: 12, color: 'var(--canela-oscuro)', marginBottom: 12 }}>{errorEliminar}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setConfirmandoEliminar(false)}
                style={{
                  flex: 1,
                  border: '1px solid rgba(146,97,55,0.25)',
                  background: 'none',
                  borderRadius: 9999,
                  padding: 11,
                  fontSize: 13,
                  fontWeight: 'bold',
                  color: 'var(--marron-tinta)',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={eliminarCuenta}
                disabled={eliminando}
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'var(--canela-oscuro)',
                  color: '#fff',
                  borderRadius: 9999,
                  padding: 11,
                  fontSize: 13,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  opacity: eliminando ? 0.7 : 1,
                }}
              >
                {eliminando ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Seccion({ titulo, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 'bold',
          color: 'var(--cafe-oscuro)',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: 8,
          paddingLeft: 4,
        }}
      >
        {titulo}
      </div>
      <div style={{ background: 'var(--superficie)', borderRadius: 16, overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

function ItemPerfil({ to, label, Icono }) {
  return (
    <Link
      to={to}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        textDecoration: 'none',
        color: 'var(--marron-tinta)',
        fontSize: 14,
        fontWeight: 500,
        borderBottom: '1px solid var(--fondo-calido)',
      }}
    >
      <Icono size={19} color="var(--cafe-oscuro)" />
      {label}
    </Link>
  );
}
