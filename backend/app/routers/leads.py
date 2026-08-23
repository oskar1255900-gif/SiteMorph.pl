from fastapi import APIRouter, Depends, Request, Header, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Tuple
import requests
import hashlib
import os
import time
import re
from collections import defaultdict
from abc import ABC, abstractmethod
from ..database import get_db
from ..models import Lead
from ..auth import get_current_user

# Rate limiter in memory: 10/mies for Starter/Free, 30/mies for Business/Pro/Agencja
_search_counts: dict[str, int] = defaultdict(int)
_search_month: dict[str, str] = {}

def check_rate_limit(plan: str, user_id: str = "anon"):
    month = time.strftime("%Y-%m")
    key = f"{user_id}:{month}"
    if _search_month.get(user_id) != month:
        _search_counts[user_id] = 0
        _search_month[user_id] = month
    limit = 30 if (plan or "Starter").lower() in ("business", "agencja", "pro", "premium") else 10
    if _search_counts[user_id] >= limit:
        raise HTTPException(status_code=429, detail=f"Limit wyszukiwaĹ„ wyczerpany ({limit}/miesiÄ…c dla planu {plan or 'Starter'}). Ulepsz plan.")
    _search_counts[user_id] += 1
    return limit - _search_counts[user_id]

router = APIRouter(prefix="/api/leads", tags=["Leads"])

UA = {"User-Agent": "SiteMorph/1.0 (lead finder; contact@sitemorph.pl)"}
GOOGLE_KEY = os.getenv("GOOGLE_PLACES_API_KEY") or os.getenv("GOOGLE_API_KEY")

COUNTRIES = {
    "Polska": {"geo": "Poland", "prefix": "+48", "budget": "2 500 - 3 500 zl"},
    "UK": {"geo": "United Kingdom", "prefix": "+44", "budget": "ÂŁ650 - ÂŁ900"},
    "USA": {"geo": "United States", "prefix": "+1", "budget": "$850 - $1 200"},
}

# In-memory cache: key -> (timestamp, results)
_cache: Dict[str, Tuple[float, Any]] = {}
CACHE_TTL = 300  # 5 min

