import { createContext, useContext, useMemo, useState } from 'react';

const CarritoContext = createContext(null);

const UMBRAL_ESCALAMIENTO_COP = 1000000;

export function CarritoProvider({ children }) {
  // items: { [key]: { key, producto_id, nombre, precio, cantidad } }
  const [items, setItems] = useState({});
  // tarifaEnvio: { transportadora, costo, diasHabiles, nota } | null
  // (el objeto completo, no un id — las opciones disponibles dependen
  // de la ciudad de entrega y se calculan en Marketplace, no acá)
  const [tarifaEnvio, setTarifaEnvio] = useState(null);

  function agregar(item) {
    setItems((prev) => {
      const existente = prev[item.key];
      return {
        ...prev,
        [item.key]: {
          ...item,
          cantidad: (existente?.cantidad || 0) + item.cantidad,
        },
      };
    });
  }

  function incrementar(key) {
    setItems((prev) => ({ ...prev, [key]: { ...prev[key], cantidad: prev[key].cantidad + 1 } }));
  }

  function decrementar(key) {
    setItems((prev) => {
      const actual = prev[key];
      if (!actual) return prev;
      if (actual.cantidad <= 1) {
        const { [key]: _omit, ...resto } = prev;
        return resto;
      }
      return { ...prev, [key]: { ...actual, cantidad: actual.cantidad - 1 } };
    });
  }

  function eliminar(key) {
    setItems((prev) => {
      const { [key]: _omit, ...resto } = prev;
      return resto;
    });
  }

  function vaciar() {
    setItems({});
    setTarifaEnvio(null);
  }

  const listaItems = useMemo(() => Object.values(items), [items]);
  const totalUnidades = listaItems.reduce((acc, it) => acc + it.cantidad, 0);
  const subtotal = listaItems.reduce((acc, it) => acc + it.precio * it.cantidad, 0);

  const costoEnvio = tarifaEnvio ? tarifaEnvio.costo : 0;
  const total = subtotal + costoEnvio;
  const requiereRevision = total > UMBRAL_ESCALAMIENTO_COP;

  const valor = {
    items,
    listaItems,
    totalUnidades,
    subtotal,
    costoEnvio,
    total,
    requiereRevision,
    tarifaEnvio,
    seleccionarTarifaEnvio: setTarifaEnvio,
    agregar,
    incrementar,
    decrementar,
    eliminar,
    vaciar,
  };

  return <CarritoContext.Provider value={valor}>{children}</CarritoContext.Provider>;
}

export function useCarrito() {
  const ctx = useContext(CarritoContext);
  if (!ctx) throw new Error('useCarrito debe usarse dentro de <CarritoProvider>');
  return ctx;
}
