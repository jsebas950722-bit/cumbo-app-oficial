// Lógica de negocio pura (sin React, sin Supabase) — separada de
// Marketplace.jsx para poder probarla con pruebas automatizadas reales
// (ver src/lib/tarifas.test.js). Antes vivía mezclada dentro del
// componente y no había ninguna forma de probarla sin renderizar toda
// la pantalla.

export const CIUDAD_BASE = 'Bogotá';

export const TAMANOS = [
  { valor: 'Libra', label: 'Libra (454g)', factor: 1 },
  { valor: 'Media libra', label: 'Media libra (250g)', factor: 0.58 },
  { valor: 'Cápsulas', label: 'Cápsulas', factor: 0.8 },
];

export const TARIFAS_URBANAS = [
  { id: 'yango', transportadora: 'Yango', costo: 9000, tiempo: 'Mismo día', nota: 'Mensajería urbana' },
  { id: 'didi', transportadora: 'Didi', costo: 9500, tiempo: 'Mismo día', nota: 'Mensajería urbana' },
];

export const TARIFAS_NACIONALES = [
  { id: 'interrapidisimo', transportadora: 'Interrapidísimo', costo: 13000, tiempo: '3-5 días hábiles', nota: 'Mejor cobertura rural' },
  { id: 'coordinadora', transportadora: 'Coordinadora', costo: 15000, tiempo: '2-4 días hábiles', nota: 'Buen balance costo/tiempo' },
  { id: 'servientrega', transportadora: 'Servientrega', costo: 17000, tiempo: '1-3 días hábiles', nota: 'Mayor cobertura y trazabilidad' },
];

export function normalizarCiudad(texto) {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function esCiudadBase(ciudad) {
  return normalizarCiudad(ciudad) === normalizarCiudad(CIUDAD_BASE);
}

export function tarifasParaCiudad(ciudad) {
  return esCiudadBase(ciudad) ? TARIFAS_URBANAS : TARIFAS_NACIONALES;
}

export function precioConTamano(precioBase, tamano) {
  const factor = (TAMANOS.find((t) => t.valor === tamano) || TAMANOS[0]).factor;
  return Math.round((precioBase * factor) / 500) * 500;
}

export function formatoCOP(n) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}
