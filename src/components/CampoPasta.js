// Escolha da pasta de um asset: pastas já existentes ou uma nova
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons as Icone } from '@expo/vector-icons';
import { C } from '../config/theme';

export function CampoPasta({ valor, pastas = [], onMudar }) {
  const [nova, setNova] = useState('');
  const lista = [...new Set([...pastas, ...(valor ? [valor] : [])])].filter(Boolean).sort((a, b) => a.localeCompare(b));

  const criar = () => {
    const n = nova.trim();
    if (!n) return;
    onMudar(n);
    setNova('');
  };

  return (
    <View>
      <Text style={estPasta.rotulo}>Pasta</Text>
      <View style={estPasta.wrap}>
        <TouchableOpacity onPress={() => onMudar('')} style={[estPasta.chip, !valor && estPasta.chipAtivo]}>
          <Icone name="folder-off-outline" size={13} color={!valor ? '#fff' : C.suave} />
          <Text style={[estPasta.chipTxt, !valor && { color: '#fff' }]}>Sem pasta</Text>
        </TouchableOpacity>
        {lista.map((p) => (
          <TouchableOpacity key={p} onPress={() => onMudar(p)} style={[estPasta.chip, valor === p && estPasta.chipAtivo]}>
            <Icone name={valor === p ? 'folder-open' : 'folder-outline'} size={13} color={valor === p ? '#fff' : C.suave} />
            <Text style={[estPasta.chipTxt, valor === p && { color: '#fff' }]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={estPasta.linha}>
        <TextInput
          style={estPasta.input}
          value={nova}
          onChangeText={setNova}
          onSubmitEditing={criar}
          placeholder="Nova pasta (ex.: Mortos-vivos)"
          placeholderTextColor={C.suave}
        />
        <TouchableOpacity style={estPasta.btn} onPress={criar}>
          <Icone name="folder-plus-outline" size={18} color={C.destaque2} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Cabeçalho de pasta usado nas listas agrupadas
export function CabecalhoPasta({ nome, quantidade, aberta, onPress }) {
  return (
    <TouchableOpacity style={estPasta.cabecalho} onPress={onPress} activeOpacity={onPress ? 0.6 : 1}>
      <Icone name={aberta === false ? 'folder-outline' : 'folder-open-outline'} size={16} color={C.destaque2} />
      <Text style={estPasta.cabecalhoTxt}>{nome}</Text>
      <Text style={estPasta.cabecalhoNum}>{quantidade}</Text>
      {!!onPress && <Icone name={aberta === false ? 'chevron-down' : 'chevron-up'} size={16} color={C.suave} />}
    </TouchableOpacity>
  );
}

const estPasta = StyleSheet.create({
  rotulo: { color: C.suave, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginTop: 12, marginBottom: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: C.borda },
  chipAtivo: { backgroundColor: C.destaque, borderColor: C.destaque },
  chipTxt: { color: C.suave, fontSize: 12, fontWeight: '600' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  input: { flex: 1, backgroundColor: C.painel2, borderWidth: 1, borderColor: C.borda, color: C.texto, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontSize: 13 },
  btn: { borderWidth: 1, borderColor: C.destaque2, borderRadius: 8, padding: 7 },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, marginTop: 4, borderBottomWidth: 1, borderColor: C.borda },
  cabecalhoTxt: { color: C.destaque2, fontWeight: '800', fontSize: 12, flex: 1 },
  cabecalhoNum: { color: C.suave, fontSize: 11 },
});
