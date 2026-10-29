import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { C } from '../config/theme';

// ---------- modal simples de nome (salvar estrutura / mapa / renomear) ----------
export function ModalNome({ titulo, valorInicial = '', rotuloBotao = 'Salvar', detalhe, onConfirmar, onFechar, onExcluir }) {
  const [nome, setNome] = useState(valorInicial);
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  async function ok() {
    if (nome.trim().length < 2) return setErro('Digite um nome.');
    setOcupado(true);
    try {
      await onConfirmar(nome.trim());
    } catch (e) {
      setErro(e.message || 'Erro ao salvar.');
      setOcupado(false);
    }
  }
  return (
    <Modal transparent animationType="fade" onRequestClose={onFechar}>
      <View style={es.fundo}>
        <View style={[es.modal, { maxWidth: 380 }]}>
          <Text style={es.titulo}>{titulo}</Text>
          {!!detalhe && <Text style={{ color: C.suave, fontSize: 12, marginTop: 4 }}>{detalhe}</Text>}
          <TextInput style={[es.input, { marginTop: 12 }]} value={nome} onChangeText={setNome} autoFocus onSubmitEditing={ok} placeholder="Nome" placeholderTextColor={C.suave} />
          {!!erro && <Text style={{ color: C.perigo, marginTop: 6 }}>{erro}</Text>}
          <View style={es.acoes}>
            {onExcluir ? (
              <TouchableOpacity
                style={[es.btn, { borderWidth: 1, borderColor: C.perigo }]}
                onPress={() => (confirmar ? onExcluir() : setConfirmar(true))}
              >
                <Text style={{ color: C.perigo, fontWeight: '700' }}>{confirmar ? 'Confirmar?' : 'Excluir'}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[es.btn, { borderWidth: 1, borderColor: C.borda }]} onPress={onFechar}>
                <Text style={{ color: C.suave, fontWeight: '700' }}>Cancelar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[es.btn, { backgroundColor: C.destaque }]} onPress={ok} disabled={ocupado}>
              {ocupado ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>{rotuloBotao}</Text>}
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
