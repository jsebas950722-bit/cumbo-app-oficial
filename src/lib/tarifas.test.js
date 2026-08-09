import { describe, it, expect } from 'vitest';
import {
  esCiudadBase,
  tarifasParaCiudad,
  precioConTamano,
  formatoCOP,
  normalizarCiudad,
  TARIFAS_URBANAS,
  TARIFAS_NACIONALES,
  DEPARTAMENTOS_COLOMBIA,
} from './tarifas';

describe('DEPARTAMENTOS_COLOMBIA', () => {
  it('incluye los 32 departamentos + Bogotá D.C.', () => {
    expect(DEPARTAMENTOS_COLOMBIA.length).toBe(33);
    expect(DEPARTAMENTOS_COLOMBIA).toContain('Huila'); // origen del café Cumbo
    expect(DEPARTAMENTOS_COLOMBIA).toContain('Bogotá D.C.');
  });

  it('no tiene departamentos duplicados', () => {
    expect(new Set(DEPARTAMENTOS_COLOMBIA).size).toBe(DEPARTAMENTOS_COLOMBIA.length);
  });
});

describe('normalizarCiudad', () => {
  it('quita tildes y pasa a minúsculas', () => {
    expect(normalizarCiudad('Bogotá')).toBe('bogota');
    expect(normalizarCiudad('BOGOTÁ')).toBe('bogota');
    expect(normalizarCiudad('  Bogota  ')).toBe('bogota');
  });

  it('devuelve string vacío si no hay texto', () => {
    expect(normalizarCiudad('')).toBe('');
    expect(normalizarCiudad(undefined)).toBe('');
  });
});

describe('esCiudadBase', () => {
  it('reconoce Bogotá sin importar tildes o mayúsculas', () => {
    expect(esCiudadBase('Bogotá')).toBe(true);
    expect(esCiudadBase('bogota')).toBe(true);
    expect(esCiudadBase('BOGOTÁ')).toBe(true);
  });

  it('no confunde otras ciudades con Bogotá', () => {
    expect(esCiudadBase('Medellín')).toBe(false);
    expect(esCiudadBase('Bogota D.C.')).toBe(false); // caso real: si el cliente escribe distinto, hoy no matchea
  });
});

describe('tarifasParaCiudad', () => {
  it('da mensajería urbana (Yango/Didi) para Bogotá', () => {
    const tarifas = tarifasParaCiudad('Bogotá');
    expect(tarifas).toEqual(TARIFAS_URBANAS);
    expect(tarifas.map((t) => t.transportadora)).toEqual(['Yango', 'Didi']);
  });

  it('da transportadora nacional para cualquier otra ciudad', () => {
    const tarifas = tarifasParaCiudad('Cali');
    expect(tarifas).toEqual(TARIFAS_NACIONALES);
    expect(tarifas.length).toBeGreaterThan(0);
  });
});

describe('precioConTamano', () => {
  it('Libra cobra el precio base completo', () => {
    expect(precioConTamano(32000, 'Libra')).toBe(32000);
  });

  it('Media libra aplica el factor 0.58, redondeado a 500', () => {
    // 32000 * 0.58 = 18560 -> redondeado a la centena de 500 más cercana
    expect(precioConTamano(32000, 'Media libra')).toBe(18500);
  });

  it('Cápsulas aplica el factor 0.8', () => {
    expect(precioConTamano(32000, 'Cápsulas')).toBe(25500);
  });

  it('un tamaño desconocido cae de vuelta a Libra (factor 1), no revienta', () => {
    expect(precioConTamano(32000, 'Tamaño inexistente')).toBe(32000);
  });
});

describe('formatoCOP', () => {
  it('formatea con separador de miles y símbolo de peso', () => {
    expect(formatoCOP(32000)).toBe('$32.000');
    expect(formatoCOP(1000000)).toBe('$1.000.000');
  });

  it('redondea decimales', () => {
    expect(formatoCOP(18500.7)).toBe('$18.501');
  });
});
