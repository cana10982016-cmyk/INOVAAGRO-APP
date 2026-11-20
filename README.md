# INOVAAGRO — gestão agrícola


Aplicativo próprio com mapa de fazendas e talhões, produtores, safras, monitoramentos e ordens de trabalho.
Os dados vieram da exportação do SIMA (`/mnt/project-files/migracao-sima/`).

## Telas
Painel (resumo de área, safra, ordens pendentes e atrasadas, monitoramentos), Mapa (satélite, satélite com nomes ou mapa de ruas; cores por produtor, situação, condição, variedade ou cultura), cadastros, Monitoramentos, Ordens de trabalho, Relatórios por produtor/fazenda (PDF, Excel ou impressão) e Equipe e permissões.

## Permissões
- **Administrador**: tudo, inclusive cadastrar pessoas na equipe.
- **Técnico**: vê tudo, cadastra e edita.
- **Consulta**: só visualiza.

Para ativar, rode uma vez `supabase/02_equipe.sql` no editor SQL do Supabase (a tela Equipe tem o botão "Copiar comando"). Ele também garante que sempre existe um administrador ativo.

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
