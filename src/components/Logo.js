import React from 'react';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { C } from '../config/theme';

// Identidade visual: hexágono (dado/mesa) com um vórtice no centro
export default function Logo({ tamanho = 64, id = 'logo' }) {
  const grad = `url(#${id})`;
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={C.destaque} />
          <Stop offset="1" stopColor={C.destaque2} />
        </LinearGradient>
      </Defs>
      <Path
        d="M50 5 L89 27.5 L89 72.5 L50 95 L11 72.5 L11 27.5 Z"
        fill={C.painel2}
        stroke={grad}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <Path
        d="M50 42 A8 8 0 0 1 58 50 A14 14 0 0 1 44 64 A20 20 0 0 1 24 44 A27 27 0 0 1 51 17 A31 31 0 0 1 79 45"
        fill="none"
        stroke={grad}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <Circle cx="50" cy="50" r="4.5" fill={C.destaque2} />
    </Svg>
  );
}
