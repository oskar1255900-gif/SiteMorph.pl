from fastapi import APIRouter, Query
import requests
import os
import time
import re
import json
import unicodedata
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, List, Tuple

router = APIRouter(prefix="/api/geocode", tags=["Geocode"])
UA = {"User-Agent": "SiteMorph/1.0 (contact@sitemorph.pl)"}
COUNTRY_MAP = {"Polska": "Poland", "USA": "United States", "UK": "United Kingdom"}
COUNTRY_CODES = {"Polska": "pl", "USA": "us", "UK": "gb"}
LANGS = {"Polska": "pl", "USA": "en", "UK": "en"}

ALLOWED_PLACE_TYPES = {"city", "town", "village", "municipality", "hamlet", "suburb", "neighbourhood", "isolated_dwelling", "quarter", "city_district", "borough"}

FEATURE_TYPE_PL = {
    "PPLC": "stolica",
    "PPLA": "miasto", "PPLA2": "miasto", "PPLA3": "miasto", "PPLA4": "miasto",
    "PPLG": "miasto",
    "PPLX": "dzielnica",
    "PPLS": "wieś",
    "PPLL": "miejscowość",
    "PPL": "miejscowość",
    "PPLF": "miejscowość",
    "PPLW": "miejscowość",
    "PPLH": "miejscowość",
    "PPLQ": "miejscowość",
    "PPLR": "miejscowość",
}

def _fold(text: str) -> str:
    """Znormalizowany klucz do deduplikacji — bez ogonków i nadmiarowych spacji."""
    t = re.sub(r"\s+", " ", (text or "").lower().strip())
    t = unicodedata.normalize("NFKD", t)
    return "".join(c for c in t if not unicodedata.combining(c))

_PL_MAP_FULL = {"a": "ą", "c": "ć", "e": "ę", "l": "ł", "n": "ń", "o": "ó", "s": "ś", "z": "ż"}

def _pl_variants(q: str) -> List[str]:
    """Warianty zapytania z polskimi znakami — użytkownicy często piszą bez ogonków
    ('walb' -> 'wałb'), a Open-Meteo wymaga właściwej pisowni."""
    lower = q.lower()
    variants = []
    v1 = "".join("ł" if ch == "l" else ch for ch in lower)
    if v1 != lower:
        variants.append(v1)
    v2 = "".join(_PL_MAP_FULL.get(ch, ch) for ch in lower)
    if v2 != lower and v2 not in variants:
        variants.append(v2)
    return variants[:2]

def _autocomplete_open_meteo(q: str, country: str) -> list:
    """Źródło 1: Open-Meteo Geocoding — wyszukiwanie po fragmencie nazwy
    ('wad' -> Wadowice), sortowanie po populacji, język polski.
    Uwaga: wymaga polskich znaków — przy pisowni bez ogonków próbujemy wariantów."""
    lang = LANGS.get(country, "pl")
    cc = COUNTRY_CODES.get(country, "")

    def _fetch(name_q: str) -> dict:
        params = {"name": name_q, "count": 50, "language": lang, "format": "json"}
        if cc:
            params["countryCode"] = cc.upper()
        last_exc: Exception = RuntimeError("unknown")
        for attempt in range(2):
            try:
                r = requests.get(
                    "https://geocoding-api.open-meteo.com/v1/search",
                    params=params,
                    headers=UA,
                    timeout=10,
                )
                r.raise_for_status()
                return r.json()
            except Exception as e:
                last_exc = e
                if attempt == 0:
                    time.sleep(0.4)
        raise last_exc

    def _parse(data: dict) -> list:
        out = []
        seen = set()
        for it in (data.get("results") or []):
            code = it.get("feature_code") or ""
            if not code.startswith("PPL"):
                continue
            name = it.get("name") or ""
            if not name:
                continue
            key = f"{name.lower()}|{round(float(it.get('latitude', 0)), 3)}|{round(float(it.get('longitude', 0)), 3)}"
            if key in seen:
                continue
            seen.add(key)
            parts = [name, it.get("admin1"), it.get("country")]
            display = ", ".join(p for p in parts if p)
            out.append({
                "display_name": display,
                "name": name,
                "lat": str(it.get("latitude")),
                "lon": str(it.get("longitude")),
                "osm_id": 0,
                "osm_type": "node",
                "place_type": FEATURE_TYPE_PL.get(code, "miejscowość"),
                "type": FEATURE_TYPE_PL.get(code, "miejscowość"),
                "class": "place",
                "country_code": (it.get("country_code") or "").lower(),
                "importance": float(it.get("population") or 0),
                "boundingbox": None,
            })
        return out

    out = _parse(_fetch(q))
    if len(out) < 3:
        known = {_fold(x["name"]) for x in out}
        for variant in _pl_variants(q):
            try:
                extra = _parse(_fetch(variant))
            except Exception:
                continue
            for item in extra:
                if _fold(item["name"]) in known:
                    continue
                known.add(_fold(item["name"]))
                out.append(item)
    out.sort(key=lambda x: x["importance"], reverse=True)
    return out[:12]

