"""Gera index.html (página única) a partir de src/."""
import os
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
rd = lambda p: open(os.path.join(R, p), encoding='utf-8').read()
html = (rd('src/index.template.html')
        .replace('/*LEAFLET_CSS*/', rd('src/leaflet.css'))
        .replace('/*APP_CSS*/', rd('src/app.css'))
        .replace('/*APP_JS*/', rd('src/offline.js') + '\n' + rd('src/app.js')))
HOSTED = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>\n<script src="config.js"></script>'
# artifact.html: fragmento para publicar como Artifact (o host adiciona <html>/<head>)
open(os.path.join(R, 'artifact.html'), 'w', encoding='utf-8').write(html.replace('<!--HOSTED_SCRIPTS-->', ''))
# index.html: documento completo para hospedar em qualquer servidor ou abrir localmente
full = '<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<link rel="manifest" href="manifest.webmanifest">\n<meta name="theme-color" content="#2F4424">\n<link rel="icon" type="image/png" href="icons/favicon-32.png">\n<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="INOVAAGRO">\n<meta name="apple-mobile-web-app-status-bar-style" content="default">\n</head>\n<body>\n' + html.replace('<!--HOSTED_SCRIPTS-->', HOSTED) + '\n</body>\n</html>\n'
open(os.path.join(R, 'index.html'), 'w', encoding='utf-8').write(full)
print('ok', len(full))
