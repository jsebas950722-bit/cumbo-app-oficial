import * as Sentry from '@sentry/react';

// Monitoreo de errores en producción — hasta ahora, si algo se rompía
// en el celular de un cliente, nadie en Cumbo se enteraba: el error
// solo aparecía en la consola del navegador de esa persona, invisible
// para el equipo. Sentry lo reporta automáticamente.
//
// Se activa SOLO si configurás VITE_SENTRY_DSN en tu .env — si no está,
// esta función no hace nada (no rompe nada, simplemente no reporta).
// Sacá tu DSN gratis en https://sentry.io (plan gratuito alcanza para
// una app en sus primeros meses).

export function inicializarSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    console.info('[Cumbo] VITE_SENTRY_DSN no configurado — el monitoreo de errores está desactivado.');
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.2,
  });
}

export const reportarError = Sentry.captureException;