def _autocomplete_nominatim(q: str, country: str) -> list:
    """Źródło 2: Nominatim — radzi sobie z pisownią bez polskich znaków
    ('wloclawek' -> Włocławek, 'lodz' -> Łódź)."""
    geo_country = COUNTRY_MAP.get(country, country)
    country_code = COUNTRY_CODES.get(country, "")
    params = {
        "q": f"{q}, {geo_country}" if country in COUNTRY_MAP else q,
        "format": "json",
        "addressdetails": 1,
        "limit": 10,
        "accept-language": LANGS.get(country, "pl"),
    }
    if country_code:
        params["countrycodes"] = country_code
    r = requests.get(
        "https://nominatim.openstreetmap.org/search",
        params=params,
        headers=UA,
        timeout=10,
    )
    r.raise_for_status()
    data = r.json()
    out = []
    seen_names = set()
    for it in data:
        place_type = (it.get("type") or "").lower()
        place_class = (it.get("class") or "").lower()
        is_allowed = False
        if place_type in ALLOWED_PLACE_TYPES:
            is_allowed = True
        if place_class == "boundary" and place_type in ("city", "town", "village", "municipality", "administrative", "hamlet"):
            addr = it.get("address") or {}
            if any(k in addr for k in ("city", "town", "village", "municipality", "hamlet", "suburb")):
                is_allowed = True
            elif place_type == "administrative":
                is_allowed = True
        if not is_allowed:
            continue
        name = it.get("name") or (it.get("display_name", "").split(",")[0].strip())
        if not name:
            continue
        nkey = _fold(name)
        if nkey in seen_names:
            continue
        seen_names.add(nkey)
        out.append({
            "display_name": it.get("display_name", ""),
            "name": name,
            "lat": it.get("lat"),
            "lon": it.get("lon"),
            "osm_id": it.get("osm_id"),
            "osm_type": it.get("osm_type"),
            "place_type": place_type,
            "type": place_type,
            "class": place_class,
            "country_code": (it.get("address") or {}).get("country_code") or country_code,
            "importance": it.get("importance") or 0,
            "boundingbox": it.get("boundingbox"),
        })
    return out

# ---------------------------------------------------------------------------
# Pełna lista miejscowości danego kraju z OSM — prawdziwe nazwy, pobierane
# z Overpass API po GRANICACH kraju (area), więc bez obcych miast z sąsiednich
# państw. Cache w pamięci + na dysku (24h). Używane przez Lead Finder.
# ---------------------------------------------------------------------------
COUNTRY_AREA: Dict[str, int] = {
    "Polska": 3600049715,
    "UK": 3600062149,
    "USA": 3600148838,
}
_all_cities_cache: Dict[str, Tuple[float, List[dict]]] = {}
ALL_CITIES_VERSION = 7
ALL_CITIES_TTL = 24 * 3600
_fetching = set()
OVERPASS_ENDPOINTS = [
    "https://overpass-api.de",
    "https://overpass.kumi.systems",
    "https://overpass.private.coffee",
]

# Min populacja wsi/hamletów per kraj — duże kraje mają tysiące wsi i Overpass
# wywala timeout na pełnym zbiorze. Brak wpisu = pomijamy wsie (USA: tylko city|town,
# mniejsze miejscowości i tak dorzuca Open-Meteo przy wpisywaniu).
COUNTRY_VILLAGE_MIN_POP: Dict[str, int] = {
    "Polska": 1000,
    "UK": 2000,
    "USA": 5000,
}

