import { BrowserRouter, Routes, Route, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { SesionProvider, useSesion } from './context/SesionContext';
import { CarritoProvider } from './context/CarritoContext';
import BottomNav from './components/BottomNav';
import Ingreso from './screens/Ingreso';
import Ecosistema from './screens/Ecosistema';
import Marketplace from './screens/Marketplace';
import Sommelier from './screens/Sommelier';
import PortalCaficultor from './screens/PortalCaficultor';
import PanelCumbo from './screens/PanelCumbo';
import Trazabilidad from './screens/Trazabilidad';
import CRMVendedor from './screens/CRMVendedor';
import Recetario from './screens/Recetario';
import Comunidad from './screens/Comunidad';
import DirectorioCaficultores from './screens/DirectorioCaficultores';
import Logistica from './screens/Logistica';
import MisPedidos from './screens/MisPedidos';
import Perfil from './screens/Perfil';
import PoliticaPrivacidad from './screens/PoliticaPrivacidad';
import TerminosCondiciones from './screens/TerminosCondiciones';

function RutasApp() {
  const { cargando } = useSesion();
  const location = useLocation();

  if (cargando) return null; // TODO: splash screen de Cumbo

  // La navegación inferior persistente no se muestra en Ingreso —
  // esa pantalla es previa a entrar al ecosistema.
  const mostrarNav = location.pathname !== '/ingreso';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Ecosistema />} />
          <Route path="/ingreso" element={<RutaIngreso />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/sommelier" element={<Sommelier />} />
          <Route path="/portal-caficultor" element={<PortalCaficultor />} />
          <Route path="/panel" element={<PanelCumbo />} />
          <Route path="/trazabilidad" element={<Trazabilidad />} />
          <Route path="/crm-vendedor" element={<CRMVendedor />} />
          <Route path="/recetario" element={<Recetario />} />
          <Route path="/comunidad" element={<Comunidad />} />
          <Route path="/directorio-caficultores" element={<DirectorioCaficultores />} />
          <Route path="/logistica" element={<Logistica />} />
          <Route path="/mis-pedidos" element={<MisPedidos />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/privacidad" element={<PoliticaPrivacidad />} />
          <Route path="/terminos" element={<TerminosCondiciones />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {mostrarNav && <BottomNav />}
    </div>
  );
}

function RutaIngreso() {
  const { sesion } = useSesion();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next') || '/';
  if (sesion) return <Navigate to={next} replace />;
  return <Ingreso />;
}

export default function App() {
  return (
    <BrowserRouter>
      <SesionProvider>
        <CarritoProvider>
          <RutasApp />
        </CarritoProvider>
      </SesionProvider>
    </BrowserRouter>
  );
}
