// Criador de mapas (estilo "dungeon maker"): gere masmorras, cavernas e labirintos,
// pinte salas, terrenos, portas e escadas, escolha o tema e salve em Meus assets › Mapas.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, PanResponder, Platform, ActivityIndicator } from 'react-native';
import Svg, { G, Path, Rect } from 'react-native-svg';
import { MaterialCommunityIcons as Icone } from '@expo/vector-icons';
import { MapaTilesSvg, TEMAS_MAPA } from '../components/MapaTiles';
import { Topo } from './Packs';
import { C } from '../config/theme';
import { salvar } from '../services/firestore';
import { assetsDe } from '../services/assets';
import { gerarId, limitar } from '../utils/util';
import { GERADORES, TERRENOS, VAZIO, deLinhas, ehPiso, gradeVazia, paraLinhas, pintar, preencherRet } from '../utils/masmorra';

const CEL_MUNDO = 70; // tamanho da célula quando o mapa vai para a mesa
const TAMANHOS = [
  [20, 15],
  [30, 20],
  [40, 30],
  [60, 40],
];
const FERRAMENTAS_MAPA = [
  { id: 'pincel', nome: 'Pincel', icone: 'brush' },
  { id: 'sala', nome: 'Sala', icone: 'vector-square' },
  { id: 'borracha', nome: 'Borracha', icone: 'eraser' },
  { id: 'porta', nome: 'Porta', icone: 'door' },
  { id: 'escada', nome: 'Escada', icone: 'stairs' },
  { id: 'mover', nome: 'Mover', icone: 'hand-back-right-outline' },
];
const novaSemente = () => Math.floor(Math.random() * 1e9);