# Rozszerzony fallback — więcej miast, żeby nie było pustki gdy Overpass pada
# Źródło: Wikipedia / stat.gov / ONS / Census Bureau top miasta
POPULAR_FALLBACK: Dict[str, List[str]] = {
    "Polska": [
        "Warszawa","Kraków","Łódź","Wrocław","Poznań","Gdańsk","Szczecin","Bydgoszcz","Lublin","Białystok",
        "Katowice","Gdynia","Częstochowa","Radom","Sosnowiec","Toruń","Kielce","Rzeszów","Gliwice","Zabrze",
        "Olsztyn","Bielsko-Biała","Bytom","Zielona Góra","Rybnik","Ruda Śląska","Opole","Tychy","Gorzów Wielkopolski",
        "Dąbrowa Górnicza","Płock","Elbląg","Wałbrzych","Włocławek","Tarnów","Chorzów","Koszalin","Kalisz","Legnica",
        "Grudziądz","Jaworzno","Słupsk","Jastrzębie-Zdrój","Nowy Sącz","Jelenia Góra","Siedlce","Mysłowice","Piła",
        "Ostrów Wielkopolski","Konin","Piotrków Trybunalski","Lubliniec","Suwałki","Gorzów","Zamość","Leszno",
        "Przemyśl","Stalowa Wola","Kędzierzyn-Koźle","Łomża","Żory","Ełk","Tarnobrzeg","Mielec","Bełchatów",
        "Świdnica","Pruszków","Legionowo","Chełm","Ostrowiec Świętokrzyski","Zawiercie","Starachowice","Wejherowo",
        "Puławy","Starogard Gdański","Skierniewice","Tomaszów Mazowiecki","Krosno","Rumia","Pabianice","Otwock",
        "Marki","Żyrardów","Kutno","Nysa","Kołobrzeg","Kwidzyn","Sopot","Siemianowice Śląskie","Inowrocław",
        "Oświęcim","Tczew","Gniezno","Piekary Śląskie","Olsztyn","Zduńska Wola","Sieradz","Mikołów","Bełchatów",
        "Świętochłowice","Racibórz","Mława","Świdnik","Bielawa","Kępno","Kościerzyna","Krotoszyn","Luboń","Lubań",
        "Łaziska Górne","Łęczyca","Łowicz","Malbork","Miasteczko Śląskie","Mikołajki","Milicz","Mszana Dolna",
        "Muszyna","Myszków","Nakło nad Notecią","Nidzica","Nisko","Nowa Ruda","Nowa Sól","Nowe Miasto Lubawskie",
        "Nowy Dwór Mazowiecki","Nowy Targ","Oborniki","Olecko","Olesno","Ostróda","Ostrzeszów","Otwock","Ozorków",
        "Pajęczno","Parczew","Pasłęk","Piaseczno","Piechowice","Pieniężno","Pilica","Pionki","Pisz","Pleszew",
        "Pniewy","Pogoń Szczecińska","Polanica-Zdrój","Police","Polkowice","Poniec","Poręba","Poznań","Prószków",
        "Prudnik","Pruszków","Przasnysz","Przeworsk","Przytyk","Pszczyna","Puck","Pyrzyce","Radziejów","Radlin",
        "Radomsko","Radzyń Podlaski","Rakoniewice","Raszków","Rawa Mazowiecka","Rawicz","Recz","Redziny","Rejowiec",
        "Reszel","Rogoźno","Ropczyce","Ruda Śląska","Rudnik nad Sanem","Rybnik","Rychwał","Ryki","Rymanów","Ryn",
        "Rzepin","Rzgów","Sandomierz","Sanok","Sejny","Serock","Sępólno Krajeńskie","Sianów","Siedlce","Siemianowice Śląskie",
        "Sieniawa","Sieradz","Sierpc","Skarszewy","Skoczów","Skoki","Skórcz","Słomniki","Słubice","Słupsk","Sobótka",
        "Sochaczew","Sokołów Podlaski","Sokołów Małopolski","Sompolno","Sopot","Sosnowiec","Stalowa Wola","Starachowice",
        "Stargard","Starogard Gdański","Stary Sącz","Stęszew","Strzelce Krajeńskie","Strzelce Opolskie","Strzelin",
        "Strzyżów","Sucha Beskidzka","Suchedniów","Suchowola","Sulejów","Sulęcin","Suwałki","Swarzędz","Syców","Szamocin",
        "Szamotuły","Szczawnica","Szczecin","Szczecinek","Szczucin","Szczytno","Sztum","Szubin","Szydłowiec","Ścinawa",
        "Ślesin","Śmigiel","Śrem","Środa Śląska","Środa Wielkopolska","Świdnica","Świdnik","Świdwin","Świebodzin",
        "Świebodzice","Świętochłowice","Tarczyn","Tarnobrzeg","Tarnowskie Góry","Tarnów","Tczew","Tolkmicko","Tomaszów Lubelski",
        "Tomaszów Mazowiecki","Toruń","Torzym","Tuchola","Tuliszków","Turek","Tuszyn","Twardogóra","Tychy","Tyczyn",
        "Tykocin","Tyczyn","Ulanów","Uniejów","Ustka","Wadowice","Warka","Warszawa","Warta","Wasilków","Wąbrzeźno",
        "Wąchock","Węgliniec","Węgorzewo","Węgorzyno","Węgrów","Wieliczka","Wieleń","Wieruszów","Więcbork","Wijewo",
        "Wilanów","Winnica","Wisła","Witkowo","Witnica","Wiązowna","Włocławek","Włodawa","Włoszakowice","Wodzisław Śląski",
        "Wojkowice","Wołczyn","Wołomin","Wołów","Wolsztyn","Węgrów","Wręczyca Wielka","Wronki","Września","Wschowa",
        "Wyrzysk","Wysokie Mazowieckie","Wyszków","Ząbkowice Śląskie","Zambrów","Zator","Zawichost","Zawidów","Zawiercie",
        "Zbąszyń","Zbąszynek","Zduńska Wola","Zdzieszowice","Zgierz","Zgorzelec","Ziębice","Złocieniec","Złoczew","Złotoryja",
        "Złotów","Zwoleń","Żabno","Żagań","Żarki","Żary","Żelechów","Żerków","Żnin","Żory","Żukowo","Żuromin","Żyrardów",
        "Żywiec"
    ],
    "UK": [
        "London","Birmingham","Glasgow","Liverpool","Bristol","Sheffield","Edinburgh","Leeds","Cardiff","Manchester",
        "Stoke-on-Trent","Coventry","Sunderland","Birkenhead","Islington","Reading","Kingston upon Hull","Preston",
        "Newport","Swansea","Bradford","Southend-on-Sea","Derby","Plymouth","Luton","Wolverhampton","City of Westminster",
        "Southampton","Northampton","Portsmouth","Wigan","Leicester","Nottingham","Newcastle upon Tyne","Norwich",
        "Middlesbrough","Bournemouth","York","Blackpool","Belfast","Cambridge","Dundee","Ipswich","Warrington",
        "Peterborough","Slough","Huddersfield","Oxford","Dudley","Poole","Telford","Gloucester","Stockport",
        "Brighton","Bolton","Aberdeen","Oldham","Cheltenham","Eastbourne","Rochdale","Colchester","Crawley",
        "Exeter","Hastings","Harrogate","High Wycombe","Horsham","Keighley","Lancaster","Lincoln","Luton","Maidstone",
        "Mansfield","Milton Keynes","Morden","Newbury","Paisley","Perth","Rochester","Royal Leamington Spa","Salford",
        "Salisbury","Scunthorpe","Solihull","Southport","St Albans","St Helens","Stevenage","Sutton Coldfield",
        "Swindon","Taunton","Tonbridge","Truro","Wakefield","Watford","Wellingborough","Weston-super-Mare","Wimbledon",
        "Winchester","Woking","Worcester","Worthing","Yeovil","York"
    ],
    "USA": [
        "New York","Los Angeles","Chicago","Houston","Phoenix","Philadelphia","San Antonio","San Diego","Dallas",
        "San Jose","Austin","Jacksonville","Fort Worth","Columbus","Charlotte","San Francisco","Indianapolis",
        "Seattle","Denver","Washington","Boston","El Paso","Nashville","Detroit","Oklahoma City","Portland",
        "Las Vegas","Memphis","Louisville","Milwaukee","Baltimore","Albuquerque","Tucson","Mesa","Sacramento",
        "Atlanta","Kansas City","Colorado Springs","Miami","Raleigh","Omaha","Long Beach","Virginia Beach",
        "Oakland","Minneapolis","Tulsa","Arlington","Tampa","New Orleans","Wichita","Cleveland","Bakersfield",
        "Aurora","Anaheim","Honolulu","Santa Ana","Riverside","Corpus Christi","Lexington","Henderson","Stockton",
        "Saint Paul","St. Louis","Cincinnati","St. Petersburg","Pittsburgh","Greensboro","Anchorage","Plano",
        "Lincoln","Orlando","Irvine","Newark","Durham","Chula Vista","Toledo","Fort Wayne","Jersey City",
        "Chandler","Madison","Lubbock","Scottsdale","Reno","Buffalo","Gilbert","Glendale","North Las Vegas",
        "Winston-Salem","Chesapeake","Norfolk","Fremont","Garland","Irving","Hialeah","Richmond","Boise",
        "Spokane","Baton Rouge","Des Moines","Modesto","Fayetteville","Moreno Valley","Montgomery","Huntington Beach",
        "Glendale","Aurora","Mobile","San Bernardino","Birmingham","Roanoke","Little Rock","Amarillo","Augusta",
        "Huntsville","Grand Rapids","Salt Lake City","Tallahassee","Knoxville","Worcester","Providence","Newport News",
        "Overland Park","Santa Clarita","Santa Rosa","Sioux Falls","Springfield","Fort Lauderdale","Pembroke Pines",
        "Elk Grove","Oceanside","Garden Grove","Rancho Cucamonga","Ontario","Chattanooga","Vancouver","Jackson",
        "Cape Coral","Eugene","McKinney","Alexandria","Peoria","Lakewood","Hollywood","Salem","Palmdale","Springfield",
        "Lancaster","Eugene","Corona","Salinas","Springfield","Pomona","Hayward","Escondido","Torrance","Sunnyvale",
        "Paterson","Naperville","Joliet","Rockford","Savannah","Mesquite","Bridgeport","Sunnyvale","McAllen","Olive Branch",
        "Clarksville","Frisco","Killeen","Pasadena","Orange","Fullerton","Kansas City","Miramar","Hampton","Warren",
        "West Valley City","Columbia","Olathe","Sterling Heights","New Haven","Midland","Thousand Oaks","Visalia",
        "Waco","Topeka","Cedar Rapids","Charleston","Gainesville","Independence","Lafayette","Carrollton","Bellevue",
        "Round Rock","Billings","Abilene","Ann Arbor","Denton","Beaumont","Odessa","Wichita Falls","San Angelo","Tyler"
    ],
}

