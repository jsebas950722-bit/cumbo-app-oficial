import { Component } from 'react';

// Sin esto, si CUALQUIER pantalla lanza un error de JS no controlado
// (por ejemplo, un dato inesperado que venga de Supabase), React
// desmonta toda la app y el usuario ve una pantalla en blanco, sin
// ningún mensaje. Esto captura ese error, lo muestra de forma legible,
// y deja un botón para recargar — en vez de una pantalla muerta.

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Error no controlado en la app:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            textAlign: 'center',
            background: 'var(--fondo-calido, #faf8f4)',
            fontFamily: 'Arial, sans-serif',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>☕</div>
          <div style={{ fontSize: 16, fontWeight: 'bold', color: 'var(--marron-tinta, #2d1b0d)', marginBottom: 8 }}>Algo salió mal</div>
          <p style={{ fontSize: 13, color: 'var(--cafe-oscuro, #926137)', maxWidth: 320, marginBottom: 18 }}>
            Encontramos un error inesperado. Intenta recargar la página — si el problema sigue, avísale al equipo Cumbo.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: 'var(--accion, #926137)',
              color: '#fff',
              border: 'none',
              padding: '12px 24px',
              borderRadius: 9999,
              fontSize: 13.5,
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            Recargar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
