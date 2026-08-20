import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, Mic, Volume2, VolumeX, CheckCircle2, Send, ShoppingBag } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useSesion } from '../context/SesionContext';

// Migrado desde: "Sommelier Cumbo.dc.html"
// Cambios respecto al prototipo:
//  - El perfil de sabor calculado se guarda en Supabase
//    (usuarios.perfil_sabor) cuando hay sesión — ya no solo localStorage.
//  - Los "productos recomendados" ahora se buscan en el catálogo real
//    de Supabase filtrando por región de la finca, en vez del array
//    hardcodeado PRODUCTOS_POR_REGION. Si aún no hay café de esa región
//    en el catálogo, se lo decimos honestamente en vez de inventar datos.
//  - Voz: "Cumbito habla" (text-to-speech) funciona en iOS y Android.
//    El reconocimiento de voz (para responder hablando) solo se activa
//    si el navegador/webview lo soporta — en iOS (WKWebView) no existe
//    todavía, así que el botón de micrófono se oculta ahí en vez de
//    mostrar algo que no funciona.

const REGION_PERFIL = {
  huila: {
    nombre: 'Dulce y Frutal',
    descripcion:
      'Notas de fruta madura y un dulzor natural — panela, mora y cítricos suaves. Cultivado en ladera sobre los 1.400 msnm, con variedad Castillo y Pink Bourbon de proceso lavado, que resalta acidez dulce y aromas intensos.',
    tags: ['Panela', 'Mora', 'Cítricos'],
    region: 'Huila',
    metodoRecomendado: 'V60',
    tueste: 'claro',
  },
  tolima: {
    nombre: 'Achocolatado',
    descripcion:
      'Cuerpo denso, cacao y nuez. Variedad Castillo de proceso lavado, con tueste medio que resalta cuerpo sobre acidez — el clásico "café de toda la vida".',
    tags: ['Cacao', 'Caramelo', 'Nuez'],
    region: 'Tolima',
    metodoRecomendado: 'Prensa francesa',
    tueste: 'oscuro',
  },
  narino: {
    nombre: 'Suave y Floral',
    descripcion:
      'Aromas a jazmín y té negro, acidez delicada. Cultivado en algunas de las mayores alturas de Colombia (hasta 2.300 msnm), lo que ralentiza la maduración y concentra azúcares — referente en café de especialidad.',
    tags: ['Jazmín', 'Té negro', 'Acidez suave'],
    region: 'Nariño',
    metodoRecomendado: 'V60',
    tueste: 'claro',
  },
  cauca: {
    nombre: 'Caramelizado',
    descripcion:
      'Dulzura de caramelo y almendra tostada. Proceso natural (secado en cereza completa), que aporta cuerpo y dulzor sin perder balance.',
    tags: ['Caramelo', 'Almendra', 'Balance'],
    region: 'Cauca',
    metodoRecomendado: 'Chemex',
    tueste: 'medio',
  },
  santander: {
    nombre: 'Tostado e Intenso',
    descripcion:
      'Notas de canela y clavo, cuerpo robusto. Cultivado con más sombra por su fuerte exposición solar, con tueste medio-oscuro que acentúa las notas especiadas.',
    tags: ['Canela', 'Clavo', 'Cuerpo firme'],
    region: 'Santander',
    metodoRecomendado: 'Moka',
    tueste: 'oscuro',
  },
  eje: {
    nombre: 'Balanceado',
    descripcion:
      'Perfil medio, cuerpo equilibrado y notas dulces. Variedad Caturra y Castillo de proceso lavado — la región cafetera más emblemática del país.',
    tags: ['Equilibrio', 'Dulzura', 'Cuerpo medio'],
    region: 'Eje Cafetero',
    metodoRecomendado: 'Cafetera',
    tueste: 'medio',
  },
};

const TUESTE_INFO = {
  claro: { nombre: 'Claro', descripcion: 'resalta acidez y notas frutales/florales, cuerpo más ligero' },
  medio: { nombre: 'Medio', descripcion: 'balance entre acidez y cuerpo, el más versátil' },
  oscuro: { nombre: 'Oscuro', descripcion: 'más cuerpo y notas tostadas/achocolatadas, menos acidez' },
};

