// Dados iniciais: packs oficiais e assets gravados no Firestore na 1ª vez que alguém abre os packs
const recVida = (nome, atual) => [{ nome, atual, max: atual }];
export const PACKS_SEMENTE = [
  { id: 'pack_herois', nome: 'Heróis do Vórtice', nicho: 'Fantasia', cor: '#8b5cf6', icone: 'shield-sword-outline', descricao: 'Quatro aventureiros prontos para começar uma campanha.', ordem: 1 },
  { id: 'pack_bestiario', nome: 'Bestiário Inicial', nicho: 'Fantasia', cor: '#ef4444', icone: 'skull-outline', descricao: 'Inimigos e criaturas para os primeiros combates.', ordem: 2 },
  { id: 'pack_vila', nome: 'Taverna da Vila', nicho: 'Cidade', cor: '#f97316', icone: 'glass-mug-variant', descricao: 'NPCs e mobília para cenas na cidade.', ordem: 3 },
  { id: 'pack_floresta', nome: 'Floresta Antiga', nicho: 'Natureza', cor: '#22c55e', icone: 'pine-tree', descricao: 'Árvores, rochas e um acampamento pronto.', ordem: 4 },
  { id: 'pack_masmorra', nome: 'Masmorra Básica', nicho: 'Masmorra', cor: '#78716c', icone: 'castle', descricao: 'Portas, baús, armadilhas e uma sala do tesouro.', ordem: 5 },
].map((p) => ({ publicado: true, capa: '', autor: 'Mesa Vortex', criadoEm: 0, ...p }));

const fichaSemente = (id, pack, nome, tipo, tamanho, cor, corpo, precisao, essencia, pericias, vida, descricao) => ({
  id, pack, tipo: 'personagem', nome, categoria: tipo, tamanho, cor, corpo, precisao, essencia, pericias, recursos: recVida('Vida', vida), descricao,
});
const objSemente = (id, pack, nome, emoji, w = 1, h = 1) => ({ id, pack, tipo: 'objeto', nome, emoji, w, h, img: '' });

// Pastas dos assets iniciais (organização dentro de cada pack)
const PASTA_INICIAL = {
  a_cavaleira: 'Linha de frente', a_cleriga: 'Suporte', a_arqueiro: 'À distância', a_mago: 'À distância',
  a_goblin: 'Humanoides', a_ogro: 'Humanoides', a_esqueleto: 'Mortos-vivos', a_dragao: 'Chefes',
  a_lobo: 'Feras', a_aranha: 'Feras', a_golem: 'Constructos',
  a_taverneiro: 'NPCs', a_mercadora: 'NPCs',
  o_barril: 'Mobília', o_cadeira: 'Mobília', o_cama: 'Mobília', o_caneca: 'Utensílios',
  o_pinheiro: 'Vegetação', o_carvalho: 'Vegetação', o_arbusto: 'Vegetação', o_cogumelos: 'Vegetação',
  o_rocha: 'Terreno', o_tronco: 'Terreno', o_fogueira: 'Acampamento',
  o_porta: 'Passagens', o_alcapao: 'Passagens', o_bau: 'Tesouro', o_ossada: 'Decoração', o_vela: 'Decoração',
  o_correntes: 'Decoração', o_estatua: 'Decoração',
};

