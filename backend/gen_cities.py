import zipfile, io, json, urllib.request, os

# cities5000 = miejscowosci z populacja > 5000 (wiecej miast niz cities15000)
url = 'https://download.geonames.org/export/dump/cities5000.zip'
print('downloading...')
d = urllib.request.urlopen(url, timeout=180).read()
print('zip bytes:', len(d))
z = zipfile.ZipFile(io.BytesIO(d))
data = z.read(z.namelist()[0]).decode('utf-8')
out = {'Polska': [], 'UK': [], 'USA': []}
CC = {'PL': 'Polska', 'GB': 'UK', 'US': 'USA'}
FN = {'Polska': 'pl', 'UK': 'gb', 'USA': 'us'}
for line in data.splitlines():
    c = line.split('\t')
    if len(c) < 15:
        continue
    cc = c[8]
    if cc not in CC:
        continue
    country = CC[cc]
    pop = int(c[14] or 0)
    fc = c[7] or ''
    if not fc.startswith('PPL'):
        continue
    out[country].append({
        'display_name': c[1] + ', ' + country,
        'name': c[1],
        'lat': c[4],
        'lon': c[5],
        'osm_id': 0,
        'osm_type': 'node',
        'place_type': 'miasto',
        'country_code': cc.lower(),
        'importance': pop,
    })
for k, v in out.items():
    v.sort(key=lambda x: -x['importance'])
    fn = f'app/data/cities_{FN[k]}.json'
    with open(fn, 'w', encoding='utf-8') as f:
        json.dump(v, f, ensure_ascii=False)
    print(fn, len(v))
