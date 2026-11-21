/* INOVAAGRO — Levantamento de pragas, doenças e plantas daninhas da cana-de-açúcar.
   Catálogo com protocolo de amostragem, unidade, tipo de leitura e níveis de referência (amarelo = atenção,
   vermelho = nível de controle). Os níveis são valores de referência e podem ser ajustados no app
   (ficam salvos no banco, em config "niveis_cana"). */
window.CANA = (function () {
  'use strict';
  // leitura: 'pct' (percentual 0–100), 'cont' (contagem / número), 'pres' (presença: 1 = sim, 0 = não)
  const C = [
    // ---- Pragas ----
    { id: 'broca', g: 'Pragas', nome: 'Broca-da-cana', apel: 'broca comum broca do colmo', sci: 'Diatraea saccharalis', un: '% de entrenós brocados (II)', lt: 'pct', am: 2, vm: 3,
      prot: 'Abra 20 colmos seguidos por ponto e conte os entrenós totais e os brocados. Intensidade de infestação = brocados ÷ total × 100.' },
    { id: 'broquinha', g: 'Pragas', nome: 'Broquinha (Diatraea < 1,5 cm)', apel: 'broquinha broca pequena lagarta pequena diatraea', sci: 'Diatraea saccharalis', un: '% de plantas com broquinha', lt: 'pct', base: 125, baseNome: 'Plantas avaliadas', posNome: 'Plantas com broquinha', am: 2, vm: 3,
      prot: 'Lagartas novas, menores que 1,5 cm, ainda raspando folhas e bainhas antes de entrar no colmo (fase do controle químico). No ponto, avalie 125 plantas seguidas do sulco (padrão, pode mudar) e conte quantas têm broquinha. O app calcula a infestação sozinho: plantas com broquinha ÷ plantas avaliadas × 100. Nível de controle: 3%.' },
    { id: 'broca_lag', g: 'Pragas', nome: 'Broca (Diatraea ≥ 1,5 cm)', apel: 'broca grande lagarta grande diatraea cotesia', sci: 'Diatraea saccharalis', un: 'lagartas ≥ 1,5 cm por ha', lt: 'cont', passo: 100, am: 500, vm: 1000,
      prot: 'Levantamento populacional. Lagartas com 1,5 cm ou mais, já dentro do colmo (fase do controle biológico com Cotesia flavipes). No ponto, abra os colmos da área amostrada, conte as lagartas com 1,5 cm ou mais e lance o resultado convertido para lagartas por hectare. Nível de controle: 1.000 lagartas/ha.' },
    { id: 'cigarrinha', g: 'Pragas', nome: 'Cigarrinha-das-raízes (ninfas)', apel: 'cigarrinha espuma', sci: 'Mahanarva fimbriolata', un: 'ninfas por metro', lt: 'cont', am: 2, vm: 4,
      prot: 'Afaste a palha da base da touceira em 2 m de sulco e conte as espumas com ninfas. Divida por 2 para ter ninfas por metro.' },
    { id: 'cigarrinha_ad', g: 'Pragas', nome: 'Cigarrinha-das-raízes (adultos)', apel: 'cigarrinha adulto', sci: 'Mahanarva fimbriolata', un: 'adultos por metro', lt: 'cont', am: 1, vm: 2,
      prot: 'Nos mesmos 2 m de sulco, conte os adultos nas folhas e na base das touceiras. Divida por 2 para ter adultos por metro.' },
    { id: 'sphenophorus', g: 'Pragas', nome: 'Bicudo (Sphenophorus): tocos atacados', apel: 'bicudo sphenophorus gorgulho', sci: 'Sphenophorus levis', un: '% de tocos atacados', lt: 'pct', am: 5, vm: 10,
      prot: 'Abra trincheiras de 1 m × 0,5 m sobre a linha e examine 20 tocos. Conte os tocos com galerias ou larvas.' },
    { id: 'sph_larvas', g: 'Pragas', nome: 'Bicudo (Sphenophorus): larvas', apel: 'bicudo sphenophorus larva', sci: 'Sphenophorus levis', un: 'larvas por trincheira', lt: 'cont', am: 2, vm: 5,
      prot: 'Na trincheira de 1 m × 0,5 m sobre a linha, abra os tocos e conte as larvas (brancas, sem pernas, cabeça marrom).' },
    { id: 'sph_pupas', g: 'Pragas', nome: 'Bicudo (Sphenophorus): pupas', apel: 'bicudo sphenophorus pupa', sci: 'Sphenophorus levis', un: 'pupas por trincheira', lt: 'cont', am: 2, vm: 5,
      prot: 'Na mesma trincheira, conte as pupas dentro dos tocos (geralmente num casulo de fibras).' },
    { id: 'sph_adultos', g: 'Pragas', nome: 'Bicudo (Sphenophorus): adultos', apel: 'bicudo sphenophorus adulto isca tolete', sci: 'Sphenophorus levis', un: 'adultos por trincheira ou isca', lt: 'cont', am: 2, vm: 5,
      prot: 'Conte os besouros adultos na trincheira ou nas iscas de tolete de cana (cortadas ao meio e deixadas na linha por 7 a 15 dias).' },
    { id: 'migdolus', g: 'Pragas', nome: 'Migdolus', sci: 'Migdolus fryanus', un: 'larvas por trincheira', lt: 'cont', am: 1, vm: 2,
      prot: 'Trincheira de 0,5 m × 0,5 m × 0,5 m no sulco. Conte as larvas encontradas.' },
    { id: 'cupins', g: 'Pragas', nome: 'Cupins de solo', sci: 'Heterotermes, Neocapritermes, Procornitermes', un: '% de trincheiras com cupins', lt: 'pct', am: 10, vm: 25,
      prot: 'Abra trincheiras no talhão (antes do plantio ou na reforma) e anote se há cupins em cada uma.' },
    { id: 'elasmo', g: 'Pragas', nome: 'Lagarta-elasmo', apel: 'elasmo coracao morto', sci: 'Elasmopalpus lignosellus', un: '% de perfilhos com coração morto', lt: 'pct', am: 2, vm: 5,
      prot: 'Ataca a base de brotos novos em cana-planta e soca jovem, principalmente na seca. Em 10 m de sulco, conte os perfilhos totais e os com coração morto e furo na base. % = atacados ÷ total × 100.' },
    { id: 'broca_gigante', g: 'Pragas', nome: 'Broca-gigante', sci: 'Telchin licus', un: '% de touceiras atacadas', lt: 'pct', am: 1, vm: 3,
      prot: 'Examine 50 touceiras seguidas e conte as que têm colmos com galeria larga e serragem.' },
    { id: 'pulgao', g: 'Pragas', nome: 'Pulgão-amarelo', sci: 'Sipha flava', un: '% de folhas infestadas', lt: 'pct', am: 20, vm: 40,
      prot: 'Examine a folha +1 de 25 plantas e conte as que têm colônias.' },
    { id: 'cartucho', g: 'Pragas', nome: 'Lagarta-do-cartucho', apel: 'spodoptera lagarta militar', sci: 'Spodoptera frugiperda', un: '% de plantas com cartucho atacado', lt: 'pct', am: 10, vm: 20,
      prot: 'Em cana jovem, examine 20 plantas seguidas por ponto e conte as que têm folhas raspadas ou furadas no cartucho, com lagarta viva.' },
    { id: 'coros', g: 'Pragas', nome: 'Corós (pão-de-galinha)', apel: 'coro pao de galinha bicho bolo', sci: 'Liogenys, Phyllophaga, Cyclocephala spp.', un: 'larvas por trincheira', lt: 'cont', am: 2, vm: 5,
      prot: 'Trincheira de 0,5 m × 0,5 m × 0,3 m na linha. Conte as larvas brancas em forma de C.' },
    { id: 'formiga', g: 'Pragas', nome: 'Formigas cortadeiras', sci: 'Atta spp.', un: 'formigueiros ativos por hectare', lt: 'cont', am: 1, vm: 2,
      prot: 'Percorra o talhão e conte os formigueiros ativos (olheiros com movimento).' },
    { id: 'nematoides', g: 'Pragas', nome: 'Nematoides', sci: 'Pratylenchus zeae, Meloidogyne javanica', un: 'nematoides por 10 g de raízes (laudo)', lt: 'cont', am: null, vm: null,
      prot: 'Colete raízes e solo em 10 pontos, misture e envie ao laboratório. Lance aqui o resultado do laudo.' },
    // ---- Doenças ----
    { id: 'ferrugem_marrom', g: 'Doenças', nome: 'Ferrugem-marrom', sci: 'Puccinia melanocephala', un: '% de área foliar afetada (folha +3)', lt: 'pct', am: 5, vm: 10,
      prot: 'Avalie a folha +3 de 10 plantas por ponto e estime a área com pústulas.' },
    { id: 'ferrugem_laranja', g: 'Doenças', nome: 'Ferrugem-alaranjada', sci: 'Puccinia kuehnii', un: '% de área foliar afetada (folha +3)', lt: 'pct', am: 2, vm: 5,
      prot: 'Avalie a folha +3 de 10 plantas por ponto e estime a área com pústulas alaranjadas.' },
    { id: 'carvao', g: 'Doenças', nome: 'Carvão', sci: 'Sporisorium scitamineum', un: '% de touceiras com chicote', lt: 'pct', am: 1, vm: 3,
      prot: 'Percorra 100 m de linha e conte as touceiras com chicote. Faça o roguing das plantas doentes.' },
    { id: 'mosaico', g: 'Doenças', nome: 'Mosaico', sci: 'Sugarcane mosaic virus', un: '% de plantas com sintoma', lt: 'pct', am: 2, vm: 5,
      prot: 'Examine 100 plantas seguidas e conte as com folhas mosqueadas.' },
    { id: 'escaldadura', g: 'Doenças', nome: 'Escaldadura-das-folhas', sci: 'Xanthomonas albilineans', un: '% de plantas com sintoma', lt: 'pct', am: 1, vm: 3,
      prot: 'Examine 100 plantas e conte as com estrias brancas finas ou folhas queimadas.' },
    { id: 'amarelinho', g: 'Doenças', nome: 'Amarelinho', sci: 'Sugarcane yellow leaf virus', un: '% de plantas com sintoma', lt: 'pct', am: 5, vm: 10,
      prot: 'Examine 100 plantas e conte as com nervura central amarela na face de baixo da folha.' },
    { id: 'podridao_vermelha', g: 'Doenças', nome: 'Podridão-vermelha (fungo)', apel: 'podridao vermelha colletotrichum fungo colmo', sci: 'Colletotrichum falcatum', un: '% de entrenós com podridão', lt: 'pct', am: 2, vm: 5,
      prot: 'Doença do colmo, causada por fungo e muitas vezes ligada ao furo da broca. Abra ao meio 20 colmos seguidos por ponto e conte os entrenós totais e os com tecido interno vermelho e manchas brancas atravessadas. % = entrenós com podridão ÷ total × 100.' },
    { id: 'estria_vermelha', g: 'Doenças', nome: 'Estria-vermelha (bactéria)', apel: 'estria vermelha acidovorax bacteria folha podridao do topo', sci: 'Acidovorax avenae subsp. avenae', un: '% de plantas com sintoma', lt: 'pct', am: 2, vm: 5,
      prot: 'Doença da folha, causada por bactéria (não é a podridão-vermelha). Examine 100 plantas e conte as que têm estrias finas, compridas e vermelho-escuras nas folhas novas, ou o topo podre com cheiro ruim.' },
    { id: 'raquitismo', g: 'Doenças', nome: 'Raquitismo-da-soqueira', sci: 'Leifsonia xyli', un: 'presença no laudo', lt: 'pres', am: null, vm: 1,
      prot: 'Diagnóstico por laboratório. Marque Sim se o laudo for positivo.' },
    // ---- Plantas daninhas ----
    { id: 'colonia', g: 'Plantas daninhas', nome: 'Capim-colonião', sci: 'Panicum maximum', un: '% de cobertura', lt: 'pct', am: 5, vm: 15, prot: 'Estime a área coberta pela planta em 1 m² por ponto (quadro de amostragem).' },
    { id: 'braquiaria', g: 'Plantas daninhas', nome: 'Capim-braquiária', sci: 'Urochloa spp.', un: '% de cobertura', lt: 'pct', am: 5, vm: 15, prot: 'Estime a área coberta pela planta em 1 m² por ponto.' },
    { id: 'colchao', g: 'Plantas daninhas', nome: 'Capim-colchão', sci: 'Digitaria spp.', un: '% de cobertura', lt: 'pct', am: 5, vm: 15, prot: 'Estime a área coberta pela planta em 1 m² por ponto.' },
    { id: 'tiririca', g: 'Plantas daninhas', nome: 'Tiririca', sci: 'Cyperus rotundus', un: '% de cobertura', lt: 'pct', am: 5, vm: 15, prot: 'Estime a área coberta pela planta em 1 m² por ponto.' },
    { id: 'grama_seda', g: 'Plantas daninhas', nome: 'Grama-seda', sci: 'Cynodon dactylon', un: '% de cobertura', lt: 'pct', am: 5, vm: 15, prot: 'Estime a área coberta pela planta em 1 m² por ponto.' },
    { id: 'corda_viola', g: 'Plantas daninhas', nome: 'Corda-de-viola', sci: 'Ipomoea spp.', un: '% de cobertura', lt: 'pct', am: 3, vm: 10, prot: 'Estime a área coberta pela planta em 1 m² por ponto. Atenção às plantas enroladas nos colmos.' },
    { id: 'mucuna', g: 'Plantas daninhas', nome: 'Mucuna', sci: 'Mucuna aterrima', un: '% de cobertura', lt: 'pct', am: 3, vm: 10, prot: 'Estime a área coberta pela planta em 1 m² por ponto.' },
    { id: 'mamona', g: 'Plantas daninhas', nome: 'Mamona', sci: 'Ricinus communis', un: 'plantas por 10 m²', lt: 'cont', am: 1, vm: 3, prot: 'Conte as plantas em 10 m² por ponto.' },
    { id: 'fedegoso', g: 'Plantas daninhas', nome: 'Fedegoso', sci: 'Senna obtusifolia', un: 'plantas por 10 m²', lt: 'cont', am: 2, vm: 5, prot: 'Conte as plantas em 10 m² por ponto.' },
    { id: 'buva', g: 'Plantas daninhas', nome: 'Buva', sci: 'Conyza spp.', un: 'plantas por 10 m²', lt: 'cont', am: 2, vm: 5, prot: 'Conte as plantas em 10 m² por ponto.' },
    { id: 'pe_galinha', g: 'Plantas daninhas', nome: 'Capim-pé-de-galinha', sci: 'Eleusine indica', un: '% de cobertura', lt: 'pct', am: 5, vm: 15, prot: 'Estime a área coberta pela planta em 1 m² por ponto (quadro de amostragem).' },
    { id: 'amargoso', g: 'Plantas daninhas', nome: 'Capim-amargoso', sci: 'Digitaria insularis', un: '% de cobertura', lt: 'pct', am: 3, vm: 10, prot: 'Estime a área coberta pela planta em 1 m² por ponto (quadro de amostragem).' },
    { id: 'camalote', g: 'Plantas daninhas', nome: 'Capim-camalote', sci: 'Rottboellia cochinchinensis', un: '% de cobertura', lt: 'pct', am: 3, vm: 10, prot: 'Estime a área coberta pela planta em 1 m² por ponto (quadro de amostragem).' },
    { id: 'carrapicho', g: 'Plantas daninhas', nome: 'Capim-carrapicho', sci: 'Cenchrus echinatus', un: '% de cobertura', lt: 'pct', am: 5, vm: 15, prot: 'Estime a área coberta pela planta em 1 m² por ponto (quadro de amostragem).' },
    { id: 'beldroega', g: 'Plantas daninhas', nome: 'Beldroega', sci: 'Portulaca oleracea', un: '% de cobertura', lt: 'pct', am: 5, vm: 15, prot: 'Estime a área coberta pela planta em 1 m² por ponto (quadro de amostragem).' },
    { id: 'trapoeraba', g: 'Plantas daninhas', nome: 'Trapoeraba', sci: 'Commelina benghalensis', un: '% de cobertura', lt: 'pct', am: 3, vm: 10, prot: 'Estime a área coberta pela planta em 1 m² por ponto (quadro de amostragem).' },
    { id: 'picao', g: 'Plantas daninhas', nome: 'Picão-preto', sci: 'Bidens pilosa', un: '% de cobertura', lt: 'pct', am: 3, vm: 10, prot: 'Estime a área coberta pela planta em 1 m² por ponto (quadro de amostragem).' },
    { id: 'caruru', g: 'Plantas daninhas', nome: 'Caruru', sci: 'Amaranthus spp.', un: '% de cobertura', lt: 'pct', am: 3, vm: 10, prot: 'Estime a área coberta pela planta em 1 m² por ponto (quadro de amostragem).' },
    { id: 'leiteiro', g: 'Plantas daninhas', nome: 'Leiteiro', sci: 'Euphorbia heterophylla', un: '% de cobertura', lt: 'pct', am: 3, vm: 10, prot: 'Estime a área coberta pela planta em 1 m² por ponto (quadro de amostragem).' },
    { id: 'erva_quente', g: 'Plantas daninhas', nome: 'Erva-quente', sci: 'Spermacoce latifolia', un: '% de cobertura', lt: 'pct', am: 3, vm: 10, prot: 'Estime a área coberta pela planta em 1 m² por ponto (quadro de amostragem).' },
    { id: 'guanxuma', g: 'Plantas daninhas', nome: 'Guanxuma', sci: 'Sida spp.', un: '% de cobertura', lt: 'pct', am: 3, vm: 10, prot: 'Estime a área coberta pela planta em 1 m² por ponto (quadro de amostragem).' },
    { id: 'apaga_fogo', g: 'Plantas daninhas', nome: 'Apaga-fogo', sci: 'Alternanthera tenella', un: '% de cobertura', lt: 'pct', am: 3, vm: 10, prot: 'Estime a área coberta pela planta em 1 m² por ponto (quadro de amostragem).' },
  ];
  const GRUPOS = ['Pragas', 'Doenças', 'Plantas daninhas'];
  const TIPO_MON = { 'Pragas': 'Praga', 'Doenças': 'Doença', 'Plantas daninhas': 'Planta daninha' };
  const ESTADIOS = ['Brotação', 'Perfilhamento', 'Grande crescimento', 'Maturação', 'Colheita'];
  const CORTES = ['Cana-planta (ano e meio)', 'Cana-planta (ano)', '1º corte', '2º corte', '3º corte', '4º corte', '5º corte', '6º corte ou mais', 'Reforma'];
  const NIVEL = { 0: 'Baixo', 1: 'Médio', 2: 'Alto' }; // compatível com a tela de monitoramentos
  const SEMAF = { 0: 'Verde', 1: 'Amarelo', 2: 'Vermelho' };
  const porId = new Map(C.map(x => [x.id, x]));
  const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const porNome = new Map(C.map(x => [norm(x.nome), x]));
  porNome.set(norm('Broca-da-cana (lagartas)'), porId.get('broca_lag')); // nome antigo
  porNome.set(norm('Podridão-vermelha'), porId.get('podridao_vermelha')); porNome.set(norm('Estria-vermelha'), porId.get('estria_vermelha'));
  porNome.set(norm('Cigarrinha-das-raízes'), porId.get('cigarrinha')); porNome.set(norm('Bicudo-da-cana (Sphenophorus)'), porId.get('sphenophorus'));
  // ---------- Liberação de Cotesia: população de broca antes e depois ----------
  const COT = 'Liberação de Cotesia';
  const DIA = 864e5, dt = d => new Date(String(d).slice(0, 10) + 'T12:00:00').getTime();
  const numv = v => { if (v === '' || v == null) return null; const n = Number(String(v).replace(',', '.')); return isFinite(n) ? n : null; };
  // média de lagartas/ha numa visita (ids do catálogo: broca >= 1,5 cm por padrão)
  function popVisita(m, ids) {
    const vs = [];
    for (const a of m.amostras_detalhe || []) { const it = porId.get(a.praga_id) || porNome.get(norm(a.alvo)); const v = numv(a.valor); if (it && ids.includes(it.id) && v != null) vs.push(v); }
    return vs.length ? vs.reduce((x, y) => x + y, 0) / vs.length : null;
  }
  // levantamento mais recente até 45 dias antes da soltura e o primeiro entre 15 e 90 dias depois
  function eficiencia(rel, mons, ids) {
    ids = ids || ['broca_lag'];
    const d = dt(rel.data); let antes = null, depois = null;
    for (const m of mons || []) {
      if (String(m.talhao_id) !== String(rel.talhao_id) || !m.data) continue;
      const v = popVisita(m, ids); if (v == null) continue;
      const x = dt(m.data), dd = (x - d) / DIA;
      if (dd <= 0 && dd >= -45 && (!antes || m.data > antes.data)) antes = { data: m.data, valor: v, id: m.id };
      if (dd >= 15 && dd <= 90 && (!depois || m.data < depois.data)) depois = { data: m.data, valor: v, id: m.id };
    }
    const red = antes && depois && antes.valor > 0 ? (antes.valor - depois.valor) / antes.valor * 100 : null;
    return { antes, depois, red };
  }
  const vespasHa = r => { const c = numv(r.copos), v = numv(r.vespas_copo), a = numv(r.area_ha); return c != null && v != null && a ? Math.round(c * v / a) : null; };
  return {
    COT, eficiencia, popVisita, vespasHa,
    itens: C, GRUPOS, TIPO_MON, ESTADIOS, CORTES, NIVEL, SEMAF,
    get: id => porId.get(id) || null,
    // acha o item do catálogo de uma amostra (pelo id ou pelo nome digitado)
    daAmostra: a => (a && (porId.get(a.praga_id) || porNome.get(norm(a.alvo)))) || null,
    // níveis atuais: padrão do catálogo + ajustes salvos (config "niveis_cana")
    niveis(item, ajustes) {
      const a = ajustes && ajustes[item.id] || {};
      return { am: a.am !== undefined ? a.am : item.am, vm: a.vm !== undefined ? a.vm : item.vm };
    },
    // 0 = verde (abaixo), 1 = amarelo (atenção), 2 = vermelho (controle), null = sem nível definido
    classe(item, valor, ajustes) {
      if (!item || valor == null || valor === '' || !isFinite(+valor)) return null;
      const { am, vm } = this.niveis(item, ajustes); const v = +valor;
      if (vm != null && v >= vm) return 2;
      if (am != null && v >= am) return 1;
      if (am == null && vm == null) return null;
      return 0;
    },
  };
})();
