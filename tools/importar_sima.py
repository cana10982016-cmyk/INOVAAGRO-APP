"""Importa a exportação do SIMA (migracao-sima/) para o formato do Gleba (data/*.json).
Uso: python3 importar_sima.py [pasta_exportacao] [pasta_saida]"""
import json, os, re, sys
SRC = sys.argv[1] if len(sys.argv) > 1 else '/mnt/project-files/migracao-sima'
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
os.makedirs(OUT, exist_ok=True)
D = lambda n: json.load(open(os.path.join(SRC, 'dados', n + '.json'), encoding='utf-8'))
f2 = lambda v: None if v in (None, '') else round(float(v), 4)
dt = lambda v: v[:10] if v else None
ativo = lambda r: str(r.get('active', 1)) != '0' and not r.get('deleted_at')

# Traduções dos catálogos (o SIMA entrega em espanhol)
TR = {'Caña de azucar': 'Cana-de-açúcar', 'Barbecho': 'Pousio', 'Brotación': 'Brotação', 'Macollaje': 'Perfilhamento',
      'Gran crecimiento': 'Grande crescimento', 'Maduración': 'Maturação', 'Barrenador': 'Broca-da-cana',
      'Pulgon amarillo': 'Pulgão-amarelo', 'Guinea': 'Capim-colonião', 'Brusca': 'Fedegoso',
      'Malo': 'Ruim', 'Regular': 'Regular', 'Bueno': 'Bom', 'Muy bueno': 'Muito bom', 'Excelente': 'Excelente',
      'Muy húmedo': 'Muito úmido', 'Húmedo': 'Úmido', 'Adecuado': 'Adequado', 'Seco': 'Seco', 'Muy seco': 'Muito seco',
      'Individuos en 10 m²': 'Indivíduos em 10 m²', 'Estado fenológico': 'Estádio fenológico', '% de presencia': '% de presença',
      'Complejo': 'Complexo', 'Insecticida': 'Inseticida', 'Regulador Fisiologico': 'Regulador fisiológico',
      'Variedad/Hibrido (Semilla)': 'Variedade/híbrido (semente)', 'Coadyuvante': 'Adjuvante'}
tr = lambda s: TR.get(s, s) if s else s
cat = lambda n, f='name': {r['id']: tr(r[f]) for r in D('catalogos/' + n)}
fenol, hidr, est_tal = cat('estados_fenologicos'), cat('estados_hidricos'), cat('estados_talhao')
pragas, protos, medidas = cat('pragas_doencas'), cat('protocolos_monitoramento'), cat('medidas_monitoramento', 'unit_sample')
unid = {r['id']: r['unit'] for r in D('catalogos/unidades')}
unid_tot = {r['id']: r['unit_total'] for r in D('catalogos/unidades')}
insumos = {r['id']: r for r in D('catalogos/insumos')}
TIPO_ORDEM = {7: 'Pulverização', 17: 'Plantio', 18: 'Adubação', 19: 'Colheita', 47: 'Outro'}
STATUS_ORDEM = {1: 'Planejada', 2: 'Em andamento', 7: 'Concluída'}
NIVEL = {1: 'Baixo', 2: 'Médio', 3: 'Alto'}

def ciclo(c):  # "2024/2025" -> "2024/25"
    p = (c or '').split('/')
    return p[0] + '/' + p[1][-2:] if len(p) == 2 and len(p[1]) == 4 else c

produtores = [{'id': r['id'], 'nome': r['name'].strip(), 'documento': r.get('cuit') or None} for r in D('produtores') if ativo(r)]
fazendas = []
for r in D('fazendas'):
    if not ativo(r): continue
    nome, cod = r['name'].strip(), r.get('external_code') or None
    m = re.match(r'^\s*(\d+)\s*-\s*(.+)$', nome)
    if m: cod, nome = cod or m.group(1), m.group(2).strip()
    lat, lon = f2(r.get('lat')), f2(r.get('lon'))
    fazendas.append({'id': r['id'], 'produtor_id': r['farmer_id'], 'nome': nome, 'codigo': cod,
                     'municipio': (lambda p: p[0].strip() + (' - ' + p[1].strip() if len(p) > 1 else ''))((r.get('location') or '').split(',')) if r.get('location') else None,
                     'lat': lat if lat else None, 'lng': lon if lon else None})
faz_prod = {f['id']: f['produtor_id'] for f in fazendas}

def rnd(c):
    if isinstance(c[0], (int, float)): return [round(c[0], 6), round(c[1], 6)]
    return [rnd(x) for x in c]
geo = {ft['properties']['id_talhao']: ft['geometry'] for ft in json.load(open(os.path.join(SRC, 'geo', 'talhoes.geojson'), encoding='utf-8'))['features']}
talhoes = []
for r in D('talhoes'):
    if not ativo(r): continue
    g = geo.get(r['id']) or geo.get(int(r['id']))
    talhoes.append({'id': r['id'], 'fazenda_id': r['establishment_id'], 'nome': str(r['name']).strip(), 'area_ha': f2(r.get('area')),
                    'obs': r.get('observations') or None,
                    'geometry': {'type': g['type'], 'coordinates': rnd(g['coordinates'])} if g else None})

ciclos = {r['id']: r for r in D('ciclos_safra')}
safras, saf_plot = [], {}
for r in D('safras_talhao'):
    if not ativo(r): continue
    c = ciclos.get(r['master_campaign_id'], {})
    var = r.get('variety') or (insumos.get(r.get('formulated_id'), {}).get('commercial_brand'))
    saf_plot[r['id']] = r['plot_id']
    safras.append({'id': r['id'], 'talhao_id': r['plot_id'], 'safra': ciclo(c.get('cycle_name')), 'cultura': tr(c.get('cultivation_name')) or 'Outra',
                   'variedade': var or None, 'data_plantio': dt(r.get('planting_date')), 'data_colheita': dt(r.get('harvest_finished')) if isinstance(r.get('harvest_finished'), str) else None,
                   'produtividade': f2(r.get('harvest_final_yield')) or None, 'area_ha': f2(r.get('planting_objective_area_ha')),
                   'obs': r.get('observations') or None})

