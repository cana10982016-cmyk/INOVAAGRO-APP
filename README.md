# INOVAAGRO — gestão agrícola


Aplicativo próprio com mapa de fazendas e talhões, produtores, safras, monitoramentos e ordens de trabalho.
Os dados vieram da exportação do SIMA (`/mnt/project-files/migracao-sima/`).

## Telas
Painel (resumo de área, safra, ordens pendentes e atrasadas, monitoramentos), Mapa (satélite, satélite com nomes ou mapa de ruas; cores por produtor, situação, condição, variedade ou cultura), cadastros, Monitoramentos, Ordens de trabalho, Relatórios por produtor/fazenda (PDF, Excel ou impressão) e Equipe e permissões.

## Permissões
- **Administrador**: tudo, inclusive cadastrar pessoas na equipe.
- **Técnico**: vê tudo, cadastra e edita.
- **Consulta**: só visualiza.

Para ativar, rode uma vez `supabase/02_atualizacao.sql` no editor SQL do Supabase (a tela Equipe tem o botão "Copiar comando"). Ele também garante que sempre existe um administrador ativo.

## Despesas e veículos (Financeiro)
- Menu **Financeiro → Despesas e veículos** (no celular: menu do modo campo). Código em `src/financeiro.js` e `src/financeiro.css`.
- Cadastro de veículos (placa, modelo, hodômetro, próxima revisão) e lançamentos de combustível, manutenção, alimentação e outras despesas, com foto do comprovante, fazenda/cliente visitado e situação (Pendente, Aprovada, Reembolsada, Recusada).
- Calcula consumo km/l (entre tanques cheios), km rodados e custo por km; filtros por período, veículo, funcionário, tipo e fazenda; gráficos; Excel e PDF.
- Funciona sem internet: lançamentos entram na fila e as fotos ficam no aparelho até enviar.
- Para ativar no banco, rode uma vez `supabase/04_financeiro.sql` no editor SQL do Supabase. Técnico vê e lança só as próprias despesas; administrador vê tudo e aprova. Comprovantes ficam numa área privada.

## Melhorias da cana (produtividade, recomendação, mapas offline, backup, relatórios)
- **Produtividade da cana** (`src/produtividade.js`, menu Análise): lança TCH e ATR por talhão em cada safra (gravados no plantio: `produtividade` = TCH, `atr`, `corte`, `data_colheita`), calcula TAH e produção e compara as safras.
- **Histórico do talhão** (`src/linha_tempo.js`): linha do tempo de cada safra com visitas e pragas, aplicações, chuva por mês, colheita e TCH/ATR. No celular, botão Histórico no cartão do talhão.
- **Recomendação → ordem de aplicação** (`src/campo.js`): na visita do celular, produtos, doses, talhões e prazo; um toque gera a ordem (funciona sem internet). A visita guarda `recomendacao` e `ordem_id`; a ordem guarda `origem_visita`. O site mostra a recomendação na visita e no PDF.
- **Mapas offline das fazendas** (menu do modo campo): baixa a imagem de satélite da fazenda inteira (zoom 12 a 18) num armazenamento separado (`inovaagro-mapa-faz`), que o app não apaga sozinho.
- **Backup** (`src/backup.js`, só administrador): rode uma vez `supabase/05_backup.sql` para o banco copiar todas as tabelas toda segunda às 6h (guarda 8 cópias). O site também salva uma cópia semanal no computador do administrador (pasta Downloads). Dá para baixar e restaurar pela tela.
- **Relatório mensal do cliente** (`src/relatorio_mensal.js`): PDF com visitas, pragas da cana com nível de controle, chuva por dia, aplicações e custos. Custos só aparecem para o administrador.

## Acabamento (tema escuro, animações, resumo do dia, busca, ditado)
- Código em `src/acabamento.js` e `src/acabamento.css`.
- **Tema**: Automático (segue o aparelho), Claro ou Escuro. No site, botão ao lado da busca; no celular, menu > Aparência. Fica salvo no aparelho.
- **Animações** leves entre telas; desligadas quando o aparelho pede "reduzir movimento".
- **Resumo do dia**: no topo do Início (site) e na aba **Hoje** do celular: visitas de hoje, alertas de praga (últimos 15 dias), chuva registrada, previsão (Open-Meteo), ordens de hoje e atrasadas. Contas só para o administrador.
- **Busca rápida**: Ctrl K no computador ou a lupa no celular; acha fazenda, talhão, visita, ordem e produtor digitando poucas letras (sem acento).
- **Ditado por voz**: botão "Falar" em todo campo de observação. Precisa de internet; sem sinal, use o microfone do teclado do celular.

## Estrutura
- `assets/` logo e ícones da InovaAgro.
- `src/` código-fonte (HTML, CSS, JavaScript puro + Leaflet). Sem etapa de compilação além de `tools/build.py`.
- `data/*.json` dados importados do SIMA (ids do SIMA preservados). **Não vão para o GitHub**: ficam no banco de dados, protegidos por login.
- `tools/importar_sima.py` converte a exportação do SIMA em `data/*.json` (rode de novo para reimportar).
- `tools/build.py` gera `index.html` (página completa, para hospedar ou abrir num servidor) e `artifact.html` (versão publicada no Claude).
- `tools/teste_tela.js` capturas de tela com Playwright.

## Onde ficam as alterações
Os dados importados são a base (somente leitura). O que for criado, editado ou excluído no app fica salvo por cima:
na versão publicada no Claude, num banco na nuvem; rodando localmente, no navegador. "Exportar dados" baixa tudo em JSON.

## App no celular (PWA, funciona sem internet)
- `manifest.webmanifest` + `icons/` fazem o site virar app instalável (Android: Chrome > Instalar app; iPhone: Safari > Compartilhar > Adicionar à Tela de Início).
- `sw.js` guarda o app (página, Leaflet, Supabase JS) e as imagens de satélite vistas ou baixadas em "Salvar mapa offline".
- `src/offline.js` guarda uma cópia dos dados no aparelho (IndexedDB) e uma fila de alterações. Sem internet o app abre com a cópia; o que for salvo entra na fila e é enviado ao Supabase quando a conexão volta (vale a última alteração de cada registro).
- No mapa: "Onde estou" mostra o GPS e abre o talhão onde você está.
- Ao mudar `sw.js`, aumente `VERSAO` para os celulares baixarem a versão nova.

## Próximos passos
- Hospedagem própria + banco (ex.: Supabase/Postgres com PostGIS) e login de usuários.
- App móvel: o mesmo código empacotado com Capacitor (Android/iOS), com modo offline para monitoramento no campo.
- Desenhar/editar contornos de talhões no mapa; fotos dos monitoramentos (precisam ser baixadas do SIMA).
