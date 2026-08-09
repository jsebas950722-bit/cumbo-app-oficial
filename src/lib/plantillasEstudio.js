// Motor visual — Fase 2 del documento de arquitectura ("estilo
// Canva"): plantillas predefinidas que respetan el Brand Kit real de
// Cumbo (colores de marca, logo, tipografía) y se llenan con datos
// reales — precio, nombre de finca, cita real — en vez de generar una
// imagen nueva con IA cada vez. Esto es justamente la diferencia que
// pide el documento entre "Canva" (layouts consistentes desde
// plantillas) y "Firefly"/generación libre: acá el layout es siempre
// el mismo, solo cambia el dato.
//
// Se renderiza con Canvas del navegador — determinista, sin costo de
// API, sin depender de que un modelo de IA "interprete" el brand kit
// cada vez.

const COLORES = {
  cafeOscuro: '#926137',
  tierraKraft: '#c79c67',
  canelaOscuro: '#693c23',
  verdeCumbre: '#3d5a33',
  marronTinta: '#2d1b0d',
  fondoCalido: '#faf8f4',
};

const TAMANO = 1080; // cuadrado, tamaño estándar de post de Instagram

function cargarImagen(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function envolverTexto(ctx, texto, x, y, anchoMax, alturaLinea) {
  const palabras = texto.split(' ');
  let linea = '';
  let lineaActualY = y;
  const lineas = [];
  for (const palabra of palabras) {
    const pruebaLinea = linea + palabra + ' ';
    if (ctx.measureText(pruebaLinea).width > anchoMax && linea !== '') {
      lineas.push(linea);
      linea = palabra + ' ';
    } else {
      linea = pruebaLinea;
    }
  }
  lineas.push(linea);
  lineas.forEach((l, i) => ctx.fillText(l.trim(), x, lineaActualY + i * alturaLinea));
  return lineas.length;
}

async function dibujarLogo(ctx, blanco = false) {
  try {
    const logo = await cargarImagen('/assets/logo-cumbo.png');
    const alturaLogo = 70;
    const anchoLogo = (logo.width / logo.height) * alturaLogo;
    if (blanco) {
      // El logo real tiene sus propios colores café — para fondos
      // oscuros lo dibujamos con una máscara blanca simple en vez de
      // generar un logo "de mentira".
      ctx.save();
      ctx.filter = 'brightness(0) invert(1)';
      ctx.drawImage(logo, TAMANO / 2 - anchoLogo / 2, 50, anchoLogo, alturaLogo);
      ctx.restore();
    } else {
      ctx.drawImage(logo, TAMANO / 2 - anchoLogo / 2, 50, anchoLogo, alturaLogo);
    }
  } catch {
    // Si el logo no carga (ej: problema de red), seguimos sin romper
    // la plantilla — mejor una pieza sin logo que ninguna pieza.
  }
}

export async function generarPlantillaOfertaSemanal({ nombreProducto, precio, region }) {
  const canvas = document.createElement('canvas');
  canvas.width = TAMANO;
  canvas.height = TAMANO;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = COLORES.cafeOscuro;
  ctx.fillRect(0, 0, TAMANO, TAMANO);

  await dibujarLogo(ctx, true);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 34px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('OFERTA DE LA SEMANA', TAMANO / 2, 320);

  ctx.font = 'bold 56px Arial';
  envolverTexto(ctx, nombreProducto, TAMANO / 2, 420, 900, 64);

  if (region) {
    ctx.font = '32px Arial';
    ctx.fillStyle = COLORES.tierraKraft;
    ctx.fillText(region, TAMANO / 2, 560);
  }

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 80px Arial';
  ctx.fillText(`$${Number(precio).toLocaleString('es-CO')}`, TAMANO / 2, 750);

  ctx.font = 'bold 30px Arial';
  ctx.fillStyle = COLORES.tierraKraft;
  ctx.fillText('Disponible en el Marketplace de Cumbo', TAMANO / 2, 950);

  return canvas;
}

export async function generarPlantillaNuevaFinca({ nombreFinca, region, altitud, proceso }) {
  const canvas = document.createElement('canvas');
  canvas.width = TAMANO;
  canvas.height = TAMANO;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = COLORES.fondoCalido;
  ctx.fillRect(0, 0, TAMANO, TAMANO);
  ctx.fillStyle = COLORES.verdeCumbre;
  ctx.fillRect(0, 0, TAMANO, 16);

  await dibujarLogo(ctx, false);

  ctx.fillStyle = '#fff';
  ctx.fillRect(TAMANO / 2 - 180, 260, 360, 50);
  ctx.fillStyle = COLORES.verdeCumbre;
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('NUEVO EN CUMBO ORIGEN', TAMANO / 2, 293);

  ctx.fillStyle = COLORES.marronTinta;
  ctx.font = 'bold 54px Arial';
  envolverTexto(ctx, nombreFinca, TAMANO / 2, 420, 900, 62);

  ctx.font = '30px Arial';
  ctx.fillStyle = COLORES.cafeOscuro;
  ctx.fillText(`${region} · ${altitud} msnm`, TAMANO / 2, 560);
  ctx.fillText(`Proceso ${proceso}`, TAMANO / 2, 610);

  return canvas;
}

export async function generarPlantillaCitaCatacion({ cita, autor }) {
  const canvas = document.createElement('canvas');
  canvas.width = TAMANO;
  canvas.height = TAMANO;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = COLORES.canelaOscuro;
  ctx.fillRect(0, 0, TAMANO, TAMANO);

  await dibujarLogo(ctx, true);

  ctx.fillStyle = COLORES.tierraKraft;
  ctx.font = 'italic 120px Georgia';
  ctx.textAlign = 'center';
  ctx.fillText('"', TAMANO / 2, 380);

  ctx.fillStyle = '#fff';
  ctx.font = 'italic 42px Georgia';
  envolverTexto(ctx, cita, TAMANO / 2, 460, 820, 56);

  if (autor) {
    ctx.font = '28px Arial';
    ctx.fillStyle = COLORES.tierraKraft;
    ctx.fillText(`— ${autor}`, TAMANO / 2, 870);
  }

  return canvas;
}

export async function generarPlantillaAcademy({ tituloLeccion }) {
  const canvas = document.createElement('canvas');
  canvas.width = TAMANO;
  canvas.height = TAMANO;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = COLORES.marronTinta;
  ctx.fillRect(0, 0, TAMANO, TAMANO);

  await dibujarLogo(ctx, true);

  ctx.fillStyle = COLORES.tierraKraft;
  ctx.font = 'bold 28px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('CUMBO ACADEMY', TAMANO / 2, 340);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 50px Arial';
  envolverTexto(ctx, tituloLeccion, TAMANO / 2, 460, 880, 60);

  return canvas;
}

export function canvasABlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