# Mapowanie branzy -> tagi OSM â€” 40 branĹĽ angielskich + stare PL dla kompatybilnoĹ›ci
INDUSTRY_OSM: Dict[str, List[str]] = {
    # --- Nowa lista 40 angielskich (spec) ---
    "Real Estate": ["[office=estate_agent]"],
    "Barber": ["[shop=hairdresser]", "[shop=barber]"],
    "Hair Salon": ["[shop=hairdresser]"],
    "Beauty Salon": ["[shop=beauty]"],
    "Nail Salon": ["[shop=beauty]", "[shop=nail]"],
    "Spa": ["[shop=beauty]", "[leisure=spa]", "[shop=massage]"],
    "Dentist": ["[amenity=dentist]"],
    "Medical Clinic": ["[amenity=clinic]", "[amenity=doctors]"],
    "Physiotherapist": ["[amenity=clinic]", "[healthcare=physiotherapist]"],
    "Veterinarian": ["[amenity=veterinary]"],
    "Veterinary": ["[amenity=veterinary]"],
    "Restaurant": ["[amenity=restaurant]"],
    "Cafe": ["[amenity=cafe]"],
    "Bakery": ["[shop=bakery]", "[shop=pastry]"],
    "Pizzeria": ["[amenity=restaurant]", "[amenity=fast_food]", "[shop=pizza]"],
    "Fast Food": ["[amenity=fast_food]"],
    "Catering": ["[shop=catering]", "[craft=caterer]", "[amenity=canteen]"],
    "Hotel": ["[tourism=hotel]", "[tourism=guest_house]", "[tourism=hostel]"],
    "Gym": ["[leisure=fitness_centre]"],
    "Yoga Studio": ["[leisure=fitness_centre]", "[sport=yoga]"],
    "Personal Trainer": ["[leisure=fitness_centre]", "[leisure=sports_centre]"],
    "Law Firm": ["[office=lawyer]"],
    "Accounting": ["[office=accountant]"],
    "Insurance": ["[office=insurance]"],
    "Auto Repair": ["[shop=car_repair]", "[shop=car]"],
    "Car Dealership": ["[shop=car]"],
    "Car Wash": ["[amenity=car_wash]"],
    "Photographer": ["[shop=photo]", "[craft=photographer]"],
    "Wedding Services": ["[shop=wedding]", "[office=wedding_planner]"],
    "Cleaning Service": ["[shop=dry_cleaning]", "[shop=laundry]", "[craft=cleaner]"],
    "Landscaping": ["[shop=garden_centre]", "[craft=gardener]"],
    "Construction": ["[craft=builder]", "[office=construction_company]"],
    "Plumber": ["[craft=plumber]"],
    "Electrician": ["[craft=electrician]"],
    "Roofing": ["[craft=roofer]"],
    "Painting": ["[craft=painter]"],
    "Moving Company": ["[office=moving_company]", "[shop=storage_rental]"],
    "Marketing Agency": ["[office=advertising_agency]", "[office=marketing]"],
    "IT Services": ["[office=it]", "[office=company][it=yes]"],
    "Computer Repair": ["[shop=computer]", "[craft=electronics_repair]"],
    "Local Retail Store": ["[shop=convenience]", "[shop=general]", "[shop=supermarket]"],
    "Clothing Store": ["[shop=clothes]", "[shop=boutique]"],
    "Furniture Store": ["[shop=furniture]"],
    "Florist": ["[shop=florist]"],
    "Pet Store": ["[shop=pet]"],
    "Pet Grooming": ["[shop=pet_grooming]", "[shop=pet]"],
    "Tutoring": ["[amenity=school]", "[amenity=language_school]"],
    "Music School": ["[amenity=music_school]"],
    "Driving School": ["[amenity=driving_school]"],
    # Alias IT / Software -> IT Services
    "IT / Software": ["[office=it]", "[office=company]"],
    # --- Stare PL + kompatybilnoĹ›Ä‡ ---
    "Restauracje": ["[amenity=restaurant]"],
    "Kawiarnie": ["[amenity=cafe]"],
    "Bary i puby": ["[amenity=bar]", "[amenity=pub]"],
    "Piekarnie i cukiernie": ["[shop=bakery]", "[shop=pastry]"],
    "Sklepy spozywcze": ["[shop=convenience]"],
    "Supermarkety": ["[shop=supermarket]"],
    "Warzywniaki": ["[shop=greengrocer]"],
    "Salony fryzjerskie": ["[shop=hairdresser]"],
    "Salony kosmetyczne": ["[shop=beauty]", "[shop=cosmetics]"],
    "Studio tatuaĹĽu i piercingu": ["[shop=tattoo]", "[shop=piercing]"],
    "Solaria i SPA": ["[shop=solarium]", "[leisure=spa]"],
    "Silownie i fitness": ["[leisure=fitness_centre]", "[leisure=sports_centre]"],
    "Fitness / Yoga": ["[leisure=fitness_centre]"],
    "Gabinet stomatologiczny": ["[amenity=dentist]"],
    "Lekarze i przychodnie": ["[amenity=doctors]", "[amenity=clinic]"],
    "Apteki": ["[amenity=pharmacy]"],
    "Weterynarze": ["[amenity=veterinary]"],
    "Warsztaty samochodowe": ["[shop=car_repair]"],
    "Wulkanizacja i opony": ["[shop=tyres]"],
    "Stacje paliw": ["[amenity=fuel]"],
    "Pranie tapicerki i czyszczenie": ["[shop=dry_cleaning]", "[shop=laundry]"],
    "Kwiaciarnie": ["[shop=florist]"],
    "Biura nieruchomosci": ["[office=estate_agent]"],
    "Biura nieruchomoĹ›ci": ["[office=estate_agent]"],
    "Kancelarie prawne": ["[office=lawyer]"],
    "Biura rachunkowe": ["[office=accountant]"],
    "Ubezpieczenia": ["[office=insurance]"],
    "Firmy budowlane": ["[craft=builder]", "[office=construction_company]"],
    "Elektrycy": ["[craft=electrician]"],
    "Hydraulicy": ["[craft=plumber]"],
    "Stolarze i stolarnie": ["[craft=carpenter]", "[shop=do-it-yourself]"],
    "Fotografowie": ["[shop=photo]", "[craft=photographer]"],
    "Szkoly jezykowe": ["[amenity=school]", "[amenity=language_school]"],
    "SzkoĹ‚y jÄ™zykowe": ["[amenity=school]", "[amenity=language_school]"],
    "Hotele i noclegi": ["[tourism=hotel]", "[tourism=guest_house]", "[tourism=hostel]"],
    "Agroturystyka": ["[tourism=guest_house]"],
    "Sklepy zoologiczne": ["[shop=pet]", "[shop=pet_grooming]"],
    "Optycy": ["[shop=optician]"],
    "Jubilerzy i zegarmistrzowie": ["[shop=jewelry]", "[shop=watches]"],
    "Odziez i butiki": ["[shop=clothes]", "[shop=boutique]"],
    "OdzieĹĽ i butiki": ["[shop=clothes]", "[shop=boutique]"],
    "Obuwie": ["[shop=shoes]"],
    "Ksiegarnie i papiernicze": ["[shop=books]", "[shop=stationery]"],
    "KsiÄ™garnie i papiernicze": ["[shop=books]", "[shop=stationery]"],
    "Zabawki": ["[shop=toys]"],
    "Serwisy rowerowe": ["[shop=bicycle]", "[shop=bicycle_repair]"],
    "Taksowki i transport": ["[amenity=taxi]"],
    "TaksĂłwki i transport": ["[amenity=taxi]"],
    "Kregielnia i rozrywka": ["[leisure=bowling_alley]", "[leisure=escape_game]"],
    "KrÄ™gielnia i rozrywka": ["[leisure=bowling_alley]", "[leisure=escape_game]"],
    "Local Store": ["[shop=convenience]"],
    # --- Aliasy pojedynczej liczby / warianty z frontendu (LeadFinderView) ---
    "Fast food": ["[amenity=fast_food]"],
    "Salony piÄ™knoĹ›ci": ["[shop=beauty]"],
    "Manicure": ["[shop=nail]"],
    "Stomatolog": ["[amenity=dentist]"],
    "Przychodnia lekarska": ["[amenity=doctors]", "[amenity=clinic]"],
    "Fizjoterapeuta": ["[healthcare=physiotherapist]", "[amenity=clinic]"],
    "Weterynarz": ["[amenity=veterinary]"],
    "Restauracja": ["[amenity=restaurant]"],
    "Kawiarnia": ["[amenity=cafe]"],
    "Piekarnia": ["[shop=bakery]"],
    "Bar szybkiej obsĹ‚ugi": ["[amenity=fast_food]"],
    "SiĹ‚ownia": ["[leisure=fitness_centre]"],
    "Studio jogi": ["[sport=yoga]", "[leisure=fitness_centre]"],
    "Trener personalny": ["[leisure=fitness_centre]", "[leisure=sports_centre]"],
    "NieruchomoĹ›ci": ["[office=estate_agent]"],
    "Kancelaria prawna": ["[office=lawyer]"],
    "KsiÄ™gowoĹ›Ä‡": ["[office=accountant]"],
    "Warsztat samochodowy": ["[shop=car_repair]"],
    "Salon samochodowy": ["[shop=car]"],
    "Myjnia samochodowa": ["[amenity=car_wash]"],
    "Fotograf": ["[shop=photo]", "[craft=photographer]"],
    "UsĹ‚ugi Ĺ›lubne": ["[shop=wedding]", "[office=wedding_planner]"],
    "SprzÄ…tanie": ["[craft=cleaner]", "[shop=dry_cleaning]"],
    "Budownictwo": ["[craft=builder]", "[office=construction_company]"],
    "Hydraulik": ["[craft=plumber]"],
    "Elektryk": ["[craft=electrician]"],
    "Dekarz": ["[craft=roofer]"],
    "Malarz": ["[craft=painter]"],
    "Przeprowadzki": ["[office=moving_company]", "[shop=storage_rental]"],
    "Agencja marketingowa": ["[office=advertising_agency]", "[office=marketing]"],
    "UsĹ‚ugi IT": ["[office=it]", "[office=company]"],
    "Serwis komputerowy": ["[shop=computer]", "[craft=electronics_repair]"],
    "Sklep osiedlowy": ["[shop=convenience]"],
    "Sklep odzieĹĽowy": ["[shop=clothes]", "[shop=boutique]"],
    "Sklep meblowy": ["[shop=furniture]"],
    "Kwiaciarnia": ["[shop=florist]"],
    "Fryzjer mÄ™ski": ["[shop=barber]", "[shop=hairdresser]"],
    "Korepetycje": ["[amenity=school]", "[amenity=language_school]"],
    "SzkoĹ‚a muzyczna": ["[amenity=music_school]"],
    "Nauka jazdy": ["[amenity=driving_school]"],
}

