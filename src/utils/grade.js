// Grade quadrada e hexagonal: valores padrão, encaixe e desenho da grade visível
import { encaixar } from './util';

// ---------- grade (quadrada / hexagonal) ----------
export const GRADE_PADRAO = {
  grade: true,
  tipoGrade: 'quadrada', // 'quadrada' | 'hex'
  tamGrade: 70,
  corGrade: '#ffffff',
  opacGrade: 0.18,
  espGrade: 1,
  infinita: true,
  offX: 0,
  offY: 0,
  snap: true,
};

export const lerGrade = (sala) => ({ ...GRADE_PADRAO, ...(sala || {}) });

// hexágono "pointy-top": cel = largura (distância entre lados paralelos)
const R3 = Math.sqrt(3);
const hexRaio = (cel) => cel / R3;

function hexCentro(q, r, g) {
  const w = g.tamGrade;
  const R = hexRaio(w);
  return { x: g.offX + w * (q + r / 2), y: g.offY + 1.5 * R * r };
}

function hexDoPonto(x, y, g) {
  const w = g.tamGrade;
  const R = hexRaio(w);
  const rf = (y - g.offY) / (1.5 * R);
  const qf = (x - g.offX) / w - rf / 2;
  // arredondamento em coordenadas cúbicas
  let rx = Math.round(qf);
  let rz = Math.round(rf);
  const ry = Math.round(-qf - rf);
  const dx = Math.abs(rx - qf);
  const dy = Math.abs(ry - (-qf - rf));
  const dz = Math.abs(rz - rf);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy <= dz) rz = -rx - ry;
  return { q: rx, r: rz };
}

// Encaixa o centro de um token na grade atual
export function encaixarPonto(x, y, g, tam = 1) {
  if (!g.grade || !g.snap) return { x, y };
  if (g.tipoGrade === 'hex') {
    const h = hexDoPonto(x, y, g);
    return hexCentro(h.q, h.r, g);
  }
  return {
    x: encaixar(x - g.offX, g.tamGrade, tam) + g.offX,
    y: encaixar(y - g.offY, g.tamGrade, tam) + g.offY,
  };
}

// Gera o "d" de um único Path com a grade visível (x0,y0)-(x1,y1) em coordenadas do mundo.
// Retorna '' se houver células demais (zoom muito afastado).
export function caminhoGrade(g, x0, y0, x1, y1, mapW, mapH) {
  if (!g.grade) return '';
  if (!g.infinita) {
    x0 = Math.max(x0, 0);
    y0 = Math.max(y0, 0);
    x1 = Math.min(x1, mapW);
    y1 = Math.min(y1, mapH);
    if (x1 <= x0 || y1 <= y0) return '';
  }
  const w = g.tamGrade;
  const partes = [];

  if (g.tipoGrade === 'hex') {
    const R = hexRaio(w);
    const r0 = Math.floor((y0 - g.offY) / (1.5 * R)) - 1;
    const r1 = Math.ceil((y1 - g.offY) / (1.5 * R)) + 1;
    if ((r1 - r0) * ((x1 - x0) / w + 3) > 2500) return '';
    for (let r = r0; r <= r1; r++) {
      const q0 = Math.floor((x0 - g.offX) / w - r / 2) - 1;
      const q1 = Math.ceil((x1 - g.offX) / w - r / 2) + 1;
      for (let q = q0; q <= q1; q++) {
        const c = hexCentro(q, r, g);
        if (!g.infinita && (c.x < -w / 2 || c.y < -R || c.x > mapW + w / 2 || c.y > mapH + R)) continue;
        let d = '';
        for (let i = 0; i < 6; i++) {
          const ang = (Math.PI / 180) * (60 * i - 30);
          const px = (c.x + R * Math.cos(ang)).toFixed(1);
          const py = (c.y + R * Math.sin(ang)).toFixed(1);
          d += (i ? 'L' : 'M') + px + ' ' + py;
        }
        partes.push(d + 'Z');
      }
    }
    return partes.join('');
  }

  const i0 = Math.floor((x0 - g.offX) / w);
  const i1 = Math.ceil((x1 - g.offX) / w);
  const j0 = Math.floor((y0 - g.offY) / w);
  const j1 = Math.ceil((y1 - g.offY) / w);
  if (i1 - i0 + (j1 - j0) > 600) return '';
  for (let i = i0; i <= i1; i++) {
    const x = g.offX + i * w;
    if (!g.infinita && (x < 0 || x > mapW)) continue;
    partes.push(`M${x} ${y0}V${y1}`);
  }
  for (let j = j0; j <= j1; j++) {
    const y = g.offY + j * w;
    if (!g.infinita && (y < 0 || y > mapH)) continue;
    partes.push(`M${x0} ${y}H${x1}`);
  }
  return partes.join('');
}