const PREGUNTAS = [
  {
    texto: '¿Qué método de preparación preferís (o te gustaría probar)?',
    opciones: [
      { texto: 'V60 — resalta acidez y notas frutales', scores: { huila: 2 } },
      { texto: 'Chemex — taza limpia, delicada y floral', scores: { narino: 2 } },
      { texto: 'Prensa francesa — cuerpo denso, con más textura', scores: { tolima: 2 } },
      { texto: 'Moka o cafetera italiana — intenso y directo', scores: { santander: 2 } },
      { texto: 'Cafetera de goteo tradicional — el de todos los días', scores: { eje: 2 } },
      { texto: 'AeroPress — versátil, dulce y suave', scores: { cauca: 2 } },
    ],
  },
  {
    texto: '¿Qué tan fuerte te gusta el café?',
    opciones: [
      { texto: 'Fuerte, con cuerpo alto y poca acidez', scores: { santander: 2 } },
      { texto: 'Suave y jugoso, con acidez brillante', scores: { huila: 2 } },
      { texto: 'Con cuerpo denso y cálido', scores: { tolima: 2 } },
      { texto: 'Delicado, con acidez suave', scores: { narino: 2 } },
      { texto: 'Balanceado, ni muy fuerte ni muy suave', scores: { eje: 2 } },
      { texto: 'Dulce, con cuerpo medio', scores: { cauca: 2 } },
    ],
  },
  {
    texto: '¿Qué notas buscás en la taza?',
    opciones: [
      { texto: 'Frutal y dulce — mora, cítricos', scores: { huila: 2 } },
      { texto: 'Achocolatado — cacao y nuez', scores: { tolima: 2 } },
      { texto: 'Floral — jazmín y té negro', scores: { narino: 2 } },
      { texto: 'Caramelo y almendra tostada', scores: { cauca: 2 } },
      { texto: 'Especiado — canela y clavo', scores: { santander: 2 } },
      { texto: 'Equilibrado, sin una nota que domine', scores: { eje: 2 } },
    ],
  },
  {
    texto: '¿Qué tueste preferís?',
    opciones: [
      { texto: 'Claro — más ácido, resalta lo frutal y floral', scores: { huila: 1, narino: 1 } },
      { texto: 'Medio — balance entre acidez y cuerpo', scores: { cauca: 1, eje: 1 } },
      { texto: 'Oscuro — más cuerpo, notas tostadas, menos acidez', scores: { tolima: 1, santander: 1 } },
    ],
  },
];