class OsmSearchInput(BaseModel):
    country: str = "Polska"
    city: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    osmId: Optional[str] = None
    osmType: Optional[str] = None
    industry: str
    onlyWithoutWebsite: bool = True
    limit: int = 60

# BusinessDataProvider abstraction
class BusinessDataProvider(ABC):
    @abstractmethod
    def searchBusinesses(self, bbox: Tuple[float,float,float,float], industry: str) -> List[dict]:
        pass

# Non-business tags to filter out
NON_BUSINESS_EXCLUDE = {
    "leisure": {"park", "garden", "playground", "nature_reserve", "common", "pitch", "track", "stadium", "recreation_ground", "dog_park", "golf_course", "water_park", "beach_resort", "bird_hide", "fishing", "swimming_pool", "swimming_area"},
    "tourism": {"attraction", "viewpoint", "artwork", "museum", "gallery", "theme_park", "zoo", "aquarium", "information", "camp_site", "caravan_site", "picnic_site"},
    "amenity": {"bench", "fountain", "waste_basket", "parking", "bicycle_parking", "toilets", "drinking_water", "shelter", "post_box", "telephone", "atm", "bank", "place_of_worship", "school", "kindergarten", "university", "college", "library", "community_centre", "social_facility", "grave_yard", "crematorium"},
    "historic": {"memorial", "monument", "castle", "ruins", "archaeological_site", "wayside_cross", "wayside_shrine"},
    "natural": {"wood", "forest", "scrub", "heath", "grassland", "wetland", "water", "bay", "beach", "coastline", "cliff", "peak", "volcano", "hill"},
    "landuse": {"forest", "meadow", "grass", "farmland", "farmyard", "orchard", "vineyard", "reservoir", "basin", "cemetery"},
    "shop": set(),  # shop is generally business, but we filter parks etc via other keys
}

BUSINESS_KEYS = {"shop", "craft", "office", "amenity", "healthcare", "tourism", "leisure"}

ALLOWED_LEISURE = {"fitness_centre", "sports_centre", "spa", "fitness_station"}
ALLOWED_TOURISM = {"hotel", "guest_house", "hostel", "motel", "apartment"}
ALLOWED_AMENITY = {"restaurant", "cafe", "bar", "pub", "fast_food", "food_court", "ice_cream", "dentist", "doctors", "clinic", "veterinary", "pharmacy", "car_wash", "fuel", "driving_school", "music_school", "language_school", "school", "college", "university"}

def is_business_element(tags: dict) -> bool:
    if not tags:
        return False
    # Exclude obvious non-businesses
    for k, v in tags.items():
        if k in NON_BUSINESS_EXCLUDE and v in NON_BUSINESS_EXCLUDE[k]:
            return False
        # leisure park/garden etc already handled, but also check natural/landuse
        if k == "leisure" and v not in ALLOWED_LEISURE:
            # allow only fitness/spa etc, otherwise considered non-business leisure
            # need to check if other business keys also present
            pass
        if k == "tourism" and v not in ALLOWED_TOURISM:
            pass
        if k == "natural" or k == "landuse":
            return False
        if k == "historic":
            return False
    # Must have at least one business-relevant key
    has_business_key = any(k in tags for k in BUSINESS_KEYS)
    if not has_business_key:
        return False
    # If shop/craft/office present, it's business
    if any(k in tags for k in ("shop", "craft", "office", "healthcare")):
        return True
    # For amenity: only allowed amenity types
    if "amenity" in tags:
        if tags["amenity"] in ALLOWED_AMENITY:
            return True
        else:
            # Check if also has other business tag
            if any(k in tags for k in ("shop", "craft", "office")):
                return True
            return False
    if "leisure" in tags:
        if tags["leisure"] in ALLOWED_LEISURE:
            return True
        return False
    if "tourism" in tags:
        if tags["tourism"] in ALLOWED_TOURISM:
            return True
        return False
    return False