export default function CriadorMapas({ usuario, asset, onVoltar }) {
  // mapa existente (edição) ou novo
  const tilesOrig = asset && (asset.itens || []).find((i) => i.type === 'tiles');
  const g = useRef(tilesOrig ? deLinhas(tilesOrig.linhas) : null);
  const [cols, setCols] = useState(tilesOrig ? tilesOrig.cols : 30);
  const [rows, setRows] = useState(tilesOrig ? tilesOrig.rows : 20);
  const [versao, setVersao] = useState(0);
  const historico = useRef([]);

  const [nome, setNome] = useState(asset ? asset.nome : '');
  const [tema, setTema] = useState(tilesOrig ? tilesOrig.tema : 'pedra');
  const [mostrarGrade, setMostrarGrade] = useState(tilesOrig ? tilesOrig.mostrarGrade !== false : true);
  const [aba, setAba] = useState(tilesOrig ? 'pintar' : 'gerar');
  const [gerador, setGerador] = useState((asset && asset.gerador && asset.gerador.tipo) || 'masmorra');
  const [semente, setSemente] = useState((asset && asset.gerador && asset.gerador.semente) || novaSemente());
  const [salas, setSalas] = useState(9);
  const [agua, setAgua] = useState(true);
  const [ferramenta, setFerramenta] = useState('pincel');
  const [terreno, setTerreno] = useState('#');
  const [raio, setRaio] = useState(0);
  const [view, setView] = useState({ x: 10, y: 10, s: 16 });
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [previa, setPreviaEstado] = useState(null);
  const previaRef = useRef(null);
  const setPrevia = (v) => {
    previaRef.current = v;
    setPreviaEstado(v);
  };
  const [msg, setMsg] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [idSalvo, setIdSalvo] = useState(asset ? asset.id : null);

  if (!g.current) g.current = GERADORES[0].gerar(30, 20, semente, { salas: 9 });

  const linhas = useMemo(() => paraLinhas(g.current), [versao]);
  const avisar = (t) => {
    setMsg(t);
    setTimeout(() => setMsg((m) => (m === t ? '' : m)), 2500);
  };

  // ---------- histórico ----------
  function guardar() {
    historico.current.push(paraLinhas(g.current));
    if (historico.current.length > 40) historico.current.shift();
  }
  function desfazer() {
    const ant = historico.current.pop();
    if (!ant) return avisar('Nada para desfazer');
    g.current = deLinhas(ant);
    setRows(ant.length);
    setCols(ant[0].length);
    setVersao((v) => v + 1);
  }

  // ---------- geração ----------
  function gerar(c = cols, r = rows, sem = semente) {
    guardar();
    const gen = GERADORES.find((x) => x.id === gerador);
    g.current = gen.gerar(c, r, sem, { salas, agua });
    setCols(c);
    setRows(r);
    setVersao((v) => v + 1);
    ajustar(c, r);
  }

  function redimensionar(c, r) {
    guardar();
    const novo = gradeVazia(c, r);
    for (let y = 0; y < Math.min(r, rows); y++) for (let x = 0; x < Math.min(c, cols); x++) novo[y][x] = g.current[y][x];
    g.current = novo;
    setCols(c);
    setRows(r);
    setVersao((v) => v + 1);
    ajustar(c, r);
  }

  function limpar() {
    guardar();
    g.current = gradeVazia(cols, rows);
    setVersao((v) => v + 1);
  }

  // ---------- vista ----------
  function ajustar(c = cols, r = rows, a = area) {
    if (!a.w) return;
    const s = Math.max(4, Math.min((a.w - 20) / c, (a.h - 20) / r));
    setView({ s, x: (a.w - c * s) / 2, y: (a.h - r * s) / 2 });
  }
  function zoom(f) {
    setView((v) => {
      const s = limitar(v.s * f, 4, 80);
      const cx = area.w / 2;
      const cy = area.h / 2;
      return { s, x: cx - ((cx - v.x) / v.s) * s, y: cy - ((cy - v.y) / v.s) * s };
    });
  }

  // ---------- gestos de pintura ----------
  const E = useRef({});
  E.current = { view, ferramenta, terreno, raio, cols, rows };
  const caixaRef = useRef(null);
  const origem = useRef({ x: 0, y: 0 });
  const gesto = useRef({});

  const celulaDe = (pageX, pageY) => {
    const v = E.current.view;
    return {
      x: Math.floor((pageX - origem.current.x - v.x) / v.s),
      y: Math.floor((pageY - origem.current.y - v.y) / v.s),
    };
  };
  const dentro = (c) => c.x >= 0 && c.y >= 0 && c.x < E.current.cols && c.y < E.current.rows;

  function aplicar(c) {
    const { ferramenta: f, terreno: t, raio: r } = E.current;
    if (!dentro(c)) return;
    if (f === 'pincel') pintar(g.current, c.x, c.y, r, t);
    if (f === 'borracha') pintar(g.current, c.x, c.y, r, VAZIO);
    setVersao((v) => v + 1);
  }

  function linhaAte(a, b) {
    const passos = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), 1);
    for (let i = 1; i <= passos; i++) {
      aplicar({ x: Math.round(a.x + ((b.x - a.x) * i) / passos), y: Math.round(a.y + ((b.y - a.y) * i) / passos) });
    }
  }

  const resp = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const ne = e.nativeEvent;
        if (ne.locationX !== undefined) origem.current = { x: ne.pageX - ne.locationX, y: ne.pageY - ne.locationY };
        const f = E.current.ferramenta;
        const c = celulaDe(e.nativeEvent.pageX, e.nativeEvent.pageY);
        gesto.current = { ultima: c, view0: E.current.view, inicio: c };
        if (f === 'mover') return;
        if (f === 'sala') {
          setPrevia({ a: c, b: c });
          return;
        }
        if (f === 'porta' || f === 'escada') {
          if (!dentro(c)) return;
          guardar();
          const atual = g.current[c.y][c.x];
          const marca = f === 'porta' ? 'D' : 'S';
          g.current[c.y][c.x] = atual === marca ? '#' : marca;
          setVersao((v) => v + 1);
          return;
        }
        guardar();
        aplicar(c);
      },
      onPanResponderMove: (e, gs) => {
        const f = E.current.ferramenta;
        if (f === 'mover') {
          const v0 = gesto.current.view0;
          setView({ ...v0, x: v0.x + gs.dx, y: v0.y + gs.dy });
          return;
        }
        const c = celulaDe(e.nativeEvent.pageX, e.nativeEvent.pageY);
        if (f === 'sala') {
          setPrevia({ a: gesto.current.inicio, b: c });
          return;
        }
        if (f === 'pincel' || f === 'borracha') {
          const u = gesto.current.ultima;
          if (c.x !== u.x || c.y !== u.y) {
            linhaAte(u, c);
            gesto.current.ultima = c;
          }
        }
      },
      onPanResponderRelease: () => {
        const p = previaRef.current;
        if (E.current.ferramenta === 'sala' && p) {
          guardar();
          preencherRet(g.current, p.a.x, p.a.y, p.b.x, p.b.y, E.current.terreno);
          setVersao((v) => v + 1);
        }
        setPrevia(null);
      },
    })
  ).current;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = caixaRef.current;
    if (!el || !el.addEventListener) return;
    const roda = (ev) => {
      ev.preventDefault();
      const r = el.getBoundingClientRect();
      const px = ev.clientX - r.left;
      const py = ev.clientY - r.top;
      setView((v) => {
        const s = limitar(v.s * (ev.deltaY < 0 ? 1.1 : 1 / 1.1), 4, 80);
        return { s, x: px - ((px - v.x) / v.s) * s, y: py - ((py - v.y) / v.s) * s };
      });
    };
    el.addEventListener('wheel', roda, { passive: false });
    return () => el.removeEventListener('wheel', roda);
  }, []);

  // grade leve sobre a área toda (para ver onde pintar)
  const gradeFundo = useMemo(() => {
    let d = '';
    for (let x = 0; x <= cols; x++) d += `M${x} 0V${rows}`;
    for (let y = 0; y <= rows; y++) d += `M0 ${y}H${cols}`;
    return d;
  }, [cols, rows]);

  // ---------- salvar ----------
  async function salvarMapa() {
    if (nome.trim().length < 2) return avisar('Dê um nome ao mapa');
    setSalvando(true);
    try {
      const base = asset || {};
      const camadaTiles = tilesOrig ? tilesOrig.camada : 'c0';
      const tiles = {
        type: 'tiles',
        camada: camadaTiles,
        x: 0,
        y: 0,
        z: 0,
        cel: CEL_MUNDO,
        cols,
        rows,
        w: cols * CEL_MUNDO,
        h: rows * CEL_MUNDO,
        linhas: paraLinhas(g.current),
        tema,
        mostrarGrade,
        rotulo: nome.trim(),
      };
      const id = idSalvo || gerarId();
      const final = {
        ...base,
        id,
        tipo: 'mapa',
        nome: nome.trim(),
        img: '',
        gerador: { tipo: gerador, semente },
        sala: {
          ...(base.sala || {}),
          mapUrl: '',
          mapW: cols * CEL_MUNDO,
          mapH: rows * CEL_MUNDO,
          tamGrade: CEL_MUNDO,
          grade: true,
          tipoGrade: 'quadrada',
          opacGrade: 0.06,
          offX: 0,
          offY: 0,
          snap: true,
        },
        camadas:
          base.camadas && base.camadas.length
            ? base.camadas
            : [
                { chave: 'c0', nome: 'Mapa', ordem: 0, visivel: true, travada: true },
                { chave: 'c1', nome: 'Cenário', ordem: 1, visivel: true, travada: false },
                { chave: 'c2', nome: 'Tokens', ordem: 2, visivel: true, travada: false },
              ],
        itens: [tiles, ...(base.itens || []).filter((i) => i.type !== 'tiles')],
        autor: base.autor || usuario.nome,
        criadoEm: base.criadoEm || Date.now(),
        atualizadoEm: Date.now(),
      };
      await salvar(`${assetsDe(usuario.usuario)}/${id}`, final);
      setIdSalvo(id);
      avisar('Mapa salvo em Meus assets › Mapas');
    } catch (e) {
      avisar('Erro ao salvar o mapa');
    }
    setSalvando(false);
  }

  const pisoTotal = linhas.join('').split('').filter(ehPiso).length;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Topo
        titulo="Criador de mapas"
        sub={`${cols}×${rows} células · ${pisoTotal} de piso`}
        onVoltar={onVoltar}
        direita={
          <TouchableOpacity style={s.btnSalvar} onPress={salvarMapa} disabled={salvando}>
            {salvando ? <ActivityIndicator color="#fff" /> : <Icone name="content-save-outline" size={18} color="#fff" />}
            <Text style={s.btnSalvarTxt}>Salvar</Text>
          </TouchableOpacity>
        }
      />
      <View style={s.linhaNome}>
        <TextInput style={s.inputNome} value={nome} onChangeText={setNome} placeholder="Nome do mapa (ex.: Cripta do Rei)" placeholderTextColor={C.suave} />
      </View>

      {/* ---------- canvas ---------- */}
      <View
        ref={caixaRef}
        style={s.canvas}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          const a = { w: width, h: height };
          setArea(a);
          if (caixaRef.current && caixaRef.current.measure) {
            caixaRef.current.measure((x, y, w, h, px, py) => (origem.current = { x: px || 0, y: py || 0 }));
          }
          if (!area.w) ajustar(cols, rows, a);
        }}
        {...resp.panHandlers}
      >
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%">
            <G transform={`translate(${view.x} ${view.y})`}>
              <MapaTilesSvg linhas={linhas} cel={view.s} tema={tema} mostrarGrade={mostrarGrade} />
              <G transform={`scale(${view.s})`}>
                <Path d={gradeFundo} stroke="#ffffff" strokeOpacity={0.07} strokeWidth={1 / view.s} fill="none" />
                {previa && (
                  <Rect
                    x={Math.min(previa.a.x, previa.b.x)}
                    y={Math.min(previa.a.y, previa.b.y)}
                    width={Math.abs(previa.b.x - previa.a.x) + 1}
                    height={Math.abs(previa.b.y - previa.a.y) + 1}
                    fill="rgba(34,211,238,0.25)"
                    stroke={C.destaque2}
                    strokeWidth={2 / view.s}
                  />
                )}
              </G>
            </G>
          </Svg>
        </View>
        <View style={s.zoom} pointerEvents="box-none">
          <TouchableOpacity style={s.zoomBtn} onPress={() => zoom(1.25)}>
            <Icone name="plus" size={18} color={C.texto} />
          </TouchableOpacity>
          <TouchableOpacity style={s.zoomBtn} onPress={() => zoom(0.8)}>
            <Icone name="minus" size={18} color={C.texto} />
          </TouchableOpacity>
          <TouchableOpacity style={s.zoomBtn} onPress={() => ajustar()}>
            <Icone name="fit-to-screen-outline" size={18} color={C.texto} />
          </TouchableOpacity>
          <TouchableOpacity style={s.zoomBtn} onPress={desfazer}>
            <Icone name="undo" size={18} color={C.texto} />
          </TouchableOpacity>
        </View>
        {!!msg && (
          <View style={s.aviso} pointerEvents="none">
            <Text style={{ color: C.texto }}>{msg}</Text>
          </View>
        )}
      </View>

      {/* ---------- painel ---------- */}
      <View style={s.painel}>
        {aba === 'gerar' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.faixa}>
            <View style={s.grupo}>
              {GERADORES.map((gen) => (
                <Opcao key={gen.id} ativo={gerador === gen.id} icone={gen.icone} rotulo={gen.nome} onPress={() => setGerador(gen.id)} />
              ))}
            </View>
            <View style={s.grupo}>
              {TAMANHOS.map(([c, r]) => (
                <TouchableOpacity key={c} onPress={() => gerar(c, r)} style={[s.chip, cols === c && rows === r && s.chipAtivo]}>
                  <Text style={s.chipTxt}>{c}×{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {gerador === 'masmorra' && (
              <View style={s.passo}>
                <Text style={s.passoRot}>Salas</Text>
                <View style={s.grupo}>
                  <TouchableOpacity onPress={() => setSalas(Math.max(2, salas - 1))} style={s.passoBtn}>
                    <Icone name="minus" size={14} color={C.texto} />
                  </TouchableOpacity>
                  <Text style={s.passoVal}>{salas}</Text>
                  <TouchableOpacity onPress={() => setSalas(Math.min(30, salas + 1))} style={s.passoBtn}>
                    <Icone name="plus" size={14} color={C.texto} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {gerador === 'caverna' && <Opcao ativo={agua} icone="water" rotulo="Água" onPress={() => setAgua(!agua)} />}
            <View style={s.passo}>
              <Text style={s.passoRot}>Semente</Text>
              <Text style={[s.passoVal, { minWidth: 80 }]}>{semente}</Text>
            </View>
            <TouchableOpacity
              style={s.btnGerar}
              onPress={() => {
                const sem = novaSemente();
                setSemente(sem);
                gerar(cols, rows, sem);
              }}
            >
              <Icone name="dice-multiple" size={18} color="#fff" />
              <Text style={s.btnGerarTxt}>Gerar novo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btnGerar, { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.destaque2 }]} onPress={() => gerar()}>
              <Icone name="refresh" size={18} color={C.destaque2} />
              <Text style={[s.btnGerarTxt, { color: C.destaque2 }]}>Mesma semente</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {aba === 'pintar' && (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.faixa}>
              <View style={s.grupo}>
                {FERRAMENTAS_MAPA.map((f) => (
                  <Opcao key={f.id} ativo={ferramenta === f.id} icone={f.icone} rotulo={f.nome} onPress={() => setFerramenta(f.id)} />
                ))}
              </View>
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.faixa, { paddingTop: 0 }]}>
              <View style={s.grupo}>
                {TERRENOS.map((t) => (
                  <Opcao key={t.id} ativo={terreno === t.id} icone={t.icone} rotulo={t.nome} onPress={() => setTerreno(t.id)} />
                ))}
              </View>
              <View style={s.grupo}>
                {[0, 1, 2].map((r) => (
                  <TouchableOpacity key={r} onPress={() => setRaio(r)} style={[s.chip, raio === r && s.chipAtivo]}>
                    <Text style={s.chipTxt}>{r * 2 + 1}×{r * 2 + 1}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={[s.chip, { paddingHorizontal: 10 }]} onPress={limpar}>
                <Text style={[s.chipTxt, { color: C.perigo }]}>Limpar tudo</Text>
              </TouchableOpacity>
              <View style={s.grupo}>
                {TAMANHOS.map(([c, r]) => (
                  <TouchableOpacity key={c} onPress={() => redimensionar(c, r)} style={[s.chip, cols === c && rows === r && s.chipAtivo]}>
                    <Text style={s.chipTxt}>{c}×{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {aba === 'aparencia' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.faixa}>
            {Object.entries(TEMAS_MAPA).map(([id, t]) => (
              <TouchableOpacity key={id} onPress={() => setTema(id)} style={[s.tema, tema === id && { borderColor: C.destaque2 }]}>
                <View style={[s.temaAmostra, { backgroundColor: t.fundo }]}>
                  <View style={{ width: 22, height: 14, backgroundColor: t.chao, borderWidth: 2, borderColor: t.parede }} />
                </View>
                <Text style={s.temaTxt}>{t.nome}</Text>
              </TouchableOpacity>
            ))}
            <Opcao ativo={mostrarGrade} icone="grid" rotulo="Grade no chão" onPress={() => setMostrarGrade(!mostrarGrade)} />
          </ScrollView>
        )}

        <View style={s.abas}>
          {[
            ['gerar', 'auto-fix', 'Gerar'],
            ['pintar', 'brush', 'Pintar'],
            ['aparencia', 'palette-outline', 'Aparência'],
          ].map(([id, ic, rot]) => (
            <TouchableOpacity key={id} style={[s.aba, aba === id && s.abaAtiva]} onPress={() => setAba(id)}>
              <Icone name={ic} size={20} color={aba === id ? C.destaque2 : C.suave} />
              <Text style={[s.abaTxt, aba === id && { color: C.destaque2 }]}>{rot}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

function Opcao({ ativo, icone, rotulo, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.opcao, ativo && s.opcaoAtiva]}>
      <Icone name={icone} size={18} color={ativo ? '#fff' : C.suave} />
      <Text style={[s.opcaoTxt, ativo && { color: '#fff' }]}>{rotulo}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btnSalvar: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.destaque, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  btnSalvarTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  linhaNome: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.painel, borderBottomWidth: 1, borderColor: C.borda },
  inputNome: { backgroundColor: C.painel2, borderWidth: 1, borderColor: C.borda, color: C.texto, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  canvas: { flex: 1, backgroundColor: C.palco, overflow: 'hidden' },
  zoom: { position: 'absolute', right: 10, top: 10, gap: 6 },
  zoomBtn: { backgroundColor: 'rgba(21,18,31,0.9)', borderWidth: 1, borderColor: C.borda, borderRadius: 10, padding: 8 },
  aviso: { position: 'absolute', bottom: 12, alignSelf: 'center', backgroundColor: 'rgba(21,18,31,0.95)', borderWidth: 1, borderColor: C.destaque, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  painel: { backgroundColor: C.painel, borderTopWidth: 1, borderColor: C.borda },
  faixa: { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, gap: 12 },
  grupo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  opcao: { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: C.borda, minWidth: 62 },
  opcaoAtiva: { backgroundColor: C.destaque, borderColor: C.destaque },
  opcaoTxt: { color: C.suave, fontSize: 10, fontWeight: '700', marginTop: 1 },
  chip: { minWidth: 46, height: 32, borderRadius: 8, borderWidth: 1, borderColor: C.borda, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  chipAtivo: { borderColor: C.destaque2, backgroundColor: 'rgba(34,211,238,0.15)' },
  chipTxt: { color: C.texto, fontSize: 12, fontWeight: '700' },
  passo: { alignItems: 'center', backgroundColor: C.painel2, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  passoRot: { color: C.suave, fontSize: 10, fontWeight: '700' },
  passoBtn: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: C.borda, alignItems: 'center', justifyContent: 'center' },
  passoVal: { color: C.texto, fontWeight: '800', minWidth: 28, textAlign: 'center', fontSize: 12 },
  btnGerar: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.destaque, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  btnGerarTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  tema: { alignItems: 'center', borderWidth: 2, borderColor: 'transparent', borderRadius: 10, padding: 4 },
  temaAmostra: { width: 52, height: 36, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  temaTxt: { color: C.texto, fontSize: 11, marginTop: 3 },
  abas: { flexDirection: 'row', borderTopWidth: 1, borderColor: C.borda, backgroundColor: C.bg },
  aba: { flex: 1, alignItems: 'center', paddingVertical: 6, borderTopWidth: 2, borderColor: 'transparent' },
  abaAtiva: { borderColor: C.destaque2, backgroundColor: C.painel },
  abaTxt: { color: C.suave, fontSize: 10, fontWeight: '700', marginTop: 1 },
});
