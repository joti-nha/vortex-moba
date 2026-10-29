// Campo de imagem reutilizável: galeria, câmera ou URL, com prévia
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons as Icone } from '@expo/vector-icons';
import { C } from '../config/theme';
import { escolherImagem, useImagem } from '../services/imagens';

// ---------- componente de campo de imagem ----------
// valor: ref atual · onMudar(ref, {w,h}) · largura: tamanho máximo ao enviar
export function CampoImagem({ valor, onMudar, largura = 512, rotulo = 'Imagem', autor = '', redondo }) {
  const src = useImagem(valor);
  const [modoUrl, setModoUrl] = useState(false);
  const [url, setUrl] = useState(valor && !valor.startsWith('fs:') ? valor : '');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');

  async function pegar(origem) {
    setErro('');
    setOcupado(true);
    try {
      const r = await escolherImagem(origem, { largura, autor });
      if (r) onMudar(r.ref, { w: r.w, h: r.h });
    } catch (e) {
      setErro(e.message || 'Não foi possível carregar a imagem.');
    }
    setOcupado(false);
  }

  function aplicarUrl() {
    const u = url.trim();
    if (!u) return;
    setModoUrl(false);
    Image.getSize(
      u,
      (w, h) => onMudar(u, { w, h }),
      () => onMudar(u, null)
    );
  }

  return (
    <View style={s.campo}>
      <Text style={s.rotulo}>{rotulo}</Text>
      <View style={s.linha}>
        <View style={[s.preview, redondo && { borderRadius: 32 }]}>
          {ocupado ? (
            <ActivityIndicator color={C.destaque} />
          ) : src ? (
            <Image source={{ uri: src }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : (
            <Icone name="image-outline" size={26} color={C.suave} />
          )}
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={s.botoes}>
            <TouchableOpacity style={s.btn} onPress={() => pegar('galeria')} disabled={ocupado}>
              <Icone name="image-multiple-outline" size={16} color={C.destaque2} />
              <Text style={s.btnTxt}>Galeria</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btn} onPress={() => pegar('camera')} disabled={ocupado}>
              <Icone name="camera-outline" size={16} color={C.destaque2} />
              <Text style={s.btnTxt}>Câmera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btn} onPress={() => setModoUrl(!modoUrl)} disabled={ocupado}>
              <Icone name="link-variant" size={16} color={C.destaque2} />
              <Text style={s.btnTxt}>URL</Text>
            </TouchableOpacity>
            {!!valor && (
              <TouchableOpacity style={[s.btn, { borderColor: C.perigo }]} onPress={() => onMudar('', null)} disabled={ocupado}>
                <Icone name="close" size={16} color={C.perigo} />
              </TouchableOpacity>
            )}
          </View>
          {modoUrl && (
            <View style={s.linha}>
              <TextInput
                style={s.input}
                value={url}
                onChangeText={setUrl}
                placeholder="https://..."
                placeholderTextColor={C.suave}
                autoCapitalize="none"
                onSubmitEditing={aplicarUrl}
              />
              <TouchableOpacity style={[s.btn, { backgroundColor: C.destaque, borderColor: C.destaque }]} onPress={aplicarUrl}>
                <Icone name="check" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
          {!!erro && <Text style={s.erro}>{erro}</Text>}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  campo: { marginTop: 4 },
  rotulo: { color: C.suave, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  preview: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: C.painel2,
    borderWidth: 1,
    borderColor: C.borda,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  botoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: C.destaque2,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  btnTxt: { color: C.destaque2, fontSize: 12, fontWeight: '700' },
  input: {
    flex: 1,
    backgroundColor: C.painel2,
    borderWidth: 1,
    borderColor: C.borda,
    color: C.texto,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
  },
  erro: { color: C.perigo, fontSize: 12 },
});
