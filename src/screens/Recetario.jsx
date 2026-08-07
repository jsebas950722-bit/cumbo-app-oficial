import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

// Migrado desde: "Recetario Cumbo.dc.html"
// Sin cambios de fondo: es contenido editorial (no datos de usuario ni
// de negocio), así que se queda como datos estáticos en el frontend —
// no hace falta tabla en Supabase para esto. Único cambio real:
// navegación con react-router en vez de <a href> a archivos sueltos.

const CATEGORIAS = ['Bebidas frías', 'Bebidas calientes', 'Postres horneados', 'Postres fríos'];

const RECETAS = [
  {
    id: 'r1',
    categoria: 'Bebidas frías',
    nombre: 'Frappé de café Huila',
    tiempo: '5 min',
    dificultad: 'Fácil',
    porciones: '1 porción',
    descripcion: 'Café frío batido con hielo, leche y un toque dulce — ideal con un espresso de notas achocolatadas.',
    ingredientes: [
      '1 shot de espresso (o 60ml de café fuerte frío)',
      '150ml de leche entera',
      '1 cucharada de azúcar o panela',
      '8-10 cubos de hielo',
      'Crema batida al gusto',
    ],
    pasos: [
      'Prepara el espresso o café concentrado y déjalo enfriar unos minutos.',
      'Licúa el café, la leche, el azúcar y el hielo hasta lograr textura cremosa.',
      'Sirve en un vaso alto y corona con crema batida.',
    ],
  },
  {
    id: 'r2',
    categoria: 'Bebidas frías',
    nombre: 'Cold brew Nariño con cítricos',
    tiempo: '12 h reposo',
    dificultad: 'Fácil',
    porciones: '4 porciones',
    descripcion: 'Extracción en frío de 12 horas, con notas frutales que resaltan al combinarse con naranja.',
    ingredientes: ['100g de café molido grueso (Nariño)', '1 litro de agua fría', 'Cáscara de naranja', 'Hielo', 'Endulzante opcional'],
    pasos: [
      'Mezcla el café molido con el agua fría en un recipiente y añade la cáscara de naranja.',
      'Refrigera tapado durante 12 horas.',
      'Filtra con un colador fino o filtro de papel.',
      'Sirve sobre hielo, con un toque de endulzante si gustas.',
    ],
  },
  {
    id: 'r3',
    categoria: 'Bebidas frías',
    nombre: 'Tonic de café y romero',
    tiempo: '8 min',
    dificultad: 'Media',
    porciones: '1 porción',
    descripcion: 'Espresso doble sobre agua tónica y hielo, con un toque herbal — refrescante y con carácter.',
    ingredientes: ['1 shot doble de espresso', '120ml de agua tónica', 'Hielo', '1 ramita de romero', 'Cáscara de limón'],
    pasos: [
      'Llena un vaso con hielo y añade el agua tónica.',
      'Vierte el espresso lentamente encima, sin mezclar, para lograr las capas.',
      'Decora con romero y cáscara de limón.',
    ],
  },
  {
    id: 'r4',
    categoria: 'Bebidas calientes',
    nombre: 'Latte de café Cauca con canela',
    tiempo: '7 min',
    dificultad: 'Fácil',
    porciones: '1 porción',
    descripcion: 'Espresso con leche espumada y canela — dulzura natural de caramelo que combina perfecto con la especia.',
    ingredientes: ['1 shot de espresso', '180ml de leche entera', 'Canela en polvo', 'Miel o panela al gusto'],
    pasos: [
      'Prepara el espresso directo en la taza donde servirás el latte.',
      'Calienta y espuma la leche hasta lograr textura sedosa.',
      'Vierte la leche sobre el café y espolvorea canela.',
    ],
  },
  {
    id: 'r5',
    categoria: 'Bebidas calientes',
    nombre: 'Café con leche de finca y panela',
    tiempo: '6 min',
    dificultad: 'Fácil',
    porciones: '1 porción',
    descripcion: 'La receta tradicional colombiana — café filtrado con leche caliente y panela derretida.',
    ingredientes: ['200ml de café filtrado (método V60 o cafetera)', '150ml de leche', '1 cucharada de panela raspada'],
    pasos: [
      'Prepara el café filtrado a tu método habitual.',
      'Calienta la leche con la panela hasta que se disuelva por completo.',
      'Combina el café y la leche en proporciones iguales y sirve caliente.',
    ],
  },
  {
    id: 'r6',
    categoria: 'Bebidas calientes',
    nombre: 'Mocha de café Santanderes',
    tiempo: '8 min',
    dificultad: 'Media',
    porciones: '1 porción',
    descripcion: 'Espresso, chocolate y leche caliente — la combinación clásica con un café de cuerpo intenso.',
    ingredientes: ['1 shot de espresso', '2 cucharadas de chocolate en polvo', '180ml de leche', 'Crema batida (opcional)'],
    pasos: [
      'Disuelve el chocolate en polvo en un poco de leche caliente hasta formar una pasta.',
      'Añade el espresso y mezcla bien.',
      'Incorpora el resto de la leche caliente espumada y sirve con crema batida.',
    ],
  },
  {
    id: 'r7',
    categoria: 'Postres horneados',
    nombre: 'Torta de café y Eje Cafetero',
    tiempo: '55 min',
    dificultad: 'Media',
    porciones: '8 porciones',
    descripcion: 'Bizcocho húmedo con café expreso integrado en la masa — aroma intenso en cada mordisco.',
    ingredientes: [
      '2 tazas de harina',
      '1 taza de azúcar',
      '½ taza de café expreso frío',
      '½ taza de aceite',
      '3 huevos',
      '1 cucharada de polvo de hornear',
    ],
    pasos: [
      'Precalienta el horno a 180°C y engrasa un molde.',
      'Mezcla los ingredientes secos en un bowl.',
      'Bate los huevos con el aceite y el café, luego incorpora a los secos.',
      'Hornea 35-40 minutos hasta que un palillo salga limpio.',
    ],
  },
  {
    id: 'r8',
    categoria: 'Postres horneados',
    nombre: 'Brownie de café Valle del Cauca',
    tiempo: '45 min',
    dificultad: 'Fácil',
    porciones: '9 porciones',
    descripcion: 'Brownie de chocolate intenso con café molido integrado — textura densa y aroma profundo.',
    ingredientes: [
      '200g de chocolate oscuro',
      '150g de mantequilla',
      '1 taza de azúcar',
      '2 huevos',
      '1 cucharada de café molido fino',
      '¾ taza de harina',
    ],
    pasos: [
      'Derrite el chocolate con la mantequilla a baño maría.',
      'Bate el azúcar con los huevos hasta espumar, luego añade el chocolate.',
      'Incorpora la harina y el café molido con movimientos suaves.',
      'Hornea a 175°C por 25 minutos.',
    ],
  },
  {
    id: 'r9',
    categoria: 'Postres horneados',
    nombre: 'Galletas de café Cundinamarca',
    tiempo: '30 min',
    dificultad: 'Fácil',
    porciones: '18 galletas',
    descripcion: 'Galletas crocantes con café molido y un toque de vainilla — perfectas para acompañar tu taza.',
    ingredientes: [
      '2 tazas de harina',
      '1 taza de mantequilla',
      '¾ taza de azúcar',
      '1 cucharada de café molido fino',
      '1 huevo',
      'Esencia de vainilla',
    ],
    pasos: [
      'Bate la mantequilla con el azúcar hasta cremar.',
      'Añade el huevo, la vainilla y el café molido.',
      'Incorpora la harina hasta formar una masa homogénea.',
      'Forma bolitas, aplánalas y hornea a 180°C por 12 minutos.',
    ],
  },
  {
    id: 'r10',
    categoria: 'Postres fríos',
    nombre: 'Mousse de café Huila',
    tiempo: '20 min + 4h frío',
    dificultad: 'Media',
    porciones: '4 porciones',
    descripcion: 'Mousse ligero y aireado con café concentrado — postre elegante con notas dulces y frutales.',
    ingredientes: [
      '200ml de crema de leche',
      '2 cucharadas de café expreso concentrado',
      '3 cucharadas de azúcar',
      '1 sobre de gelatina sin sabor',
    ],
    pasos: [
      'Hidrata la gelatina según las instrucciones del sobre.',
      'Bate la crema de leche con el azúcar hasta punto de picos suaves.',
      'Incorpora el café y la gelatina disuelta con movimientos envolventes.',
      'Refrigera al menos 4 horas antes de servir.',
    ],
  },
  {
    id: 'r11',
    categoria: 'Postres fríos',
    nombre: 'Helado de café Nariño',
    tiempo: '15 min + 6h congelador',
    dificultad: 'Media',
    porciones: '6 porciones',
    descripcion: 'Helado cremoso a base de café concentrado — refrescante con la acidez cítrica típica de Nariño.',
    ingredientes: ['400ml de crema de leche', '200ml de leche condensada', '3 cucharadas de café expreso concentrado y frío'],
    pasos: [
      'Bate la crema de leche hasta que doble su volumen.',
      'Incorpora la leche condensada y el café con movimientos suaves.',
      'Vierte en un recipiente y congela mínimo 6 horas.',
    ],
  },
  {
    id: 'r12',
    categoria: 'Postres fríos',
    nombre: 'Tiramisú de café Cauca',
    tiempo: '30 min + 4h frío',
    dificultad: 'Media',
    porciones: '6 porciones',
    descripcion: 'El clásico italiano con el café dulce y caramelizado del Cauca — capas de bizcocho, café y crema.',
    ingredientes: [
      '200ml de café fuerte frío',
      '250g de queso mascarpone',
      '3 huevos',
      '½ taza de azúcar',
      '200g de bizcochos de soletilla',
      'Cacao en polvo',
    ],
    pasos: [
      'Separa las yemas de las claras y bate las yemas con el azúcar hasta blanquear.',
      'Incorpora el mascarpone a las yemas y luego las claras batidas a punto de nieve.',
      'Remoja los bizcochos en el café y forma capas alternando con la crema.',
      'Refrigera mínimo 4 horas y espolvorea cacao antes de servir.',
    ],
  },
];

