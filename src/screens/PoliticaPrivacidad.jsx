import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

// Pantalla nueva — borrador de política de privacidad conforme a la
// Ley 1581 de 2012 (Habeas Data) de Colombia. IMPORTANTE: esto es un
// PUNTO DE PARTIDA razonable, no un documento validado por un abogado.
// Antes de publicar la app, un abogado debería revisarlo — pero es
// mucho mejor arrancar de este borrador específico de Cumbo que de
// una plantilla genérica de internet o de nada en absoluto.

export default function PoliticaPrivacidad() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--fondo-calido)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'var(--superficie)' }}>
        <Link to="/perfil" style={{ color: 'var(--marron-tinta)', display: 'flex' }}>
          <ArrowLeft size={20} />
        </Link>
        <div style={{ fontWeight: 'bold', fontSize: 15, color: 'var(--marron-tinta)' }}>Política de Privacidad</div>
      </div>

      <div
        style={{
          maxWidth: 600,
          margin: '0 auto',
          padding: '20px 20px 60px',
          fontSize: 13.5,
          color: 'var(--marron-tinta)',
          lineHeight: 1.6,
        }}
      >
        <div
          style={{
            background: '#fdf3e6',
            border: '1px solid var(--tierra-kraft)',
            borderRadius: 12,
            padding: '12px 14px',
            marginBottom: 20,
            fontSize: 12,
          }}
        >
          Última actualización: [fecha]. Este documento es un borrador inicial — Cumbo recomienda revisión legal antes de considerarlo
          definitivo.
        </div>

        <h2 style={tituloEstilo}>1. ¿Quién es responsable de tus datos?</h2>
        <p>
          Café Cumbo (&ldquo;Cumbo&rdquo;), con domicilio en Bogotá, Colombia, es el responsable del tratamiento de los datos personales que
          recolecta a través de esta aplicación, conforme a la Ley 1581 de 2012 y sus decretos reglamentarios (1377 de 2013 y 1074 de 2015).
        </p>

        <h2 style={tituloEstilo}>2. ¿Qué datos recolectamos?</h2>
        <p>Según el rol con el que uses Cumbo, podemos recolectar:</p>
        <ul style={listaEstilo}>
          <li>
            <strong>De cualquier usuario:</strong> nombre completo, correo electrónico, número de WhatsApp, ciudad.
          </li>
          <li>
            <strong>Si compras:</strong> dirección de entrega, historial de pedidos, preferencias de sabor (perfil del Sommelier).
          </li>
          <li>
            <strong>Si eres caficultor:</strong> datos de tu finca, fotos y video de certificación, número de cédula, datos bancarios para
            recibir pagos.
          </li>
          <li>
            <strong>Si eres vendedor:</strong> los productos que publicas y tu historial de ventas.
          </li>
        </ul>
        <p>
          Cumbo <strong>no recolecta</strong> datos de tarjetas de crédito ni contraseñas de otras plataformas — los pagos se procesan
          directamente por Mercado Pago o Wompi, que tienen sus propias políticas de privacidad.
        </p>

        <h2 style={tituloEstilo}>3. ¿Para qué usamos tus datos?</h2>
        <ul style={listaEstilo}>
          <li>Gestionar tu cuenta y autenticarte de forma segura.</li>
          <li>Procesar y despachar tus pedidos.</li>
          <li>Pagarle a los caficultores y vendedores por sus ventas.</li>
          <li>Recomendarte café según tus preferencias (Agente Sommelier).</li>
          <li>Comunicarnos contigo sobre tus pedidos o consultas (WhatsApp).</li>
          <li>Cumplir obligaciones legales y contables.</li>
        </ul>

        <h2 style={tituloEstilo}>4. ¿Con quién compartimos tus datos?</h2>
        <p>
          Compartimos únicamente lo estrictamente necesario con: la transportadora que despacha tu pedido (nombre, dirección, teléfono), la
          pasarela de pago que elijas (Mercado Pago o Wompi, para procesar el cobro), y Supabase (nuestro proveedor de infraestructura
          tecnológica, que almacena los datos de forma cifrada). Nunca vendemos tus datos a terceros con fines publicitarios.
        </p>
        <p>
          Los datos bancarios y la cédula de los caficultores se almacenan en una tabla separada, con acceso restringido únicamente al
          propio caficultor y al equipo de Cumbo — nunca se muestran en el Marketplace ni a otros usuarios.
        </p>

        <h2 style={tituloEstilo}>5. Tus derechos (Habeas Data)</h2>
        <p>Como titular de tus datos, tienes derecho a:</p>
        <ul style={listaEstilo}>
          <li>Conocer, actualizar y rectificar tus datos personales.</li>
          <li>Solicitar prueba de la autorización otorgada.</li>
          <li>Ser informado sobre el uso que se le ha dado a tus datos.</li>
          <li>Revocar la autorización y/o solicitar la supresión de tus datos, cuando no exista un deber legal de conservarlos.</li>
          <li>Acceder gratuitamente a tus datos personales.</li>
        </ul>
        <p>
          Puedes ejercer estos derechos escribiéndonos por el chat de WhatsApp de la app, o eliminando tu cuenta directamente desde Perfil →
          Eliminar mi cuenta.
        </p>

        <h2 style={tituloEstilo}>6. ¿Cuánto tiempo conservamos tus datos?</h2>
        <p>
          Conservamos tus datos mientras mantengas tu cuenta activa, y por el tiempo adicional que exija la ley para fines contables y
          tributarios (típicamente hasta 5 años después de la última transacción). Al eliminar tu cuenta, se eliminan tus datos personales
          salvo aquellos que debamos conservar por obligación legal.
        </p>

        <h2 style={tituloEstilo}>7. Seguridad</h2>
        <p>
          Usamos cifrado en tránsito y en reposo, control de acceso por roles, y separamos los datos sensibles (bancarios, identidad) en
          tablas con acceso restringido. Ningún sistema es 100% infalible, pero trabajamos activamente para proteger tu información.
        </p>

        <h2 style={tituloEstilo}>8. Contacto</h2>
        <p>Para preguntas sobre esta política o para ejercer tus derechos, escríbenos por el chat de WhatsApp de la app.</p>
      </div>
    </div>
  );
}

const tituloEstilo = { fontSize: 14.5, fontWeight: 'bold', color: 'var(--canela-oscuro)', marginTop: 22, marginBottom: 8 };
const listaEstilo = { paddingLeft: 20, marginBottom: 10 };