# Fallback gdy Overpass pada — top miasta per kraj (żeby dropdown nie był pusty)
POPULAR_FALLBACK: Dict[str, List[str]] = {
    "Polska": ["Warszawa","Kraków","Łódź","Wrocław","Poznań","Gdańsk","Szczecin","Bydgoszcz","Lublin","Białystok","Katowice","Gdynia","Częstochowa","Radom","Sosnowiec","Toruń","Kielce","Rzeszów","Gliwice","Zabrze","Olsztyn","Bielsko-Biała","Bytom","Zielona Góra","Rybnik","Ruda Śląska","Opole","Tychy","Gorzów Wielkopolski","Dąbrowa Górnicza","Płock","Elbląg","Wałbrzych","Włocławek","Tarnów","Chorzów","Koszalin","Kalisz","Legnica","Grudziądz","Jaworzno","Słupsk","Jastrzębie-Zdrój","Nowy Sącz","Jelenia Góra","Siedlce","Mysłowice","Piła","Ostrów Wielkopolski","Konin","Piotrków Trybunalski","Lubliniec","Suwałki","Gorzów","Zamość","Leszno","Przemyśl","Stalowa Wola","Kędzierzyn-Koźle","Łomża","Żory","Ełk","Tarnobrzeg","Mielec","Bełchatów","Świdnica","Pruszków","Legionowo","Chełm","Ostrowiec Świętokrzyski","Zawiercie","Starachowice","Wejherowo","Puławy","Starogard Gdański","Skierniewice","Tomaszów Mazowiecki","Krosno","Rumia","Pabianice","Otwock","Marki","Żyrardów","Kutno","Nysa","Kołobrzeg","Kwidzyn","Sopot","Siemianowice Śląskie","Inowrocław","Oświęcim","Tczew","Gniezno","Piekary Śląskie","Olsztyn","Zduńska Wola","Sieradz","Mikołów","Bełchatów"],
    "UK": ["London","Birmingham","Glasgow","Liverpool","Bristol","Sheffield","Edinburgh","Leeds","Cardiff","Manchester","Stoke-on-Trent","Coventry","Sunderland","Birkenhead","Islington","Reading","Kingston upon Hull","Preston","Newport","Swansea","Bradford","Southend-on-Sea","Derby","Plymouth","Luton","Wolverhampton","City of Westminster","Southampton","Northampton","Portsmouth","Wigan","Leicester","Nottingham","Newcastle upon Tyne","Norwich","Middlesbrough","Bournemouth","York","Blackpool","Belfast","Cambridge","Dundee","Ipswich","Warrington","Peterborough","Slough","Huddersfield","Oxford","Dudley","Poole","Telford","York","Gloucester","Stockport","Brighton","Bolton","Aberdeen","Oldham"],
    "USA": ["New York","Los Angeles","Chicago","Houston","Phoenix","Philadelphia","San Antonio","San Diego","Dallas","San Jose","Austin","Jacksonville","Fort Worth","Columbus","Charlotte","San Francisco","Indianapolis","Seattle","Denver","Washington","Boston","El Paso","Nashville","Detroit","Oklahoma City","Portland","Las Vegas","Memphis","Louisville","Milwaukee","Baltimore","Albuquerque","Tucson","Mesa","Sacramento","Atlanta","Kansas City","Colorado Springs","Miami","Raleigh","Omaha","Long Beach","Virginia Beach","Oakland","Minneapolis","Tulsa","Arlington","Tampa","New Orleans","Wichita","Cleveland","Bakersfield","Aurora","Anaheim","Honolulu","Santa Ana","Riverside","Corpus Christi","Lexington","Henderson","Stockton","Saint Paul","St. Louis","Cincinnati","St. Petersburg","Pittsburgh","Greensboro","Anchorage","Plano","Lincoln","Orlando","Irvine","Newark","Durham","Chula Vista","Toledo","Fort Wayne","St. Petersburg","Laredo","Jersey City","Chandler","Madison","Lubbock","Scottsdale","Reno","Buffalo","Gilbert","Glendale","North Las Vegas","Winston-Salem","Chesapeake","Norfolk","Fremont","Garland","Irving","Hialeah","Richmond","Boise","Spokane","Baton Rouge"],
}

