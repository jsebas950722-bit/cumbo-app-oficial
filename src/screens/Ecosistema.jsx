import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Sparkles, ShoppingBag, MapPin, BookOpen, Users, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useSesion } from '../context/SesionContext';

// Migrado desde: "Ecosistema Cumbo.dc.html"
// Rediseño (a pedido): inspirado en la navegación de Rappi/MercadoLibre.
// Nada de lo que existía se perdió, se reorganizó:
//  - Los menús desplegables "Cumbo ▾" / "Afiliados ▾" desaparecen —
//    todos sus destinos viven ahora en la pestaña Perfil (ver Perfil.jsx)
//  - La barra de navegación inferior antigua se reemplazó por
//    BottomNav.jsx, persistente en toda la app
//  - Las 5 tarjetas de módulo se volvieron categorías en íconos
//    (mismo destino, presentación más compacta)
//  - Se agregó una búsqueda REAL: escribe algo y te lleva al
//    Marketplace con ese texto ya filtrado (antes no existía buscador)
//  - El FAQ y los videos ya NO están escritos en el código — se leen
//    de la tabla `contenido_app` en Supabase, así el CEO los puede
//    editar desde Panel Cumbo sin que un programador toque código
//    (ver pestaña "Contenido" en PanelCumbo.jsx). Se usan estos mismos
//    valores como respaldo mientras carga o si la tabla está vacía.

const VIDEOS_RESPALDO = ['/videos/ecosistema-1.mp4', '/videos/ecosistema-2.mp4'];

const FAQ_RESPALDO = [
  {
    pregunta: '¿Cuánto tarda mi pedido en llegar?',
    respuesta:
      'Depende de la transportadora y tu ciudad — normalmente entre 1 y 4 días hábiles. Puedes rastrear tu guía en el correo de confirmación que te enviamos.',
  },
  { pregunta: '¿Qué métodos de pago aceptan?', respuesta: 'Aceptamos Mercado Pago y Wompi — ambos incluyen tarjeta, PSE, Efecty y más.' },
  {
    pregunta: '¿De dónde viene el café que compro?',
    respuesta:
      'Cada café Cumbo indica la finca, la región y el proceso exactos — puedes ver la trazabilidad completa en la ficha del producto.',
  },
  {
    pregunta: '¿Cómo saben que el café es real?',
    respuesta: 'Cada finca certifica su cultivo con foto, foto del grano y un video — validado por el equipo Cumbo antes de publicarse.',
  },
  {
    pregunta: '¿Puedo devolver un producto?',
    respuesta: 'Sí, si llega dañado o no corresponde a lo pedido. Escríbenos por WhatsApp con tu número de pedido y lo resolvemos.',
  },
  {
    pregunta: '¿Cómo funciona el Agente Sommelier?',
    respuesta:
      'Cumbito te hace unas preguntas sobre tus gustos (o puedes hablarle por voz) y te recomienda el café de nuestro stock que mejor se ajusta a tu paladar.',
  },
];

const CATEGORIAS = [
  { to: '/sommelier', label: 'Sommelier', Icono: Sparkles },
  { to: '/marketplace', label: 'Marketplace', Icono: ShoppingBag },
  { to: '/trazabilidad', label: 'Trazabilidad', Icono: MapPin },
  { to: '/recetario', label: 'Recetario', Icono: BookOpen },
  { to: '/comunidad', label: 'Comunidad', Icono: Users },
];

