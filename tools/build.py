"""Gera index.html (página única) a partir de src/."""
import base64, json, os
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
rd = lambda p: open(os.path.join(R, p), encoding='utf-8').read()
b64 = lambda p: 'data:image/png;base64,' + base64.b64encode(open(os.path.join(R, p), 'rb').read()).decode()
ASSETS = {'{{LOGO}}': 'assets/logo.png', '{{LOGO_ESCURO}}': 'assets/logo-escuro.png', '{{FAVICON}}': 'assets/favicon.png', '{{ICONE}}': 'assets/icone.png'}
html = (rd('src/index.template.html')
        .replace('/*LEAFLET_CSS*/', rd('src/leaflet.css'))
        .replace('/*APP_CSS*/', rd('src/app.css') + '\n' + rd('src/campo.css') + '\n' + rd('src/financeiro.css'))
        .replace('/*APP_JS*/', rd('src/offline.js') + '\n' + rd('src/app.js').replace("/*SQL_EQUIPE*/''", json.dumps(rd('supabase/02_atualizacao.sql'), ensure_ascii=False)) + '\n' + rd('src/cana.js') + '\n' + rd('src/campo.js') + '\n' + rd('src/financeiro.js')))
HOSTED = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>\n<script src="config.js"></script>'
# artifact.html: fragmento para publicar como Artifact (o host adiciona <html>/<head>); imagens embutidas
art = html.replace('<!--HOSTED_SCRIPTS-->', '')
for k, p in ASSETS.items(): art = art.replace(k, b64(p))
open(os.path.join(R, 'artifact.html'), 'w', encoding='utf-8').write(art)
# index.html: documento completo para hospedar em qualquer servidor ou abrir localmente
for k, p in ASSETS.items(): html = html.replace(k, p)
full = '<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="theme-color" content="#5e8145">\n<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" type="image/png" href="icons/favicon-32.png">\n<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="INOVAAGRO">\n<meta name="apple-mobile-web-app-status-bar-style" content="default">\n</head>\n<body>\n' + html.replace('<!--HOSTED_SCRIPTS-->', HOSTED) + '\n</body>\n</html>\n'
open(os.path.join(R, 'index.html'), 'w', encoding='utf-8').write(full)
print('ok', len(full))
