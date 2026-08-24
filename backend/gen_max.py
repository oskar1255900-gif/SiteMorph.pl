import urllib.request, zipfile, io, json, pathlib
targets = {
    'PL': ('Polska', 11000),
    'GB': ('UK', 8000),
    'US': ('USA', 15000),
}
FN = {'Polska':'pl','UK':'gb','USA':'us'}
for cc, (country, limit) in targets.items():
    url = f'https://download.geonames.org/export/dump/{cc}.zip'
    print(f'downloading {cc}...')
    d = urllib.request.urlopen(url, timeout=180).read()
    z = zipfile.ZipFile(io.BytesIO(d))
    data = z.read(f'{cc}.txt').decode('utf-8')
    out = []
    for line in data.splitlines():
        c = line.split('\t')
        if len(c) < 15:
            continue
        fc = c[7] or ''
        if not fc.startswith('PPL'):
            continue
        name = c[1]
        if not name:
            continue
        pop = int(c[14] or 0)
        out.append({
            'display_name': name + ', ' + country,
            'name': name,
            'lat': c[4],
            'lon': c[5],
            'osm_id': 0,
            'osm_type': 'node',
            'place_type': 'miasto' if fc in ('PPLA','PPLA2','PPLA3','PPL','PPLC') else 'wies',
            'country_code': cc.lower() if cc != 'GB' else 'gb',
            'importance': pop,
        })
    out.sort(key=lambda x: -x['importance'])
    sliced = out[:limit]
    fn = f'app/data/cities_{FN[country]}.json'
    pathlib.Path(fn).write_text(json.dumps(sliced, ensure_ascii=False), encoding='utf-8')
    print(f'{fn} {len(sliced)} (z {len(out)} total)')
    # also print pop at cutoff
    imp = sliced[-1]["importance"]
    nm = sliced[-1]["name"]
    print(f'  cutoff pop {imp} name {nm}')
