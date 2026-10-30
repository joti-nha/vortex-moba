// Peças de SVG compartilhadas entre a mesa (Palco) e o criador de mapas:
// objetos de cenário, luzes e a camada de escuridão.
import React from 'react';
import { G, Circle, Rect, Path, Image as SvgImage, Text as SvgText, Defs, RadialGradient, Stop, Mask, ClipPath } from 'react-native-svg';
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

// Token simples (para o criador de mapas): círculo com cor, imagem ou iniciais
export function TokenSimplesSvg({ it }) {
  const src = useImagem(it.img);
  const r = it.r;
  const clip = 'tkc_' + it.id;
  return (
    <G>
      <Circle cx={it.x} cy={it.y + r * 0.08} r={r} fill="rgba(0,0,0,0.45)" />
      <Circle cx={it.x} cy={it.y} r={r} fill={it.cor || '#8b5cf6'} />
      {src ? (
        <>
          <Defs>
            <ClipPath id={clip}>
              <Circle cx={it.x} cy={it.y} r={r * 0.9} />
            </ClipPath>
          </Defs>
          <SvgImage href={{ uri: src }} x={it.x - r} y={it.y - r} width={r * 2} height={r * 2} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clip})`} />
        </>
      ) : (
        <SvgText x={it.x} y={it.y + r * 0.18} fontSize={r * 0.55} fontWeight="bold" fill="#fff" textAnchor="middle">
          {(it.nome || '?').slice(0, 2).toUpperCase()}
        </SvgText>
      )}
      <Circle cx={it.x} cy={it.y} r={r} fill="none" stroke="#fff" strokeWidth={r * 0.08} />
    </G>
  );
}

// Forma vinda de uma estrutura (retângulo, círculo ou desenho), em escala k
export function FormaSvg({ it }) {
  const k = it.k || 1;
  let corpo = null;
  if (it.tipoForma === 'rect') corpo = <Rect x={0} y={0} width={it.w} height={it.h} fill={it.cor} fillOpacity={0.25} stroke={it.cor} strokeWidth={it.espessura || 3} />;
  if (it.tipoForma === 'circle') corpo = <Circle cx={0} cy={0} r={it.r} fill={it.cor} fillOpacity={0.25} stroke={it.cor} strokeWidth={it.espessura || 3} />;
  if (it.tipoForma === 'draw')
    corpo = <Path d={it.d} fill="none" stroke={it.cor} strokeOpacity={it.opac || 1} strokeWidth={it.espessura || 4} strokeLinecap="round" strokeLinejoin="round" />;
  return <G transform={`translate(${it.x} ${it.y}) scale(${k})`}>{corpo}</G>;
}
