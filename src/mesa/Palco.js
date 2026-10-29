import React, { useRef, useState, useEffect, useMemo } from 'react';
import { View, PanResponder, StyleSheet, Platform } from 'react-native';
import Svg, { G, Rect, Circle, Line, Path, Image as SvgImage, Text as SvgText, Defs, ClipPath } from 'react-native-svg';
import { C } from '../config/theme';
import { useImagem } from '../services/imagens';
import { MapaTilesSvg } from '../components/MapaTiles';
import { caminhoGrade, lerGrade } from '../utils/grade';
import { caixa, limitar } from '../utils/util';

// Palco: renderiza a cena (mapa, grade, itens) e trata todos os gestos.
export default function Palco(props) {
  const P = useRef(props);
  P.current = props;

  const areaRef = useRef(null);
  const origem = useRef({ x: 0, y: 0 });
  const g = useRef({ modo: null });
  const [rascunho, setRascunho] = useState(null);
  const [area, setArea] = useState({ w: 800, h: 600 });

  const pontoTela = (pageX, pageY) => ({ x: pageX - origem.current.x, y: pageY - origem.current.y });
  const paraMundo = (t) => {
    const v = P.current.view;
    return { x: (t.x - v.x) / v.s, y: (t.y - v.y) / v.s };
  };

  const medir = () => {
    if (areaRef.current && areaRef.current.measure) {
      areaRef.current.measure((x, y, w, h, px, py) => {
        origem.current = { x: px || 0, y: py || 0 };
        if (w && h) setArea({ w, h });
        P.current.onTamanho && P.current.onTamanho(w, h);
      });
    }
  };

  const finalizar = () => {
    const st = g.current;
    const p = P.current;
    if (st.modo === 'arrastar') p.onSoltar(st.id);
    if (st.modo === 'desenho' && st.pts.length > 1) p.onCriarDesenho(st.pts);
    if (st.modo === 'forma') {
      if (st.tipo === 'captura') p.onCapturar(st.a, st.b);
      else p.onCriarForma(st.tipo, st.a, st.b);
    }
    if (st.modo === 'colocar' && st.ultimo) p.onColocar(st.ultimo);
    setRascunho(null);
    g.current = { modo: null };
  };

  const resp = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: (e) => {
        const p = P.current;
        const tela = pontoTela(e.nativeEvent.pageX, e.nativeEvent.pageY);
        const w = paraMundo(tela);
        const st = { modo: null, view0: p.view, ultimo: w, pts: [] };
        g.current = st;

        switch (p.ferramenta) {
          case 'mover': {
            const hit = p.acharItem(w.x, w.y);
            if (hit) {
              st.modo = 'arrastar';
              st.id = hit.id;
              st.off = { x: w.x - hit.x, y: w.y - hit.y };
              p.onSelecionar(hit.id);
              p.onIniciarArraste(hit.id);
            } else {
              st.modo = 'pan';
              p.onSelecionar(null);
            }
            break;
          }
          case 'pan':
            st.modo = 'pan';
            break;
          case 'desenho':
            st.modo = 'desenho';
            st.pts = [w];
            setRascunho({ type: 'draw', pts: [w] });
            break;
          case 'retangulo':
          case 'circulo':
          case 'capturar':
            st.modo = 'forma';
            st.tipo = p.ferramenta === 'retangulo' ? 'rect' : p.ferramenta === 'circulo' ? 'circle' : 'captura';
            st.a = w;
            st.b = w;
            setRascunho({ type: st.tipo, a: w, b: w });
            break;
          case 'colocar':
            st.modo = 'colocar';
            break;
          case 'borracha': {
            st.modo = 'borracha';
            const hit = p.acharItem(w.x, w.y);
            if (hit) p.onApagar(hit.id);
            break;
          }
        }
      },

      onPanResponderMove: (e, gs) => {
        const p = P.current;
        const st = g.current;
        const toques = e.nativeEvent.touches || [];

        // ---- pinça (zoom com dois dedos) ----
        if (toques.length >= 2) {
          const a = pontoTela(toques[0].pageX, toques[0].pageY);
          const b = pontoTela(toques[1].pageX, toques[1].pageY);
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          const meio = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          if (st.modo !== 'pinca') {
            if (st.modo === 'arrastar') p.onSoltar(st.id);
            setRascunho(null);
            g.current = { modo: 'pinca', dist0: dist || 1, meio0: meio, view0: p.view };
            return;
          }
          const v0 = st.view0;
          const s = limitar(v0.s * (dist / st.dist0), 0.15, 6);
          const wx = (st.meio0.x - v0.x) / v0.s;
          const wy = (st.meio0.y - v0.y) / v0.s;
          p.setView({ s, x: meio.x - wx * s, y: meio.y - wy * s });
          return;
        }
        if (st.modo === 'pinca') return; // ignora o dedo restante

        const tela = pontoTela(e.nativeEvent.pageX, e.nativeEvent.pageY);
        const w = paraMundo(tela);
        st.ultimo = w;

        switch (st.modo) {
          case 'pan':
            p.setView({ ...st.view0, x: st.view0.x + gs.dx, y: st.view0.y + gs.dy });
            break;
          case 'arrastar':
            p.onMoverLocal(st.id, w.x - st.off.x, w.y - st.off.y);
            break;
          case 'desenho': {
            const ult = st.pts[st.pts.length - 1];
            if (Math.hypot(w.x - ult.x, w.y - ult.y) > 3 / p.view.s) {
              st.pts.push(w);
              setRascunho({ type: 'draw', pts: st.pts.slice() });
            }
            break;
          }
          case 'forma':
            st.b = w;
            setRascunho({ type: st.tipo, a: st.a, b: w });
            break;
          case 'borracha': {
            const hit = p.acharItem(w.x, w.y);
            if (hit) p.onApagar(hit.id);
            break;
          }
        }
      },

      onPanResponderRelease: finalizar,
      onPanResponderTerminate: finalizar,
    })
  ).current;

  // Zoom com a roda do mouse no navegador
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = areaRef.current;
    if (!el || !el.addEventListener) return;
    const roda = (ev) => {
      ev.preventDefault();
      const r = el.getBoundingClientRect();
      const px = ev.clientX - r.left;
      const py = ev.clientY - r.top;
      const v = P.current.view;
      const s = limitar(v.s * (ev.deltaY < 0 ? 1.1 : 1 / 1.1), 0.15, 6);
      const wx = (px - v.x) / v.s;
      const wy = (py - v.y) / v.s;
      P.current.setView({ s, x: px - wx * s, y: py - wy * s });
    };
    el.addEventListener('wheel', roda, { passive: false });
    return () => el.removeEventListener('wheel', roda);
  }, []);

  const { sala, itens, view, selecionado, cor, espessura } = props;
  const mapW = sala.mapW || 1400;
  const mapH = sala.mapH || 1000;
  const gr = lerGrade(sala);

  // Região visível do mundo, "quantizada" em blocos para não recalcular a grade a cada frame de arraste
  const bloco = gr.tamGrade * 8;
  const bx0 = Math.floor(-view.x / view.s / bloco) * bloco;
  const by0 = Math.floor(-view.y / view.s / bloco) * bloco;
  const bx1 = Math.ceil((area.w - view.x) / view.s / bloco) * bloco;
  const by1 = Math.ceil((area.h - view.y) / view.s / bloco) * bloco;
  const mapaSrc = useImagem(sala.mapUrl);
  const dGrade = useMemo(
    () => caminhoGrade(gr, bx0, by0, bx1, by1, mapW, mapH),
    [bx0, by0, bx1, by1, gr.grade, gr.tipoGrade, gr.tamGrade, gr.infinita, gr.offX, gr.offY, mapW, mapH]
  );

  const sel = itens.find((i) => i.id === selecionado);
  const selCaixa = sel ? caixa(sel) : null;

  return (
    <View
      ref={areaRef}
      style={s.area}
      onLayout={medir}
      {...resp.panHandlers}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%">
          <G transform={`translate(${view.x} ${view.y}) scale(${view.s})`}>
            {/* fundo do mapa */}
            <Rect x={0} y={0} width={mapW} height={mapH} fill="#1a1626" />
            {!!mapaSrc && (
              <SvgImage
                href={{ uri: mapaSrc }}
                x={0}
                y={0}
                width={mapW}
                height={mapH}
                preserveAspectRatio="xMidYMid slice"
              />
            )}
            {!!dGrade && (
              <Path
                d={dGrade}
                fill="none"
                stroke={gr.corGrade}
                strokeOpacity={gr.opacGrade}
                strokeWidth={gr.espGrade / view.s}
              />
            )}

            {/* itens já ordenados por camada e z */}
            {itens.map((it) => (
              <Item key={it.id} it={it} escala={view.s} />
            ))}

            {/* rascunho do que está sendo desenhado */}
            {rascunho && <Rascunho r={rascunho} cor={cor} espessura={espessura} escala={view.s} />}

            {/* contorno de seleção */}
            {selCaixa && (
              <Rect
                x={selCaixa.x - 6}
                y={selCaixa.y - 6}
                width={selCaixa.w + 12}
                height={selCaixa.h + 12}
                fill="none"
                stroke={C.destaque2}
                strokeWidth={2 / view.s}
                strokeDasharray={`${8 / view.s} ${5 / view.s}`}
              />
            )}
          </G>
        </Svg>
      </View>
    </View>
  );
}

