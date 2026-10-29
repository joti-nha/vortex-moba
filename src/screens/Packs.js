import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Modal, Image, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons as Icone } from '@expo/vector-icons';
import { AssetMini } from '../components/AssetMini';
import { CampoImagem } from '../components/CampoImagem';
import { EditorObjeto } from '../components/EditorObjeto';
import FichaVortex from '../components/Ficha';
import { ModalNome } from '../components/ModalNome';
import { C, CORES } from '../config/theme';
import { ICONE_NICHO, NICHOS, NOME_TIPO_ASSET, TIPOS_ASSET } from '../data/constantes';
import { STATUS_PACK, assetDaFicha, assetsDe, carregarMeusAssets, carregarTodosPacks, ehOficial, fichaDoAsset, notificar, packEstaAtivo, resumoAsset, statusDoPack } from '../services/assets';
import { lerPacksAtivos, salvarPacksAtivos } from '../services/auth';
import { COL, apagar, atualizar, consultar, salvar } from '../services/firestore';
import { useImagem } from '../services/imagens';
import { gerarId } from '../utils/util';

const ICONES_PACK = ['cards-outline', 'shield-sword-outline', 'skull-outline', 'pine-tree', 'castle', 'glass-mug-variant', 'map-legend', 'rocket-launch-outline', 'ghost-outline', 'treasure-chest', 'home-city', 'dragon'];

export function CapaPack({ pack, tamanho = 56 }) {
  const src = useImagem(pack.capa);
  return (
    <View style={[ps.capa, { width: tamanho, height: tamanho, backgroundColor: pack.cor || C.destaque }]}>
      {src ? (
        <Image source={{ uri: src }} style={{ width: tamanho, height: tamanho }} resizeMode="cover" />
      ) : (
        <Icone name={pack.icone || 'cards-outline'} size={tamanho * 0.5} color="#fff" />
      )}
    </View>
  );
}

const contagem = (assets) =>
  TIPOS_ASSET.map((t) => [t, assets.filter((a) => a.tipo === t.id).length])
    .filter(([, n]) => n)
    .map(([t, n]) => `${n} ${t.nome.toLowerCase()}`)
    .join(' · ') || 'vazio';

function SeloStatus({ pack }) {
  const st = STATUS_PACK[statusDoPack(pack)];
  return (
    <View style={[ps.seloStatus, { borderColor: st.cor }]}>
      <Icone name={st.icone} size={11} color={st.cor} />
      <Text style={[ps.seloStatusTxt, { color: st.cor }]}>{st.nome}</Text>
    </View>
  );
}