def _popular_fallback(country: str) -> List[dict]:
    names = POPULAR_FALLBACK.get(country, [])
    out = []
    for n in names:
        out.append({
            "display_name": f"{n}, {country}",
            "name": n,
            "lat": "",
            "lon": "",
            "osm_id": 0,
            "osm_type": "node",
            "place_type": "miasto",
            "country_code": COUNTRY_CODES.get(country, ""),
            "importance": 0,
        })
    return out

def _cache_path(country: str) -> Path:
    # Na Vercel tylko /tmp jest zapisywalny
    base = Path("/tmp") if os.getenv("VERCEL") else Path(__file__).resolve().parent.parent / ".cache"
    base.mkdir(parents=True, exist_ok=True)
    safe = re.sub(r"[^a-zA-Z0-9_-]", "_", country)
    return base / f"all_cities_{safe}_v{ALL_CITIES_VERSION}.json"

def _load_disk_cache(country: str):
    p = _cache_path(country)
    if not p.exists():
        return None
    try:
        age = time.time() - p.stat().st_mtime
        if age > ALL_CITIES_TTL:
            return None
        data = json.loads(p.read_text(encoding="utf-8"))
        if isinstance(data, list) and data:
            return data
    except Exception:
        pass
    return None

def _save_disk_cache(country: str, results: List[dict]):
    try:
        p = _cache_path(country)
        p.write_text(json.dumps(results, ensure_ascii=False), encoding="utf-8")
    except Exception:
        pass