res_by, amo_by, fot_by = {}, {}, {}
for r in D('monitoramento_resultados'): res_by.setdefault(r['scouting_id'], []).append(r)
for r in D('monitoramento_amostras'): amo_by[r['scouting_id']] = amo_by.get(r['scouting_id'], 0) + 1
for r in D('monitoramento_fotos'):
    if r.get('parent_type') in (None, 'scoutings'): fot_by.setdefault(r['parent_id'], []).append(r)
monit = []
for r in D('monitoramentos'):
    if not ativo(r): continue
    res = [{'alvo': pragas.get(x['adversity_id'], str(x['adversity_id'])), 'protocolo': protos.get(x['protocol_id']),
            'medida': medidas.get(x['measure_id']), 'valor': f2(x.get('aggr_result_value')), 'nivel': NIVEL.get(x.get('semaphore'))} for x in res_by.get(r['id'], [])]
    fotos = fot_by.get(r['id'], [])
    monit.append({'id': r['id'], 'talhao_id': saf_plot.get(r['campaign_id']), 'safra_id': r['campaign_id'], 'data': dt(r.get('date')),
                  'tipo': 'Praga' if res else 'Estádio fenológico', 'alvo': ', '.join(dict.fromkeys(x['alvo'] for x in res)) or None,
                  'nivel': NIVEL.get(r.get('semaphore')), 'estadio': fenol.get(r.get('phenologicalstate_id')),
                  'estado_hidrico': hidr.get(r.get('hydricstate_id')), 'estado_talhao': est_tal.get(r.get('plotstate_id')),
                  'produtividade_estimada': f2(r.get('estimated_yield')), 'amostras': amo_by.get(r['id'], 0) or r.get('samples_taken'),
                  'fotos': len([x for x in fotos if x.get('file_name')]), 'pontos_gps': len(fotos),
                  'lat': f2(r.get('lat')), 'lng': f2(r.get('lon')), 'obs': r.get('observations') or None, 'resultados': res or None})

ots, prods, aplic = {}, {}, {}
for r in D('ordens_trabalho_safras'): ots.setdefault(r['application_order_id'], []).append(r)
for r in D('ordens_trabalho_produtos'): prods.setdefault(r['application_order_id'], []).append(r)
for r in D('ordens_trabalho_aplicado'): aplic.setdefault(r['application_order_id'], []).append(r)
ordens = []
talmap = {t['id']: t for t in talhoes}
for r in D('ordens_trabalho'):
    if r.get('deleted_at'): continue
    tal_ids = list(dict.fromkeys(saf_plot[x['campaign_id']] for x in ots.get(r['id'], []) if x['campaign_id'] in saf_plot))
    fz = [talmap[t]['fazenda_id'] for t in tal_ids if t in talmap]
    faz = max(set(fz), key=fz.count) if fz else None
    ap = aplic.get(r['id'], [])
    ap_by_prod = {}
    for a in ap: ap_by_prod.setdefault(a['formulated_id'], []).append(a)
    produtos = []
    for p in sorted(prods.get(r['id'], []), key=lambda x: x.get('input_order') or 0):
        ins = insumos.get(p['formulated_id'], {})
        apl = ap_by_prod.get(p['formulated_id'], [])
        produtos.append({'produto': ins.get('commercial_brand') or str(p['formulated_id']), 'classe': tr(ins.get('formulated_use')),
                         'dose': f2(p.get('dose_to_apply')), 'unidade': unid.get(p.get('unit_id')),
                         'total': f2(p.get('total_to_apply')), 'unidade_total': unid_tot.get(p.get('unit_id')),
                         'aplicado_total': round(sum(float(a.get('total_applied') or 0) for a in apl), 4) if apl else None})
    datas_ap = sorted(a['date_applied'] for a in ap if a.get('date_applied'))
    ordens.append({'id': r['id'], 'titulo': (r.get('application_name') or 'Ordem ' + str(r['id'])).strip(),
                   'tipo': TIPO_ORDEM.get(r.get('order_type'), 'Outro'), 'status': STATUS_ORDEM.get(r.get('status_id'), 'Planejada'),
                   'fazenda_id': faz, 'talhao_ids': tal_ids, 'data_prevista': dt(r.get('date_issued') or r.get('date')),
                   'data_conclusao': dt(datas_ap[-1]) if datas_ap else dt(r.get('date_confirmed')),
                   'area_ha': round(sum(float(x.get('area_to_apply') or 0) for x in ots.get(r['id'], [])), 2) or None,
                   'insumos': '\n'.join(f"{p['produto']} - {('%g' % p['dose']).replace('.', ',') if p['dose'] is not None else '?'} {p['unidade'] or ''}".strip() for p in produtos) or None,
                   'produtos': produtos or None, 'obs': (r.get('observations') or '').strip() or None})

def dump(name, rows):
    with open(os.path.join(OUT, name + '.json'), 'w', encoding='utf-8') as f:
        f.write('[\n' + ',\n'.join(json.dumps({k: v for k, v in r.items() if v is not None}, ensure_ascii=False, separators=(',', ':')) for r in rows) + '\n]\n')
    print(f'{name}: {len(rows)}')

dump('produtores', produtores); dump('fazendas', fazendas); dump('talhoes', talhoes)
dump('safras', safras); dump('monitoramentos', monit); dump('ordens', ordens)