def geocode(city: str, country_geo: str):
    try:
        r = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": f"{city}, {country_geo}", "format": "json", "limit": 1},
            headers=UA,
            timeout=20,
        )
        r.raise_for_status()
        data = r.json()
        if not data:
            return None
        bb = data[0].get("boundingbox")
        if not bb or len(bb) != 4:
            return None
        south, north, west, east = float(bb[0]), float(bb[1]), float(bb[2]), float(bb[3])
        dlat = max((north - south) * 0.15, 0.01)
        dlon = max((east - west) * 0.15, 0.01)
        return (south - dlat, west - dlon, north + dlat, east + dlon)
    except Exception:
        return None

def get_bbox_from_osm(osm_id: str, osm_type: str):
    try:
        # osm_type: node/way/relation, Nominatim expects N/W/R prefix
        prefix = {"node": "N", "way": "W", "relation": "R"}.get(osm_type.lower(), osm_type[0].upper())
        osm_ids = f"{prefix}{osm_id}"
        r = requests.get(
            "https://nominatim.openstreetmap.org/lookup",
            params={"osm_ids": osm_ids, "format": "json", "addressdetails": 1},
            headers=UA,
            timeout=15,
        )
        r.raise_for_status()
        data = r.json()
        if not data:
            return None
        bb = data[0].get("boundingbox")
        if not bb or len(bb) != 4:
            # fallback use lat/lon with small bbox
            lat = data[0].get("lat")
            lon = data[0].get("lon")
            if lat and lon:
                lat_f = float(lat); lon_f = float(lon)
                return (lat_f-0.05, lon_f-0.05, lat_f+0.05, lon_f+0.05)
            return None
        south, north, west, east = float(bb[0]), float(bb[1]), float(bb[2]), float(bb[3])
        dlat = max((north - south) * 0.12, 0.008)
        dlon = max((east - west) * 0.12, 0.008)
        return (south - dlat, west - dlon, north + dlat, east + dlon)
    except Exception:
        return None

def overpass_query(bbox, filters: List[str]):
    parts = "\n".join(f"  nwr{f}({bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]});" for f in filters)
    q = f"[out:json][timeout:90];\n(\n{parts}\n);\nout center {200};"
    r = requests.post(
        "https://overpass-api.de/api/interpreter",
        data={"data": q},
        headers={**UA, "Content-Type": "application/x-www-form-urlencoded"},
        timeout=120,
    )
    r.raise_for_status()
    return r.json().get("elements", [])

# ---------------------------------------------------------------------------
# Wielkie sieci i marki â€” bez sensu jako leady (maja strony i dzial marketingu).
# Filtr po nazwie/marce/operatorze + sygnal OSM "brand:wikidata" (tag sieciowki).
# ---------------------------------------------------------------------------
BIG_BRANDS = [
    # stacje paliw / motoryzacja - marki
    "orlen", "lotos", "shell", "bp", "circle k", "statoil", "moya", "amic", "sprint",
    "opel", "toyota", "volkswagen", "vw", "audi", "bmw", "mercedes", "ford",
    "renault", "dacia", "peugeot", "citroen", "skoda", "seat", "nissan", "hyundai",
    "kia motors", "mazda", "mitsubishi", "suzuki", "honda", "volvo", "fiat", "jeep",
    "porsche", "land rover", "jaguar", "lexus", "subaru", "chevrolet", "alfa romeo",
    "bosch service", "autoserwis sieciowy", "eurorepar", "man truck",
    # gastronomia
    "mcdonald", "mc donald", "burger king", "kfc", "subway", "starbucks", "costa coffee",
    "domino", "pizza hut", "little caesar", "wendy", "dunkin", "greggs", "crispy burger", "biggy burger",
    # sklepy / drogerie
    "zabka", "biedronka", "lidl", "aldi", "carrefour", "auchan", "kaufland", "tesco",
    "netto", "dino", "stokrotka", "lewiatan", "delikatesy centrum", "fresh market",
    "rosman", "rossmann", "hebe", "superpharm", "empik", "media expert", "rtv euro agd",
    "euro rtv agd", "pepco", "action", "tedox", "jysk", "ikea", "obi", "leroy merlin",
    "castorama", "bricomarche", "ccc", "reserved", "cropp", "sinsay", "house brand",
    "h&m", "zara", "bershka", "stradivarius", "deichmann", "sephora", "douglas",
    "tk maxx", "4f", "nike", "adidas",
    # rozrywka / kultura
    "helios", "multikino", "cinema city",
    # kurierzy / uslugi
    "inpost", "dpd", "dhl", "ups", "fedex", "poczta polska", "pocztex",
]

def _fold_text(s: str) -> str:
    s = (s or "").lower().strip()
    import unicodedata
    s = s.replace("Ĺ‚", "l")
    s = unicodedata.normalize("NFKD", s)
    return "".join(c for c in s if not unicodedata.combining(c))

def is_big_brand(tags: dict, name: Optional[str]) -> bool:
    """True = wielka siec/marka, ktora nie jest dobrym leadem."""
    # Tag wikidata na brand/operatorze to niemal pewny znacznik sieciowki
    if any(tags.get(k) for k in ("brand:wikidata", "operator:wikidata", "network:wikidata")):
        return True
    joined = _fold_text(" | ".join([
        name or "",
        tags.get("brand") or "",
        tags.get("operator") or "",
        tags.get("network") or "",
        tags.get("brand:wikipedia") or "",
    ]))
    for pat in BIG_BRANDS:
        p = _fold_text(pat)
        if not p:
            continue
        if len(p) >= 5 or " " in p:
            if p in joined:
                return True
        else:
            # krotkie wzorce tylko jako cale slowo (np. "vw", "bp", "kfc")
            if re.search(rf"\b{re.escape(p)}\b", joined):
                return True
    return False