function FiltroNicho({ valor, onMudar }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 12 }}>
      {[{ id: 'Todos', icone: 'apps' }, ...NICHOS].map((n) => (
        <TouchableOpacity key={n.id} onPress={() => onMudar(n.id)} style={[ps.chip, valor === n.id && ps.chipAtivo]}>
          <Icone name={n.icone} size={14} color={valor === n.id ? '#fff' : C.suave} />
          <Text style={[ps.chipTxt, valor === n.id && { color: '#fff' }]}>{n.id}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function AbasTopo({ abas, atual, onMudar }) {
  return (
    <View style={ps.abasTopo}>
      {abas.map((a) => (
        <TouchableOpacity key={a.id} onPress={() => onMudar(a.id)} style={[ps.abaTopo, atual === a.id && ps.abaTopoAtiva]}>
          <Icone name={a.icone} size={18} color={atual === a.id ? C.destaque2 : C.suave} />
          <Text style={[ps.abaTopoTxt, atual === a.id && { color: C.destaque2 }]}>{a.nome}</Text>
          {!!a.badge && (
            <View style={ps.badge}>
              <Text style={ps.badgeTxt}>{a.badge}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// Lista de assets de um pack, separada por abas de tipo
function AssetsDoPack({ assets, renderAcoes, onAbrir }) {
  const tipos = TIPOS_ASSET.filter((t) => assets.some((a) => a.tipo === t.id));
  const [aba, setAba] = useState(tipos[0] ? tipos[0].id : 'personagem');
  const efetiva = tipos.some((t) => t.id === aba) ? aba : tipos[0] ? tipos[0].id : aba;
  const lista = assets.filter((a) => a.tipo === efetiva);
  if (!assets.length) return <Text style={ps.vazio}>Nenhum asset neste pack ainda.</Text>;
  return (
    <View>
      <View style={ps.abas}>
        {tipos.map((t) => (
          <TouchableOpacity key={t.id} onPress={() => setAba(t.id)} style={[ps.aba, efetiva === t.id && ps.abaAtiva]}>
            <Icone name={t.icone} size={14} color={efetiva === t.id ? C.destaque2 : C.suave} />
            <Text style={[ps.abaTxt, efetiva === t.id && { color: C.destaque2 }]}>{t.nome}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {lista.map((a) => (
        <TouchableOpacity key={a.id} style={ps.assetLinha} onPress={() => onAbrir && onAbrir(a)} activeOpacity={onAbrir ? 0.6 : 1}>
          <AssetMini asset={a} tamanho={38} />
          <View style={{ flex: 1 }}>
            <Text style={ps.assetNome}>{a.nome}</Text>
            <Text style={ps.assetInfo}>{resumoAsset(a)}</Text>
          </View>
          {renderAcoes && renderAcoes(a)}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// Caixa com a última revisão do admin (comentário + aceitos/não aceitos)
function CaixaRevisao({ revisao }) {
  if (!revisao) return null;
  const cor = revisao.decisao === 'aprovado' ? C.ok : revisao.decisao === 'recusado' ? C.perigo : '#f97316';
  const titulo = revisao.decisao === 'aprovado' ? 'Aprovado' : revisao.decisao === 'recusado' ? 'Recusado' : 'Devolvido com ressalvas';
  return (
    <View style={[ps.revisao, { borderColor: cor }]}>
      <View style={ps.linha}>
        <Icone name="comment-quote-outline" size={16} color={cor} />
        <Text style={[ps.revisaoTit, { color: cor }]}>{titulo}</Text>
        <Text style={ps.revisaoPor}>por {revisao.por}</Text>
      </View>
      {!!revisao.comentario && <Text style={ps.revisaoTxt}>"{revisao.comentario}"</Text>}
      <Text style={ps.revisaoNums}>
        ✓ {(revisao.aceitos || []).length} aceitos · ✗ {(revisao.recusados || []).length} não aceitos
      </Text>
    </View>
  );
}

// ======== Gerenciador de packs editáveis (admin: oficiais · jogador: meus packs) ========
function GerenciadorPacks({ usuario, lista, setTodos, meus, modoAdmin, novoPack, renderStatus, podeEditar, filtroNicho, vazio }) {
  const [aberto, setAberto] = useState(null);
  const [editPack, setEditPack] = useState(null);
  const [editFicha, setEditFicha] = useState(null); // { asset, pack }
  const [editObjeto, setEditObjeto] = useState(null);
  const [renomear, setRenomear] = useState(null);
  const [importarPara, setImportarPara] = useState(null);

  async function gravarPack(p) {
    const { assets, ...dados } = p;
    const final = { ...dados, id: p.id || gerarId(), autor: p.autor || usuario.nome, criadoEm: p.criadoEm || Date.now(), atualizadoEm: Date.now() };
    await salvar(`${COL.packs}/${final.id}`, final);
    setTodos((l) => {
      const antigo = l.find((x) => x.id === final.id);
      const novo = { ...final, assets: antigo ? antigo.assets : [] };
      return antigo ? l.map((x) => (x.id === final.id ? novo : x)) : [...l, novo];
    });
    setEditPack(null);
  }

  async function excluirPack(p) {
    await Promise.all((p.assets || []).map((a) => apagar(`${COL.assets}/${a.id}`)));
    await apagar(`${COL.packs}/${p.id}`);
    setTodos((l) => l.filter((x) => x.id !== p.id));
    setEditPack(null);
  }

  async function gravarAsset(asset, packId) {
    const final = { ...asset, id: asset.id || gerarId(), pack: packId, autor: asset.autor || usuario.nome, criadoEm: asset.criadoEm || Date.now(), atualizadoEm: Date.now() };
    await salvar(`${COL.assets}/${final.id}`, final);
    setTodos((l) =>
      l.map((p) => (p.id === packId ? { ...p, assets: [...p.assets.filter((a) => a.id !== final.id), final].sort((a, b) => a.nome.localeCompare(b.nome)) } : p))
    );
  }

  async function excluirAsset(asset) {
    await apagar(`${COL.assets}/${asset.id}`);
    setTodos((l) => l.map((p) => ({ ...p, assets: p.assets.filter((a) => a.id !== asset.id) })));
  }

  async function importar(asset, pack) {
    const { origem, adicionadoEm, ...resto } = asset;
    await gravarAsset({ ...resto, id: gerarId(), criadoEm: Date.now() }, pack.id);
  }

  const visiveis = lista.filter((p) => filtroNicho === 'Todos' || p.nicho === filtroNicho);
  const marcaDe = (p, a) => {
    const r = p.revisao;
    if (!r || ehOficial(p)) return null;
    if ((r.aceitos || []).includes(a.id)) return 'ok';
    if ((r.recusados || []).includes(a.id)) return 'nao';
    return 'novo';
  };

  return (
    <View style={{ gap: 12 }}>
      <TouchableOpacity style={ps.btnNovo} onPress={() => setEditPack(novoPack())}>
        <Icone name="plus" size={20} color="#fff" />
        <Text style={{ color: '#fff', fontWeight: '800' }}>Novo pack</Text>
      </TouchableOpacity>
      {visiveis.length === 0 && <Text style={ps.vazio}>{vazio}</Text>}

      {visiveis.map((p) => {
        const editavel = podeEditar(p);
        return (
          <View key={p.id} style={ps.card}>
            <TouchableOpacity style={ps.cardTopo} onPress={() => setAberto(aberto === p.id ? null : p.id)}>
              <CapaPack pack={p} />
              <View style={{ flex: 1 }}>
                <Text style={ps.packNome}>{p.nome}</Text>
                <View style={ps.linha}>
                  <Icone name={ICONE_NICHO[p.nicho] || 'tag-outline'} size={12} color={C.destaque2} />
                  <Text style={ps.nicho}>{p.nicho || 'Outros'}</Text>
                  {modoAdmin ? (
                    <Text style={[ps.selo, p.publicado ? ps.seloPub : ps.seloRasc]}>{p.publicado ? 'Publicado' : 'Rascunho'}</Text>
                  ) : (
                    <SeloStatus pack={p} />
                  )}
                </View>
                <Text style={ps.packInfo}>
                  {contagem(p.assets)}
                  {modoAdmin && p.dono ? ` · de ${p.autor}` : ''}
                </Text>
              </View>
              {editavel && (
                <TouchableOpacity onPress={() => setEditPack(p)} style={{ padding: 6 }}>
                  <Icone name="pencil-outline" size={20} color={C.suave} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {modoAdmin && (
              <TouchableOpacity style={[ps.btnUsar, p.publicado && ps.btnUsarOn]} onPress={() => gravarPack({ ...p, publicado: !p.publicado })}>
                <Icone name={p.publicado ? 'earth' : 'earth-off'} size={18} color={p.publicado ? '#fff' : C.destaque2} />
                <Text style={[ps.btnUsarTxt, p.publicado && { color: '#fff' }]}>{p.publicado ? 'Publicado (toque para despublicar)' : 'Publicar para todos'}</Text>
              </TouchableOpacity>
            )}

            {renderStatus && renderStatus(p, gravarPack)}

            {aberto === p.id && (
              <View style={{ marginTop: 10 }}>
                {editavel ? (
                  <View style={ps.acoesPack}>
                    <BotaoMini icone="account-plus-outline" rotulo="Personagem" onPress={() => setEditFicha({ asset: { tipo: 'Inimigo', recursos: [{ nome: 'Vida', atual: 10, max: 10 }] }, pack: p })} />
                    <BotaoMini icone="cube-outline" rotulo="Objeto" onPress={() => setEditObjeto({ asset: {}, pack: p })} />
                    <BotaoMini icone="import" rotulo="Dos meus assets" onPress={() => setImportarPara(p)} />
                  </View>
                ) : (
                  <Text style={[ps.dica, { marginBottom: 6, marginTop: 0 }]}>
                    {statusDoPack(p) === 'pendente' ? 'Em análise: não dá para editar até a resposta do admin.' : 'Pack oficial: a edição agora é feita pelos admins.'}
                  </Text>
                )}
                <AssetsDoPack
                  key={p.assets.length}
                  assets={p.assets}
                  onAbrir={
                    editavel
                      ? (a) => {
                          if (a.tipo === 'personagem') setEditFicha({ asset: fichaDoAsset(a), pack: p });
                          else if (a.tipo === 'objeto') setEditObjeto({ asset: a, pack: p });
                          else setRenomear(a);
                        }
                      : null
                  }
                  renderAcoes={(a) => {
                    const m = marcaDe(p, a);
                    if (m === 'ok') return <Icone name="check-circle" size={18} color={C.ok} />;
                    if (m === 'nao') return <Icone name="close-circle" size={18} color={C.perigo} />;
                    if (m === 'novo') return <Text style={ps.novoTxt}>novo</Text>;
                    return editavel ? <Icone name="pencil-outline" size={16} color={C.suave} /> : null;
                  }}
                />
                {editavel && <Text style={ps.dica}>Estruturas e mapas são criados na mesa (aba Construir), salvos em Meus assets e trazidos com "Dos meus assets".</Text>}
              </View>
            )}
          </View>
        );
      })}

      {editPack && (
        <EditorPack
          pack={editPack}
          autor={usuario.nome}
          podePublicar={modoAdmin}
          onSalvar={gravarPack}
          onExcluir={editPack.id ? () => excluirPack(editPack) : null}
          onFechar={() => setEditPack(null)}
        />
      )}

      {editFicha && (
        <FichaVortex
          ficha={editFicha.asset}
          titulo={`Personagem · ${editFicha.pack.nome}`}
          onSalvar={async (f) => {
            await gravarAsset(assetDaFicha(f, { pack: editFicha.pack.id }), editFicha.pack.id);
            setEditFicha(null);
          }}
          onApagar={
            editFicha.asset.id
              ? async () => {
                  await excluirAsset(editFicha.asset);
                  setEditFicha(null);
                }
              : null
          }
          onFechar={() => setEditFicha(null)}
        />
      )}

      {editObjeto && (
        <EditorObjeto
          asset={editObjeto.asset}
          autor={usuario.nome}
          onSalvar={async (o) => {
            await gravarAsset(o, editObjeto.pack.id);
            setEditObjeto(null);
          }}
          onApagar={async () => {
            await excluirAsset(editObjeto.asset);
            setEditObjeto(null);
          }}
          onFechar={() => setEditObjeto(null)}
        />
      )}

      {renomear && (
        <ModalNome
          titulo={`${NOME_TIPO_ASSET[renomear.tipo]}: ${renomear.nome}`}
          valorInicial={renomear.nome}
          detalhe="Renomeie ou exclua este asset do pack."
          onConfirmar={async (n) => {
            await gravarAsset({ ...renomear, nome: n }, renomear.pack);
            setRenomear(null);
          }}
          onExcluir={async () => {
            await excluirAsset(renomear);
            setRenomear(null);
          }}
          onFechar={() => setRenomear(null)}
        />
      )}

      {importarPara && (
        <Modal transparent animationType="fade" onRequestClose={() => setImportarPara(null)}>
          <View style={ps.fundo}>
            <View style={ps.modal}>
              <View style={ps.linhaTopo}>
                <Text style={ps.modalTitulo}>Enviar para "{importarPara.nome}"</Text>
                <TouchableOpacity onPress={() => setImportarPara(null)}>
                  <Icone name="close" size={22} color={C.suave} />
                </TouchableOpacity>
              </View>
              <ScrollView>
                {meus.length === 0 && <Text style={ps.vazio}>Você ainda não tem assets próprios. Crie na mesa (aba Construir) ou em Meus assets.</Text>}
                {meus.map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    style={ps.assetLinha}
                    onPress={async () => {
                      await importar(a, importarPara);
                      setImportarPara(null);
                    }}
                  >
                    <AssetMini asset={a} tamanho={38} />
                    <View style={{ flex: 1 }}>
                      <Text style={ps.assetNome}>{a.nome}</Text>
                      <Text style={ps.assetInfo}>{NOME_TIPO_ASSET[a.tipo]} · {resumoAsset(a)}</Text>
                    </View>
                    <Icone name="send" size={18} color={C.destaque2} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

// ================= Packs (usuário): Oficiais + Meus packs =================
export function PacksUsuario({ usuario, onVoltar, abaInicial }) {
  const [aba, setAba] = useState(abaInicial || 'oficiais');
  const [todos, setTodos] = useState([]);
  const [ativos, setAtivos] = useState(null);
  const [meus, setMeus] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [nicho, setNicho] = useState('Todos');
  const [aberto, setAberto] = useState(null);
  const [vendo, setVendo] = useState(null);
  const [confirmarEnvio, setConfirmarEnvio] = useState(null);

  async function recarregar() {
    setCarregando(true);
    setErro('');
    try {
      const [p, at, m] = await Promise.all([carregarTodosPacks(), lerPacksAtivos(usuario.usuario), carregarMeusAssets(usuario.usuario)]);
      setTodos(p);
      setAtivos(at);
      setMeus(m);
    } catch (e) {
      setErro('Não foi possível carregar os packs.');
    }
    setCarregando(false);
  }
  useEffect(() => {
    recarregar();
  }, []);

  const oficiais = todos.filter((p) => ehOficial(p) && p.publicado);
  const meusPacks = todos.filter((p) => p.dono === usuario.usuario);
  const copiados = {};
  meus.forEach((m) => m.origem && (copiados[m.origem] = true));

  function alternar(p) {
    const usaveis = todos.filter((x) => (ehOficial(x) && x.publicado) || x.dono === usuario.usuario).map((x) => x.id);
    const atual = ativos === null ? usaveis : ativos;
    const novo = atual.includes(p.id) ? atual.filter((x) => x !== p.id) : [...atual, p.id];
    setAtivos(novo);
    salvarPacksAtivos(usuario.usuario, novo).catch(() => setErro('Erro ao salvar sua escolha.'));
  }

  async function copiar(a) {
    const { pack, ...resto } = a;
    const id = `pk_${a.id}`;
    await salvar(`${assetsDe(usuario.usuario)}/${id}`, { ...resto, id, origem: a.id, adicionadoEm: Date.now() });
    setMeus((l) => [...l, { ...resto, id, origem: a.id }]);
  }

  async function oficializar(p, gravarPack) {
    setConfirmarEnvio(null);
    if (!p.assets.length) return setErro('Adicione ao menos um asset antes de pedir a oficialização.');
    await gravarPack({ ...p, status: 'pendente', enviadoEm: Date.now() });
    await notificar('admins', {
      tipo: 'pedido',
      packId: p.id,
      texto: `${usuario.nome} enviou o pack "${p.nome}" (${p.assets.length} assets) para oficialização.`,
    });
  }

  const botaoUsar = (p) => {
    const ativo = packEstaAtivo(ativos, p.id);
    return (
      <TouchableOpacity style={[ps.btnUsar, ativo && ps.btnUsarOn]} onPress={() => alternar(p)}>
        <Icone name={ativo ? 'check-circle' : 'plus-circle-outline'} size={18} color={ativo ? '#fff' : C.destaque2} />
        <Text style={[ps.btnUsarTxt, ativo && { color: '#fff' }]}>{ativo ? 'Usando na mesa' : 'Usar na mesa'}</Text>
      </TouchableOpacity>
    );
  };

  const nAtivos = oficiais.filter((p) => packEstaAtivo(ativos, p.id)).length;
  const nRetornos = meusPacks.filter((p) => p.status === 'ressalvas' || p.status === 'recusado').length;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Topo titulo="Packs de assets" sub={`${nAtivos} oficiais em uso · ${meusPacks.length} seus`} onVoltar={onVoltar} onRecarregar={recarregar} />
      <AbasTopo
        abas={[
          { id: 'oficiais', nome: 'Oficiais', icone: 'check-decagram' },
          { id: 'meus', nome: 'Meus packs', icone: 'package-variant-closed', badge: nRetornos || null },
        ]}
        atual={aba}
        onMudar={setAba}
      />
      <View style={{ paddingVertical: 8 }}>
        <FiltroNicho valor={nicho} onMudar={setNicho} />
      </View>
      {carregando ? (
        <ActivityIndicator color={C.destaque} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={ps.lista}>
          {!!erro && <Text style={ps.erro}>{erro}</Text>}

          {aba === 'oficiais' ? (
            <>
              <Text style={ps.explica}>Packs ativados aparecem na aba Assets da mesa, prontos para colocar no mapa.</Text>
              {oficiais.filter((p) => nicho === 'Todos' || p.nicho === nicho).length === 0 && <Text style={ps.vazio}>Nenhum pack neste nicho.</Text>}
              {oficiais
                .filter((p) => nicho === 'Todos' || p.nicho === nicho)
                .map((p) => {
                  const ativo = packEstaAtivo(ativos, p.id);
                  return (
                    <View key={p.id} style={[ps.card, ativo && { borderColor: p.cor || C.destaque }]}>
                      <TouchableOpacity style={ps.cardTopo} onPress={() => setAberto(aberto === p.id ? null : p.id)}>
                        <CapaPack pack={p} />
                        <View style={{ flex: 1 }}>
                          <Text style={ps.packNome}>{p.nome}</Text>
                          <View style={ps.linha}>
                            <Icone name={ICONE_NICHO[p.nicho] || 'tag-outline'} size={12} color={C.destaque2} />
                            <Text style={ps.nicho}>{p.nicho || 'Outros'}</Text>
                            {!!p.dono && <Text style={ps.packInfo}> · por {p.autor}</Text>}
                          </View>
                          <Text style={ps.packInfo}>{contagem(p.assets)}</Text>
                        </View>
                        <Icone name={aberto === p.id ? 'chevron-up' : 'chevron-down'} size={20} color={C.suave} />
                      </TouchableOpacity>
                      {!!p.descricao && <Text style={ps.desc}>{p.descricao}</Text>}
                      <View style={ps.previa}>
                        {p.assets.slice(0, 7).map((a) => (
                          <AssetMini key={a.id} asset={a} tamanho={30} />
                        ))}
                      </View>
                      {botaoUsar(p)}
                      {aberto === p.id && (
                        <View style={{ marginTop: 10 }}>
                          <AssetsDoPack
                            assets={p.assets}
                            onAbrir={(a) => setVendo(a)}
                            renderAcoes={(a) => (
                              <TouchableOpacity onPress={() => !copiados[a.id] && copiar(a)} style={{ padding: 6 }}>
                                <Icone name={copiados[a.id] ? 'check' : 'content-copy'} size={18} color={copiados[a.id] ? C.ok : C.suave} />
                              </TouchableOpacity>
                            )}
                          />
                          <Text style={ps.dica}>Toque em um personagem para ver a ficha. O ícone de copiar leva o asset para Meus assets.</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
            </>
          ) : (
            <>
              <Text style={ps.explica}>
                Crie seus próprios packs e use na mesa. Quando estiver pronto, toque em "Oficializar" para enviar aos admins: se aprovado, ele fica disponível para todos.
              </Text>
              <GerenciadorPacks
                usuario={usuario}
                lista={meusPacks}
                setTodos={setTodos}
                meus={meus}
                filtroNicho={nicho}
                vazio="Você ainda não criou nenhum pack."
                podeEditar={(p) => !ehOficial(p) && p.status !== 'pendente'}
                novoPack={() => ({
                  nome: '',
                  nicho: nicho === 'Todos' ? 'Fantasia' : nicho,
                  descricao: '',
                  cor: CORES[7],
                  icone: 'cards-outline',
                  capa: '',
                  publicado: false,
                  oficial: false,
                  status: 'privado',
                  dono: usuario.usuario,
                  autor: usuario.nome,
                })}
                renderStatus={(p, gravarPack) => {
                  const st = statusDoPack(p);
                  return (
                    <View style={{ marginTop: 8, gap: 8 }}>
                      <CaixaRevisao revisao={p.revisao} />
                      {botaoUsar(p)}
                      {(st === 'privado' || st === 'ressalvas' || st === 'recusado') && (
                        <TouchableOpacity style={ps.btnOficializar} onPress={() => setConfirmarEnvio({ p, gravarPack })}>
                          <Icone name="check-decagram-outline" size={18} color="#000" />
                          <Text style={ps.btnOficializarTxt}>{p.revisao ? 'Reenviar para oficialização' : 'Oficializar'}</Text>
                        </TouchableOpacity>
                      )}
                      {st === 'pendente' && (
                        <TouchableOpacity style={[ps.btnUsar, { borderColor: C.suave }]} onPress={() => gravarPack({ ...p, status: p.revisao ? 'ressalvas' : 'privado' })}>
                          <Icone name="undo" size={16} color={C.suave} />
                          <Text style={[ps.btnUsarTxt, { color: C.suave }]}>Cancelar envio</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                }}
              />
            </>
          )}
        </ScrollView>
      )}

      {vendo && vendo.tipo === 'personagem' && (
        <FichaVortex
          ficha={fichaDoAsset(vendo)}
          titulo="Ficha do pack"
          somenteLeitura
          acaoExtra={{
            rotulo: copiados[vendo.id] ? 'Já copiado' : 'Copiar para Meus assets',
            icone: copiados[vendo.id] ? 'check' : 'content-copy',
            desativado: copiados[vendo.id],
            onPress: () => copiar(vendo).then(() => setVendo(null)),
          }}
          onFechar={() => setVendo(null)}
        />
      )}

      {confirmarEnvio && (
        <ModalNome
          titulo={`Oficializar "${confirmarEnvio.p.nome}"?`}
          valorInicial={confirmarEnvio.p.nome}
          rotuloBotao="Enviar aos admins"
          detalhe={`${contagem(confirmarEnvio.p.assets)}. Enquanto estiver em análise, o pack não pode ser editado. Confirme o nome do pack:`}
          onConfirmar={async (n) => {
            await oficializar({ ...confirmarEnvio.p, nome: n }, confirmarEnvio.gravarPack);
          }}
          onFechar={() => setConfirmarEnvio(null)}
        />
      )}
    </View>
  );
}

// ================= Postagens (admin): Oficiais + Pendentes =================
export function Postagens({ usuario, onVoltar, abaInicial }) {
  const [aba, setAba] = useState(abaInicial || 'oficiais');
  const [todos, setTodos] = useState([]);
  const [meus, setMeus] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [nicho, setNicho] = useState('Todos');

  async function recarregar() {
    setCarregando(true);
    setErro('');
    try {
      const [p, m] = await Promise.all([carregarTodosPacks(), carregarMeusAssets(usuario.usuario)]);
      setTodos(p);
      setMeus(m);
    } catch (e) {
      setErro('Não foi possível carregar as postagens.');
    }
    setCarregando(false);
  }
  useEffect(() => {
    recarregar();
  }, []);

  const oficiais = todos.filter(ehOficial);
  const pendentes = todos.filter((p) => !ehOficial(p) && p.status === 'pendente').sort((a, b) => (a.enviadoEm || 0) - (b.enviadoEm || 0));

  // decisão sobre um pedido de oficialização
  async function decidir(p, decisao, marcas, comentario) {
    const aceitos = p.assets.filter((a) => marcas[a.id] !== false).map((a) => a.id);
    const recusados = p.assets.filter((a) => marcas[a.id] === false).map((a) => a.id);
    if (decisao === 'aprovado' && !aceitos.length) throw new Error('Marque ao menos um asset para aprovar.');
    if (decisao === 'ressalvas' && !comentario.trim()) throw new Error('Escreva as ressalvas no comentário.');
    const revisao = { decisao, comentario: comentario.trim(), aceitos, recusados, por: usuario.nome, em: Date.now() };
    const { assets, ...dados } = p;
    let novo;
    let assetsFinais = p.assets;

    if (decisao === 'aprovado') {
      // assets não aceitos saem do pack e voltam para os assets pessoais do criador
      const fora = p.assets.filter((a) => recusados.includes(a.id));
      await Promise.all(
        fora.map(async (a) => {
          const { pack, ...resto } = a;
          await salvar(`${assetsDe(p.dono)}/${a.id}`, resto);
          await apagar(`${COL.assets}/${a.id}`);
        })
      );
      assetsFinais = p.assets.filter((a) => aceitos.includes(a.id));
      novo = { ...dados, status: 'aceito', oficial: true, publicado: true, revisao, oficializadoEm: Date.now() };
    } else {
      novo = { ...dados, status: decisao, revisao };
    }
    await salvar(`${COL.packs}/${p.id}`, novo);
    setTodos((l) => l.map((x) => (x.id === p.id ? { ...novo, assets: assetsFinais } : x)));

    const textos = {
      aprovado: `Seu pack "${p.nome}" foi oficializado! ✓ ${aceitos.length} aceitos${recusados.length ? `, ✗ ${recusados.length} voltaram para Meus assets` : ''}.`,
      ressalvas: `Seu pack "${p.nome}" voltou com ressalvas: ✓ ${aceitos.length} aceitos, ✗ ${recusados.length} não aceitos.`,
      recusado: `Seu pack "${p.nome}" não foi aceito.`,
    };
    await notificar(p.dono, { tipo: 'revisao', decisao, packId: p.id, texto: textos[decisao], comentario: revisao.comentario, por: usuario.nome });

    // o pedido some da caixa de todos os admins
    const pedidos = await consultar(COL.notificacoes, 'para', 'admins');
    await Promise.all(pedidos.filter((n) => n.packId === p.id && !n.lida).map((n) => atualizar(`${COL.notificacoes}/${n.id}`, { lida: true })));
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Topo titulo="Postagens" sub="Packs oficiais e pedidos de oficialização" onVoltar={onVoltar} onRecarregar={recarregar} />
      <View style={ps.faixaAdmin}>
        <Icone name="shield-crown-outline" size={16} color="#fff" />
        <Text style={ps.faixaAdminTxt}>ADMIN · rascunhos só aparecem para os admins até serem publicados</Text>
      </View>
      <AbasTopo
        abas={[
          { id: 'oficiais', nome: 'Oficiais', icone: 'check-decagram' },
          { id: 'pendentes', nome: 'Pedidos', icone: 'inbox-arrow-down', badge: pendentes.length || null },
        ]}
        atual={aba}
        onMudar={setAba}
      />
      {aba === 'oficiais' && (
        <View style={{ paddingVertical: 8 }}>
          <FiltroNicho valor={nicho} onMudar={setNicho} />
        </View>
      )}
      {carregando ? (
        <ActivityIndicator color={C.destaque} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={ps.lista}>
          {!!erro && <Text style={ps.erro}>{erro}</Text>}
          {aba === 'oficiais' ? (
            <GerenciadorPacks
              usuario={usuario}
              lista={oficiais}
              setTodos={setTodos}
              meus={meus}
              modoAdmin
              filtroNicho={nicho}
              vazio="Nenhum pack oficial neste nicho."
              podeEditar={() => true}
              novoPack={() => ({
                nome: '',
                nicho: nicho === 'Todos' ? 'Fantasia' : nicho,
                descricao: '',
                cor: CORES[7],
                icone: 'cards-outline',
                capa: '',
                publicado: false,
                oficial: true,
                ordem: oficiais.length + 1,
              })}
            />
          ) : (
            <>
              {pendentes.length === 0 && (
                <View style={{ alignItems: 'center', paddingVertical: 30, gap: 6 }}>
                  <Icone name="inbox-outline" size={40} color={C.suave} />
                  <Text style={ps.vazio}>Nenhum pedido de oficialização.</Text>
                </View>
              )}
              {pendentes.map((p) => (
                <CartaoRevisao key={p.id} pack={p} onDecidir={(d, m, c) => decidir(p, d, m, c)} />
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// Cartão de análise de um pedido: marca cada asset como aceito/não aceito + comentário
function CartaoRevisao({ pack, onDecidir }) {
  const [marcas, setMarcas] = useState({});
  const [comentario, setComentario] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [vendo, setVendo] = useState(null);
  const aceitosN = pack.assets.filter((a) => marcas[a.id] !== false).length;

  async function enviar(decisao) {
    setErro('');
    setOcupado(true);
    try {
      await onDecidir(decisao, marcas, comentario);
    } catch (e) {
      setErro(e.message || 'Erro ao registrar a decisão.');
      setOcupado(false);
    }
  }

  return (
    <View style={[ps.card, { borderColor: '#eab308' }]}>
      <View style={ps.cardTopo}>
        <CapaPack pack={pack} />
        <View style={{ flex: 1 }}>
          <Text style={ps.packNome}>{pack.nome}</Text>
          <Text style={ps.packInfo}>
            por {pack.autor} · {pack.nicho} · enviado em {pack.enviadoEm ? new Date(pack.enviadoEm).toLocaleDateString('pt-BR') : '—'}
          </Text>
          <Text style={ps.packInfo}>{contagem(pack.assets)}</Text>
        </View>
      </View>
      {!!pack.descricao && <Text style={ps.desc}>{pack.descricao}</Text>}
      {pack.revisao && (
        <View style={{ marginTop: 8 }}>
          <Text style={ps.dica}>Reenvio. Revisão anterior:</Text>
          <CaixaRevisao revisao={pack.revisao} />
        </View>
      )}

      <Text style={ps.rotulo}>Assets ({aceitosN} de {pack.assets.length} aceitos)</Text>
      <AssetsDoPack
        assets={pack.assets}
        onAbrir={(a) => a.tipo === 'personagem' && setVendo(a)}
        renderAcoes={(a) => {
          const ok = marcas[a.id] !== false;
          return (
            <TouchableOpacity onPress={() => setMarcas({ ...marcas, [a.id]: !ok })} style={[ps.marca, { borderColor: ok ? C.ok : C.perigo }]}>
              <Icone name={ok ? 'check' : 'close'} size={16} color={ok ? C.ok : C.perigo} />
              <Text style={{ color: ok ? C.ok : C.perigo, fontSize: 11, fontWeight: '700' }}>{ok ? 'Aceito' : 'Não'}</Text>
            </TouchableOpacity>
          );
        }}
      />

      <Text style={ps.rotulo}>Comentário para o criador</Text>
      <TextInput
        style={[ps.input, { minHeight: 60, textAlignVertical: 'top' }]}
        value={comentario}
        onChangeText={setComentario}
        multiline
        placeholder="Ex.: o dragão está forte demais para um pack inicial; ajuste a Vida."
        placeholderTextColor={C.suave}
      />
      {!!erro && <Text style={[ps.erro, { marginTop: 6 }]}>{erro}</Text>}
      <View style={[ps.acoes, { flexWrap: 'wrap' }]}>
        <TouchableOpacity style={[ps.btnDecisao, { borderColor: C.perigo }]} onPress={() => enviar('recusado')} disabled={ocupado}>
          <Icone name="close-octagon-outline" size={16} color={C.perigo} />
          <Text style={[ps.btnDecisaoTxt, { color: C.perigo }]}>Recusar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[ps.btnDecisao, { borderColor: '#f97316' }]} onPress={() => enviar('ressalvas')} disabled={ocupado}>
          <Icone name="message-alert-outline" size={16} color="#f97316" />
          <Text style={[ps.btnDecisaoTxt, { color: '#f97316' }]}>Ressalvas</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[ps.btnDecisao, { backgroundColor: C.ok, borderColor: C.ok }]} onPress={() => enviar('aprovado')} disabled={ocupado}>
          {ocupado ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Icone name="check-decagram" size={16} color="#fff" />
              <Text style={[ps.btnDecisaoTxt, { color: '#fff' }]}>{aceitosN === pack.assets.length ? 'Aprovar' : `Aprovar ${aceitosN}`}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      <Text style={ps.dica}>
        Aprovar: o pack vira oficial com os assets marcados; os não aceitos voltam para Meus assets do criador. Ressalvas: o pack volta ao criador com o comentário e as marcações para ajustar e reenviar.
      </Text>

      {vendo && <FichaVortex ficha={fichaDoAsset(vendo)} titulo="Ficha enviada" somenteLeitura onFechar={() => setVendo(null)} />}
    </View>
  );
}

function EditorPack({ pack, autor, podePublicar, onSalvar, onExcluir, onFechar }) {
  const [f, setF] = useState(pack);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  async function ok() {
    if ((f.nome || '').trim().length < 2) return setErro('Dê um nome ao pack.');
    setOcupado(true);
    try {
      await onSalvar({ ...f, nome: f.nome.trim(), descricao: (f.descricao || '').trim() });
    } catch (e) {
      setErro('Erro ao salvar.');
      setOcupado(false);
    }
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onFechar}>
      <View style={ps.fundo}>
        <View style={ps.modal}>
          <View style={ps.linhaTopo}>
            <CapaPack pack={f} tamanho={44} />
            <Text style={ps.modalTitulo}>{f.id ? 'Editar pack' : 'Novo pack'}</Text>
            <TouchableOpacity onPress={onFechar}>
              <Icone name="close" size={22} color={C.suave} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={ps.rotulo}>Nome</Text>
            <TextInput style={ps.input} value={f.nome} onChangeText={(t) => set('nome', t)} placeholder="Ex.: Cidade Portuária" placeholderTextColor={C.suave} />
            <Text style={ps.rotulo}>Nicho</Text>
            <View style={ps.wrap}>
              {NICHOS.map((n) => (
                <TouchableOpacity key={n.id} onPress={() => set('nicho', n.id)} style={[ps.chip, f.nicho === n.id && ps.chipAtivo]}>
                  <Icone name={n.icone} size={13} color={f.nicho === n.id ? '#fff' : C.suave} />
                  <Text style={[ps.chipTxt, f.nicho === n.id && { color: '#fff' }]}>{n.id}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={ps.rotulo}>Descrição</Text>
            <TextInput style={[ps.input, { minHeight: 56, textAlignVertical: 'top' }]} value={f.descricao} onChangeText={(t) => set('descricao', t)} multiline />
            <Text style={ps.rotulo}>Cor e ícone</Text>
            <View style={ps.wrap}>
              {CORES.map((c) => (
                <TouchableOpacity key={c} onPress={() => set('cor', c)} style={[ps.cor, { backgroundColor: c }, f.cor === c && ps.corSel]} />
              ))}
            </View>
            <View style={[ps.wrap, { marginTop: 8 }]}>
              {ICONES_PACK.map((i) => (
                <TouchableOpacity key={i} onPress={() => set('icone', i)} style={[ps.iconeOp, f.icone === i && ps.chipAtivo]}>
                  <Icone name={i} size={20} color={f.icone === i ? '#fff' : C.suave} />
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ marginTop: 10 }}>
              <CampoImagem valor={f.capa} onMudar={(ref) => set('capa', ref)} largura={600} rotulo="Capa (opcional, substitui o ícone)" autor={autor} />
            </View>
            {podePublicar && (
              <TouchableOpacity style={[ps.btnUsar, f.publicado && ps.btnUsarOn, { marginTop: 14 }]} onPress={() => set('publicado', !f.publicado)}>
                <Icone name={f.publicado ? 'earth' : 'earth-off'} size={18} color={f.publicado ? '#fff' : C.destaque2} />
                <Text style={[ps.btnUsarTxt, f.publicado && { color: '#fff' }]}>{f.publicado ? 'Publicado' : 'Rascunho (não publicado)'}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
          {!!erro && <Text style={ps.erro}>{erro}</Text>}
          <View style={ps.acoes}>
            {!!onExcluir && (
              <TouchableOpacity style={[ps.btn, { borderWidth: 1, borderColor: C.perigo }]} onPress={() => (confirmar ? onExcluir() : setConfirmar(true))}>
                <Text style={{ color: C.perigo, fontWeight: '700' }}>{confirmar ? 'Excluir pack e assets?' : 'Excluir'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[ps.btn, { backgroundColor: C.destaque }]} onPress={ok} disabled={ocupado}>
              {ocupado ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Salvar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function BotaoMini({ icone, rotulo, onPress }) {
  return (
    <TouchableOpacity style={ps.botaoMini} onPress={onPress}>
      <Icone name={icone} size={16} color={C.destaque2} />
      <Text style={ps.botaoMiniTxt}>{rotulo}</Text>
    </TouchableOpacity>
  );
}

export function Topo({ titulo, sub, onVoltar, onRecarregar, direita }) {
  return (
    <View style={ps.topo}>
      <TouchableOpacity onPress={onVoltar} style={{ padding: 6 }}>
        <Icone name="arrow-left" size={22} color={C.texto} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={ps.titulo}>{titulo}</Text>
        {!!sub && <Text style={ps.sub}>{sub}</Text>}
      </View>
      {direita}
      {!!onRecarregar && (
        <TouchableOpacity onPress={onRecarregar} style={{ padding: 6 }}>
          <Icone name="refresh" size={20} color={C.suave} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const ps = StyleSheet.create({
  topo: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, backgroundColor: C.painel, borderBottomWidth: 1, borderColor: C.borda },
  titulo: { color: C.texto, fontWeight: '700', fontSize: 17 },
  sub: { color: C.suave, fontSize: 11 },
  explica: { color: C.suave, fontSize: 12 },
  abasTopo: { flexDirection: 'row', backgroundColor: C.painel, borderBottomWidth: 1, borderColor: C.borda },
  abaTopo: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderBottomWidth: 2, borderColor: 'transparent' },
  abaTopoAtiva: { borderColor: C.destaque2 },
  abaTopoTxt: { color: C.suave, fontWeight: '700', fontSize: 13 },
  badge: { backgroundColor: C.perigo, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
  faixaAdmin: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.destaque, paddingHorizontal: 12, paddingVertical: 6 },
  faixaAdminTxt: { color: '#fff', fontSize: 11, fontWeight: '700', flex: 1 },
  lista: { padding: 12, paddingBottom: 60, gap: 12, maxWidth: 680, width: '100%', alignSelf: 'center' },
  card: { backgroundColor: C.painel, borderRadius: 14, borderWidth: 1, borderColor: C.borda, padding: 12 },
  cardTopo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  capa: { borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  packNome: { color: C.texto, fontWeight: '800', fontSize: 16 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'wrap' },
  nicho: { color: C.destaque2, fontSize: 12 },
  packInfo: { color: C.suave, fontSize: 11, marginTop: 2 },
  desc: { color: C.suave, fontSize: 12, marginTop: 8 },
  previa: { flexDirection: 'row', gap: 4, marginTop: 10, flexWrap: 'wrap' },
  btnUsar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: C.destaque2, borderRadius: 10, paddingVertical: 9, marginTop: 10 },
  btnUsarOn: { backgroundColor: C.destaque, borderColor: C.destaque },
  btnUsarTxt: { color: C.destaque2, fontWeight: '800', fontSize: 13 },
  btnOficializar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#eab308', borderRadius: 10, paddingVertical: 10 },
  btnOficializarTxt: { color: '#000', fontWeight: '800', fontSize: 13 },
  selo: { fontSize: 10, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, marginLeft: 8, overflow: 'hidden', fontWeight: '700' },
  seloPub: { color: '#fff', backgroundColor: C.ok },
  seloRasc: { color: '#000', backgroundColor: '#f59e0b' },
  seloStatus: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, marginLeft: 8 },
  seloStatusTxt: { fontSize: 10, fontWeight: '800' },
  revisao: { borderWidth: 1, borderRadius: 10, padding: 10, backgroundColor: C.bg, gap: 4 },
  revisaoTit: { fontWeight: '800', fontSize: 13 },
  revisaoPor: { color: C.suave, fontSize: 11, marginLeft: 4 },
  revisaoTxt: { color: C.texto, fontSize: 13, fontStyle: 'italic' },
  revisaoNums: { color: C.suave, fontSize: 11 },
  novoTxt: { color: C.destaque2, fontSize: 10, fontWeight: '800' },
  marca: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  abas: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 6 },
  aba: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderBottomWidth: 2, borderColor: 'transparent' },
  abaAtiva: { borderColor: C.destaque2 },
  abaTxt: { color: C.suave, fontSize: 12, fontWeight: '700' },
  assetLinha: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  assetNome: { color: C.texto, fontWeight: '600' },
  assetInfo: { color: C.suave, fontSize: 11 },
  dica: { color: C.suave, fontSize: 11, marginTop: 8, fontStyle: 'italic' },
  vazio: { color: C.suave, textAlign: 'center', paddingVertical: 16 },
  erro: { color: C.perigo, textAlign: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: C.borda },
  chipAtivo: { backgroundColor: C.destaque, borderColor: C.destaque },
  chipTxt: { color: C.suave, fontSize: 12, fontWeight: '600' },
  btnNovo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.destaque, borderRadius: 12, paddingVertical: 12 },
  acoesPack: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  botaoMini: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: C.destaque2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  botaoMiniTxt: { color: C.destaque2, fontSize: 12, fontWeight: '700' },
  btnDecisao: { flex: 1, minWidth: 96, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderRadius: 10, paddingVertical: 10 },
  btnDecisaoTxt: { fontWeight: '800', fontSize: 13 },
  fundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 14 },
  modal: { width: '100%', maxWidth: 460, maxHeight: '92%', backgroundColor: C.painel, borderRadius: 16, borderWidth: 1, borderColor: C.borda, padding: 16 },
  linhaTopo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  modalTitulo: { color: C.texto, fontWeight: '800', fontSize: 17, flex: 1 },
  rotulo: { color: C.suave, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: C.painel2, borderWidth: 1, borderColor: C.borda, color: C.texto, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cor: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'transparent' },
  corSel: { borderColor: '#fff' },
  iconeOp: { width: 38, height: 38, borderRadius: 8, borderWidth: 1, borderColor: C.borda, alignItems: 'center', justifyContent: 'center' },
  acoes: { flexDirection: 'row', gap: 8, marginTop: 14 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
});