export default function Ecosistema() {
  const navigate = useNavigate();
  const { sesion } = useSesion();
  const [videos, setVideos] = useState(VIDEOS_RESPALDO);
  const [faqItems, setFaqItems] = useState(FAQ_RESPALDO);
  const [indice, setIndice] = useState(0);
  const [videoSilenciado, setVideoSilenciado] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  const sesionActiva = !!sesion;

  useEffect(() => {
    cargarContenido();
  }, []);

  async function cargarContenido() {
    const { data } = await supabase.from('contenido_app').select('clave, valor').in('clave', ['home_faq', 'home_videos']);
    const videosGuardados = data?.find((d) => d.clave === 'home_videos')?.valor;
    const faqGuardado = data?.find((d) => d.clave === 'home_faq')?.valor;
    if (Array.isArray(videosGuardados) && videosGuardados.length) setVideos(videosGuardados);
    if (Array.isArray(faqGuardado) && faqGuardado.length) setFaqItems(faqGuardado);
  }

  function buscar(e) {
    e.preventDefault();
    navigate(`/marketplace${busqueda.trim() ? `?q=${encodeURIComponent(busqueda.trim())}` : ''}`);
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fondo-calido)' }}>
      {/* Barra superior: logo + búsqueda real */}
      <div style={{ padding: '16px 16px 12px', background: 'var(--superficie)' }}>
        <img src="/assets/logo-cumbo.png" alt="Cumbo" style={{ height: 28, width: 'auto', marginBottom: 12 }} />
        <form
          onSubmit={buscar}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--fondo-calido)',
            borderRadius: 12,
            padding: '10px 14px',
          }}
        >
          <Search size={18} color="var(--cafe-oscuro)" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Busca café, método o accesorio"
            style={{ border: 'none', background: 'none', flex: 1, fontSize: 13.5, color: 'var(--marron-tinta)' }}
          />
        </form>
      </div>

      {/* Carrusel de video */}
      <div style={{ position: 'relative', width: '100%', maxWidth: 440, margin: '0 auto', aspectRatio: '16/9', background: '#000' }}>
        <video
          key={indice}
          src={videos[indice]}
          autoPlay
          loop
          muted={videoSilenciado}
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <button
          onClick={() => setVideoSilenciado((v) => !v)}
          style={{
            position: 'absolute',
            bottom: 10,
            right: 10,
            background: 'rgba(0,0,0,0.5)',
            border: 'none',
            color: '#fff',
            borderRadius: '50%',
            width: 32,
            height: 32,
            cursor: 'pointer',
          }}
        >
          {videoSilenciado ? '🔇' : '🔊'}
        </button>
        <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
          {videos.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndice(i)}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                border: 'none',
                cursor: 'pointer',
                background: i === indice ? 'var(--accion)' : 'rgba(45,27,13,0.2)',
              }}
            />
          ))}
        </div>
      </div>

      {!sesionActiva && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '18px 16px' }}>
          <Link
            to="/ingreso"
            style={{
              width: '100%',
              maxWidth: 440,
              textAlign: 'center',
              fontSize: 14,
              fontWeight: 'bold',
              color: '#fff',
              background: 'var(--accion)',
              textDecoration: 'none',
              borderRadius: 9999,
              padding: '14px 32px',
            }}
          >
            Entrar con ID Cumbo →
          </Link>
        </div>
      )}

      {/* Categorías en íconos */}
      <div style={{ display: 'flex', gap: 18, overflowX: 'auto', padding: '14px 16px', maxWidth: 440, margin: '0 auto' }}>
        {CATEGORIAS.map(({ to, label, Icono }) => (
          <Link
            key={to}
            to={to}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textDecoration: 'none', flexShrink: 0 }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'var(--accion-suave)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icono size={22} color="var(--accion)" />
            </div>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--marron-tinta)', whiteSpace: 'nowrap' }}>{label}</span>
          </Link>
        ))}
      </div>

      {/* Chat de atención al cliente por WhatsApp — reemplaza el FAQ
          visible en la interfaz. Las mismas preguntas que antes eran un
          acordeón acá se usan como accesos rápidos que abren WhatsApp
          con esa pregunta ya escrita. El CEO sigue editando estas
          preguntas desde Panel Cumbo → Contenido, solo que ahora
          alimentan el chat en vez de una sección de la página. */}
      <ChatWhatsApp preguntas={faqItems} />
    </div>
  );
}

// TODO: reemplazar por el número real de atención al cliente de Cumbo
// (formato internacional sin el "+", ej: 573001234567).
const NUMERO_WHATSAPP_ATENCION = '573000000000';

function ChatWhatsApp({ preguntas }) {
  const [abierto, setAbierto] = useState(false);

  function abrirWhatsApp(mensaje) {
    const texto = encodeURIComponent(mensaje);
    window.open(`https://wa.me/${NUMERO_WHATSAPP_ATENCION}?text=${texto}`, '_blank');
    setAbierto(false);
  }

  return (
    <>
      {abierto && (
        <div
          style={{
            position: 'fixed',
            bottom: 84,
            right: 16,
            maxWidth: 300,
            width: 'calc(100% - 32px)',
            background: 'var(--superficie)',
            borderRadius: 16,
            boxShadow: '0 10px 30px rgba(45,27,13,0.25)',
            padding: 16,
            zIndex: 45,
          }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 'bold', color: 'var(--marron-tinta)', marginBottom: 4 }}>¿En qué te ayudamos?</div>
          <p style={{ fontSize: 11.5, color: 'var(--cafe-oscuro)', marginBottom: 10 }}>
            Elige una pregunta o escríbenos directo por WhatsApp.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
            {preguntas.map((f, i) => (
              <button
                key={i}
                onClick={() => abrirWhatsApp(f.pregunta)}
                style={{
                  textAlign: 'left',
                  background: 'var(--fondo-calido)',
                  border: 'none',
                  borderRadius: 10,
                  padding: '9px 11px',
                  fontSize: 12,
                  color: 'var(--marron-tinta)',
                  cursor: 'pointer',
                }}
              >
                {f.pregunta}
              </button>
            ))}
          </div>
          <button
            onClick={() => abrirWhatsApp('Hola, tengo una pregunta sobre Cumbo:')}
            style={{
              width: '100%',
              marginTop: 10,
              background: 'var(--verde-cumbre)',
              color: '#fff',
              border: 'none',
              borderRadius: 9999,
              padding: 10,
              fontSize: 12.5,
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            Escribir directamente
          </button>
        </div>
      )}

      <button
        onClick={() => setAbierto((v) => !v)}
        aria-label="Atención al cliente por WhatsApp"
        style={{
          position: 'fixed',
          bottom: 84,
          right: 16,
          width: 54,
          height: 54,
          borderRadius: '50%',
          background: 'var(--verde-cumbre)',
          border: 'none',
          boxShadow: '0 6px 16px rgba(45,27,13,0.3)',
          cursor: 'pointer',
          zIndex: 46,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MessageCircle color="#fff" size={26} />
      </button>
    </>
  );
}
