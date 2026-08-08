import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

// Borrador de términos y condiciones conforme a la Ley 1480 de 2011
// (Estatuto del Consumidor). Mismo aviso que en PoliticaPrivacidad.jsx:
// es un punto de partida específico de Cumbo, no un documento validado
// legalmente todavía.

export default function TerminosCondiciones() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--fondo-calido)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'var(--superficie)' }}>
        <Link to="/perfil" style={{ color: 'var(--marron-tinta)', display: 'flex' }}>
          <ArrowLeft size={20} />
        </Link>
        <div style={{ fontWeight: 'bold', fontSize: 15, color: 'var(--marron-tinta)' }}>Términos y Condiciones</div>
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

        <h2 style={tituloEstilo}>1. Qué es Cumbo</h2>
        <p>
          Cumbo es una plataforma que conecta directamente a caficultores colombianos con compradores de café de especialidad, y a marcas
          socias que venden métodos de preparación y accesorios. Al usar la app, aceptas estos términos.
        </p>

        <h2 style={tituloEstilo}>2. Tu cuenta</h2>
        <p>
          Eres responsable de mantener la confidencialidad de tu contraseña y de toda actividad realizada desde tu cuenta. Debes darnos
          información verdadera al registrarte. Puedes eliminar tu cuenta en cualquier momento desde Perfil.
        </p>

        <h2 style={tituloEstilo}>3. Compras y precios</h2>
        <p>
          Los precios se muestran en pesos colombianos (COP) e incluyen el costo del producto — el envío se cobra por separado según la
          tarifa que elijas al finalizar tu compra. El pago se procesa a través de Mercado Pago o Wompi; Cumbo no almacena los datos de tu
          tarjeta.
        </p>

        <h2 style={{ ...tituloEstilo, color: 'var(--accion)' }}>4. Derecho de retracto</h2>
        <p>
          <strong>Tienes derecho a retractarte de tu compra dentro de los 5 días hábiles siguientes a la entrega del producto</strong>, sin
          necesidad de dar ninguna explicación, conforme al artículo 47 de la Ley 1480 de 2011 (Estatuto del Consumidor). Para ejercer este
          derecho, escríbenos por el chat de WhatsApp de la app o desde Mis Pedidos → Solicitar devolución, indicando el número de tu
          pedido.
        </p>
        <p>
          El producto debe devolverse en las mismas condiciones en que fue entregado. Una vez recibido y verificado, Cumbo reintegrará el
          valor pagado a través del mismo medio de pago utilizado, dentro de los plazos que exige la ley.
        </p>
        <p style={{ fontSize: 12, color: 'var(--cafe-oscuro)' }}>
          Nota: el derecho de retracto no aplica a productos perecederos ya abiertos o consumidos parcialmente, cuando la naturaleza del
          bien lo impida por razones de higiene o salud (aplica a café ya abierto, no a empaques sellados).
        </p>

        <h2 style={tituloEstilo}>5. Garantía</h2>
        <p>
          Si tu pedido llega dañado, incompleto o no corresponde a lo solicitado, tienes derecho a la garantía legal — repuesto, reparación
          o devolución del dinero, según corresponda — sin costo adicional para ti.
        </p>

        <h2 style={tituloEstilo}>6. Caficultores y vendedores</h2>
        <p>
          Al publicar una finca o un producto en Cumbo, garantizas que la información y las certificaciones que subes son reales y de tu
          autoría. Cumbo se reserva el derecho de validar, rechazar o retirar cualquier publicación que no cumpla con estos estándares.
          Cumbo cobra una comisión sobre las ventas realizadas por vendedores de marca socia, según lo establecido en la Constitución del
          Ecosistema Cumbo.
        </p>

        <h2 style={tituloEstilo}>7. Uso aceptable</h2>
        <p>
          No está permitido usar Cumbo para actividades ilegales, publicar información falsa, o intentar vulnerar la seguridad de la
          plataforma.
        </p>

        <h2 style={tituloEstilo}>8. Cambios a estos términos</h2>
        <p>Podemos actualizar estos términos ocasionalmente. Te avisaremos de cambios importantes a través de la app.</p>

        <h2 style={tituloEstilo}>9. Contacto</h2>
        <p>Para cualquier consulta, escríbenos por el chat de WhatsApp de la app.</p>
      </div>
    </div>
  );
}

const tituloEstilo = { fontSize: 14.5, fontWeight: 'bold', color: 'var(--canela-oscuro)', marginTop: 22, marginBottom: 8 };
