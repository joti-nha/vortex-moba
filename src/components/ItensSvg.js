// Peças de SVG compartilhadas entre a mesa (Palco) e o criador de mapas:
// objetos de cenário, luzes e a camada de escuridão.
import React from 'react';
import { G, Circle, Rect, Image as SvgImage, Text as SvgText, Defs, RadialGradient, Stop, Mask } from 'react-native-svg';
import { useImagem } from '../services/imagens';

// Objeto (adereço): imagem ou ícone emoji, ocupando w×h, com rotação
export function PropSvg({ it }) {
  const src = useImagem(it.img);
  const cx = it.x + it.w / 2;
  const cy = it.y + it.h / 2;
  return (
    <G transform={it.rot ? `rotate(${it.rot} ${cx} ${cy})` : undefined}>
      {src ? (
        <SvgImage href={{ uri: src }} x={it.x} y={it.y} width={it.w} height={it.h} preserveAspectRatio="xMidYMid meet" />
      ) : (
        <SvgText x={cx} y={cy + Math.min(it.w, it.h) * 0.3} fontSize={Math.min(it.w, it.h) * 0.85} textAnchor="middle">
          {it.emoji || '❔'}
        </SvgText>
      )}
    </G>
  );
}

// Luz: brilho colorido com raio it.r. mostrarCentro desenha o ponto para selecionar/mover.
export function LuzSvg({ it, escala = 1, mostrarCentro }) {
  const gid = 'luzg_' + (it.id || `${Math.round(it.x)}_${Math.round(it.y)}`);
  const op = 0.45 * (it.intensidade || 1);
  return (
    <G>
      <Defs>
        <RadialGradient id={gid} cx={it.x} cy={it.y} r={it.r} fx={it.x} fy={it.y} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={it.cor || '#ffd27a'} stopOpacity={op} />
          <Stop offset="0.6" stopColor={it.cor || '#ffd27a'} stopOpacity={op * 0.35} />
          <Stop offset="1" stopColor={it.cor || '#ffd27a'} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={it.x} cy={it.y} r={it.r} fill={`url(#${gid})`} />
      {mostrarCentro && (
        <Circle cx={it.x} cy={it.y} r={8 / escala} fill={it.cor || '#ffd27a'} stroke="#000" strokeWidth={1.5 / escala} />
      )}
    </G>
  );
}

// Escuridão: cobre a área com preto e "abre buracos" onde há luzes
export function EscuridaoSvg({ luzes, nivel, x, y, w, h }) {
  if (!nivel) return null;
  return (
    <G>
      <Defs>
        <RadialGradient id="buracoLuz" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#000000" stopOpacity={1} />
          <Stop offset="0.55" stopColor="#000000" stopOpacity={0.85} />
          <Stop offset="1" stopColor="#000000" stopOpacity={0} />
        </RadialGradient>
        <Mask id="mascaraEscuro" maskUnits="userSpaceOnUse" x={x} y={y} width={w} height={h}>
          <Rect x={x} y={y} width={w} height={h} fill="#ffffff" />
          {luzes.map((l, i) => (
            <Circle key={l.id || i} cx={l.x} cy={l.y} r={l.r} fill="url(#buracoLuz)" />
          ))}
        </Mask>
      </Defs>
      <Rect x={x} y={y} width={w} height={h} fill="#000000" opacity={nivel} mask="url(#mascaraEscuro)" />
    </G>
  );
}