def _overpass(query: str, timeout: int = 180, rounds: int = 2):
    """Zwróć elements albo None. Krąży po endpointach; 5xx/timeout ponawia."""
    last_err = ""
    for rnd in range(rounds):
        for base in OVERPASS_ENDPOINTS:
            try:
                r = requests.post(
                    f"{base}/api/interpreter",
                    data={"data": query},
                    headers={**UA, "Content-Type": "application/x-www-form-urlencoded"},
                    timeout=timeout,
                )
                if r.status_code >= 500:
                    last_err = f"{base}: HTTP {r.status_code}"
                    time.sleep(1 + rnd * 2)
                    continue
                r.raise_for_status()
                return r.json().get("elements", [])
            except Exception as e:
                last_err = str(e)[:150]
                continue
    print(f"[SiteMorph][Overpass] fail: {last_err}", flush=True)
    return None

def _parse_place_elements(elements, country: str) -> List[dict]:
    out: List[dict] = []
    seen_local = set()
    for el in elements or []:
        t = el.get("tags") or {}
        name = t.get("name")
        if not name:
            continue
        place_kind = t.get("place") or "town"
        key = _fold(name)
        if not key or key in seen_local:
            continue
        seen_local.add(key)
        lat = el.get("lat")
        lon = el.get("lon")
        if lat is None and el.get("center"):
            lat = el["center"].get("lat")
            lon = el["center"].get("lon")
        label = {"city": "miasto", "town": "miasteczko", "village": "wieś", "hamlet": "przysiółek"}.get(place_kind, "miejscowość")
        try:
            pop = float(re.sub(r"[^\d.]", "", t.get("population") or "") or 0)
        except ValueError:
            pop = 0.0
        out.append({
            "display_name": f"{name}, {country}",
            "name": name,
            "lat": str(lat) if lat is not None else "",
            "lon": str(lon) if lon is not None else "",
            "osm_id": el.get("id"),
            "osm_type": el.get("type", "node"),
            "place_type": label,
            "country_code": COUNTRY_CODES.get(country, ""),
            "importance": pop,
        })
    return out