const PERFILES_REGION = [
  {
    nombre: 'Dulce y frutal',
    region: 'Huila',
    descripcion: 'Notas de panela, mora y cítricos suaves. Denominación de Origen por su acidez dulce e intensos aromas.',
    ficha: [
      {
        titulo: 'Suelo',
        texto: 'Suelos volcánicos jóvenes del Macizo Colombiano, muy ricos en minerales — dan dulzura y complejidad de sabor.',
      },
      {
        titulo: 'Altitud',
        texto: '1600–2000 msnm. La altura y el clima estable maduran el grano despacio, concentrando azúcares y acidez frutal.',
      },
      { titulo: 'Proceso', texto: 'Predomina el lavado — resalta la fruta y la acidez dulce características de la región.' },
    ],
  },
  {
    nombre: 'Achocolatado',
    region: 'Tolima',
    descripcion: 'Cuerpo denso, cacao y nuez. El clásico "café de toda la vida", cálido y reconfortante.',
    ficha: [
      {
        titulo: 'Suelo',
        texto: 'Suelos de origen volcánico y aluvial en las estribaciones de la Cordillera Central, con buena retención de nutrientes.',
      },
      { titulo: 'Altitud', texto: '1200–1800 msnm, con zonas de camas elevadas. Da cuerpo denso y notas achocolatadas más que acidez.' },
      { titulo: 'Proceso', texto: 'Beneficio lavado tradicional, con secado al sol en su mayoría — perfil limpio y de cuerpo firme.' },
    ],
  },
  {
    nombre: 'Floral',
    region: 'Nariño',
    descripcion: 'Aromas a jazmín y té negro, acidez delicada. Cafés de altura, referente en café de especialidad.',
    ficha: [
      { titulo: 'Suelo', texto: 'Suelos volcánicos derivados de cenizas del complejo Galeras-Doña Juana, muy fértiles y de buen drenaje.' },
      {
        titulo: 'Altitud',
        texto: 'Hasta 2300 msnm, de las más altas de Colombia. Maduración lenta que produce acidez brillante y notas florales.',
      },
      {
        titulo: 'Proceso',
        texto: 'Lavado meticuloso, secado lento en camas africanas — cuidado artesanal típico de los caficultores nariñenses.',
      },
    ],
  },
  {
    nombre: 'Caramelizado',
    region: 'Cauca',
    descripcion: 'Dulzura de caramelo y almendra tostada. Un balance suave entre acidez y cuerpo.',
    ficha: [
      { titulo: 'Suelo', texto: 'Suelos volcánicos de la Cordillera Central y Occidental, con buena presencia de materia orgánica.' },
      { titulo: 'Altitud', texto: '1500–2000 msnm en su mayoría minifundios. Da un balance entre dulzura de caramelo y cuerpo medio.' },
      { titulo: 'Proceso', texto: 'Lavado tradicional en fincas de especialidad, buscando resaltar el dulzor natural del grano.' },
    ],
  },
  {
    nombre: 'Especiado',
    region: 'Santander',
    descripcion: 'Notas de canela y clavo, cuerpo robusto. Cultivado con más sombra por su fuerte exposición solar.',
    ficha: [
      { titulo: 'Suelo', texto: 'Suelos más secos y pedregosos de la cordillera Oriental, con menor humedad que otras zonas cafeteras.' },
      { titulo: 'Altitud', texto: '1200–1700 msnm, con más exposición solar directa — cultivo bajo sombra para proteger el grano.' },
      { titulo: 'Proceso', texto: 'Beneficio lavado; el estrés hídrico moderado concentra notas especiadas y cuerpo robusto.' },
    ],
  },
  {
    nombre: 'Balanceado',
    region: 'Eje Cafetero (Caldas, Risaralda, Quindío)',
    descripcion: 'Perfil medio, cuerpo equilibrado y notas dulces. La región cafetera más emblemática del país.',
    ficha: [
      { titulo: 'Suelo', texto: 'Suelos volcánicos derivados de cenizas del Nevado del Ruiz — de los más fértiles del país para el café.' },
      { titulo: 'Altitud', texto: '1200–1900 msnm con clima muy estable todo el año, ideal para un perfil parejo y equilibrado.' },
      { titulo: 'Proceso', texto: 'Lavado tradicional consolidado por generaciones — la base del "café de toda la vida" colombiano.' },
    ],
  },
  {
    nombre: 'Suave y limpio',
    region: 'Antioquia',
    descripcion: 'Notas a panela y frutos secos, acidez media. Tradición cafetera con enfoque en innovación.',
    ficha: [
      { titulo: 'Suelo', texto: 'Suelos volcánicos y graníticos variados según la subregión, con buen drenaje natural en ladera.' },
      { titulo: 'Altitud', texto: '1300–2000 msnm. Diversidad de microclimas que da tazas limpias con acidez media.' },
      { titulo: 'Proceso', texto: 'Lavado con creciente experimentación en natural en fincas de especialidad.' },
    ],
  },
  {
    nombre: 'Cítrico y brillante',
    region: 'Valle del Cauca',
    descripcion: 'Acidez cítrica marcada, cuerpo ligero. Cafés vibrantes de las laderas andinas.',
    ficha: [
      { titulo: 'Suelo', texto: 'Suelos volcánicos de ladera en la Cordillera Occidental y Central, con buena permeabilidad.' },
      { titulo: 'Altitud', texto: '1400–2000 msnm cerca del valle del río Cauca — climas frescos que realzan la acidez cítrica.' },
      { titulo: 'Proceso', texto: 'Lavado predominante, con tazas vibrantes y cuerpo ligero.' },
    ],
  },
  {
    nombre: 'Herbal y suave',
    region: 'Cundinamarca',
    descripcion: 'Notas herbales y de nuez, cuerpo ligero a medio. Cultivos de montaña cerca de la capital.',
    ficha: [
      { titulo: 'Suelo', texto: 'Suelos de origen sedimentario y volcánico en la Cordillera Oriental, cerca de la Sabana de Bogotá.' },
      { titulo: 'Altitud', texto: '1200–1900 msnm, con temperaturas más frías — maduración lenta y perfil suave.' },
      { titulo: 'Proceso', texto: 'Beneficio lavado tradicional en fincas pequeñas de la región.' },
    ],
  },
  {
    nombre: 'Dulce y almendrado',
    region: 'Boyacá',
    descripcion: 'Notas de almendra y panela, acidez suave. Cafés de altura con producción artesanal.',
    ficha: [
      { titulo: 'Suelo', texto: 'Suelos de origen sedimentario y volcánico en los valles andinos boyacenses.' },
      { titulo: 'Altitud', texto: 'Hasta 2000 msnm, entre las zonas más altas y frías cultivadas — grano de maduración muy lenta.' },
      { titulo: 'Proceso', texto: 'Lavado artesanal en pequeñas fincas familiares, con secado natural al sol.' },
    ],
  },
  {
    nombre: 'Amaderado',
    region: 'Santanderes del norte y Sierra Nevada (Cesar, Guajira, Magdalena)',
    descripcion: 'Cuerpo alto, notas amaderadas y menor acidez. Cultivos cerca de la Sierra Nevada de Santa Marta.',
    ficha: [
      { titulo: 'Suelo', texto: 'Suelos de origen metamórfico y volcánico en las faldas de la Sierra Nevada de Santa Marta.' },
      { titulo: 'Altitud', texto: '900–1600 msnm con mayor calor — cuerpo alto, menor acidez y notas amaderadas.' },
      { titulo: 'Proceso', texto: 'Lavado bajo sombra intensiva, necesaria por la fuerte radiación solar de la zona.' },
    ],
  },
];

