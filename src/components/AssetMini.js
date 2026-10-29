import React from 'react';
import { View, Text, Image } from 'react-native';
import { MaterialCommunityIcons as Icone } from '@expo/vector-icons';
import { TokenMini } from './Ficha';
import { C } from '../config/theme';
import { useImagem } from '../services/imagens';

// ---------- miniatura de qualquer asset ----------
export function AssetMini({ asset, tamanho = 46 }) {
  const src = useImagem(asset.tipo === 'objeto' || asset.tipo === 'mapa' ? asset.img : '');
  if (asset.tipo === 'personagem') return <TokenMini item={asset} tamanho={tamanho} />;
  const caixaMini = {
    width: tamanho,
    height: tamanho,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: C.painel2,
    borderWidth: 1,
    borderColor: C.borda,
  };
  if (src) {
    return (
      <View style={caixaMini}>
        <Image source={{ uri: src }} style={{ width: tamanho, height: tamanho }} resizeMode="cover" />
      </View>
    );
  }
  if (asset.tipo === 'objeto') {
    return (
      <View style={caixaMini}>
        <Text style={{ fontSize: tamanho * 0.55 }}>{asset.emoji || '❔'}</Text>
      </View>
    );
  }
  return (
    <View style={[caixaMini, { backgroundColor: asset.tipo === 'estrutura' ? 'rgba(34,211,238,0.15)' : 'rgba(139,92,246,0.2)' }]}>
      <Icone name={asset.tipo === 'estrutura' ? 'home-city-outline' : 'map-outline'} size={tamanho * 0.5} color={asset.tipo === 'estrutura' ? C.destaque2 : C.destaque} />
    </View>
  );
}
