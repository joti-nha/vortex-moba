export const gerarId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const gerarCodigo = () => {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 6; i++) c += letras[Math.floor(Math.random() * letras.length)];
  return c;
};

export const limitar = (v, min, max) => Math.max(min, Math.min(max, v));

// Centro de um token "encaixado" na grade (tamanho ímpar = centro da célula, par = cruzamento)
export const encaixar = (v, celula, tam = 1) =>
  tam % 2 === 1
    ? Math.floor(v / celula) * celula + celula / 2
    : Math.round(v / celula) * celula;

// Caixa delimitadora de qualquer item (para seleção e outliner)
export function caixa(it) {
  if (it.type === 'luz') return { x: it.x - 20, y: it.y - 20, w: 40, h: 40 }; // só o centro da luz é "pegável"
  if (it.type === 'token' || it.type === 'circle') {
    return { x: it.x - it.r, y: it.y - it.r, w: it.r * 2, h: it.r * 2 };
  }
  return { x: it.x, y: it.y, w: it.w || 0, h: it.h || 0 };
}

export function contemPonto(it, wx, wy, margem = 6) {
  if (it.type === 'luz') return Math.hypot(wx - it.x, wy - it.y) <= 20 + margem;
  if (it.type === 'token' || it.type === 'circle') {
    return Math.hypot(wx - it.x, wy - it.y) <= it.r + margem;
  }
  const b = caixa(it);
  return wx >= b.x - margem && wx <= b.x + b.w + margem && wy >= b.y - margem && wy <= b.y + b.h + margem;
}

// Converte pontos do mundo em um path relativo à própria caixa
export function pathDosPontos(pts) {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const d = pts
    .map((p, i) => `${i ? 'L' : 'M'}${(p.x - minX).toFixed(1)} ${(p.y - minY).toFixed(1)}`)
    .join(' ');
  return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY, d };
}

export const NOME_TIPO = {
  token: 'Token',
  draw: 'Desenho',
  rect: 'Retângulo',
  circle: 'Círculo',
  prop: 'Objeto',
  luz: 'Luz',
  tiles: 'Mapa',
};

export const ICONE_TIPO = {
  token: 'account-circle-outline',
  draw: 'draw',
  rect: 'square-outline',
  circle: 'circle-outline',
  prop: 'cube-outline',
  luz: 'lightbulb-on-outline',
  tiles: 'map-outline',
};

// ---------- pastas ----------
export const SEM_PASTA = 'Sem pasta';

// Agrupa itens pelo campo "pasta": [{ pasta, itens }], com "Sem pasta" por último
export function agruparPorPasta(itens) {
  const grupos = {};
  itens.forEach((it) => {
    const p = (it.pasta || '').trim() || SEM_PASTA;
    (grupos[p] = grupos[p] || []).push(it);
  });
  return Object.keys(grupos)
    .sort((a, b) => (a === SEM_PASTA) - (b === SEM_PASTA) || a.localeCompare(b))
    .map((pasta) => ({ pasta, itens: grupos[pasta] }));
}

// Lista de pastas já usadas
export const pastasDe = (itens) => [...new Set(itens.map((it) => (it.pasta || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