def calc_lead_score(tags: dict, has_address: bool, has_phone: bool, has_website: bool) -> int:
    score = 35  # base for existence
    if has_address:
        score += 20
    if has_phone:
        score += 20
    if not has_website:
        score += 20  # bonus for missing website (our target)
    else:
        score += 5
    # bonus for name completeness - if name exists already counted, add small variation via hash to differentiate
    name = tags.get("name", "") or tags.get("operator", "")
    if name:
        h = int(hashlib.md5(name.encode()).hexdigest()[:2], 16) % 5
        score += h
    # clamp
    return min(100, max(0, score))

class OpenStreetMapProvider(BusinessDataProvider):
    def searchBusinesses(self, bbox: Tuple[float,float,float,float], industry: str) -> List[dict]:
        filters = INDUSTRY_OSM.get(industry)
        if not filters:
            # fallback generic
            filters = ["[shop]", "[craft]", "[office]", "[amenity]"]
        elements = overpass_query(bbox, filters)
        # Filter non-businesses
        filtered = []
        seen = set()
        for el in elements:
            tags = el.get("tags", {})
            if not is_business_element(tags):
                continue
            # dedup by osm type+id
            key = f"{el.get('type')}_{el.get('id')}"
            if key in seen:
                continue
            seen.add(key)
            filtered.append(el)
        return filtered

def normalize(el, industry: str, city: str, country: str, only_without_website: bool = True):
    t = el.get("tags", {})
    name = t.get("name") or t.get("operator") or t.get("brand")
    if not name:
        return None
    # PomiĹ„ wielkie sieci/marki (Zabka, McDonald's, dealerzy Opla itp.)
    if is_big_brand(t, name):
        return None
    website = t.get("website") or t.get("contact:website") or t.get("url") or t.get("contact:url")
    has_website = bool(website)
    if only_without_website and has_website:
        return None
    # address
    street = " ".join(x for x in [t.get("addr:street"), t.get("addr:housenumber")] if x)
    city_tag = t.get("addr:city") or t.get("addr:town") or t.get("addr:village") or city
    address_parts = [x for x in [street, t.get("addr:postcode"), city_tag] if x]
    address = ", ".join(address_parts) if address_parts else None
    has_address = bool(address)
    phone = t.get("phone") or t.get("contact:phone") or t.get("contact:mobile") or t.get("phone:mobile")
    has_phone = bool(phone)
    # coordinates
    lat = el.get("lat")
    lon = el.get("lon")
    if lat is None and el.get("center"):
        lat = el["center"].get("lat")
        lon = el["center"].get("lon")
    try:
        lat_f = float(lat) if lat is not None else None
        lon_f = float(lon) if lon is not None else None
    except:
        lat_f = None; lon_f = None
    score = calc_lead_score(t, has_address, has_phone, has_website)
    osm_id = str(el.get("id"))
    osm_type = el.get("type", "node")
    # id for frontend
    fid = f"{osm_type}_{osm_id}_{hashlib.md5(name.encode()).hexdigest()[:6]}"
    return {
        "id": fid,
        "name": name,
        "industry": industry,
        "address": address,
        "city": city_tag,
        "country": country,
        "phone": phone,
        "website": website,  # null if missing
        "latitude": lat_f,
        "longitude": lon_f,
        "osmId": osm_id,
        "osmType": osm_type,
        "leadScore": score,
        # legacy fields for compatibility with old frontend
        "category": industry,
        "location": city,
        "websiteStatus": website if website else "Brak strony w danych OSM",
        "readinessScore": score,
        "estBudget": COUNTRIES.get(country, COUNTRIES["Polska"])["budget"],
        "rating": None,
        "userRatingsTotal": None,
        "openingHours": t.get("opening_hours"),
        "photos": [],
    }

