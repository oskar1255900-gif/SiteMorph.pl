from fastapi import APIRouter, Depends, Request, Header, HTTPException, Query
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
        raise HTTPException(status_code=429, detail=f"Limit wyszukiwań wyczerpany ({limit}/miesiąc dla planu {plan or 'Starter'}). Ulepsz plan.")
    _search_counts[user_id] += 1
    return limit - _search_counts[user_id]

router = APIRouter(prefix="/api/leads", tags=["Leads"])

UA = {"User-Agent": "SiteMorph/1.0 (lead finder; contact@sitemorph.pl)"}
GOOGLE_KEY = os.getenv("GOOGLE_PLACES_API_KEY") or os.getenv("GOOGLE_API_KEY")

# Google Places API config
GOOGLE_PLACES_BASE = "https://places.googleapis.com/v1"
GOOGLE_FIELDS = "places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.types,places.regularOpeningHours,places.photos,places.priceLevel,places.businessStatus"

COUNTRIES = {
    "Polska": {"geo": "Poland", "prefix": "+48", "budget": "2 500 - 3 500 zl"},
    "UK": {"geo": "United Kingdom", "prefix": "+44", "budget": "£650 - £900"},
    "USA": {"geo": "United States", "prefix": "+1", "budget": "$850 - $1 200"},
}

# In-memory cache: key -> (timestamp, results)
_cache: Dict[str, Tuple[float, Any]] = {}
CACHE_TTL = 300  # 5 min

# Mapowanie branzy -> tagi OSM — 40 branż angielskich + stare PL dla kompatybilności
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
    # --- Stare PL + kompatybilność ---
    "Restauracje": ["[amenity=restaurant]"],
    "Kawiarnie": ["[amenity=cafe]"],
    "Bary i puby": ["[amenity=bar]", "[amenity=pub]"],
    "Piekarnie i cukiernie": ["[shop=bakery]", "[shop=pastry]"],
    "Sklepy spozywcze": ["[shop=convenience]"],
    "Supermarkety": ["[shop=supermarket]"],
    "Warzywniaki": ["[shop=greengrocer]"],
    "Salony fryzjerskie": ["[shop=hairdresser]"],
    "Salony kosmetyczne": ["[shop=beauty]", "[shop=cosmetics]"],
    "Studio tatuażu i piercingu": ["[shop=tattoo]", "[shop=piercing]"],
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
    "Biura nieruchomości": ["[office=estate_agent]"],
    "Kancelarie prawne": ["[office=lawyer]"],
    "Biura rachunkowe": ["[office=accountant]"],
    "Ubezpieczenia": ["[office=insurance]"],
    "Firmy budowlane": ["[craft=builder]", "[office=construction_company]"],
    "Elektrycy": ["[craft=electrician]"],
    "Hydraulicy": ["[craft=plumber]"],
    "Stolarze i stolarnie": ["[craft=carpenter]", "[shop=do-it-yourself]"],
    "Fotografowie": ["[shop=photo]", "[craft=photographer]"],
    "Szkoly jezykowe": ["[amenity=school]", "[amenity=language_school]"],
    "Szkoły językowe": ["[amenity=school]", "[amenity=language_school]"],
    "Hotele i noclegi": ["[tourism=hotel]", "[tourism=guest_house]", "[tourism=hostel]"],
    "Agroturystyka": ["[tourism=guest_house]"],
    "Sklepy zoologiczne": ["[shop=pet]", "[shop=pet_grooming]"],
    "Optycy": ["[shop=optician]"],
    "Jubilerzy i zegarmistrzowie": ["[shop=jewelry]", "[shop=watches]"],
    "Odziez i butiki": ["[shop=clothes]", "[shop=boutique]"],
    "Odzież i butiki": ["[shop=clothes]", "[shop=boutique]"],
    "Obuwie": ["[shop=shoes]"],
    "Ksiegarnie i papiernicze": ["[shop=books]", "[shop=stationery]"],
    "Księgarnie i papiernicze": ["[shop=books]", "[shop=stationery]"],
    "Zabawki": ["[shop=toys]"],
    "Serwisy rowerowe": ["[shop=bicycle]", "[shop=bicycle_repair]"],
    "Taksowki i transport": ["[amenity=taxi]"],
    "Taksówki i transport": ["[amenity=taxi]"],
    "Kregielnia i rozrywka": ["[leisure=bowling_alley]", "[leisure=escape_game]"],
    "Kręgielnia i rozrywka": ["[leisure=bowling_alley]", "[leisure=escape_game]"],
    "Local Store": ["[shop=convenience]"],
    # --- Aliasy pojedynczej liczby / warianty z frontendu (LeadFinderView) ---
    "Fast food": ["[amenity=fast_food]"],
    "Salony piękności": ["[shop=beauty]"],
    "Manicure": ["[shop=nail]"],
    "Stomatolog": ["[amenity=dentist]"],
    "Przychodnia lekarska": ["[amenity=doctors]", "[amenity=clinic]"],
    "Fizjoterapeuta": ["[healthcare=physiotherapist]", "[amenity=clinic]"],
    "Weterynarz": ["[amenity=veterinary]"],
    "Restauracja": ["[amenity=restaurant]"],
    "Kawiarnia": ["[amenity=cafe]"],
    "Piekarnia": ["[shop=bakery]"],
    "Bar szybkiej obsługi": ["[amenity=fast_food]"],
    "Siłownia": ["[leisure=fitness_centre]"],
    "Studio jogi": ["[sport=yoga]", "[leisure=fitness_centre]"],
    "Trener personalny": ["[leisure=fitness_centre]", "[leisure=sports_centre]"],
    "Nieruchomości": ["[office=estate_agent]"],
    "Kancelaria prawna": ["[office=lawyer]"],
    "Księgowość": ["[office=accountant]"],
    "Warsztat samochodowy": ["[shop=car_repair]"],
    "Salon samochodowy": ["[shop=car]"],
    "Myjnia samochodowa": ["[amenity=car_wash]"],
    "Fotograf": ["[shop=photo]", "[craft=photographer]"],
    "Usługi ślubne": ["[shop=wedding]", "[office=wedding_planner]"],
    "Sprzątanie": ["[craft=cleaner]", "[shop=dry_cleaning]"],
    "Budownictwo": ["[craft=builder]", "[office=construction_company]"],
    "Hydraulik": ["[craft=plumber]"],
    "Elektryk": ["[craft=electrician]"],
    "Dekarz": ["[craft=roofer]"],
    "Malarz": ["[craft=painter]"],
    "Przeprowadzki": ["[office=moving_company]", "[shop=storage_rental]"],
    "Agencja marketingowa": ["[office=advertising_agency]", "[office=marketing]"],
    "Usługi IT": ["[office=it]", "[office=company]"],
    "Serwis komputerowy": ["[shop=computer]", "[craft=electronics_repair]"],
    "Sklep osiedlowy": ["[shop=convenience]"],
    "Sklep odzieżowy": ["[shop=clothes]", "[shop=boutique]"],
    "Sklep meblowy": ["[shop=furniture]"],
    "Kwiaciarnia": ["[shop=florist]"],
    "Fryzjer męski": ["[shop=barber]", "[shop=hairdresser]"],
    "Korepetycje": ["[amenity=school]", "[amenity=language_school]"],
    "Szkoła muzyczna": ["[amenity=music_school]"],
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
# Wielkie sieci i marki — bez sensu jako leady (maja strony i dzial marketingu).
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
    s = s.replace("ł", "l")
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


