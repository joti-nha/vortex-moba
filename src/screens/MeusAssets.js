import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons as Icone } from '@expo/vector-icons';
import { AssetMini } from '../components/AssetMini';
import { EditorObjeto } from '../components/EditorObjeto';
import FichaVortex, { FICHA_VAZIA, porNome } from '../components/Ficha';
import { ModalNome } from '../components/ModalNome';
import { C } from '../config/theme';
import { TIPOS_ASSET } from '../data/constantes';
import { Topo } from './Packs';
import { assetDaFicha, assetsDe, carregarMeusAssets, fichaDoAsset, resumoAsset } from '../services/assets';
import { apagar, salvar } from '../services/firestore';
import { escolherArquivoVtt, importarVtt } from '../services/dungeondraft';
import { SEM_PASTA, agruparPorPasta, gerarId, pastasDe } from '../utils/util';
import { CabecalhoPasta } from '../components/CampoPasta';

// "Meus assets": personagens (fichas), objetos, estruturas e mapas do próprio usuário
export default function MeusAssets({ usuario, onVoltar, onAbrirPacks, onCriarMapa }) {
  const caminho = assetsDe(usuario.usuario);
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [aba, setAba] = useState('personagem');
  const [editFicha, setEditFicha] = useState(null);
  const [editObjeto, setEditObjeto] = useState(null);
  const [renomear, setRenomear] = useState(null);

  async function recarregar() {
    setCarregando(true);
    setErro('');
    try {
      setLista(await carregarMeusAssets(usuario.usuario));
    } catch (e) {
      setErro('Não foi possível carregar seus assets.');
    }
    setCarregando(false);
  }
  useEffect(() => {
    recarregar();
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return lista.filter((a) => a.tipo === aba && (!q || (a.nome || '').toLowerCase().includes(q)));
  }, [lista, busca, aba]);

  async function gravar(asset) {
    const final = { ...asset, id: asset.id || gerarId(), autor: asset.autor || usuario.nome, criadoEm: asset.criadoEm || Date.now(), atualizadoEm: Date.now() };
    await salvar(`${caminho}/${final.id}`, final);
    setLista((l) => porNome([...l.filter((x) => x.id !== final.id), final]));
  }

  async function remover(asset) {
    await apagar(`${caminho}/${asset.id}`);
    setLista((l) => l.filter((x) => x.id !== asset.id));
  }

  const [importando, setImportando] = useState(false);
  async function importarDD() {
    setErro('');
    try {
      const arq = await escolherArquivoVtt();
      if (!arq) return;
      setImportando(true);
      const m = await importarVtt(arq, { usuario });
      setLista((l) => porNome([...l, m]));
    } catch (e) {
      setErro(e.message || 'Não foi possível importar o mapa do Dungeondraft.');
    }
    setImportando(false);
  }

  function abrir(a) {
    if (a.tipo === 'personagem') setEditFicha(fichaDoAsset(a));
    else if (a.tipo === 'objeto') setEditObjeto(a);
    else if (a.tipo === 'mapa' && (a.itens || []).some((i) => i.type === 'tiles') && onCriarMapa) onCriarMapa(a);
    else setRenomear(a);
  }

  const contar = (t) => lista.filter((a) => a.tipo === t).length;
  const tipoAtual = TIPOS_ASSET.find((t) => t.id === aba);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Topo
        titulo="Meus assets"
        sub={`${lista.length} no total`}
        onVoltar={onVoltar}
        onRecarregar={recarregar}
        direita={
          <TouchableOpacity onPress={onAbrirPacks} style={s.btnPacks}>
            <Icone name="package-variant" size={18} color={C.destaque2} />
            <Text style={{ color: C.destaque2, fontWeight: '700', fontSize: 13 }}>Packs</Text>
          </TouchableOpacity>
        }
      />

      <View style={s.abas}>
        {TIPOS_ASSET.map((t) => (
          <TouchableOpacity key={t.id} onPress={() => setAba(t.id)} style={[s.aba, aba === t.id && s.abaAtiva]}>
            <Icone name={t.icone} size={18} color={aba === t.id ? C.destaque2 : C.suave} />
            <Text style={[s.abaTxt, aba === t.id && { color: C.destaque2 }]}>{t.nome}</Text>
            <Text style={s.abaNum}>{contar(t.id)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.busca}>
        <Icone name="magnify" size={18} color={C.suave} />
        <TextInput style={s.buscaInput} value={busca} onChangeText={setBusca} placeholder={`Buscar em ${tipoAtual.nome.toLowerCase()}`} placeholderTextColor={C.suave} />
      </View>

      {carregando ? (
        <ActivityIndicator color={C.destaque} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={s.lista}>
          {!!erro && <Text style={{ color: C.perigo, textAlign: 'center' }}>{erro}</Text>}
          {filtrados.length === 0 && !erro && (
            <View style={s.vazioCaixa}>
              <Icone name={tipoAtual.icone} size={40} color={C.suave} />
              <Text style={s.vazio}>Nada em {tipoAtual.nome.toLowerCase()} ainda.</Text>
              <Text style={s.vazioSub}>
                {aba === 'mapa'
                  ? 'Crie no botão + (criador de mapas), importe do Dungeondraft (botão de cima), salve a mesa pela aba Construir ou copie de um pack.'
                  : aba === 'estrutura'
                  ? 'Monte na mesa e salve pela aba Construir, ou copie de um pack.'
                  : 'Crie no botão + ou copie de um pack.'}
              </Text>
              <TouchableOpacity style={s.btnVazio} onPress={onAbrirPacks}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Ver packs</Text>
              </TouchableOpacity>
            </View>
          )}
          {agruparPorPasta(filtrados).map((g) => (
            <View key={g.pasta} style={{ gap: 10 }}>
              {(g.pasta !== SEM_PASTA || filtrados.some((a) => a.pasta)) && <CabecalhoPasta nome={g.pasta} quantidade={g.itens.length} />}
          {g.itens.map((a) => (
            <TouchableOpacity key={a.id} style={s.card} onPress={() => abrir(a)}>
              <AssetMini asset={a} tamanho={46} />
              <View style={{ flex: 1 }}>
                <Text style={s.nome}>{a.nome}</Text>
                <Text style={s.info}>{resumoAsset(a)}</Text>
                {!!a.descricao && a.tipo === 'personagem' && (
                  <Text style={s.desc} numberOfLines={2}>
                    {a.descricao}
                  </Text>
                )}
              </View>
              <Text style={[s.selo, a.origem ? s.seloPack : s.seloMeu]}>{a.origem ? 'de pack' : 'seu'}</Text>
            </TouchableOpacity>
          ))}
            </View>
          ))}
        </ScrollView>
      )}

      {aba === 'mapa' && !!onCriarMapa && (
        <TouchableOpacity style={s.fab} onPress={() => onCriarMapa(null)}>
          <Icone name="map-plus" size={26} color="#fff" />
        </TouchableOpacity>
      )}
      {aba === 'mapa' && (
        <TouchableOpacity style={[s.fab, { bottom: 92, backgroundColor: C.painel2, borderWidth: 1, borderColor: C.destaque2 }]} onPress={importarDD}>
          {importando ? <ActivityIndicator color={C.destaque2} /> : <Icone name="file-import-outline" size={24} color={C.destaque2} />}
        </TouchableOpacity>
      )}
      {(aba === 'personagem' || aba === 'objeto') && (
        <TouchableOpacity
          style={s.fab}
          onPress={() => (aba === 'personagem' ? setEditFicha({ ...FICHA_VAZIA }) : setEditObjeto({}))}
        >
          <Icone name="plus" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {editFicha && (
        <FichaVortex
          pastas={pastasDe(lista.filter((x) => x.tipo === 'personagem'))}
          ficha={editFicha}
          titulo={editFicha.origem ? 'Sua cópia (de um pack)' : 'Ficha Vortex'}
          onSalvar={async (f) => {
            await gravar(assetDaFicha(f));
            setEditFicha(null);
          }}
          onApagar={
            editFicha.id
              ? async () => {
                  await remover(editFicha);
                  setEditFicha(null);
                }
              : null
          }
          onFechar={() => setEditFicha(null)}
        />
      )}
      {editObjeto && (
        <EditorObjeto
          pastas={pastasDe(lista.filter((x) => x.tipo === 'objeto'))}
          asset={editObjeto}
          autor={usuario.nome}
          onSalvar={async (o) => {
            await gravar(o);
            setEditObjeto(null);
          }}
          onApagar={async () => {
            await remover(editObjeto);
            setEditObjeto(null);
          }}
          onFechar={() => setEditObjeto(null)}
        />
      )}
      {renomear && (
        <ModalNome
          titulo={renomear.nome}
          valorInicial={renomear.nome}
          detalhe={resumoAsset(renomear)}
          onConfirmar={async (nome) => {
            await gravar({ ...renomear, nome });
            setRenomear(null);
          }}
          onExcluir={async () => {
            await remover(renomear);
            setRenomear(null);
          }}
          onFechar={() => setRenomear(null)}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  btnPacks: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: C.destaque2, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  abas: { flexDirection: 'row', backgroundColor: C.painel, borderBottomWidth: 1, borderColor: C.borda },
  aba: { flex: 1, alignItems: 'center', paddingVertical: 8, borderBottomWidth: 2, borderColor: 'transparent' },
  abaAtiva: { borderColor: C.destaque2 },
  abaTxt: { color: C.suave, fontSize: 11, fontWeight: '700', marginTop: 2 },
  abaNum: { color: C.suave, fontSize: 10 },
  busca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.painel,
    borderWidth: 1,
    borderColor: C.borda,
    borderRadius: 10,
    paddingHorizontal: 10,
    margin: 12,
  },
  buscaInput: { flex: 1, color: C.texto, paddingVertical: 9 },
  lista: { paddingHorizontal: 12, paddingBottom: 100, gap: 10, maxWidth: 640, width: '100%', alignSelf: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.painel, borderRadius: 14, borderWidth: 1, borderColor: C.borda, padding: 12 },
  nome: { color: C.texto, fontWeight: '700', fontSize: 15 },
  info: { color: C.destaque2, fontSize: 12, marginTop: 2 },
  desc: { color: C.suave, fontSize: 12, marginTop: 4 },
  selo: { fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden', fontWeight: '700' },
  seloPack: { color: C.destaque2, backgroundColor: 'rgba(34,211,238,0.12)' },
  seloMeu: { color: C.destaque, backgroundColor: 'rgba(139,92,246,0.15)' },
  vazioCaixa: { alignItems: 'center', paddingVertical: 30, gap: 6 },
  vazio: { color: C.suave, textAlign: 'center' },
  vazioSub: { color: C.suave, fontSize: 12, textAlign: 'center' },
  btnVazio: { backgroundColor: C.destaque, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10, marginTop: 8 },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 58, height: 58, borderRadius: 29, backgroundColor: C.destaque, alignItems: 'center', justifyContent: 'center', elevation: 6 },
});
