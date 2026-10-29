// Desenha um mapa de células (criador de mapas) dentro de um <Svg>:
// piso por terreno, paredes automáticas com sombra, grade no chão, portas e escadas.
import React, { useMemo } from 'react';
import { G, Rect, Path } from 'react-native-svg';
import { VAZIO, ehPiso } from '../utils/masmorra';

export const TEMAS_MAPA = {
  pedra: { nome: 'Pedra', fundo: '#24212c', chao: '#d6cfc0', parede: '#0d0b12', sombra: '#000000', grade: '#000000', gradeOp: 0.12 },
  pergaminho: { nome: 'Pergaminho', fundo: '#e9dcc1', chao: '#fffaf0', parede: '#2d2418', sombra: '#7a6648', grade: '#2d2418', gradeOp: 0.15 },
  caverna: { nome: 'Caverna', fundo: '#1b1712', chao: '#8b7a60', parede: '#0b0907', sombra: '#000000', grade: '#000000', gradeOp: 0.12 },
  floresta: { nome: 'Floresta', fundo: '#24391f', chao: '#b49a68', parede: '#142012', sombra: '#000000', grade: '#000000', gradeOp: 0.1 },
  scifi: { nome: 'Sci-fi', fundo: '#060912', chao: '#1d2740', parede: '#22d3ee', sombra: '#22d3ee', grade: '#22d3ee', gradeOp: 0.18 },
};
const COR_TERRENO = { ',': '#9a7b4f', '~': '#3b82f6', '^': '#ef4444' };

// junta segmentos colineares: mapa linha -> lista de [inicio, fim]
function juntar(segs) {
  const out = [];
  Object.keys(segs).forEach((k) => {
    const l = segs[k].sort((a, b) => a - b);
    let ini = l[0];
    let fim = l[0] + 1;
    for (let i = 1; i < l.length; i++) {
      if (l[i] === fim) fim++;
      else {
        out.push([Number(k), ini, fim]);
        ini = l[i];
        fim = l[i] + 1;
      }
    }
    if (l.length) out.push([Number(k), ini, fim]);
  });
  return out;
}

export function calcularDesenho(linhas, cel) {
  const rows = linhas.length;
  const cols = rows ? linhas[0].length : 0;
  const at = (x, y) => (y < 0 || x < 0 || y >= rows || x >= cols ? VAZIO : linhas[y][x]);
  const pisos = {}; // cor -> d
  const paredeH = {};
  const paredeV = {};
  const gradeH = {};
  const gradeV = {};
  const portas = [];
  const escadas = [];

  for (let y = 0; y < rows; y++) {
    // piso em "corridas" horizontais de mesma cor
    let x = 0;
    while (x < cols) {
      const c = linhas[y][x];
      if (!ehPiso(c)) {
        x++;
        continue;
      }
      const chaveDe = (ch) => (COR_TERRENO[ch] ? ch : 'chao');
      const chave = chaveDe(c);
      let fim = x + 1;
      while (fim < cols && ehPiso(linhas[y][fim]) && chaveDe(linhas[y][fim]) === chave) fim++;
      pisos[chave] = (pisos[chave] || '') + `M${x * cel} ${y * cel}h${(fim - x) * cel}v${cel}h${-(fim - x) * cel}z`;
      x = fim;
    }
    for (let xx = 0; xx < cols; xx++) {
      const c = linhas[y][xx];
      if (!ehPiso(c)) continue;
      if (c === 'D') portas.push([xx, y, !ehPiso(at(xx - 1, y)) && !ehPiso(at(xx + 1, y))]);
      if (c === 'S') escadas.push([xx, y]);
      // bordas: parede se o vizinho não é piso; linha de grade se é piso
      if (!ehPiso(at(xx, y - 1))) (paredeH[y] = paredeH[y] || []).push(xx);
      else (gradeH[y] = gradeH[y] || []).push(xx);
      if (!ehPiso(at(xx, y + 1))) (paredeH[y + 1] = paredeH[y + 1] || []).push(xx);
      if (!ehPiso(at(xx - 1, y))) (paredeV[xx] = paredeV[xx] || []).push(y);
      else (gradeV[xx] = gradeV[xx] || []).push(y);
      if (!ehPiso(at(xx + 1, y))) (paredeV[xx + 1] = paredeV[xx + 1] || []).push(y);
    }
  }
  const linhasH = (m) => juntar(m).map(([y, a, b]) => `M${a * cel} ${y * cel}H${b * cel}`).join('');
  const linhasV = (m) => juntar(m).map(([x, a, b]) => `M${x * cel} ${a * cel}V${b * cel}`).join('');
  return {
    largura: cols * cel,
    altura: rows * cel,
    pisos,
    paredes: linhasH(paredeH) + linhasV(paredeV),
    grade: linhasH(gradeH) + linhasV(gradeV),
    portas,
    escadas,
  };
}

export function MapaTilesSvg({ linhas, cel, tema = 'pedra', mostrarGrade = true, x = 0, y = 0 }) {
  const t = TEMAS_MAPA[tema] || TEMAS_MAPA.pedra;
  const chave = (linhas || []).join('|');
  const d = useMemo(() => calcularDesenho(linhas || [], cel), [chave, cel]);
  const esp = cel * 0.14;
  return (
    <G transform={x || y ? `translate(${x} ${y})` : undefined}>
      <Rect x={0} y={0} width={d.largura} height={d.altura} fill={t.fundo} />
      {Object.keys(d.pisos).map((k) => (
        <Path key={k} d={d.pisos[k]} fill={k === 'chao' ? t.chao : COR_TERRENO[k]} />
      ))}
      {mostrarGrade && !!d.grade && <Path d={d.grade} stroke={t.grade} strokeOpacity={t.gradeOp} strokeWidth={Math.max(0.5, cel * 0.02)} fill="none" />}
      {!!d.paredes && <Path d={d.paredes} stroke={t.sombra} strokeOpacity={0.3} strokeWidth={esp * 2.6} strokeLinecap="square" fill="none" />}
      {!!d.paredes && <Path d={d.paredes} stroke={t.parede} strokeWidth={esp} strokeLinecap="square" fill="none" />}
      {d.portas.map(([px, py, vertical]) => (
        <Rect
          key={`p${px}_${py}`}
          x={px * cel + (vertical ? cel * 0.1 : cel * 0.38)}
          y={py * cel + (vertical ? cel * 0.38 : cel * 0.1)}
          width={vertical ? cel * 0.8 : cel * 0.24}
          height={vertical ? cel * 0.24 : cel * 0.8}
          fill="#8b5a2b"
          stroke={t.parede}
          strokeWidth={esp * 0.5}
        />
      ))}
      {d.escadas.map(([sx, sy]) => (
        <Path
          key={`s${sx}_${sy}`}
          d={[0.2, 0.4, 0.6, 0.8].map((f) => `M${sx * cel + cel * 0.15} ${sy * cel + cel * f}H${sx * cel + cel * 0.85}`).join('')}
          stroke={t.parede}
          strokeWidth={esp * 0.6}
        />
      ))}
    </G>
  );
}
