"""Gera index.html (página única) a partir de src/."""
import os
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
rd = lambda p: open(os.path.join(R, p), encoding='utf-8').read()
html = rd('src/index.template.html').replace('/*LEAFLET_CSS*/', rd('src/leaflet.css')).replace('/*APP_CSS*/', rd('src/app.css')).replace('/*APP_JS*/', rd('src/app.js'))
# artifact.html: fragmento para publicar como Artifact (o host adiciona <html>/<head>)
open(os.path.join(R, 'artifact.html'), 'w', encoding='utf-8').write(html)
# index.html: documento completo para hospedar em qualquer servidor ou abrir localmente
full = '<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n' + html + '\n</body>\n</html>\n'
open(os.path.join(R, 'index.html'), 'w', encoding='utf-8').write(full)
print('ok', len(html))