# Legacy google_search kept for reference but not used in new endpoint (real OSM only)
def google_search(city: str, country: str, industry: str, budget: str, limit: int = 20, only_without_website: bool = True):
    if not GOOGLE_KEY:
        return None, "Brak klucza Google Places"
    en_map = {
        "Restauracje": "restaurant", "Restaurant": "restaurant",
        "Kawiarnie": "cafe", "Cafe": "cafe",
        "Bary i puby": "bar", "Barber": "barber",
        "Fast food": "fast food",
        "Piekarnie i cukiernie": "bakery",
        "Salony fryzjerskie": "hairdresser", "Hair Salon": "hairdresser", "Barber": "barber shop",
        "Salony kosmetyczne": "beauty salon", "Beauty Salon": "beauty salon",
        "Silownie i fitness": "gym", "Gym": "gym", "Fitness / Yoga": "yoga studio",
        "Gabinet stomatologiczny": "dentist", "Dentist": "dentist",
        "Apteki": "pharmacy",
        "Warsztaty samochodowe": "car repair", "Auto Repair": "car repair", "Car Dealership": "car dealer",
        "Kwiaciarnie": "florist",
        "Hotele i noclegi": "hotel", "Hotel": "hotel",
        "Real Estate": "real estate agency",
        "Law Firm": "lawyer", "Kancelarie prawne": "lawyer",
        "Medical Clinic": "medical clinic", "Lekarze i przychodnie": "doctor",
        "Pet Grooming": "pet grooming", "Veterinary": "veterinary",
        "Photographer": "photographer", "Fotografowie": "photographer",
        "Cleaning Service": "cleaning service",
        "Construction": "construction company", "Firmy budowlane": "construction",
        "Landscaping": "landscaper",
        "IT / Software": "software company",
        "Moving Company": "moving company",
        "Tutoring": "tutor",
        "Wedding Services": "wedding service",
        "Local Store": "store",
    }
    alias_25 = {
        "Real Estate": "real estate agency", "Barber": "barber", "Hair Salon": "hairdresser",
        "Beauty Salon": "beauty salon", "Dentist": "dentist", "Restaurant": "restaurant",
        "Cafe": "cafe", "Gym": "gym", "Car Dealership": "car dealer", "Auto Repair": "car repair",
        "Hotel": "hotel", "Law Firm": "lawyer", "Medical Clinic": "clinic", "Pet Grooming": "pet groomer",
        "Photographer": "photographer", "Cleaning Service": "cleaning service", "Construction": "construction",
        "Landscaping": "landscaping", "IT / Software": "software company", "Moving Company": "moving company",
        "Tutoring": "tutoring", "Veterinary": "veterinary", "Fitness / Yoga": "yoga", "Wedding Services": "wedding",
        "Local Store": "store", "Pet Grooming": "pet grooming",
    }
    query_label = alias_25.get(industry) or en_map.get(industry, industry)
    if country in ("UK", "USA"):
        query_label = en_map.get(industry, query_label)
    text = f"{query_label} w {city}, {country}" if country == "Polska" else f"{query_label} in {city}, {country}"
    try:
        resp = requests.post(
            "https://places.googleapis.com/v1/places:searchText",
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": GOOGLE_KEY,
                "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.websiteUri,places.regularOpeningHours,places.nationalPhoneNumber,places.internationalPhoneNumber,places.photos,places.id,places.types,places.priceLevel",
            },
            json={
                "textQuery": text,
                "languageCode": "pl" if country == "Polska" else "en",
                "maxResultCount": min(limit, 20),
            },
            timeout=25,
        )
        if resp.status_code != 200:
            return None, f"Google Places {resp.status_code}: {resp.text[:300]}"
        data = resp.json()
        places = data.get("places", [])
        out = []
        for p in places:
            if only_without_website and p.get("websiteUri"):
                continue
            g_name = (p.get("displayName") or {}).get("text") or "Firma"
            # PomiĹ„ wielkie sieci/marki takĹĽe w wynikach Google
            if is_big_brand({}, g_name):
                continue
            addr = p.get("formattedAddress") or city
            phone = p.get("nationalPhoneNumber") or p.get("internationalPhoneNumber") or None
            rating = p.get("rating")
            ratings_total = p.get("userRatingCount")
            hours = None
            roh = p.get("regularOpeningHours")
            if roh and roh.get("weekdayDescriptions"):
                hours = "; ".join(roh["weekdayDescriptions"][:3])
            photos = []
            for ph in (p.get("photos") or [])[:3]:
                photos.append(ph.get("name"))
            seed = int(hashlib.md5(name.encode()).hexdigest()[:6], 16)
            score = 85 + (seed % 15)
            out.append({
                "id": f"g-{p.get('id') or seed}",
                "name": name,
                "category": industry,
                "location": city,
                "phone": phone,
                "address": addr,
                "websiteStatus": "Brak strony w danych OSM",
                "readinessScore": score,
                "estBudget": budget,
                "rating": rating,
                "userRatingsTotal": ratings_total,
                "openingHours": hours,
                "photos": photos,
                "types": p.get("types", []),
            })
            if len(out) >= limit:
                break
        return out, None
    except Exception as e:
        return None, str(e)

@router.post("/osm-search")
def osm_search(data: OsmSearchInput, request: Request, db: Session = Depends(get_db), x_user_plan: Optional[str] = Header(None), x_user_id: Optional[str] = Header(None)):
    # Redirect to new search for compatibility
    return search_osm(data, request, db, x_user_plan, x_user_id)

def search_osm(data: OsmSearchInput, request: Request, db: Session, x_user_plan, x_user_id):
    try:
        remaining = check_rate_limit(x_user_plan or "Starter", x_user_id or (request.client.host if request.client else "anon"))
    except HTTPException as e:
        raise e
    country = COUNTRIES.get(data.country, COUNTRIES["Polska"])
    budget = country["budget"]
    is_high = (x_user_plan or "Starter").lower() in ("business", "agencja", "pro", "premium", "business")
    g_places: Optional[List[dict]] = None
    g_err: Optional[str] = None
    if is_high:
        g_places, g_err = google_search(data.city, data.country, data.industry, budget, data.limit, data.onlyWithoutWebsite)
        if g_places is not None and len(g_places) > 0:
            return {"status": "success", "count": len(g_places), "leads": g_places, "warning": None, "source": "google", "remaining": remaining}
    if not is_high and g_err is None:
        g_err = "Plan Starter/Free â€” uzywam darmowego Overpass API (Google Places tylko dla Business/Pro/Agencja)"
    filters = INDUSTRY_OSM.get(data.industry, ["[amenity=restaurant]"])
    bbox = None
    if data.osmId and data.osmType:
        bbox = get_bbox_from_osm(data.osmId, data.osmType)
    if not bbox:
        # fallback to latitude/longitude if provided
        if data.latitude is not None and data.longitude is not None:
            lat = float(data.latitude); lon = float(data.longitude)
            bbox = (lat-0.05, lon-0.05, lat+0.05, lon+0.05)
        else:
            bbox = geocode(data.city, country["geo"])
    leads_out = g_places if g_places is not None else []
    warning = g_err
    if bbox and (g_places is None or len(g_places) == 0):
        try:
            provider = OpenStreetMapProvider()
            elements = provider.searchBusinesses(bbox, data.industry)
            for el in elements:
                norm = normalize(el, data.industry, data.city, data.country, data.onlyWithoutWebsite)
                if norm:
                    leads_out.append(norm)
                if len(leads_out) >= data.limit:
                    break
            if leads_out:
                warning = None
        except Exception as e:
            warning = f"Overpass error: {e}"
    elif not bbox and (g_places is None or len(g_places) == 0):
        warning = warning or "Nie znaleziono miejscowosci â€” sprawdz pisownie"

    if not leads_out:
        if not warning:
            warning = "Brak firm bez strony w tej okolicy â€” sprobuj inna branze lub pobliskie miasto. Pokazujemy tylko zweryfikowane firmy bez website (Google Places + OSM)."
        return {"status": "success", "count": 0, "leads": [], "warning": warning, "source": "none", "remaining": remaining}

    return {"status": "success", "count": len(leads_out), "leads": leads_out, "warning": warning, "source": "google" if g_places and len(g_places) > 0 else "osm", "remaining": remaining}

