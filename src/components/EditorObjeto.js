import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons as Icone } from '@expo/vector-icons';
import { AssetMini } from './AssetMini';
import { CampoImagem } from './CampoImagem';
import { CampoPasta } from './CampoPasta';
import { C } from '../config/theme';
import { EMOJIS } from '../data/constantes';

// ---------- editor de objeto (adereço) ----------
export function EditorObjeto({ asset, onSalvar, onApagar, onFechar, autor, pastas }) {
  const [f, setF] = useState({ nome: '', emoji: '🪨', img: '', w: 1, h: 1, ...asset });
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  async function salvarObj() {
    if (f.nome.trim().length < 2) return setErro('Dê um nome ao objeto.');
    setOcupado(true);
    try {
      await onSalvar({ ...f, tipo: 'objeto', nome: f.nome.trim() });
    } catch (e) {
      setErro('Erro ao salvar.');
      setOcupado(false);
    }
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onFechar}>
      <View style={es.fundo}>
        <View style={es.modal}>
          <View style={es.topo}>
            <AssetMini asset={{ ...f, tipo: 'objeto' }} tamanho={46} />
            <Text style={es.titulo}>{f.id ? 'Editar item de cenário' : 'Novo item de cenário'}</Text>
            <TouchableOpacity onPress={onFechar}>
              <Icone name="close" size={22} color={C.suave} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={es.rotulo}>Nome</Text>
            <TextInput style={es.input} value={f.nome} onChangeText={(t) => set('nome', t)} placeholder="Ex.: Árvore antiga, mesa de pedra" placeholderTextColor={C.suave} />

            {!!pastas && <CampoPasta valor={f.pasta || ''} pastas={pastas} onMudar={(v) => set('pasta', v)} />}

            <Text style={es.rotulo}>Ícone</Text>
            <View style={es.emojis}>
              {EMOJIS.map((e) => (
                <TouchableOpacity key={e} onPress={() => set('emoji', e)} style={[es.emoji, f.emoji === e && !f.img && es.emojiSel]}>
                  <Text style={{ fontSize: 22 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <CampoImagem valor={f.img} onMudar={(ref) => set('img', ref)} largura={512} rotulo="Ou use uma imagem (substitui o ícone)" autor={autor} />

            <Text style={es.rotulo}>Tamanho (células)</Text>
            <View style={es.linha}>
              <Text style={es.rotMini}>Largura</Text>
              {[1, 2, 3, 4].map((n) => (
                <TouchableOpacity key={'w' + n} onPress={() => set('w', n)} style={[es.chip, f.w === n && es.chipAtivo]}>
                  <Text style={es.chipTxt}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={[es.linha, { marginTop: 6 }]}>
              <Text style={es.rotMini}>Altura</Text>
              {[1, 2, 3, 4].map((n) => (
                <TouchableOpacity key={'h' + n} onPress={() => set('h', n)} style={[es.chip, f.h === n && es.chipAtivo]}>
                  <Text style={es.chipTxt}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          {!!erro && <Text style={{ color: C.perigo, marginTop: 6 }}>{erro}</Text>}
          <View style={es.acoes}>
            {!!onApagar && !!f.id && (
              <TouchableOpacity
                style={[es.btn, { borderWidth: 1, borderColor: C.perigo }]}
                onPress={() => (confirmar ? onApagar() : setConfirmar(true))}
              >
                <Text style={{ color: C.perigo, fontWeight: '700' }}>{confirmar ? 'Confirmar?' : 'Excluir'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[es.btn, { backgroundColor: C.destaque }]} onPress={salvarObj} disabled={ocupado}>
              {ocupado ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Salvar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}


const es = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 14 },
  modal: { width: '100%', maxWidth: 460, maxHeight: '92%', backgroundColor: C.painel, borderRadius: 16, borderWidth: 1, borderColor: C.borda, padding: 16 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  titulo: { color: C.texto, fontWeight: '800', fontSize: 17, flex: 1 },
  rotulo: { color: C.suave, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginTop: 12, marginBottom: 6 },
  rotMini: { color: C.suave, fontSize: 12, width: 60 },
  input: { backgroundColor: C.painel2, borderWidth: 1, borderColor: C.borda, color: C.texto, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  emojis: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 6 },
  emoji: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  emojiSel: { borderColor: C.destaque2, backgroundColor: 'rgba(34,211,238,0.12)' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chip: { minWidth: 34, height: 30, borderRadius: 8, borderWidth: 1, borderColor: C.borda, alignItems: 'center', justifyContent: 'center' },
  chipAtivo: { borderColor: C.destaque, backgroundColor: 'rgba(139,92,246,0.3)' },
  chipTxt: { color: C.texto, fontWeight: '700' },
  acoes: { flexDirection: 'row', gap: 8, marginTop: 14 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
});
