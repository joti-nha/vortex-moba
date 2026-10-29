// Tipos de asset, nichos de packs e ícones (emojis) para objetos
export const TIPOS_ASSET = [
  { id: 'personagem', nome: 'Personagens', icone: 'account-group-outline' },
  { id: 'objeto', nome: 'Cenário', icone: 'pine-tree' },
  { id: 'estrutura', nome: 'Estruturas', icone: 'home-city-outline' },
  { id: 'mapa', nome: 'Mapas', icone: 'map-outline' },
];
export const NOME_TIPO_ASSET = { personagem: 'Personagem', objeto: 'Cenário', estrutura: 'Estrutura', mapa: 'Mapa' };

export const NICHOS = [
  { id: 'Fantasia', icone: 'sword' },
  { id: 'Masmorra', icone: 'castle' },
  { id: 'Natureza', icone: 'pine-tree' },
  { id: 'Cidade', icone: 'home-city' },
  { id: 'Sci-fi', icone: 'rocket-launch-outline' },
  { id: 'Horror', icone: 'ghost-outline' },
];
export const ICONE_NICHO = Object.fromEntries(NICHOS.map((n) => [n.id, n.icone]));

export const EMOJIS = [
  '🌲', '🌳', '🌴', '🌵', '🌿', '🍄', '🪨', '🪵', '🔥', '⛺',
  '🚪', '🧰', '💀', '🕯️', '⛓️', '🗿', '🕳️', '⚰️', '🛢️', '📦',
  '🪑', '🛏️', '🍺', '🍖', '📜', '💎', '🗡️', '🛡️', '🏹', '⚗️',
  '🐎', '🛶', '⛲', '🏛️', '🧱', '🪜', '🚀', '🤖', '👻', '🕸️',
];
