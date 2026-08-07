import { Link } from 'react-router-dom';
import { BookOpen, MapPin, Users, Store, Sprout, LayoutGrid, Contact, Truck, LogOut, LogIn } from 'lucide-react';
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

  const itemsRol = perfil?.rol ? ITEMS_POR_ROL[perfil.rol] || [] : [];
  const yaTieneAccesoAbierto = (to) => itemsRol.some((i) => i.to === to);

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
      </div>
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