export const ASSETS_SEMENTE = [
  fichaSemente('a_cavaleira', 'pack_herois', 'Cavaleira Errante', 'Aliado', 1, '#3b82f6', 3, 1, 0, [{ nome: 'Atletismo', valor: 2 }, { nome: 'Intimidação', valor: 1 }], 14, 'Guerreira de armadura pesada que protege os aliados na linha de frente.'),
  fichaSemente('a_arqueiro', 'pack_herois', 'Arqueiro Élfico', 'Aliado', 1, '#22c55e', 1, 3, 1, [{ nome: 'Pontaria', valor: 2 }, { nome: 'Furtividade', valor: 1 }], 10, 'Atirador ágil que prefere manter distância.'),
  fichaSemente('a_mago', 'pack_herois', 'Mago do Vórtice', 'Aliado', 1, '#8b5cf6', 0, 1, 3, [{ nome: 'Arcanismo', valor: 2 }, { nome: 'Conhecimento', valor: 2 }], 8, 'Estudioso das energias do Vórtice; frágil, mas devastador.'),
  fichaSemente('a_cleriga', 'pack_herois', 'Clériga da Aurora', 'Aliado', 1, '#eab308', 1, 1, 3, [{ nome: 'Cura', valor: 2 }, { nome: 'Persuasão', valor: 1 }], 11, 'Curandeira devota que protege o grupo com bênçãos de luz.'),
  fichaSemente('a_goblin', 'pack_bestiario', 'Goblin Saqueador', 'Inimigo', 1, '#84cc16', 1, 2, 0, [{ nome: 'Furtividade', valor: 2 }], 6, 'Pequeno, covarde e sempre em bando.'),
  fichaSemente('a_esqueleto', 'pack_bestiario', 'Esqueleto Guardião', 'Inimigo', 1, '#e5e7eb', 2, 1, 0, [{ nome: 'Lâminas', valor: 1 }], 8, 'Morto-vivo que vigia criptas antigas.'),
  fichaSemente('a_ogro', 'pack_bestiario', 'Ogro da Ponte', 'Inimigo', 2, '#a16207', 4, 0, 0, [{ nome: 'Atletismo', valor: 2 }], 22, 'Cobra pedágio de quem atravessa a ponte.'),
  fichaSemente('a_dragao', 'pack_bestiario', 'Dragão de Cinzas', 'Inimigo', 3, '#ef4444', 4, 2, 3, [{ nome: 'Sopro', valor: 3 }, { nome: 'Voo', valor: 2 }], 40, 'Dragão jovem que sopra brasas sufocantes.'),
  fichaSemente('a_lobo', 'pack_bestiario', 'Lobo das Sombras', 'Criatura', 1, '#1f2937', 2, 2, 1, [{ nome: 'Rastrear', valor: 2 }], 9, 'Caça em matilha e some na escuridão.'),
  fichaSemente('a_aranha', 'pack_bestiario', 'Aranha Gigante', 'Criatura', 2, '#6b21a8', 2, 2, 0, [{ nome: 'Escalar', valor: 3 }], 15, 'Tece teias que prendem quem entra em seu covil.'),
  fichaSemente('a_golem', 'pack_bestiario', 'Golem de Pedra', 'Criatura', 2, '#78716c', 4, 0, 1, [], 30, 'Construto lento e resistente, ativado por runas.'),
  fichaSemente('a_taverneiro', 'pack_vila', 'Taverneiro Bartolo', 'NPC', 1, '#f97316', 2, 0, 0, [{ nome: 'Boatos', valor: 3 }], 10, 'Sabe de todos os boatos da região.'),
  fichaSemente('a_mercadora', 'pack_vila', 'Mercadora Itinerante', 'NPC', 1, '#14b8a6', 0, 1, 1, [{ nome: 'Negociar', valor: 3 }], 8, 'Carroça cheia de itens raros (e preços salgados).'),
  objSemente('o_barril', 'pack_vila', 'Barril', '🛢️'),
  objSemente('o_cadeira', 'pack_vila', 'Cadeira', '🪑'),
  objSemente('o_caneca', 'pack_vila', 'Caneca', '🍺'),
  objSemente('o_cama', 'pack_vila', 'Cama', '🛏️', 1, 2),
  objSemente('o_pinheiro', 'pack_floresta', 'Pinheiro', '🌲', 2, 2),
  objSemente('o_carvalho', 'pack_floresta', 'Carvalho', '🌳', 2, 2),
  objSemente('o_rocha', 'pack_floresta', 'Rocha', '🪨'),
  objSemente('o_cogumelos', 'pack_floresta', 'Cogumelos', '🍄'),
  objSemente('o_arbusto', 'pack_floresta', 'Arbusto', '🌿'),
  objSemente('o_fogueira', 'pack_floresta', 'Fogueira', '🔥'),
  objSemente('o_tronco', 'pack_floresta', 'Tronco caído', '🪵', 2, 1),
  objSemente('o_porta', 'pack_masmorra', 'Porta', '🚪'),
  objSemente('o_bau', 'pack_masmorra', 'Baú', '🧰'),
  objSemente('o_ossada', 'pack_masmorra', 'Ossada', '💀'),
  objSemente('o_vela', 'pack_masmorra', 'Vela', '🕯️'),
  objSemente('o_correntes', 'pack_masmorra', 'Correntes', '⛓️'),
  objSemente('o_alcapao', 'pack_masmorra', 'Alçapão', '🕳️'),
  objSemente('o_estatua', 'pack_masmorra', 'Estátua', '🗿', 1, 2),
  {
    id: 'e_acampamento', pack: 'pack_floresta', tipo: 'estrutura', nome: 'Acampamento', cel: 70, w: 280, h: 210,
    itens: [
      { type: 'prop', x: 70, y: 0, w: 140, h: 140, emoji: '⛺', cor: '#22c55e' },
      { type: 'prop', x: 105, y: 140, w: 70, h: 70, emoji: '🔥', cor: '#f97316' },
      { type: 'prop', x: 0, y: 140, w: 70, h: 70, emoji: '🪵', cor: '#a16207' },
      { type: 'prop', x: 210, y: 140, w: 70, h: 70, emoji: '🪵', cor: '#a16207' },
    ],
  },
  {
    id: 'e_tesouro', pack: 'pack_masmorra', tipo: 'estrutura', nome: 'Sala do tesouro', cel: 70, w: 280, h: 210,
    itens: [
      { type: 'rect', x: 0, y: 0, w: 280, h: 210, cor: '#78716c', espessura: 8 },
      { type: 'prop', x: 105, y: 52, w: 70, h: 70, emoji: '🧰', cor: '#eab308' },
      { type: 'prop', x: 10, y: 10, w: 35, h: 35, emoji: '🕯️', cor: '#eab308' },
      { type: 'prop', x: 235, y: 10, w: 35, h: 35, emoji: '🕯️', cor: '#eab308' },
      { type: 'prop', x: 105, y: 175, w: 70, h: 35, emoji: '🚪', cor: '#a16207' },
    ],
  },
].map((a) => ({ autor: 'Mesa Vortex', criadoEm: 0, pasta: PASTA_INICIAL[a.id] || '', ...a }));
