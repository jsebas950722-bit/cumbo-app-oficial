import { NavLink } from 'react-router-dom';
import { Home, ShoppingBag, Sparkles, Package, User } from 'lucide-react';
import { useCarrito } from '../context/CarritoContext';

// Navegación inferior persistente, inspirada en Rappi/MercadoLibre/Didi:
// 5 destinos fijos y siempre visibles, en vez de menús desplegables
// escondidos (los "Cumbo ▾" / "Afiliados ▾" del diseño anterior).
// Todo lo que vivía en esos menús (CRM Vendedor, Portal Caficultor,
// Panel Cumbo, Directorio, Logística, Recetario, Trazabilidad,
// Comunidad) sigue existiendo — ahora vive dentro de "Perfil", que es
// donde estas apps agrupan cuentas, historial y ajustes.

const ITEMS = [
  { to: '/', label: 'Home', Icono: Home, fin: true },
  { to: '/marketplace', label: 'Comprar', Icono: ShoppingBag },
  { to: '/sommelier', label: 'Sommelier', Icono: Sparkles },
  { to: '/mis-pedidos', label: 'Pedidos', Icono: Package },
  { to: '/perfil', label: 'Perfil', Icono: User },
];

export default function BottomNav() {
  const { totalUnidades } = useCarrito();

  return (
    <nav
      style={{
        position: 'sticky',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'var(--superficie)',
        borderTop: '1px solid var(--borde-suave)',
        display: 'flex',
        justifyContent: 'space-around',
        padding: '8px 0 10px',
        zIndex: 40,
      }}
    >
      {ITEMS.map(({ to, label, Icono, fin }) => (
        <NavLink
          key={to}
          to={to}
          end={fin}
          style={({ isActive }) => ({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            textDecoration: 'none',
            color: isActive ? 'var(--accion)' : '#a89b89',
            position: 'relative',
            minWidth: 52,
          })}
        >
          <Icono size={21} strokeWidth={2} />
          {to === '/marketplace' && totalUnidades > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -4,
                right: 6,
                background: 'var(--accion)',
                color: '#fff',
                borderRadius: '50%',
                width: 15,
                height: 15,
                fontSize: 9,
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {totalUnidades}
            </span>
          )}
          <span style={{ fontSize: 10, fontWeight: 500 }}>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