def _warm_cache():
    """W tle dogrzewa listy miast — pętla co 5 min dopóki wszystkie kraje
    nie będą miały cache na dysku (Overpass bywa awaryjny, więc próbujemy dalej)."""
    time.sleep(4)
    while True:
        for c in ("Polska", "UK", "USA"):
            try:
                if _load_disk_cache(c) is not None:
                    continue  # już mamy świeży cache
                print(f"[SiteMorph][warm] pobieram {c}...", flush=True)
                all_cities(c)
            except Exception as e:
                print(f"[SiteMorph][warm] {c}: {e}", flush=True)
        # czy wszystko gotowe?
        if all(_load_disk_cache(c) is not None for c in ("Polska", "UK", "USA")):
            print("[SiteMorph][warm] wszystkie kraje gotowe", flush=True)
            return
        time.sleep(300)


def _fetch_and_cache(country: str):
    """Pobiera pełną listę miejscowości kraju z Overpass i zapisuje cache
    (pamięć + dysk). Wywoływana w wątku tła, gdy brak cache przy zapytaniu.
    Dzieli zapytanie na typy miejscowości, by uniknąć timeoutów na dużych krajach."""
    area_id = COUNTRY_AREA.get(country)
    if not area_id:
        _fetching.discard(country)
        return
    all_results: List[dict] = []
    place_types = ["city", "town", "village", "hamlet"]
    for ptype in place_types:
        try:
            query = (
                f"[out:json][timeout:180];"
                f"area({area_id})->.searchArea;"
                "("
                f'nwr["place"="{ptype}"](area.searchArea);'
                ");"
                "out center tags;"
            )
            elements = _overpass(query)
            if elements is None:
                print(f"[SiteMorph][cities] {country}: {ptype} - Overpass niedostępny", flush=True)
                continue
            parsed = _parse_place_elements(elements, country)
            all_results.extend(parsed)
            print(f"[SiteMorph][cities] {country}: {ptype} -> {len(parsed)}", flush=True)
        except Exception as e:
            print(f"[SiteMorph][cities] {country}: {ptype} błąd: {e}", flush=True)
            continue
    if not all_results:
        print(f"[SiteMorph][cities] {country}: brak wyników z Overpass", flush=True)
        _fetching.discard(country)
        return
    # deduplikacja po nazwie
    seen = set()
    deduped = []
    for r in all_results:
        key = _fold(r["name"])
        if key not in seen:
            seen.add(key)
            deduped.append(r)
    min_pop = COUNTRY_VILLAGE_MIN_POP.get(country)
    if min_pop:
        deduped = [
            r for r in deduped
            if r.get("place_type") not in ("wieś", "przysiółek")
            or float(r.get("importance") or 0) >= min_pop
        ]
    deduped.sort(key=lambda x: float(x.get("importance") or 0), reverse=True)
    _save_disk_cache(country, deduped)
    _all_cities_cache[f"{country}|v{ALL_CITIES_VERSION}"] = (time.time(), deduped)
    print(f"[SiteMorph][cities] {country}: zapisałem {len(deduped)} unikalnych miejscowości", flush=True)
    _fetching.discard(country)


import threading as _threading
_threading.Thread(target=_warm_cache, daemon=True).start()

GOOGLE_KEY = os.getenv("GOOGLE_PLACES_API_KEY") or os.getenv("GOOGLE_API_KEY")