const METODOS = {
  v60: { nombre: 'V60', ratio: 16 },
  chemex: { nombre: 'Chemex', ratio: 17 },
  prensa: { nombre: 'Prensa francesa', ratio: 15 },
  aeropress: { nombre: 'AeroPress', ratio: 14 },
  frio: { nombre: 'Café frío', ratio: 8 },
  moka: { nombre: 'Moka', ratio: 10 },
  cafetera: { nombre: 'Cafetera', ratio: 16 },
  drip: { nombre: 'Café de goteo (Drip)', ratio: 16 },
  capsulas: { nombre: 'Cápsulas', ratio: 12 },
};

const VARIETALES = [
  { id: 'castillo', nombre: 'Castillo', ajuste: 0 },
  { id: 'caturra', nombre: 'Caturra', ajuste: 0 },
  { id: 'pink_bourbon', nombre: 'Pink Bourbon', ajuste: 1 },
  { id: 'tipica', nombre: 'Típica', ajuste: 1 },
];

const NOTAS_PERFIL = [
  { id: 'floral', nombre: 'Floral / Cítrico', ajuste: 2 },
  { id: 'frutal', nombre: 'Frutal / Dulce', ajuste: 1 },
  { id: 'caramelizado', nombre: 'Caramelizado', ajuste: 0 },
];

const SCORES_INICIALES = {
  huila: 0,
  tolima: 0,
  narino: 0,
  cauca: 0,
  santander: 0,
  eje: 0,
};

function calcularPerfil(scores) {
  const claves = Object.keys(REGION_PERFIL);
  const max = Math.max(...claves.map((k) => scores[k] || 0));
  const empatados = claves.filter((k) => (scores[k] || 0) === max);
  const elegido = empatados[Math.floor(Math.random() * empatados.length)];
  return REGION_PERFIL[elegido];
}

const reconocimientoVozDisponible = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

function hablar(texto) {
  try {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'es-CO';
    u.rate = 1;
    u.pitch = 0.9;
    window.speechSynthesis.speak(u);
  } catch {
    /* TTS no disponible — degradar en silencio */
  }
}