# New spec endpoint POST /api/leads/search
class SearchBody(BaseModel):
    country: str
    city: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    osmId: Optional[str] = None
    osmType: Optional[str] = None
    industry: str
    onlyWithoutWebsite: bool = True
    limit: int = Field(default=60, ge=1, le=200)

@router.post("/search")
def new_search(body: SearchBody, request: Request, db: Session = Depends(get_db), x_user_plan: Optional[str] = Header(None), x_user_id: Optional[str] = Header(None)):
    # Validation
    if body.country not in COUNTRIES:
        raise HTTPException(status_code=400, detail=f"Invalid country: {body.country}. Allowed: {list(COUNTRIES.keys())}")
    if not body.city or len(body.city.strip()) < 2:
        raise HTTPException(status_code=400, detail="Invalid city: must be at least 2 characters")
    industry_warning: Optional[str] = None
    if body.industry not in INDUSTRY_OSM:
        # Nie rzucamy 400 â€” szukamy ogolnie wszystkich firm z ostrzezeniem
        industry_warning = f"BranĹĽa '{body.industry}' nie ma dedykowanych tagĂłw OSM â€” szukam wszystkich firm w okolicy"
    if body.limit < 1 or body.limit > 200:
        raise HTTPException(status_code=400, detail="Invalid limit: 1-200")
    # Rate limit
    try:
        remaining = check_rate_limit(x_user_plan or "Starter", x_user_id or (request.client.host if request.client else "anon"))
    except HTTPException as e:
        raise e
    # Cache check
    cache_key = f"{body.country}|{body.city.lower().strip()}|{body.industry}|{body.onlyWithoutWebsite}|{body.limit}|{body.osmId}|{body.osmType}"
    now = time.time()
    if cache_key in _cache:
        ts, cached_data = _cache[cache_key]
        if now - ts < CACHE_TTL:
            # return cached but update remaining? include remaining
            cached_copy = dict(cached_data)
            cached_copy["remaining"] = remaining
            cached_copy["cached"] = True
            return cached_copy
    # Resolve bbox â€” kolejno: dokladny OSM lookup -> geocode pelnej nazwy -> punkt Â±0.05
    bbox = None
    if body.osmId and body.osmType:
        bbox = get_bbox_from_osm(str(body.osmId), str(body.osmType))
    if not bbox:
        country_geo = COUNTRIES[body.country]["geo"]
        bbox = geocode(body.city, country_geo)
    if not bbox and body.latitude is not None and body.longitude is not None:
        lat = float(body.latitude); lon = float(body.longitude)
        bbox = (lat-0.05, lon-0.05, lat+0.05, lon+0.05)
    if not bbox:
        raise HTTPException(status_code=400, detail=f"Nie znaleziono lokalizacji: {body.city}, {body.country} â€” sprawdz pisownie lub wybierz z podpowiedzi")
    # Overpass query via provider
    try:
        provider = OpenStreetMapProvider()
        elements = provider.searchBusinesses(bbox, body.industry)
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="Overpass timeout â€” sprobuj ponownie za chwile")
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Nominatim/Overpass error: {str(e)[:200]}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Blad wyszukiwania: {str(e)[:200]}")
    # Normalize and filter
    leads_out = []
    seen_keys = set()
    for el in elements:
        norm = normalize(el, body.industry, body.city, body.country, body.onlyWithoutWebsite)
        if not norm:
            continue
        # dedup by osmId+type+name+coords
        dedup_key = f"{norm['osmType']}_{norm['osmId']}_{norm['name'].lower().strip()}"
        if dedup_key in seen_keys:
            continue
        seen_keys.add(dedup_key)
        # also dedup by close coordinates + same name
        if norm["latitude"] and norm["longitude"]:
            coord_key = f"{norm['name'].lower().strip()}_{round(norm['latitude'],4)}_{round(norm['longitude'],4)}"
            if coord_key in seen_keys:
                continue
            seen_keys.add(coord_key)
        leads_out.append(norm)
        if len(leads_out) >= body.limit:
            break
    # Weryfikacja Google Places dla trybu "bez strony" — OSM często nie ma tagu website
    # mimo że firma ma stronę w Google Maps (np. kawiarnie w Londynie)
    if body.onlyWithoutWebsite and GOOGLE_KEY and leads_out:
        def _has_website_google(lead: dict):
            try:
                q = " ".join(x for x in [lead.get("name"), lead.get("address") or "", lead.get("city") or body.city, lead.get("country") or body.country] if x).strip()
                if not q:
                    return None
                r = requests.post(
                    "https://places.googleapis.com/v1/places:searchText",
                    headers={"Content-Type": "application/json", "X-Goog-Api-Key": GOOGLE_KEY, "X-Goog-FieldMask": "places.websiteUri,places.displayName"},
                    json={"textQuery": q, "maxResultCount": 1},
                    timeout=8,
                )
                if r.status_code != 200:
                    return None
                pls = r.json().get("places") or []
                if not pls:
                    return None
                return bool(pls[0].get("websiteUri"))
            except Exception:
                return None
        # Weryfikuj pierwsze 25 leadów równolegle (5 wątków) — reszta bez weryfikacji
        verify_n = min(len(leads_out), 25)
        to_verify = leads_out[:verify_n]
        rest = leads_out[verify_n:]
        kept = []
        skipped = 0
        try:
            from concurrent.futures import ThreadPoolExecutor, as_completed
            with ThreadPoolExecutor(max_workers=5) as ex:
                fut_map = {ex.submit(_has_website_google, ld): ld for ld in to_verify}
                for fut in as_completed(fut_map):
                    ld = fut_map[fut]
                    try:
                        has = fut.result()
                    except Exception:
                        has = None
                    if has is True:
                        skipped += 1
                        continue
                    kept.append(ld)
        except Exception:
            kept = to_verify
        leads_out = kept + rest
        # zapamiętaj do warningu poniżej
        google_skipped_local = skipped
        google_verify_n_local = verify_n

    # Sort by leadScore desc
    leads_out.sort(key=lambda x: x.get("leadScore", 0), reverse=True)
    empty_warning = "Brak firm spelniajacych kryteria w tej okolicy â€” sprobuj inna branze lub pobliskie miasto. Pokazujemy tylko zweryfikowane firmy bez website (dane OSM)."
    combined_warning = industry_warning or (None if leads_out else empty_warning)
    if industry_warning and leads_out:
        combined_warning = industry_warning
    # Dopisz info o weryfikacji Google jeśli była
    try:
        if 'google_skipped_local' in locals() and google_skipped_local:
            g_note = f"Google zweryfikowało {google_skipped_local} z {google_verify_n_local} firm — miały stronę w Google i zostały odfiltrowane."
            combined_warning = f"{combined_warning} {g_note}" if combined_warning else g_note
    except Exception:
        pass
    result = {
        "status": "success",
        "count": len(leads_out),
        "leads": leads_out,
        "warning": combined_warning,
        "source": "osm",
        "remaining": remaining,
        "cached": False
    }
    _cache[cache_key] = (now, result)
    # pruning cache size
    if len(_cache) > 200:
        oldest = min(_cache.items(), key=lambda x: x[1][0])
        del _cache[oldest[0]]
    return result