# Google Places Provider (primary source - better data quality)
class GooglePlacesProvider(BusinessDataProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://places.googleapis.com/v1/places:searchText"

    def searchBusinesses(self, bbox: Tuple[float,float,float,float], industry: str) -> List[dict]:
        if not self.api_key:
            return []
        
        # Convert bbox to location restriction (circle around center)
        center_lat = (bbox[0] + bbox[2]) / 2
        center_lon = (bbox[1] + bbox[3]) / 2
        # Radius in meters (approx bbox diagonal / 2)
        dlat = bbox[2] - bbox[0]
        dlon = bbox[3] - bbox[1]
        radius = int(((dlat ** 2 + dlon ** 2) ** 0.5) * 111000 / 2)  # rough meters
        radius = max(min(radius, 50000), 1000)  # clamp 1km-50km
        
        # Map industry to Google Places types
        industry_types = self._map_industry_to_types(industry)
        
        query = f"{industry} in area"
        body = {
            "textQuery": query,
            "maxResultCount": 100,
            "locationRestriction": {
                "circle": {
                    "center": {"latitude": center_lat, "longitude": center_lon},
                    "radius": float(radius)
                }
            },
            "includedType": industry_types[0] if industry_types else None
        }
        
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self.api_key,
            "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.types,places.regularOpeningHours,places.photos,places.priceLevel,places.businessStatus"
        }
        
        try:
            r = requests.post(
                "https://places.googleapis.com/v1/places:searchText",
                headers={"Content-Type": "application/json", "X-Goog-Api-Key": self.api_key, "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.types,places.regularOpeningHours,places.photos,places.priceLevel,places.businessStatus"},
                json=body,
                timeout=15
            )
            if r.status_code != 200:
                print(f"[Google Places] Error {r.status_code}: {r.text[:200]}")
                return []
            data = r.json()
            return data.get("places", [])
        except Exception as e:
            print(f"[Google Places] Error: {e}")
            return []

    def _map_industry_to_types(self, industry: str) -> List[str]:
        mapping = {
            "Restaurant": ["restaurant"],
            "Cafe": ["cafe"],
            "Bakery": ["bakery"],
            "Barber": ["hair_care"],
            "Hair Salon": ["hair_care"],
            "Beauty Salon": ["beauty_salon"],
            "Spa": ["spa"],
            "Dentist": ["dentist"],
            "Medical Clinic": ["doctor", "hospital"],
            "Gym": ["gym"],
            "Hotel": ["lodging"],
            "Auto Repair": ["car_repair"],
            "Plumber": ["plumber"],
            "Electrician": ["electrician"],
            "Law Firm": ["lawyer"],
            "Accounting": ["accounting"],
            "Real Estate": ["real_estate_agency"],
            "Photographer": ["photographer"],
            "Florist": ["florist"],
            "Car Wash": ["car_wash"],
            "Veterinarian": ["veterinary_care"],
            "Pet Store": ["pet_store"],
            "Furniture Store": ["furniture_store"],
            "Clothing Store": ["clothing_store"],
            "Local Retail Store": ["store"],
            "Cafe": ["cafe"],
            "Fast Food": ["restaurant"],
            "Pizzeria": ["restaurant"],
            "Bakery": ["bakery"],
        }
        return mapping.get(industry, ["establishment"])

