"""Explicit Google Fonts catalog. At most two families and two weights per family."""
from urllib.parse import urlencode

# Display-only families cannot accidentally become the body face.
_ROWS = [
    ("fraunces", "Fraunces", "serif", "display", "soft expressive editorial"),
    ("playfair", "Playfair Display", "serif", "display", "editorial elegant"),
    ("cormorant", "Cormorant Garamond", "serif", "display", "delicate heritage"),
    ("lora", "Lora", "serif", "dual", "warm literary"),
    ("libre-baskerville", "Libre Baskerville", "serif", "dual", "formal authority"),
    ("source-serif", "Source Serif 4", "serif", "dual", "precise editorial"),
    ("eb-garamond", "EB Garamond", "serif", "dual", "heritage quiet"),
    ("dm-serif", "DM Serif Display", "serif", "display", "confident expressive"),
    ("manrope", "Manrope", "sans-serif", "dual", "precise contemporary"),
    ("dm-sans", "DM Sans", "sans-serif", "dual", "urban neutral"),
    ("work-sans", "Work Sans", "sans-serif", "dual", "editorial functional"),
    ("source-sans", "Source Sans 3", "sans-serif", "dual", "humanist trustworthy"),
    ("ibm-plex-sans", "IBM Plex Sans", "sans-serif", "dual", "technical precise"),
    ("nunito-sans", "Nunito Sans", "sans-serif", "dual", "soft friendly"),
    ("outfit", "Outfit", "sans-serif", "dual", "geometric playful"),
    ("plus-jakarta", "Plus Jakarta Sans", "sans-serif", "dual", "polished warm"),
    ("space-grotesk", "Space Grotesk", "sans-serif", "dual", "urban expressive"),
    ("sora", "Sora", "sans-serif", "dual", "wide technical"),
    ("archivo", "Archivo", "sans-serif", "dual", "industrial confident"),
    ("archivo-black", "Archivo Black", "sans-serif", "display", "poster strong"),
    ("oswald", "Oswald", "sans-serif", "display", "condensed energetic"),
    ("barlow-condensed", "Barlow Condensed", "sans-serif", "display", "condensed precise"),
    ("space-mono", "Space Mono", "monospace", "dual", "technical poster"),
    ("jetbrains-mono", "JetBrains Mono", "monospace", "dual", "functional code"),
]
FONT_LIBRARY = {id: {"id": id, "family": family, "fallback": fallback, "role": role,
                     "mood": mood, "subsets": ["latin", "latin-ext"],
                     "weights": [400] if id in {"dm-serif", "archivo-black"} else [400, 700]}
                for id, family, fallback, role, mood in _ROWS}


def select_typography(display_id, text_id, locale="pl-PL"):
    if display_id not in FONT_LIBRARY or text_id not in FONT_LIBRARY:
        raise ValueError("Wybierz font z biblioteki SiteMorph.")
    display, text = FONT_LIBRARY[display_id], FONT_LIBRARY[text_id]
    if text["role"] == "display":
        raise ValueError("Font nagłówkowy nie może być fontem tekstu akapitowego.")
    if display["fallback"] == "monospace" and text["fallback"] == "monospace" and display_id != text_id:
        raise ValueError("Dwie różne rodziny monospace nie tworzą czytelnej pary.")
    selected = {f["id"]: f for f in (display, text)}
    params = [("family", f["family"] + ":wght@" + ";".join(map(str, f["weights"]))) for f in selected.values()]
    return {"display": display, "text": text, "stylesheet": "https://fonts.googleapis.com/css2?" + urlencode(params) + "&display=swap"}


def prompt_catalog():
    return "\n".join(f"{f['id']}: {f['family']}; {f['role']}; {f['mood']}" for f in FONT_LIBRARY.values())