@router.get("/")
def get_leads(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    leads = db.query(Lead).filter(Lead.owner_id == current_user["id"]).all()
    # NO mock injection - return real data only, empty if none
    return leads

# Save lead endpoint with deduplication osmId+type, RLS
class SaveLeadBody(BaseModel):
    name: str
    industry: Optional[str] = None
    niche: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    osmId: Optional[str] = None
    osmType: Optional[str] = None
    leadScore: Optional[int] = None
    ai_score: Optional[int] = None

@router.post("/save")
def save_lead(body: SaveLeadBody, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    # Validate required
    if not body.name or len(body.name.strip()) < 2:
        raise HTTPException(status_code=400, detail="Invalid name")
    # Deduplication by osmId+osmType for this owner
    if body.osmId and body.osmType:
        existing = db.query(Lead).filter(
            Lead.owner_id == current_user["id"],
            Lead.osm_id == str(body.osmId),
            Lead.osm_type == str(body.osmType)
        ).first()
        if existing:
            return {"status": "exists", "message": "Lead already saved", "lead": existing}
    else:
        # fallback dedup by name+city
        existing = db.query(Lead).filter(
            Lead.owner_id == current_user["id"],
            Lead.company_name == body.name,
            Lead.city == (body.city or "")
        ).first()
        if existing:
            return {"status": "exists", "message": "Lead already saved (name+city)", "lead": existing}
    # Create new lead
    industry_val = body.industry or body.niche or "Other"
    score = body.leadScore or body.ai_score or 75
    new_lead = Lead(
        owner_id=current_user["id"],
        company_name=body.name.strip(),
        website=body.website,
        niche=industry_val,
        industry=industry_val,
        address=body.address,
        city=body.city,
        country=body.country,
        phone=body.phone,
        latitude=body.latitude,
        longitude=body.longitude,
        osm_id=str(body.osmId) if body.osmId else None,
        osm_type=str(body.osmType) if body.osmType else None,
        ai_score=score,
        lead_score=score,
        status="Nowy"
    )
    db.add(new_lead)
    try:
        db.commit()
        db.refresh(new_lead)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"DB error: {str(e)[:200]}")
    return {"status": "saved", "message": "Lead saved", "lead": new_lead}

# Keep old POST /search with query params for backward compat (already defined as new_search via body, but old signature was niche/location)
# We keep it as separate endpoint with different path? FastAPI will handle overload by body vs query - keep legacy as /search-legacy
@router.post("/search-legacy")
def search_leads_legacy(niche: str, location: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    new_lead = Lead(
        owner_id=current_user["id"],
        company_name=f"Firma {niche} - {location}",
        website=f"{niche.lower()}-{location.lower()}.pl",
        niche=niche,
        ai_score=89
    )
    db.add(new_lead)
    db.commit()
    db.refresh(new_lead)
    return {"message": "Znaleziono nowy lead!", "lead": new_lead}