export default function Recetario() {
  const [categoriaActiva, setCategoriaActiva] = useState('Todas');
  const [recetaAbiertaId, setRecetaAbiertaId] = useState('');

  const categorias = ['Todas', ...CATEGORIAS];
  const recetasFiltradas = categoriaActiva === 'Todas' ? RECETAS : RECETAS.filter((r) => r.categoria === categoriaActiva);
  const recetaAbierta = RECETAS.find((r) => r.id === recetaAbiertaId);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fondo-calido)', paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'var(--superficie)' }}>
        <Link to="/" style={{ color: 'var(--marron-tinta)', display: 'flex' }}>
          <ArrowLeft size={20} />
        </Link>
        <div style={{ fontWeight: 'bold', fontSize: 15, color: 'var(--marron-tinta)', flex: 1 }}>Recetario</div>
        <img src="/assets/logo-cumbo.png" alt="Cumbo" style={{ height: 22, width: 'auto' }} />
      </div>

      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '14px 16px 10px', maxWidth: 460, margin: '0 auto' }}>
        {categorias.map((c) => (
          <button
            key={c}
            onClick={() => setCategoriaActiva(c)}
            style={{
              whiteSpace: 'nowrap',
              border: 'none',
              borderRadius: 9999,
              padding: '8px 14px',
              fontSize: 12,
              fontWeight: 'bold',
              cursor: 'pointer',
              background: categoriaActiva === c ? 'var(--accion)' : 'var(--superficie)',
              color: categoriaActiva === c ? '#fff' : 'var(--cafe-oscuro)',
            }}
          >
            {c}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 460, margin: '0 auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {recetasFiltradas.map((r) => (
          <button
            key={r.id}
            onClick={() => setRecetaAbiertaId(r.id)}
            style={{ textAlign: 'left', background: '#fff', border: 'none', borderRadius: 18, padding: 16, cursor: 'pointer' }}
          >
            <div style={{ fontWeight: 'bold', fontSize: 14, color: 'var(--marron-tinta)' }}>{r.nombre}</div>
            <div style={{ fontSize: 11.5, color: 'var(--cafe-oscuro)', marginBottom: 4 }}>
              {r.tiempo} · {r.dificultad} · {r.porciones}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--marron-tinta)' }}>{r.descripcion}</div>
          </button>
        ))}
      </div>

      {/* Detalle de receta */}
      {recetaAbierta && (
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
              maxWidth: 460,
              borderRadius: '24px 24px 0 0',
              padding: 22,
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 18, color: 'var(--canela-oscuro)' }}>
                  {recetaAbierta.nombre}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--cafe-oscuro)' }}>
                  {recetaAbierta.tiempo} · {recetaAbierta.dificultad} · {recetaAbierta.porciones}
                </div>
              </div>
              <button
                onClick={() => setRecetaAbiertaId('')}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--marron-tinta)', lineHeight: 1.5, marginBottom: 16 }}>{recetaAbierta.descripcion}</p>

            <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--marron-tinta)', marginBottom: 8 }}>Ingredientes</div>
            <ul style={{ margin: '0 0 16px', paddingLeft: 18, fontSize: 13, color: 'var(--marron-tinta)', lineHeight: 1.6 }}>
              {recetaAbierta.ingredientes.map((ing, i) => (
                <li key={i}>{ing}</li>
              ))}
            </ul>

            <div style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--marron-tinta)', marginBottom: 8 }}>Pasos</div>
            {recetaAbierta.pasos.map((paso, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'var(--cafe-oscuro)',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ fontSize: 13, color: 'var(--marron-tinta)', lineHeight: 1.5 }}>{paso}</div>
              </div>
            ))}

            <Link
              to="/marketplace"
              className="cumbo-btn"
              style={{
                display: 'block',
                textAlign: 'center',
                textDecoration: 'none',
                marginTop: 16,
                background: 'var(--accion)',
                color: '#fff',
                padding: 14,
                borderRadius: 9999,
                fontSize: 14,
                fontWeight: 'bold',
              }}
            >
              Ir al Marketplace →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