function Item({ it, escala }) {
  switch (it.type) {
    case 'token':
      return <TokenItem it={it} escala={escala} />;
    case 'tiles':
      return <MapaTilesSvg linhas={it.linhas} cel={it.cel || 70} tema={it.tema} mostrarGrade={it.mostrarGrade !== false} x={it.x} y={it.y} />;
    case 'prop':
      return <PropItem it={it} />;
    case 'rect':
      return (
        <Rect
          x={it.x}
          y={it.y}
          width={it.w}
          height={it.h}
          fill={it.cor}
          fillOpacity={0.25}
          stroke={it.cor}
          strokeWidth={it.espessura || 3}
        />
      );
    case 'circle':
      return (
        <Circle
          cx={it.x}
          cy={it.y}
          r={it.r}
          fill={it.cor}
          fillOpacity={0.25}
          stroke={it.cor}
          strokeWidth={it.espessura || 3}
        />
      );
    case 'draw':
      return (
        <G transform={`translate(${it.x} ${it.y}) scale(${it.escalaPath || 1})`}>
          <Path
            d={it.d}
            fill="none"
            stroke={it.cor}
            strokeWidth={it.espessura || 4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </G>
      );
    default:
      return null;
  }
}

function TokenItem({ it, escala }) {
  const src = useImagem(it.img);
  const clip = 'clip_' + it.id;
  return (
    <G>
      <Circle cx={it.x} cy={it.y + it.r * 0.08} r={it.r} fill="rgba(0,0,0,0.45)" />
      <Circle cx={it.x} cy={it.y} r={it.r} fill={it.cor} />
      {!!src && (
        <>
          <Defs>
            <ClipPath id={clip}>
              <Circle cx={it.x} cy={it.y} r={it.r * 0.9} />
            </ClipPath>
          </Defs>
          <SvgImage
            href={{ uri: src }}
            x={it.x - it.r}
            y={it.y - it.r}
            width={it.r * 2}
            height={it.r * 2}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clip})`}
          />
        </>
      )}
      <Circle cx={it.x} cy={it.y} r={it.r} fill="none" stroke="#fff" strokeWidth={Math.max(2, it.r * 0.08)} />
      {!src && !!it.rotulo && (
        <SvgText x={it.x} y={it.y + it.r * 0.18} fontSize={it.r * 0.55} fontWeight="bold" fill="#fff" textAnchor="middle">
          {it.rotulo.slice(0, 2).toUpperCase()}
        </SvgText>
      )}
      <BarraRecurso it={it} escala={escala} />
      {!!it.rotulo && (
        <SvgText
          x={it.x}
          y={it.y + it.r + (it.ficha && it.ficha.recursos && it.ficha.recursos.length ? 26 : 16) / escala}
          fontSize={13 / escala}
          fill="#fff"
          stroke="#000"
          strokeWidth={0.6 / escala}
          textAnchor="middle"
        >
          {it.rotulo}
        </SvgText>
      )}
    </G>
  );
}

// Objeto (adereço): imagem ou ícone emoji, ocupando w×h, com rotação
function PropItem({ it }) {
  const src = useImagem(it.img);
  const cx = it.x + it.w / 2;
  const cy = it.y + it.h / 2;
  return (
    <G transform={it.rot ? `rotate(${it.rot} ${cx} ${cy})` : undefined}>
      {src ? (
        <SvgImage href={{ uri: src }} x={it.x} y={it.y} width={it.w} height={it.h} preserveAspectRatio="xMidYMid meet" />
      ) : (
        <SvgText x={cx} y={cy + Math.min(it.w, it.h) * 0.3} fontSize={Math.min(it.w, it.h) * 0.85} textAnchor="middle">
          {it.emoji || '❔'}
        </SvgText>
      )}
    </G>
  );
}

// Barra do 1º recurso da ficha (ex.: Vida) logo abaixo do token
function BarraRecurso({ it, escala }) {
  const rec = it.ficha && it.ficha.recursos && it.ficha.recursos[0];
  if (!rec || !rec.max) return null;
  const larg = it.r * 1.6;
  const alt = 6 / escala;
  const frac = Math.max(0, Math.min(1, (rec.atual || 0) / rec.max));
  const corBarra = frac > 0.5 ? '#22c55e' : frac > 0.25 ? '#eab308' : '#ef4444';
  const x = it.x - larg / 2;
  const y = it.y + it.r + 4 / escala;
  return (
    <G>
      <Rect x={x} y={y} width={larg} height={alt} rx={alt / 2} fill="rgba(0,0,0,0.7)" />
      <Rect x={x} y={y} width={larg * frac} height={alt} rx={alt / 2} fill={corBarra} />
    </G>
  );
}

function Rascunho({ r, cor, espessura, escala }) {
  if (r.type === 'captura') {
    return (
      <Rect
        x={Math.min(r.a.x, r.b.x)}
        y={Math.min(r.a.y, r.b.y)}
        width={Math.abs(r.b.x - r.a.x)}
        height={Math.abs(r.b.y - r.a.y)}
        fill="rgba(34,211,238,0.12)"
        stroke={C.destaque2}
        strokeWidth={2 / escala}
        strokeDasharray={`${10 / escala} ${6 / escala}`}
      />
    );
  }
  if (r.type === 'draw') {
    const d = r.pts.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
    return <Path d={d} fill="none" stroke={cor} strokeWidth={espessura} strokeLinecap="round" strokeLinejoin="round" />;
  }
  if (r.type === 'rect') {
    return (
      <Rect
        x={Math.min(r.a.x, r.b.x)}
        y={Math.min(r.a.y, r.b.y)}
        width={Math.abs(r.b.x - r.a.x)}
        height={Math.abs(r.b.y - r.a.y)}
        fill={cor}
        fillOpacity={0.2}
        stroke={cor}
        strokeWidth={espessura}
        strokeDasharray={`${6 / escala} ${4 / escala}`}
      />
    );
  }
  if (r.type === 'circle') {
    return (
      <Circle
        cx={r.a.x}
        cy={r.a.y}
        r={Math.hypot(r.b.x - r.a.x, r.b.y - r.a.y)}
        fill={cor}
        fillOpacity={0.2}
        stroke={cor}
        strokeWidth={espessura}
        strokeDasharray={`${6 / escala} ${4 / escala}`}
      />
    );
  }
  return null;
}

const s = StyleSheet.create({
  area: { flex: 1, backgroundColor: C.palco, overflow: 'hidden' },
});