def normalize(el, industry: str, city: str, country: str, only_without_website: bool = True):
    t = el.get("tags", {})
    name = t.get("name") or t.get("operator") or t.get("brand")
    if not name:
        return None
    # Pomiń wielkie sieci/marki (Zabka, McDonald's, dealerzy Opla itp.)
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


# Body dla POST /api/leads/search
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


# Normalize Google Places result
def normalize_google(place: dict, industry: str, city: str, country: str, only_without_website: bool = True):
    name = place.get("displayName", {}).get("text") if isinstance(place.get("displayName"), dict) else place.get("displayName")
    if not name:
        return None
    website = place.get("websiteUri")
    has_website = bool(website)
    if only_without_website and has_website:
        return None
    address = place.get("formattedAddress")
    phone = place.get("nationalPhoneNumber")
    lat = place.get("location", {}).get("latitude")
    lon = place.get("location", {}).get("longitude")
    rating = place.get("rating")
    user_ratings_total = place.get("userRatingCount")
    opening_hours = place.get("regularOpeningHours", {}).get("weekdayDescriptions") if place.get("regularOpeningHours") else None
    types = place.get("types", [])
    business_status = place.get("businessStatus")
    if business_status and business_status != "OPERATIONAL":
        return None
    # Skip big brands
    if is_big_brand({"name": name, "types": types}, name):
        return None
    has_address = bool(address)
    has_phone = bool(phone)
    has_website = bool(website)
    score = calc_lead_score({}, has_address, has_phone, has_website)
    if rating:
        score += min(int(rating * 5), 10)
    fid = f"google_{place.get('id', '')}_{hashlib.md5(name.encode()).hexdigest()[:6]}"
    return {
        "id": fid,
        "name": name,
        "industry": industry,
        "address": address,
        "city": city,
        "country": country,
        "phone": phone,
        "website": website,
        "latitude": lat,
        "longitude": lon,
        "osmId": place.get("id", ""),
        "osmType": "google",
        "leadScore": score,
        "category": industry,
        "location": city,
        "websiteStatus": website if website else "Brak strony w Google Places",
        "readinessScore": score,
        "estBudget": COUNTRIES.get(country, COUNTRIES["Polska"])["budget"],
        "rating": rating,
        "userRatingsTotal": user_ratings_total,
        "openingHours": opening_hours,
        "photos": place.get("photos", []),
    }