export default function Sommelier() {
  const { sesion } = useSesion();
  const [tab, setTab] = useState('sommelier'); // 'sommelier' | 'calculadora' | 'regiones'

  // --- Quiz ---
  const [fase, setFase] = useState('intro'); // 'intro' | 'preguntas' | 'resultado' | 'chat'
  const [mensajesChat, setMensajesChat] = useState([]);
  const [textoChat, setTextoChat] = useState('');
  const [enviandoChat, setEnviandoChat] = useState(false);
  const [productoRecomendado, setProductoRecomendado] = useState(null);
  const [paso, setPaso] = useState(0);
  const [scores, setScores] = useState(SCORES_INICIALES);
  const [escuchando, setEscuchando] = useState(false);
  const [vozActiva, setVozActiva] = useState(true);
  const [productosRecomendados, setProductosRecomendados] = useState([]);
  const [buscandoProductos, setBuscandoProductos] = useState(false);
  const [guardadoPerfil, setGuardadoPerfil] = useState(false);

  const perfilResultado = useMemo(() => (fase === 'resultado' ? calcularPerfilEstable(scores) : null), [fase, scores]);

  function calcularPerfilEstable(s) {
    // Igual que calcularPerfil pero memorizado dentro del render para no
    // recalcular con un valor aleatorio distinto en cada re-render.
    return calcularPerfil(s);
  }

  function elegirOpcion(opcion) {
    const nuevoScores = { ...scores };
    Object.keys(opcion.scores).forEach((k) => {
      nuevoScores[k] = (nuevoScores[k] || 0) + opcion.scores[k];
    });
    const siguientePaso = paso + 1;
    setScores(nuevoScores);
    setPaso(siguientePaso);

    if (siguientePaso >= PREGUNTAS.length) {
      const perfil = calcularPerfil(nuevoScores);
      setFase('resultado');
      if (vozActiva) hablar(`¡Ya te descubrí! Tu taza ideal es ${perfil.nombre}, un café de ${perfil.region}. ${perfil.descripcion}`);
    } else if (vozActiva) {
      hablar(PREGUNTAS[siguientePaso].texto);
    }
  }

  function reiniciar() {
    setPaso(0);
    setFase('intro');
    setScores(SCORES_INICIALES);
    setProductosRecomendados([]);
    setGuardadoPerfil(false);
    setMensajesChat([]);
    setProductoRecomendado(null);
  }

  async function enviarMensajeChat() {
    if (!textoChat.trim() || enviandoChat) return;
    const nuevosMensajes = [...mensajesChat, { rol: 'usuario', texto: textoChat.trim() }];
    setMensajesChat(nuevosMensajes);
    setTextoChat('');
    setEnviandoChat(true);
    try {
      const { data, error } = await supabase.functions.invoke('sommelier-chat', { body: { mensajes: nuevosMensajes } });
      if (error || data?.error) {
        setMensajesChat((prev) => [...prev, { rol: 'cumbito', texto: 'No pude responder justo ahora — intenta de nuevo en un momento.' }]);
      } else {
        setMensajesChat((prev) => [...prev, { rol: 'cumbito', texto: data.texto }]);
        if (data.producto_recomendado_id) {
          const { data: producto } = await supabase
            .from('productos')
            .select('id, nombre, precio, fincas(region, proceso)')
            .eq('id', data.producto_recomendado_id)
            .single();
          setProductoRecomendado(producto || null);
        }
      }
    } finally {
      setEnviandoChat(false);
    }
  }

  function toggleEscucha() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (escuchando) {
      try {
        window.__cumboRecon?.stop();
      } catch {
        /* noop */
      }
      setEscuchando(false);
      return;
    }
    try {
      const recon = new SR();
      recon.lang = 'es-CO';
      recon.interimResults = false;
      recon.maxAlternatives = 1;
      recon.onresult = (ev) => {
        const texto = ev.results[0][0].transcript.toLowerCase();
        setEscuchando(false);
        const pregunta = PREGUNTAS[paso];
        if (!pregunta) return;
        // Empareja la respuesta hablada con la opción cuyo texto se
        // parece más (coincidencia simple de palabras).
        const opcion =
          pregunta.opciones.find((o) => texto.includes(o.texto.toLowerCase().split(' ').slice(0, 3).join(' '))) || pregunta.opciones[0];
        elegirOpcion(opcion);
      };
      recon.onerror = () => setEscuchando(false);
      recon.onend = () => setEscuchando(false);
      window.__cumboRecon = recon;
      recon.start();
      setEscuchando(true);
    } catch {
      setEscuchando(false);
    }
  }

  // Guardar el perfil de sabor en Supabase cuando llegamos al resultado
  useEffect(() => {
    if (fase !== 'resultado' || !perfilResultado || !sesion) return;
    guardarPerfilEnSupabase();
    buscarProductosDeRegion(perfilResultado.region);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  async function guardarPerfilEnSupabase() {
    if (!sesion) return;
    await supabase
      .from('usuarios')
      .update({ perfil_sabor: { scores, region: perfilResultado.region, calculado_en: new Date().toISOString() } })
      .eq('id', sesion.user.id);
    setGuardadoPerfil(true);
  }

  async function buscarProductosDeRegion(region) {
    setBuscandoProductos(true);
    const { data } = await supabase.from('productos').select('*, fincas(nombre_finca, region, proceso)').eq('tipo', 'cafe_finca');
    const filtrados = (data || []).filter((p) => p.fincas?.region === region);
    setProductosRecomendados(filtrados);
    setBuscandoProductos(false);
  }

  // --- Calculadora ---
  const [metodo, setMetodo] = useState('v60');
  const [tazas, setTazas] = useState(2);
  const [varietal, setVarietal] = useState('castillo');
  const [notaPerfil, setNotaPerfil] = useState('frutal');

  const varietalInfo = VARIETALES.find((v) => v.id === varietal) || VARIETALES[0];
  const notaInfo = NOTAS_PERFIL.find((n) => n.id === notaPerfil) || NOTAS_PERFIL[1];
  const ratio = Math.max(6, METODOS[metodo].ratio + varietalInfo.ajuste + notaInfo.ajuste);
  const gramosAgua = tazas * 150;
  const gramosCafe = Math.round((gramosAgua / ratio) * 10) / 10;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fondo-calido)', paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'var(--superficie)' }}>
        <Link to="/" style={{ color: 'var(--marron-tinta)', display: 'flex' }}>
          <ArrowLeft size={20} />
        </Link>
        <div style={{ fontWeight: 'bold', fontSize: 15, color: 'var(--marron-tinta)', flex: 1 }}>Agente Sommelier</div>
        <img src="/assets/logo-cumbo.png" alt="Cumbo" style={{ height: 22, width: 'auto' }} />
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '14px 16px 6px', maxWidth: 440, margin: '0 auto' }}>
        {[
          { id: 'sommelier', label: 'Sommelier' },
          { id: 'calculadora', label: 'Calculadora' },
          { id: 'regiones', label: 'Regiones' },
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
              background: tab === t.id ? 'var(--accion)' : '#fff',
              color: tab === t.id ? '#fff' : 'var(--cafe-oscuro)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 440, margin: '0 auto', padding: '10px 16px' }}>
        {/* ================= TAB SOMMELIER ================= */}
        {tab === 'sommelier' && (
          <>
            {fase === 'intro' && (
              <div style={{ background: '#fff', borderRadius: 20, padding: 22, textAlign: 'center' }}>
                <div
                  style={{
                    width: 60,
                    height: 60,
                    margin: '0 auto 10px',
                    borderRadius: '50%',
                    background: 'var(--accion-suave)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Sparkles size={28} color="var(--accion)" />
                </div>
                <div
                  style={{
                    fontFamily: 'Georgia, serif',
                    fontStyle: 'italic',
                    fontSize: 18,
                    color: 'var(--canela-oscuro)',
                    marginBottom: 8,
                  }}
                >
                  Hola, soy Cumbito
                </div>
                <p style={{ fontSize: 13, color: 'var(--marron-tinta)', lineHeight: 1.5, marginBottom: 16 }}>
                  Cuéntame tus gustos con 5 preguntas rápidas y te recomiendo el café colombiano que mejor se ajusta a tu paladar.
                </p>
                <button
                  onClick={() => {
                    setFase('preguntas');
                    if (vozActiva) hablar(PREGUNTAS[0].texto);
                  }}
                  className="cumbo-btn"
                  style={botonPrimario}
                >
                  Empezar
                </button>
                <button
                  onClick={() => setFase('chat')}
                  className="cumbo-btn"
                  style={{
                    ...botonPrimario,
                    background: 'none',
                    border: '1.5px solid var(--accion)',
                    color: 'var(--accion)',
                    marginTop: 8,
                  }}
                >
                  O cuéntame en tus palabras
                </button>
                <button
                  onClick={() => setVozActiva((v) => !v)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 10,
                    background: 'none',
                    border: 'none',
                    color: 'var(--cafe-oscuro)',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {vozActiva ? <Volume2 size={14} /> : <VolumeX size={14} />}
                  {vozActiva ? 'Voz de Cumbito activada' : 'Voz de Cumbito desactivada'}
                </button>
              </div>
            )}

            {fase === 'preguntas' && (
              <div style={{ background: '#fff', borderRadius: 20, padding: 22 }}>
                <div style={{ fontSize: 11, color: 'var(--cafe-oscuro)', marginBottom: 6 }}>
                  Pregunta {paso + 1} de {PREGUNTAS.length}
                </div>
                <div style={{ fontSize: 15, fontWeight: 'bold', color: 'var(--marron-tinta)', marginBottom: 14 }}>
                  {PREGUNTAS[paso].texto}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {PREGUNTAS[paso].opciones.map((op, i) => (
                    <button
                      key={i}
                      onClick={() => elegirOpcion(op)}
                      style={{
                        textAlign: 'left',
                        border: '1.5px solid rgba(146,97,55,0.25)',
                        borderRadius: 14,
                        padding: '12px 14px',
                        fontSize: 13,
                        color: 'var(--marron-tinta)',
                        background: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      {op.texto}
                    </button>
                  ))}
                </div>
                {reconocimientoVozDisponible && (
                  <button
                    onClick={toggleEscucha}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      marginTop: 14,
                      width: '100%',
                      border: 'none',
                      borderRadius: 9999,
                      padding: 10,
                      fontSize: 12.5,
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      background: escuchando ? 'var(--canela-oscuro)' : 'var(--fondo-calido)',
                      color: escuchando ? '#fff' : 'var(--cafe-oscuro)',
                    }}
                  >
                    <Mic size={14} /> {escuchando ? 'Escuchando…' : 'Responder por voz'}
                  </button>
                )}
              </div>
            )}

            {fase === 'chat' && (
              <div style={{ background: '#fff', borderRadius: 20, padding: 18, display: 'flex', flexDirection: 'column', height: 420 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <button
                    onClick={reiniciar}
                    style={{ background: 'none', border: 'none', color: 'var(--cafe-oscuro)', cursor: 'pointer', display: 'flex' }}
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--marron-tinta)' }}>Cuéntale a Cumbito</div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {mensajesChat.length === 0 && (
                    <div style={{ fontSize: 12.5, color: 'var(--cafe-oscuro)', textAlign: 'center', marginTop: 20 }}>
                      Contale qué te gusta: ¿café suave o intenso? ¿con notas frutales, dulces o achocolatadas? ¿cómo lo preparás?
                    </div>
                  )}
                  {mensajesChat.map((m, i) => (
                    <div
                      key={i}
                      style={{
                        alignSelf: m.rol === 'usuario' ? 'flex-end' : 'flex-start',
                        maxWidth: '80%',
                        background: m.rol === 'usuario' ? 'var(--accion)' : 'var(--fondo-calido)',
                        color: m.rol === 'usuario' ? '#fff' : 'var(--marron-tinta)',
                        borderRadius: 14,
                        padding: '9px 12px',
                        fontSize: 13,
                      }}
                    >
                      {m.texto}
                    </div>
                  ))}
                  {enviandoChat && <div style={{ fontSize: 12, color: 'var(--cafe-oscuro)' }}>Cumbito está pensando…</div>}

                  {productoRecomendado && (
                    <div style={{ background: 'var(--accion-suave)', borderRadius: 14, padding: 12, marginTop: 4 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12.5,
                          fontWeight: 'bold',
                          color: 'var(--marron-tinta)',
                          marginBottom: 4,
                        }}
                      >
                        <ShoppingBag size={14} /> {productoRecomendado.nombre}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--cafe-oscuro)', marginBottom: 8 }}>
                        {productoRecomendado.fincas?.region} · {productoRecomendado.fincas?.proceso} · ${productoRecomendado.precio}
                      </div>
                      <Link
                        to="/marketplace"
                        style={{
                          display: 'inline-block',
                          background: 'var(--accion)',
                          color: '#fff',
                          borderRadius: 999,
                          padding: '8px 16px',
                          fontSize: 12,
                          fontWeight: 'bold',
                          textDecoration: 'none',
                        }}
                      >
                        Ver en el Marketplace
                      </Link>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={textoChat}
                    onChange={(e) => setTextoChat(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && enviarMensajeChat()}
                    placeholder="Escribe acá…"
                    style={{ flex: 1, border: '1px solid rgba(146,97,55,0.25)', borderRadius: 999, padding: '10px 14px', fontSize: 13 }}
                  />
                  <button
                    onClick={enviarMensajeChat}
                    disabled={enviandoChat || !textoChat.trim()}
                    style={{
                      background: 'var(--accion)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '50%',
                      width: 38,
                      height: 38,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      opacity: enviandoChat || !textoChat.trim() ? 0.5 : 1,
                    }}
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            )}

            {fase === 'resultado' && perfilResultado && (
              <div style={{ background: '#fff', borderRadius: 20, padding: 22 }}>
                <div style={{ fontSize: 11, color: 'var(--cafe-oscuro)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                  Tu taza ideal
                </div>
                <div
                  style={{
                    fontFamily: 'Georgia, serif',
                    fontStyle: 'italic',
                    fontSize: 20,
                    color: 'var(--canela-oscuro)',
                    marginBottom: 6,
                  }}
                >
                  {perfilResultado.nombre}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--cafe-oscuro)', marginBottom: 10 }}>Café de {perfilResultado.region}</div>
                <p style={{ fontSize: 13, color: 'var(--marron-tinta)', lineHeight: 1.5, marginBottom: 10 }}>
                  {perfilResultado.descripcion}
                </p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                  {perfilResultado.tags.map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: 11,
                        background: 'var(--fondo-calido)',
                        color: 'var(--cafe-oscuro)',
                        borderRadius: 9999,
                        padding: '4px 10px',
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--marron-tinta)', marginBottom: 14 }}>
                  Método recomendado: <strong>{perfilResultado.metodoRecomendado}</strong> · Tueste ideal:{' '}
                  <strong>{TUESTE_INFO[perfilResultado.tueste]?.nombre}</strong>
                </div>

                <div style={{ fontSize: 12.5, fontWeight: 'bold', color: 'var(--cafe-oscuro)', marginBottom: 8 }}>
                  Disponible ahora en el Marketplace
                </div>
                {buscandoProductos ? (
                  <p style={{ fontSize: 12.5, color: 'var(--cafe-oscuro)' }}>Buscando…</p>
                ) : productosRecomendados.length > 0 ? (
                  productosRecomendados.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 0',
                        borderBottom: '1px solid #f0e9dd',
                        fontSize: 13,
                      }}
                    >
                      <span>{p.nombre}</span>
                      <span style={{ fontWeight: 'bold' }}>${p.precio.toLocaleString('es-CO')}</span>
                    </div>
                  ))
                ) : (
                  <p style={{ fontSize: 12.5, color: 'var(--cafe-oscuro)' }}>
                    Todavía no tenemos café de {perfilResultado.region} en el catálogo — muy pronto se suman más fincas.
                  </p>
                )}

                {!sesion && (
                  <p style={{ fontSize: 11, color: 'var(--cafe-oscuro)', marginTop: 10 }}>
                    <Link to="/ingreso" style={{ color: 'var(--cafe-oscuro)', fontWeight: 'bold' }}>
                      Inicia sesión
                    </Link>{' '}
                    para guardar este perfil en tu cuenta.
                  </p>
                )}
                {sesion && guardadoPerfil && (
                  <p style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--exito)', marginTop: 10 }}>
                    <CheckCircle2 size={13} /> Perfil guardado en tu cuenta Cumbo.
                  </p>
                )}

                <Link
                  to="/marketplace"
                  className="cumbo-btn"
                  style={{ ...botonPrimario, display: 'block', textDecoration: 'none', textAlign: 'center', marginTop: 14 }}
                >
                  Ir al Marketplace →
                </Link>
                <button
                  onClick={reiniciar}
                  style={{
                    marginTop: 10,
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    color: 'var(--cafe-oscuro)',
                    fontSize: 12.5,
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Volver a intentar
                </button>
              </div>
            )}
          </>
        )}

        {/* ================= TAB CALCULADORA ================= */}
        {tab === 'calculadora' && (
          <div style={{ background: '#fff', borderRadius: 20, padding: 22 }}>
            <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--marron-tinta)', marginBottom: 10 }}>Método</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {Object.entries(METODOS).map(([k, m]) => (
                <button
                  key={k}
                  onClick={() => setMetodo(k)}
                  style={{
                    border: 'none',
                    borderRadius: 9999,
                    padding: '7px 12px',
                    fontSize: 11.5,
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    background: metodo === k ? 'var(--accion)' : 'var(--fondo-calido)',
                    color: metodo === k ? '#fff' : 'var(--cafe-oscuro)',
                  }}
                >
                  {m.nombre}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--marron-tinta)', marginBottom: 8 }}>Tazas (150ml c/u)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <button onClick={() => setTazas((t) => Math.max(1, t - 1))} style={botonCantidadStyle}>
                −
              </button>
              <span style={{ fontSize: 16, fontWeight: 'bold' }}>{tazas}</span>
              <button onClick={() => setTazas((t) => Math.min(12, t + 1))} style={botonCantidadStyle}>
                +
              </button>
            </div>

            <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--marron-tinta)', marginBottom: 8 }}>Varietal</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {VARIETALES.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVarietal(v.id)}
                  style={{
                    border: 'none',
                    borderRadius: 9999,
                    padding: '7px 12px',
                    fontSize: 11.5,
                    cursor: 'pointer',
                    background: varietal === v.id ? 'var(--accion)' : 'var(--fondo-calido)',
                    color: varietal === v.id ? '#fff' : 'var(--cafe-oscuro)',
                  }}
                >
                  {v.nombre}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--marron-tinta)', marginBottom: 8 }}>Nota de perfil que buscas</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
              {NOTAS_PERFIL.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setNotaPerfil(n.id)}
                  style={{
                    border: 'none',
                    borderRadius: 9999,
                    padding: '7px 12px',
                    fontSize: 11.5,
                    cursor: 'pointer',
                    background: notaPerfil === n.id ? 'var(--accion)' : 'var(--fondo-calido)',
                    color: notaPerfil === n.id ? '#fff' : 'var(--cafe-oscuro)',
                  }}
                >
                  {n.nombre}
                </button>
              ))}
            </div>

            <div style={{ background: 'var(--fondo-calido)', borderRadius: 16, padding: 18, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--cafe-oscuro)', textTransform: 'uppercase', letterSpacing: 1 }}>
                Ratio recomendado
              </div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--marron-tinta)', margin: '4px 0' }}>1:{ratio}</div>
              <div style={{ fontSize: 13, color: 'var(--marron-tinta)' }}>
                {gramosCafe} g de café · {gramosAgua} ml de agua
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB REGIONES ================= */}
        {tab === 'regiones' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {PERFILES_REGION.map((r) => (
              <div key={r.region} style={{ background: '#fff', borderRadius: 18, padding: 16 }}>
                <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 15, color: 'var(--canela-oscuro)' }}>
                  {r.nombre}
                </div>
                <div style={{ fontSize: 12, color: 'var(--cafe-oscuro)', marginBottom: 6 }}>{r.region}</div>
                <p style={{ fontSize: 12.5, color: 'var(--marron-tinta)', lineHeight: 1.5, marginBottom: 8 }}>{r.descripcion}</p>
                {r.ficha.map((f) => (
                  <div key={f.titulo} style={{ fontSize: 11.5, color: 'var(--marron-tinta)', marginBottom: 3 }}>
                    <strong>{f.titulo}:</strong> {f.texto}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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

const botonCantidadStyle = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  border: '1px solid rgba(146,97,55,0.3)',
  background: '#fff',
  cursor: 'pointer',
  fontSize: 16,
};
