import React from 'react';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { C } from '../config/theme';

// Identidade visual: hexágono (dado/mesa) com um vórtice hexagonal no centro
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
        d="M50.0 16.0 L77.6 34.0 L75.8 64.9 L50.0 77.8 L27.8 62.8 L29.6 38.2 L50.0 28.5 L66.8 40.3 L65.0 58.7 L50.0 65.3 L38.6 56.6 L40.4 44.5 L50.0 41.0"
        fill="none"
        stroke={grad}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="50" cy="50" r="4.5" fill={C.destaque2} />
    </Svg>
  );
}