@router.post("/search")
def new_search(body: SearchBody, request: Request, db: Session = Depends(get_db), x_user_plan: Optional[str] = Header(None), current_user: dict = Depends(get_current_user)):
    # Walidacja
    if body.country not in COUNTRIES:
        raise HTTPException(status_code=400, detail=f"Invalid country: {body.country}. Allowed: {list(COUNTRIES.keys())}")
    if not body.city or len(body.city.strip()) < 2:
        raise HTTPException(status_code=400, detail="Invalid city: must be at least 2 characters")
    if body.limit < 1 or body.limit > 200:
        raise HTTPException(status_code=400, detail="Invalid limit: 1-200")
    industry_warning: Optional[str] = None
    if body.industry not in INDUSTRY_OSM:
        industry_warning = f"Branża '{body.industry}' nie ma dedykowanych tagów OSM — szukam wszystkich firm w okolicy"
    quota_key = current_user["id"] if not current_user.get("is_anon") else (request.client.host if request.client else "anon")
    try:
        remaining = check_rate_limit(x_user_plan or "Starter", quota_key)
    except HTTPException as e:
        raise e
    cache_key = f"{body.country}|{body.city.lower().strip()}|{body.industry}|{body.onlyWithoutWebsite}|{body.limit}|{body.osmId}|{body.osmType}"
    now = time.time()
    if cache_key in _cache:
        ts, cached_data = _cache[cache_key]
        if now - ts < CACHE_TTL:
            cached_copy = dict(cached_data)
            cached_copy["remaining"] = remaining
            cached_copy["cached"] = True
            return cached_copy
    # Resolve bbox
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
        raise HTTPException(status_code=400, detail=f"Nie znaleziono lokalizacji: {body.city}, {body.country} — sprawdź pisownię lub wybierz z podpowiedzi")
    
    # Overpass jako główne źródło — wszystkie nazwy/adresy/ulice z OSM (lepsza dokładność adresów)
    leads_out = []
    try:
        provider = OpenStreetMapProvider()
        elements = provider.searchBusinesses(bbox, body.industry)
        for el in elements:
            norm = normalize(el, body.industry, body.city, body.country, False)  # na razie bez filtra strony
            if not norm:
                continue
            leads_out.append(norm)
            if len(leads_out) >= body.limit * 2:  # pobierz więcej, bo potem odfiltrujemy po weryfikacji Google
                break
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="Overpass timeout — spróbuj ponownie za chwilę")
    except Exception as e:
        print(f"[Overpass] Search error: {e}")
        raise HTTPException(status_code=502, detail=f"Overpass error: {str(e)[:200]}")

    # Google Places TYLKO do 2 rzeczy: 1) czy ma stronę 2) numer tel — reszta zostaje z Overpass
    if GOOGLE_KEY and leads_out:
        def _enrich_with_google(lead: dict):
            try:
                q = " ".join(x for x in [lead.get("name"), lead.get("address") or "", lead.get("city") or body.city, lead.get("country") or body.country] if x).strip()
                if not q:
                    return lead, None, None
                r = requests.post(
                    "https://places.googleapis.com/v1/places:searchText",
                    headers={"Content-Type": "application/json", "X-Goog-Api-Key": GOOGLE_KEY, "X-Goog-FieldMask": "places.websiteUri,places.nationalPhoneNumber,places.displayName"},
                    json={"textQuery": q, "maxResultCount": 1},
                    timeout=7,
                )
                if r.status_code != 200:
                    return lead, None, None
                pls = r.json().get("places") or []
                if not pls:
                    return lead, None, None
                p = pls[0]
                return lead, p.get("websiteUri"), p.get("nationalPhoneNumber")
            except Exception:
                return lead, None, None

        # Wzbogać pierwsze 60 leadów równolegle (Overpass ma ~60), Google tylko dla strony/tel
        from concurrent.futures import ThreadPoolExecutor, as_completed
        enriched = []
        with ThreadPoolExecutor(max_workers=6) as ex:
            fut_map = {ex.submit(_enrich_with_google, ld): ld for ld in leads_out[:60]}
            for fut in as_completed(fut_map):
                ld, g_website, g_phone = fut.result()
                # Uzupełnij tel jeśli brak w OSM, a Google ma
                if not ld.get("phone") and g_phone:
                    ld["phone"] = g_phone
                # Zapisz website z Google do filtra
                ld["_g_website"] = g_website
                enriched.append(ld)
        # Reszta bez wzbogacenia
        enriched.extend(leads_out[60:])
        leads_out = enriched

        # Filtr "tylko bez strony" — używamy Google website jako źródła prawdy
        if body.onlyWithoutWebsite:
            leads_out = [l for l in leads_out if not l.get("_g_website") and not l.get("website")]

        # Posprzątaj tymczasowe pole
        for l in leads_out:
            l.pop("_g_website", None)

        # Dedup po nazwie + koordynatach
        seen_keys = set()
        deduped = []
        for lead in leads_out:
            key = f"{lead['name'].lower().strip()}_{round(lead['latitude'] or 0, 4)}_{round(lead['longitude'] or 0, 4)}"
            if key in seen_keys:
                continue
            seen_keys.add(key)
            deduped.append(lead)
            if len(deduped) >= body.limit:
                break
        leads_out = deduped
    
    # Sort by leadScore desc
    leads_out.sort(key=lambda x: x.get("leadScore", 0), reverse=True)
    empty_warning = "Brak firm spełniających kryteria w tej okolicy — spróbuj innej branży lub pobliskiego miasta."
    combined_warning = industry_warning or (None if leads_out else empty_warning)
    if industry_warning and leads_out:
        combined_warning = industry_warning
    
    result = {
        "status": "success",
        "count": len(leads_out),
        "leads": leads_out,
        "warning": combined_warning,
        "source": "google+osm",
        "remaining": remaining,
        "cached": False
    }
    _cache[cache_key] = (now, result)
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