def google_places_autocomplete(query: str, country: str) -> List[dict]:
    """Autocomplete miasta z Google Places API"""
    if not GOOGLE_KEY or len(query) < 2:
        return []
    try:
        country_code = COUNTRY_CODES.get(country, "")
        r = requests.post(
            "https://places.googleapis.com/v1/places:autocomplete",
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": GOOGLE_KEY,
                "X-Goog-FieldMask": "suggestions.placePrediction.text,suggestions.placePrediction.placeId,suggestions.placePrediction.types"
            },
            json={
                "input": query,
                "includedRegionCodes": [country_code] if country_code else [],
                "includedPrimaryTypes": ["locality", "sublocality", "administrative_area_level_2", "administrative_area_level_3"],
                "languageCode": LANGS.get(country, "pl"),
            },
            timeout=8
        )
        if r.status_code != 200:
            return []
        data = r.json()
        results = []
        for s in data.get("suggestions", []):
            pred = s.get("placePrediction", {})
            text = pred.get("text", {}).get("text", "")
            place_id = pred.get("placeId", "")
            types = pred.get("types", [])
            if text:
                results.append({
                    "display_name": text,
                    "name": text.split(",")[0].strip(),
                    "lat": "",
                    "lon": "",
                    "osm_id": 0,
                    "osm_type": "google",
                    "place_type": "miasto",
                    "type": "locality",
                    "country_code": COUNTRY_CODES.get(country, ""),
                    "importance": 0,
                    "google_place_id": place_id,
                })
        return results[:15]
    except Exception as e:
        print(f"[Google Places Autocomplete] Error: {e}")
        return []


@router.get("/autocomplete")
def autocomplete(q: str = Query(..., min_length=1), country: str = Query("Polska")):
    q = q.strip()
    if len(q) < 2:
        return {"results": []}
    # Try Google Places first
    gp_results = google_places_autocomplete(q, country)
    # Fallback to existing Nominatim/Open-Meteo
    errors = {}
    with ThreadPoolExecutor(max_workers=2) as ex:
        f_om = ex.submit(_autocomplete_open_meteo, q, country)
        f_nom = ex.submit(_autocomplete_nominatim, q, country) if len(q) >= 3 else None
        try:
            om_results = f_om.result()
        except Exception as e:
            om_results = []
            errors["open-meteo"] = str(e)
        try:
            nom_results = f_nom.result() if f_nom else []
        except Exception as e:
            nom_results = []
            errors["nominatim"] = str(e)
    merged = []
    seen = set()
    for item in gp_results + om_results + nom_results:
        key = _fold(item.get("name"))
        if not key or key in seen:
            continue
        seen.add(key)
        merged.append(item)
        if len(merged) >= 15:
            break
    if not merged and errors:
        return {"results": [], "error": "; ".join(f"{k}: {v}" for k, v in errors.items())}
    return {"results": merged}


@router.get("/all-cities")
def all_cities(country: str = Query("Polska")):
    now = time.time()
    cache_key = f"{country}|v{ALL_CITIES_VERSION}"
    cached = _all_cities_cache.get(cache_key)
    if cached and now - cached[0] < ALL_CITIES_TTL:
        return {"results": cached[1], "cached": True}
    # PRIORYTET: statyczne dane GeoNames wbudowane w repo — instant, tysiące miast, zero timeoutu
    static_file = {
        "Polska": "pl", "UK": "gb", "USA": "us",
    }.get(country)
    if static_file:
        try:
            data_path = Path(__file__).resolve().parent.parent / "data" / f"cities_{static_file}.json"
            if not data_path.exists():
                data_path = Path("/var/task/app/data") / f"cities_{static_file}.json"
            if data_path.exists():
                cities = json.loads(data_path.read_text(encoding="utf-8"))
                if isinstance(cities, list) and cities:
                    _all_cities_cache[cache_key] = (now, cities)
                    return {"results": cities, "cached": True, "static": True, "count": len(cities)}
        except Exception as e:
            print(f"[geocode] static load error {country}: {e}", flush=True)
    disk = _load_disk_cache(country)
    if disk is not None:
        _all_cities_cache[cache_key] = (now, disk)
        return {"results": disk, "cached": True, "disk": True}
    # Brak cache — zwróć natychmiast fallback i dogrzej w tle
    fb = _popular_fallback(country)
    if country not in _fetching:
        _fetching.add(country)
        import threading as _t
        _t.Thread(target=_fetch_and_cache, args=(country,), daemon=True).start()
    if fb:
        _all_cities_cache[cache_key] = (now, fb)
        return {"results": fb, "cached": False, "fallback": True, "note": "Pełna lista w przygotowaniu w tle — pokazujemy popularne miasta"}
    area_id = COUNTRY_AREA.get(country)
    if not area_id:
        return {"results": [], "error": f"Nieznany kraj: {country}"}
    return {"results": fb or [], "error": "Przygotowujemy listę — spróbuj za chwilę"}

