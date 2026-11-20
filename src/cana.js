/* INOVAAGRO — Levantamento de pragas, doenças e plantas daninhas da cana-de-açúcar.
   Catálogo com protocolo de amostragem, unidade, tipo de leitura e níveis de referência (amarelo = atenção,
   vermelho = nível de controle). Os níveis são valores de referência e podem ser ajustados no app
   (ficam salvos no banco, em config "niveis_cana"). */
window.CANA = (function () {
  'use strict';
  // leitura: 'pct' (percentual 0–100), 'cont' (contagem / número), 'pres' (presença: 1 = sim, 0 = não)
  const C = [
    // ---- Pragas ----
    { id: 'broca', g: 'Pragas', nome: 'Broca-da-cana', sci: 'Diatraea saccharalis', un: '% de entrenós brocados (II)', lt: 'pct', am: 2, vm: 3,
      prot: 'Abra 20 colmos seguidos por ponto e conte os entrenós totais e os brocados. Intensidade de infestação = brocados ÷ total × 100.' },
    { id: 'broca_lag', g: 'Pragas', nome: 'Broca-da-cana (lagartas)', sci: 'Diatraea saccharalis', un: 'lagartas por hora-homem', lt: 'cont', am: 400, vm: 800,
      prot: 'Procure lagartas nos colmos durante 1 hora por homem. Usado para decidir a liberação de Cotesia flavipes.' },
    { id: 'cigarrinha', g: 'Pragas', nome: 'Cigarrinha-das-raízes', sci: 'Mahanarva fimbriolata', un: 'ninfas por metro', lt: 'cont', am: 2, vm: 4,
      prot: 'Afaste a palha da base da touceira em 2 m de sulco e conte as espumas com ninfas. Divida por 2 para ter ninfas por metro.' },
    { id: 'sphenophorus', g: 'Pragas', nome: 'Bicudo-da-cana (Sphenophorus)', sci: 'Sphenophorus levis', un: '% de tocos atacados', lt: 'pct', am: 5, vm: 10,
      prot: 'Abra trincheiras de 1 m × 0,5 m sobre a linha e examine 20 tocos. Conte os tocos com galerias ou larvas.' },
    { id: 'migdolus', g: 'Pragas', nome: 'Migdolus', sci: 'Migdolus fryanus', un: 'larvas por trincheira', lt: 'cont', am: 1, vm: 2,
      prot: 'Trincheira de 0,5 m × 0,5 m × 0,5 m no sulco. Conte as larvas encontradas.' },
    { id: 'cupins', g: 'Pragas', nome: 'Cupins de solo', sci: 'Heterotermes, Neocapritermes, Procornitermes', un: '% de trincheiras com cupins', lt: 'pct', am: 10, vm: 25,
      prot: 'Abra trincheiras no talhão (antes do plantio ou na reforma) e anote se há cupins em cada uma.' },
    { id: 'elasmo', g: 'Pragas', nome: 'Lagarta-elasmo', sci: 'Elasmopalpus lignosellus', un: '% de perfilhos com coração morto', lt: 'pct', am: 2, vm: 5,
      prot: 'Em 10 m de sulco, conte os perfilhos totais e os com coração morto (mais comum em época seca).' },
    { id: 'broca_gigante', g: 'Pragas', nome: 'Broca-gigante', sci: 'Telchin licus', un: '% de touceiras atacadas', lt: 'pct', am: 1, vm: 3,
      prot: 'Examine 50 touceiras seguidas e conte as que têm colmos com galeria larga e serragem.' },
    { id: 'pulgao', g: 'Pragas', nome: 'Pulgão-amarelo', sci: 'Sipha flava', un: '% de folhas infestadas', lt: 'pct', am: 20, vm: 40,
      prot: 'Examine a folha +1 de 25 plantas e conte as que têm colônias.' },
    { id: 'cigarrinha_folha', g: 'Pragas', nome: 'Cigarrinha-da-folha', sci: 'Mahanarva posticata', un: 'adultos por colmo', lt: 'cont', am: 1, vm: 2,
      prot: 'Conte os adultos nas folhas de 20 colmos e divida pelo número de colmos.' },
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
    { id: 'podridao_vermelha', g: 'Doenças', nome: 'Podridão-vermelha', sci: 'Colletotrichum falcatum / Fusarium', un: '% de entrenós com podridão', lt: 'pct', am: 2, vm: 5,
      prot: 'Junto com a avaliação da broca, conte os entrenós com tecido avermelhado.' },
    { id: 'estria_vermelha', g: 'Doenças', nome: 'Estria-vermelha', sci: 'Acidovorax avenae', un: '% de plantas com sintoma', lt: 'pct', am: 2, vm: 5,
      prot: 'Examine 100 plantas e conte as com estrias vermelhas nas folhas.' },
    { id: 'raquitismo', g: 'Doenças', nome: 'Raquitismo-da-soqueira', sci: 'Leifsonia xyli', un: 'presença no laudo', lt: 'pres', am: null, vm: 1,
      prot: 'Diagnóstico por laboratório. Marque Sim se o laudo for positivo.' },
    // ---- Plantas daninhas ----
    { id: 'colonia', g: 'Plantas daninhas', nome: 'Capim-colonião', sci: 'Panicum maximum', un: '% de cobertura', lt: 'pct', am: 5, vm: 15, prot: 'Estime a área coberta pela planta em 1 m² por ponto (quadro de amostragem).' },
    { id: 'braquiaria', g: 'Plantas daninhas', nome: 'Capim-braquiária', sci: 'Urochloa decumbens', un: '% de cobertura', lt: 'pct', am: 5, vm: 15, prot: 'Estime a área coberta pela planta em 1 m² por ponto.' },
    { id: 'colchao', g: 'Plantas daninhas', nome: 'Capim-colchão', sci: 'Digitaria spp.', un: '% de cobertura', lt: 'pct', am: 5, vm: 15, prot: 'Estime a área coberta pela planta em 1 m² por ponto.' },
    { id: 'tiririca', g: 'Plantas daninhas', nome: 'Tiririca', sci: 'Cyperus rotundus', un: '% de cobertura', lt: 'pct', am: 5, vm: 15, prot: 'Estime a área coberta pela planta em 1 m² por ponto.' },
    { id: 'grama_seda', g: 'Plantas daninhas', nome: 'Grama-seda', sci: 'Cynodon dactylon', un: '% de cobertura', lt: 'pct', am: 5, vm: 15, prot: 'Estime a área coberta pela planta em 1 m² por ponto.' },
    { id: 'corda_viola', g: 'Plantas daninhas', nome: 'Corda-de-viola', sci: 'Ipomoea spp.', un: '% de cobertura', lt: 'pct', am: 3, vm: 10, prot: 'Estime a área coberta pela planta em 1 m² por ponto. Atenção às plantas enroladas nos colmos.' },
    { id: 'mucuna', g: 'Plantas daninhas', nome: 'Mucuna', sci: 'Mucuna aterrima', un: '% de cobertura', lt: 'pct', am: 3, vm: 10, prot: 'Estime a área coberta pela planta em 1 m² por ponto.' },
    { id: 'mamona', g: 'Plantas daninhas', nome: 'Mamona', sci: 'Ricinus communis', un: 'plantas por 10 m²', lt: 'cont', am: 1, vm: 3, prot: 'Conte as plantas em 10 m² por ponto.' },
    { id: 'fedegoso', g: 'Plantas daninhas', nome: 'Fedegoso', sci: 'Senna obtusifolia', un: 'plantas por 10 m²', lt: 'cont', am: 2, vm: 5, prot: 'Conte as plantas em 10 m² por ponto.' },
    { id: 'buva', g: 'Plantas daninhas', nome: 'Buva', sci: 'Conyza spp.', un: 'plantas por 10 m²', lt: 'cont', am: 2, vm: 5, prot: 'Conte as plantas em 10 m² por ponto.' },
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
  return {
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
