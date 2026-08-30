"""
4 radically different visual templates. Wizard choices drive the design.
"""
import re
import time
import random


def fallback_content(data):
    src = (data.extraPrompt or "") + " " + (data.description or "")

    def _extract(pattern, default=None):
        m = re.search(pattern, src, re.I | re.S)
        if not m:
            return default
        try:
            return (m.group(1) if m.lastindex else m.group(0)).strip()
        except:
            return m.group(0).strip()

    m2 = re.search(r'dla firmy\s*[""]([^""]+)[""]', src, re.I)
    if m2 and len(m2.group(1).strip()) > 2:
        bn = m2.group(1).strip()
    else:
        bn = data.business_name or "Twoja Firma"
        if bn.lower() in ("restauracja", "kawiarnia", "piekarnia", "barber", "salon"):
            ef = (data.extraPrompt or "").split("\n")[0][:60] if data.extraPrompt else ""
            if ef and len(ef) > 3:
                bn = ef

    parsed_addr = _extract(r'\d{2}-\d{3}\s+[A-Z][a-z]+')
    parsed_phone = _extract(r'(?:\+?48[\s-]?)?\d{3}[\s-]?\d{3}[\s-]?\d{3}')
    rating_m = re.search(r'(\d[,.]\d)\s*\((\d+)\)', src)
    rating = rating_m.group(1).replace(',', '.') if rating_m else "4.8"
    reviews_n = rating_m.group(2) if rating_m else "127"
    niche = data.niche or "Uslugi lokalne"
    title = bn + " - " + niche
    year = time.strftime("%Y")
    safe = (bn or "Site").strip()[:30] or "Site"
    addr = parsed_addr or "Adres do uzupelnienia"
    phone = parsed_phone or "+48 000 000 000"

    ACCENT_MAP = {
        "Niebieski #2563eb": "#2563eb", "Ciemny/grafit #111827": "#111827",
        "Zloty #d97706": "#d97706", "Zielony #059669": "#059669",
        "Fioletowy #7c3aed": "#7c3aed", "Czerwony #dc2626": "#dc2626",
    }
    accent = ACCENT_MAP.get(getattr(data, "accent_color", None) or "", "") or random.choice(
        ["#2563eb", "#111827", "#d97706", "#059669", "#7c3aed", "#dc2626", "#0891b2", "#ea580c"])

    LAYOUT_MAP = {
        "Split hero (zdjecie po prawej)": "split",
        "Full-screen hero (zdjecie na caly ekran)": "full",
        "Centered (wszystko wyrodkowane)": "centered",
        "Dark mode (ciemne tlo)": "dark",
    }
    layout = LAYOUT_MAP.get(getattr(data, "layout", None) or "", "") or random.choice(["split", "full", "centered", "dark"])

    FONT_MAP = {
        "Inter + Playfair Display": "serif",
        "Inter + Playfair Display (serif)": "serif",
        "Inter (sans-serif only)": "clean",
        "DM Sans + Fraunces": "serif",
        "Space Grotesk + Lora": "mono",
        "Manrope + Cormorant": "serif",
    }
    vstyle = FONT_MAP.get(getattr(data, "fonts", None) or "", "") or random.choice(["serif", "clean", "mono", "brutalist"])
    if layout == "dark":
        vstyle = "mono"

    show = getattr(data, "sections", None) or ["Hero", "Oferta", "Cennik", "Opinie", "Kontakt"]
    if isinstance(show, str):
        show = [s.strip() for s in show.split(",")]

    niche_l = (niche or "").lower()
    is_rest = any(k in niche_l for k in ["restaurac", "kebab", "kurczaki", "ziemniaki", "jedzenie", "food", "pizzeria", "bistro", "kawiarni", "cafe"])
    is_barber = any(k in niche_l for k in ["barber", "fryzjer", "strzyz", "salon fryzj"])
    is_beauty = any(k in niche_l for k in ["beauty", "kosmetolog", "salon urod", "spa", "manicure", "paznokci"])

    if is_rest:
        cta = random.choice(["Zamow teraz", "Sprawdz menu", "Rezerwuj stolik"])
    elif is_barber:
        cta = random.choice(["Umow wizyte", "Rezerwuj termin"])
    elif is_beauty:
        cta = random.choice(["Umow wizyte", "Sprawdz oferte"])
    else:
        cta = random.choice(["Skontaktuj sie", "Napisz do nas"])

    # Content pools
    if is_rest:
        hero_imgs = ["https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1400&q=80",
                      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1400&q=80"]
        svc_imgs = ["https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80",
                     "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80",
                     "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&q=80"]
        svcs = [("Danie dnia", "Swieze skladniki, zmienia sie codziennie.", "18-22 zl"),
                ("Kurczaki", "Smazone na zloto, z surowka i pieczywem.", "16-25 zl"),
                ("Kebab", "Klasyczny, w bulce lub na talerzu.", "22-28 zl"),
                ("Zestaw rodzinny", "Cztery dania, surowki, napoje.", "79-99 zl")]
        hls = ["Jedzenie, do ktorego sie wraca", "Smak, ktory zapamietasz", "Tu sie je inaczej"]
        subs = ["Duze porcje, ceny bez niespodzianek.", "Swieze skladniki codziennie. Zero mrozonek."]
    elif is_barber:
        hero_imgs = ["https://images.unsplash.com/photo-1585747860019-024afab6236e?w=1400&q=80"]
        svc_imgs = ["https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=600&q=80",
                     "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=600&q=80",
                     "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&q=80"]
        svcs = [("Strzyzenie", "Dobierzemy fryzure do Twojej twarzy.", "50-65 zl"),
                ("Golenie brytwa", "Goracy recznik, balsam, brytwa.", "40-55 zl"),
                ("Trymowanie brody", "Kazdy wlosek na swoim miejscu.", "30-40 zl")]
        hls = ["Fryzura, ktora robi wrazenie", "Twoja broda zasluguje na mistrza"]
        subs = ["Od 12 lat strzyzemy mezczyzn.", "Brytwa, goracy recznik i mistrz fachu."]
    elif is_beauty:
        hero_imgs = ["https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1400&q=80"]
        svc_imgs = ["https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&q=80",
                     "https://images.unsplash.com/photo-1457972729786-0411a3b2b626?w=600&q=80",
                     "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80"]
        svcs = [("Manicure hybrydowy", "200+ odcieni. Trwalosc 3 tygodnie.", "80-100 zl"),
                ("Zabieg na twarz", "Oczyszczanie, nawilzenie.", "150-250 zl"),
                ("Pakiet SPA", "Manicure + pedicure + zabieg.", "280-400 zl")]
        hls = ["Twoje dlonie zasluguja na piekno", "Tu piekno spotyka precyzje"]
        subs = ["Salon urody z dbalocia o kazdy szczegol.", "Ponad 200 odcieni, trwalosc 3 tygodnie."]
    else:
        hero_imgs = ["https://images.unsplash.com/photo-1497366216548-37526070297c?w=1400&q=80"]
        svc_imgs = ["https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&q=80",
                     "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&q=80",
                     "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=600&q=80"]
        svcs = [("Strategia", "Analizujemy rynek i Twoje cele.", "3 000-5 000 zl"),
                ("Realizacja", "Od pomyslu po produkt.", "8 000-15 000 zl"),
                ("Audyt", "Sprawdzimy co nie dziala.", "2 000-4 000 zl")]
        hls = ["Twoj biznes zasluguje na wiecej", "Od pomyslu do pieniedzy"]
        subs = ["Pomagamy firmom rosnac.", "Widzimy trendy, zanim stan sie mainstreamem."]

    hero_img = random.choice(hero_imgs)
    headline = random.choice(hls)
    sub = random.choice(subs)
    chosen_svcs = random.sample(svcs, min(3, len(svcs)))

    rev_pool = [
        ("Najlepsze w okolicy! Polecam kazdemu.", "Marek K."),
        ("Staly klient. Ceny OK, obsluga super.", "Anna N."),
        ("Pierwszy raz - i na pewno nie ostatni.", "Tomek R."),
        ("Super atmosfera, szybka obsluga.", "Kasia W."),
        ("Polecam z czystym sumieniem.", "Piotr S."),
        ("Wracam co tydzien. Uzalezniona!", "Ola M."),
    ]
    chosen_reviews = random.sample(rev_pool, 3)

    # Pick template
    if vstyle == "mono":
        return _template_dark(bn, safe, niche, addr, phone, rating, reviews_n, title, year,
                              hero_img, headline, sub, chosen_svcs, svc_imgs, chosen_reviews, accent, cta, show)
    elif vstyle == "brutalist":
        return _template_brutalist(bn, safe, niche, addr, phone, rating, reviews_n, title, year,
                                   hero_img, headline, sub, chosen_svcs, svc_imgs, chosen_reviews, accent, cta, show)
    elif vstyle == "clean":
        return _template_minimal(bn, safe, niche, addr, phone, rating, reviews_n, title, year,
                                 hero_img, headline, sub, chosen_svcs, svc_imgs, chosen_reviews, accent, cta, show)
    else:
        return _template_editorial(bn, safe, niche, addr, phone, rating, reviews_n, title, year,
                                   hero_img, headline, sub, chosen_svcs, svc_imgs, chosen_reviews, accent, cta, show)


def _mk_svc_cards(svcs, svc_imgs, accent, style):
    cards = []
    for i, (nm, ds, pr) in enumerate(svcs):
        img = svc_imgs[i % len(svc_imgs)]
        if style == "brutalist":
            cards.append('<div style="border:3px solid #111;background:white"><div style="aspect-ratio:4/3;overflow:hidden;border-bottom:3px solid #111"><img src="' + img + '" alt="' + nm + '" style="width:100%;height:100%;object-cover"></div><div style="padding:20px"><h3 style="font-size:18px;font-weight:700;margin-bottom:6px">' + nm + '</h3><p style="font-size:14px;color:#555;line-height:1.5;margin-bottom:8px">' + ds + '</p><span style="font-weight:700;color:' + accent + '">' + pr + '</span></div></div>')
        elif style == "mono":
            cards.append('<div style="background:#141414;border:1px solid #333;border-radius:12px;padding:24px"><h3 style="font-size:17px;font-weight:600;margin-bottom:6px;color:#e5e5e5">' + nm + '</h3><p style="font-size:14px;color:#888;line-height:1.5;margin-bottom:10px">' + ds + '</p><span style="font-weight:600;color:' + accent + '">' + pr + '</span></div>')
        else:
            cards.append('<div style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.04)"><div style="aspect-ratio:4/3;overflow:hidden"><img src="' + img + '" alt="' + nm + '" style="width:100%;height:100%;object-cover"></div><div style="padding:20px"><h3 style="font-size:17px;font-weight:600;margin-bottom:6px">' + nm + '</h3><p style="font-size:14px;color:#666;line-height:1.5;margin-bottom:8px">' + ds + '</p><span style="font-weight:600;color:' + accent + '">' + pr + '</span></div></div>')
    gap = "0" if style == "brutalist" else "20px"
    return '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:' + gap + '">' + "".join(cards) + '</div>'


def _mk_reviews(reviews, accent, dark=False):
    cards = []
    tc = "#ccc" if dark else "#555"
    nc = "#e5e5e5" if dark else "#1a1a1a"
    for txt, ini in reviews:
        initials = ini.split()[0][0] + (ini.split()[-1][0] if len(ini.split()) > 1 else "")
        cards.append('<div style="padding:24px;border-left:3px solid ' + accent + '"><p style="font-size:16px;line-height:1.5;color:' + tc + ';margin-bottom:16px;font-style:italic">"' + txt + '"</p><div style="display:flex;align-items:center;gap:10px"><div style="width:36px;height:36px;border-radius:50%;background:' + accent + ';color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700">' + initials + '</div><div><p style="font-size:14px;font-weight:600;color:' + nc + '">' + ini + '</p><p style="font-size:11px;color:#999">Klient</p></div></div></div>')
    return '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px">' + "".join(cards) + '</div>'


def _mk_price_rows(svcs, accent, dark=False):
    rows = []
    for n, _, pr in svcs:
        tc = "#aaa" if dark else "#555"
        rows.append('<div style="display:flex;justify-content:space-between;padding:14px 0;border-bottom:1px solid ' + ('#333' if dark else '#eee') + '"><span style="font-size:15px;color:' + tc + '">' + n + '</span><span style="font-weight:700;color:' + accent + '">' + pr + '</span></div>')
    return "".join(rows)


def _mk_form(accent, dark=False):
    bg = "#141414" if dark else "white"
    bc = "#333" if dark else "#e0e0e0"
    tc = "#e5e5e5" if dark else "#1a1a1a"
    return '''<form style="background:''' + bg + ''';border:1px solid ''' + bc + ''';border-radius:16px;padding:32px">
<div style="margin-bottom:14px"><label style="display:block;font-size:12px;font-weight:600;color:#888;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">Imie</label><input type="text" placeholder="Jan Kowalski" style="width:100%;padding:12px;background:transparent;border:1px solid ''' + bc + ''';border-radius:10px;font-size:14px;color:''' + tc + ''';outline:none"></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
<div><label style="display:block;font-size:12px;font-weight:600;color:#888;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">Email</label><input type="email" placeholder="jan@firma.pl" style="width:100%;padding:12px;background:transparent;border:1px solid ''' + bc + ''';border-radius:10px;font-size:14px;color:''' + tc + ''';outline:none"></div>
<div><label style="display:block;font-size:12px;font-weight:600;color:#888;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">Telefon</label><input type="tel" placeholder="+48 123 456 789" style="width:100%;padding:12px;background:transparent;border:1px solid ''' + bc + ''';border-radius:10px;font-size:14px;color:''' + tc + ''';outline:none"></div></div>
<div style="margin-bottom:14px"><label style="display:block;font-size:12px;font-weight:600;color:#888;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">Wiadomosc</label><textarea rows="4" placeholder="W czym mozemy pomoc?" style="width:100%;padding:12px;background:transparent;border:1px solid ''' + bc + ''';border-radius:10px;font-size:14px;color:''' + tc + ''';outline:none;resize:none"></textarea></div>
<button type="submit" style="width:100%;padding:14px;background:''' + accent + ''';color:white;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer">Wyslij wiadomosc</button></form>'''


def _mk_contact(addr, phone, accent, dark=False):
    tc = "#e5e5e5" if dark else "#1a1a1a"
    return '''<div style="display:flex;flex-direction:column;gap:20px">
<div style="display:flex;gap:14px;align-items:start"><div style="width:40px;height:40px;border-radius:10px;background:''' + accent + '''15;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i data-lucide="map-pin" style="width:18px;height:18px;color:''' + accent + '''"></i></div><div><p style="font-weight:600;font-size:14px;color:''' + tc + '''">' + addr + '</p><p style="font-size:12px;color:#888;margin-top:2px">Dojazd</p></div></div>
<div style="display:flex;gap:14px;align-items:start"><div style="width:40px;height:40px;border-radius:10px;background:''' + accent + '''15;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i data-lucide="phone" style="width:18px;height:18px;color:''' + accent + '''"></i></div><div><a href="tel:' + phone + '" style="font-weight:600;font-size:14px;color:''' + accent + ''';text-decoration:none">' + phone + '</a><p style="font-size:12px;color:#888;margin-top:2px">Pon-Pt 8:00-18:00</p></div></div>
<div style="display:flex;gap:14px;align-items:start"><div style="width:40px;height:40px;border-radius:10px;background:''' + accent + '''15;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i data-lucide="clock" style="width:18px;height:18px;color:''' + accent + '''"></i></div><div><p style="font-weight:600;font-size:14px;color:''' + tc + '''">Pon-Sob: 10:00 - 22:00</p><p style="font-size:12px;color:#888;margin-top:2px">Niedziela: 12:00 - 20:00</p></div></div></div>'''


def _mk_reveal_script():
    return '''<script>
lucide.createIcons();
var o=new IntersectionObserver(function(e){e.forEach(function(x){if(x.isIntersecting){x.target.style.opacity='1';x.target.style.transform='translateY(0)';o.unobserve(x.target)}})},{threshold:.15});
document.querySelectorAll('[data-reveal]').forEach(function(el){o.observe(el)});
</script>'''


def _r(idx):
    return ' data-reveal style="opacity:0;transform:translateY(20px);transition:all .6s cubic-bezier(.16,1,.3,1);transition-delay:' + str(idx * .08) + 's"'


# ============================================================
# TEMPLATE: EDITORIAL - Playfair Display serif, warm tones
# ============================================================
def _template_editorial(bn, safe, niche, addr, phone, rating, reviews_n, title, year,
                        hero_img, headline, sub, svcs, svc_imgs, reviews, accent, cta, show):
    h = []
    h.append('<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">')
    h.append('<title>' + title + '</title>')
    h.append('<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">')
    h.append('<script src="https://unpkg.com/lucide@latest"></script>')
    h.append('<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:"DM Sans",sans-serif;color:#1a1a1a;background:#faf8f5;line-height:1.6}a{color:inherit;text-decoration:none}.serif{font-family:"Playfair Display",Georgia,serif}</style></head><body>')

    # Header
    h.append('<header style="position:fixed;top:0;width:100%;z-index:50;background:rgba(250,248,245,.92);backdrop-filter:blur(16px);border-bottom:1px solid rgba(0,0,0,.06)"><div style="max-width:1200px;margin:0 auto;padding:0 24px;height:64px;display:flex;align-items:center;justify-content:space-between"><div style="display:flex;align-items:center;gap:12px"><div style="width:36px;height:36px;border-radius:50%;background:' + accent + ';color:white;display:flex;align-items:center;justify-content:center;font-family:Playfair Display;font-weight:700;font-size:15px">' + safe[0] + '</div><span class="serif" style="font-weight:700;font-size:16px">' + safe + '</span></div><nav style="display:flex;gap:28px;font-size:13px;font-weight:500;color:#666"><a href="#oferta">Oferta</a><a href="#cennik">Cennik</a><a href="#opinie">Opinie</a><a href="#kontakt">Kontakt</a></nav><a href="tel:' + phone + '" style="padding:10px 20px;background:' + accent + ';color:white;border-radius:100px;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:8px"><i data-lucide="phone" style="width:14px;height:14px"></i>Zadzwon</a></div></header>')

    # Marquee
    h.append('<div style="overflow:hidden;white-space:nowrap;background:' + accent + ';color:white;padding:12px 0;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase"><div style="display:inline-block;animation:marquee 25s linear infinite"><span style="display:inline-block;padding:0 40px">' + safe + ' &middot; ' + niche + '</span><span style="display:inline-block;padding:0 40px">&#9733; ' + rating + ' (' + reviews_n + ' opinii)</span><span style="display:inline-block;padding:0 40px">' + safe + ' &middot; ' + niche + '</span><span style="display:inline-block;padding:0 40px">&#9733; ' + rating + ' (' + reviews_n + ' opinii)</span><span style="display:inline-block;padding:0 40px">' + safe + ' &middot; ' + niche + '</span><span style="display:inline-block;padding:0 40px">&#9733; ' + rating + ' (' + reviews_n + ' opinii)</span></div></div><style>@keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}</style>')

    # Hero
    if "Hero" in show:
        h.append('<section style="padding:120px 24px 80px;max-width:1200px;margin:0 auto"><div' + _r(0) + ' style="max-width:900px"><p style="font-size:12px;font-weight:600;letter-spacing:.15em;text-transform:uppercase;color:' + accent + ';margin-bottom:20px">' + niche + ' &middot; ' + addr + '</p><h1 class="serif" style="font-size:clamp(48px,8vw,96px);font-weight:900;line-height:.92;letter-spacing:-.03em;margin-bottom:24px">' + headline + '</h1><p style="font-size:18px;color:#666;max-width:540px;line-height:1.6;margin-bottom:36px">' + sub + '</p><div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center"><a href="#kontakt" style="padding:16px 32px;background:' + accent + ';color:white;border-radius:100px;font-weight:600;font-size:15px;display:inline-flex;align-items:center;gap:8px">' + cta + ' <i data-lucide="arrow-right" style="width:16px;height:16px"></i></a><div style="display:flex;align-items:center;gap:8px;font-size:14px;color:#999"><span style="color:#f59e0b">&#9733;&#9733;&#9733;&#9733;&#9733;</span><span style="font-weight:600;color:#1a1a1a">' + rating + '</span><span>&middot; ' + reviews_n + ' opinii</span></div></div></div><div' + _r(1) + ' style="margin-top:60px;border-radius:16px;overflow:hidden;aspect-ratio:21/9"><img src="' + hero_img + '" alt="' + safe + '" style="width:100%;height:100%;object-cover"></div></section>')

    # Oferta
    if "Oferta" in show:
        h.append('<section id="oferta" style="padding:80px 24px;background:white"><div style="max-width:1200px;margin:0 auto"><div' + _r(2) + ' style="margin-bottom:48px"><p style="font-size:12px;font-weight:600;letter-spacing:.15em;text-transform:uppercase;color:' + accent + ';margin-bottom:12px">Oferta</p><h2 class="serif" style="font-size:clamp(32px,5vw,56px);font-weight:900">Co przygotowalismy</h2></div><div' + _r(3) + '>' + _mk_svc_cards(svcs, svc_imgs, accent, "serif") + '</div></div></section>')

    # Cennik
    if "Cennik" in show:
        h.append('<section id="cennik" style="padding:80px 24px;background:' + accent + ';color:white"><div style="max-width:800px;margin:0 auto"><div' + _r(4) + ' style="margin-bottom:40px"><p style="font-size:12px;font-weight:600;letter-spacing:.15em;text-transform:uppercase;opacity:.6;margin-bottom:12px">Cennik</p><h2 class="serif" style="font-size:clamp(32px,5vw,48px);font-weight:900">Ile to kosztuje</h2></div><div' + _r(5) + ' style="border-top:1px solid rgba(255,255,255,.2)">' + _mk_price_rows(svcs, "white", False).replace("#eee", "rgba(255,255,255,.2)").replace("#555", "rgba(255,255,255,.7)") + '</div></div></section>')

    # Opinie
    if "Opinie" in show:
        h.append('<section id="opinie" style="padding:80px 24px"><div style="max-width:1200px;margin:0 auto"><div' + _r(6) + ' style="margin-bottom:48px"><p style="font-size:12px;font-weight:600;letter-spacing:.15em;text-transform:uppercase;color:' + accent + ';margin-bottom:12px">Opinie</p><h2 class="serif" style="font-size:clamp(32px,5vw,56px);font-weight:900">Co mowia klienci</h2></div><div' + _r(7) + '>' + _mk_reviews(reviews, accent) + '</div></div></section>')

    # Kontakt
    if "Kontakt" in show:
        h.append('<section id="kontakt" style="padding:80px 24px;background:#faf8f5"><div style="max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:60px"><div' + _r(8) + '><p style="font-size:12px;font-weight:600;letter-spacing:.15em;text-transform:uppercase;color:' + accent + ';margin-bottom:12px">Kontakt</p><h2 class="serif" style="font-size:clamp(32px,4vw,48px);font-weight:900;margin-bottom:28px">Porozmawiajmy</h2>' + _mk_contact(addr, phone, accent) + '</div><div' + _r(9) + '>' + _mk_form(accent) + '</div></div></section>')

    # Footer
    h.append('<footer style="padding:40px 24px;border-top:1px solid #e5e5e5"><div style="max-width:1200px;margin:0 auto;display:flex;justify-content:space-between;align-items:center"><p style="font-size:13px;color:#999">&copy; ' + year + ' ' + safe + '</p><div style="display:flex;gap:24px;font-size:13px;color:#999"><a href="#oferta">Oferta</a><a href="#cennik">Cennik</a><a href="#kontakt">Kontakt</a></div></div></footer>')
    h.append(_mk_reveal_script())
    h.append('</body></html>')

    return {"files": {"main/frontend/preview.html": "".join(h)}, "meta": {"title": title, "headline": headline, "subheadline": sub[:120], "ctaText": cta}}


# ============================================================
# TEMPLATE: DARK - Space Grotesk mono, dark background, neon accents
# ============================================================
def _template_dark(bn, safe, niche, addr, phone, rating, reviews_n, title, year,
                   hero_img, headline, sub, svcs, svc_imgs, reviews, accent, cta, show):
    h = []
    h.append('<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">')
    h.append('<title>' + title + '</title>')
    h.append('<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">')
    h.append('<script src="https://unpkg.com/lucide@latest"></script>')
    h.append('<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:"Space Grotesk",sans-serif;color:#e5e5e5;background:#0a0a0a;line-height:1.6}a{color:inherit;text-decoration:none}</style></head><body>')

    # Header
    h.append('<header style="position:fixed;top:0;width:100%;z-index:50;background:rgba(10,10,10,.85);backdrop-filter:blur(16px);border-bottom:1px solid #222"><div style="max-width:1200px;margin:0 auto;padding:0 24px;height:60px;display:flex;align-items:center;justify-content:space-between"><div style="display:flex;align-items:center;gap:10px"><div style="width:8px;height:8px;border-radius:50%;background:' + accent + ';box-shadow:0 0 12px ' + accent + ',0 0 40px ' + accent + '40"></div><span style="font-weight:700;font-size:15px">' + safe + '</span></div><nav style="display:flex;gap:28px;font-size:13px;color:#666"><a href="#oferta">Oferta</a><a href="#cennik">Cennik</a><a href="#opinie">Opinie</a><a href="#kontakt">Kontakt</a></nav><a href="tel:' + phone + '" style="padding:8px 16px;border:1px solid ' + accent + ';color:' + accent + ';border-radius:8px;font-size:13px;display:inline-flex;align-items:center;gap:6px"><i data-lucide="phone" style="width:14px;height:14px"></i>' + phone + '</a></div></header>')

    # Marquee
    h.append('<div style="overflow:hidden;white-space:nowrap;border-top:1px solid #222;border-bottom:1px solid #222;padding:12px 0;font-size:12px;color:#555;letter-spacing:.08em"><div style="display:inline-block;animation:marquee 30s linear infinite"><span style="display:inline-block;padding:0 48px">&bull; ' + safe + '</span><span style="display:inline-block;padding:0 48px">' + niche + '</span><span style="display:inline-block;padding:0 48px">&#9733; ' + rating + '</span><span style="display:inline-block;padding:0 48px">&bull; ' + safe + '</span><span style="display:inline-block;padding:0 48px">' + niche + '</span><span style="display:inline-block;padding:0 48px">&#9733; ' + rating + '</span><span style="display:inline-block;padding:0 48px">&bull; ' + safe + '</span><span style="display:inline-block;padding:0 48px">' + niche + '</span></div></div><style>@keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}</style>')

    # Hero
    if "Hero" in show:
        h.append('<section style="padding:140px 24px 100px;min-height:85vh;display:flex;align-items:center"><div style="max-width:1200px;margin:0 auto;width:100%"><div' + _r(0) + ' style="display:flex;align-items:center;gap:10px;margin-bottom:24px"><div style="width:8px;height:8px;border-radius:50%;background:' + accent + ';box-shadow:0 0 12px ' + accent + '"></div><span style="font-size:12px;color:#666;text-transform:uppercase;letter-spacing:.1em">' + niche + ' &middot; ' + addr + '</span></div><h1 style="font-size:clamp(52px,9vw,110px);font-weight:700;line-height:.88;letter-spacing:-.04em;margin-bottom:32px"' + _r(1) + '>' + headline + '</h1><p style="font-size:17px;color:#777;max-width:480px;line-height:1.7;margin-bottom:40px"' + _r(2) + '>' + sub + '</p><div' + _r(3) + ' style="display:flex;gap:16px;align-items:center"><a href="#kontakt" style="padding:16px 32px;background:' + accent + ';color:#0a0a0a;border-radius:8px;font-weight:600;font-size:15px;display:inline-flex;align-items:center;gap:8px">' + cta + ' <i data-lucide="arrow-right" style="width:16px;height:16px"></i></a><div style="display:flex;align-items:center;gap:6px;color:' + accent + ';font-weight:600;font-size:14px"><i data-lucide="star" style="width:16px;height:16px;fill:' + accent + '"></i>' + rating + ' <span style="color:#555;font-weight:400">&middot; ' + reviews_n + '</span></div></div></div></section>')

    # Oferta
    if "Oferta" in show:
        h.append('<section id="oferta" style="padding:80px 24px;border-top:1px solid #222"><div style="max-width:1200px;margin:0 auto"><div' + _r(4) + ' style="margin-bottom:40px"><p style="font-size:11px;color:' + accent + ';text-transform:uppercase;letter-spacing:.15em;margin-bottom:10px">01 &mdash; Oferta</p><h2 style="font-size:clamp(28px,4vw,44px);font-weight:700">Co mamy</h2></div><div' + _r(5) + '>' + _mk_svc_cards(svcs, svc_imgs, accent, "mono") + '</div></div></section>')

    # Cennik
    if "Cennik" in show:
        h.append('<section id="cennik" style="padding:80px 24px"><div style="max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1fr 1.2fr;gap:48px"><div' + _r(6) + '><p style="font-size:11px;color:' + accent + ';text-transform:uppercase;letter-spacing:.15em;margin-bottom:10px">02 &mdash; Cennik</p><h2 style="font-size:clamp(28px,4vw,44px);font-weight:700;margin-bottom:16px">Cennik</h2><p style="color:#666">Przejrzyste ceny.</p></div><div' + _r(7) + ' style="background:#141414;border:1px solid #333;border-radius:12px;padding:28px">' + _mk_price_rows(svcs, accent, True) + '</div></div></section>')

    # Opinie
    if "Opinie" in show:
        h.append('<section id="opinie" style="padding:80px 24px;border-top:1px solid #222;border-bottom:1px solid #222"><div style="max-width:1200px;margin:0 auto"><div' + _r(8) + ' style="margin-bottom:40px"><p style="font-size:11px;color:' + accent + ';text-transform:uppercase;letter-spacing:.15em;margin-bottom:10px">03 &mdash; Opinie</p><h2 style="font-size:clamp(28px,4vw,44px);font-weight:700">Klienci mowia</h2></div><div' + _r(9) + '>' + _mk_reviews(reviews, accent, True) + '</div></div></section>')

    # Kontakt
    if "Kontakt" in show:
        h.append('<section id="kontakt" style="padding:80px 24px"><div style="max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:60px"><div' + _r(10) + '><p style="font-size:11px;color:' + accent + ';text-transform:uppercase;letter-spacing:.15em;margin-bottom:10px">04 &mdash; Kontakt</p><h2 style="font-size:clamp(28px,4vw,48px);font-weight:700;margin-bottom:32px">Porozmawiajmy</h2>' + _mk_contact(addr, phone, accent, True) + '</div><div' + _r(11) + '>' + _mk_form(accent, True) + '</div></div></section>')

    # Footer
    h.append('<footer style="padding:32px 24px;border-top:1px solid #222"><div style="max-width:1200px;margin:0 auto;display:flex;justify-content:space-between;align-items:center"><div style="display:flex;align-items:center;gap:8px"><div style="width:6px;height:6px;border-radius:50%;background:' + accent + ';box-shadow:0 0 8px ' + accent + '"></div><span style="font-size:13px;color:#555">&copy; ' + year + ' ' + safe + '</span></div><div style="display:flex;gap:20px;font-size:12px;color:#444"><a href="#oferta">Oferta</a><a href="#cennik">Cennik</a><a href="#kontakt">Kontakt</a></div></div></footer>')
    h.append(_mk_reveal_script())
    h.append('</body></html>')

    return {"files": {"main/frontend/preview.html": "".join(h)}, "meta": {"title": title, "headline": headline, "subheadline": sub[:120], "ctaText": cta}}


# ============================================================
# TEMPLATE: BRUTALIST - Thick borders, offset shadows, raw feel
# ============================================================
def _template_brutalist(bn, safe, niche, addr, phone, rating, reviews_n, title, year,
                        hero_img, headline, sub, svcs, svc_imgs, reviews, accent, cta, show):
    h = []
    h.append('<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">')
    h.append('<title>' + title + '</title>')
    h.append('<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">')
    h.append('<script src="https://unpkg.com/lucide@latest"></script>')
    h.append('<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:"Space Grotesk",sans-serif;color:#111;background:#f5f0e8;line-height:1.6}a{color:inherit;text-decoration:none}.mono{font-family:"IBM Plex Mono",monospace}</style></head><body>')

    # Header
    h.append('<header style="position:fixed;top:0;width:100%;z-index:50;background:#f5f0e8;border-bottom:3px solid #111"><div style="max-width:1200px;margin:0 auto;padding:0 24px;height:60px;display:flex;align-items:center;justify-content:space-between"><span style="font-weight:700;font-size:18px;letter-spacing:-.03em">' + safe + '</span><div style="display:flex;gap:20px;align-items:center"><a href="#oferta" class="mono" style="font-size:12px">01 OFERTA</a><a href="#cennik" class="mono" style="font-size:12px">02 CENNIK</a><a href="#kontakt" class="mono" style="font-size:12px">03 KONTAKT</a><a href="tel:' + phone + '" style="padding:8px 16px;border:3px solid #111;background:white;font-size:13px;font-weight:600;box-shadow:4px 4px 0 #111;display:inline-flex;align-items:center;gap:6px"><i data-lucide="phone" style="width:14px;height:14px"></i>' + phone + '</a></div></div></header>')

    # Hero
    if "Hero" in show:
        h.append('<section style="padding:120px 24px 60px;min-height:85vh;display:flex;align-items:end"><div style="max-width:1200px;margin:0 auto;width:100%"><div' + _r(0) + ' style="display:inline-block;padding:6px 12px;border:2px solid #111;background:' + accent + ';margin-bottom:20px"><span class="mono" style="font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase">' + niche + '</span></div><h1 style="font-size:clamp(48px,10vw,120px);font-weight:700;line-height:.85;letter-spacing:-.05em;margin-bottom:24px;max-width:900px"' + _r(1) + '>' + headline + '</h1><div' + _r(2) + ' style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin-bottom:24px"><a href="#kontakt" style="padding:14px 28px;border:3px solid #111;background:' + accent + ';font-weight:700;font-size:15px;box-shadow:6px 6px 0 #111;display:inline-flex;align-items:center;gap:8px">' + cta + ' <i data-lucide="arrow-right" style="width:16px;height:16px"></i></a></div><div' + _r(3) + ' style="display:flex;gap:24px;align-items:center"><div style="padding:10px 16px;border:3px solid #111;background:white;box-shadow:4px 4px 0 #111;display:flex;align-items:center;gap:8px"><span style="color:' + accent + ';font-weight:700;font-size:18px">&#9733; ' + rating + '</span><span class="mono" style="font-size:12px;color:#666">(' + reviews_n + ')</span></div><span class="mono" style="font-size:12px;color:#666">' + addr + '</span></div><div style="margin-top:48px;border:3px solid #111;box-shadow:8px 8px 0 #111;overflow:hidden;aspect-ratio:21/9;max-height:360px"><img src="' + hero_img + '" alt="' + safe + '" style="width:100%;height:100%;object-cover"></div></div></section>')

    # Oferta
    if "Oferta" in show:
        h.append('<section id="oferta" style="padding:80px 24px;border-top:3px solid #111"><div style="max-width:1200px;margin:0 auto"><div' + _r(4) + ' style="display:flex;align-items:baseline;gap:16px;margin-bottom:48px"><span class="mono" style="font-size:13px;color:' + accent + ';font-weight:600">01</span><h2 style="font-size:clamp(28px,5vw,52px);font-weight:700;letter-spacing:-.03em">Oferta</h2></div><div' + _r(5) + '>' + _mk_svc_cards(svcs, svc_imgs, accent, "brutalist") + '</div></div></section>')

    # Cennik
    if "Cennik" in show:
        h.append('<section id="cennik" style="padding:80px 24px;border-top:3px solid #111;background:' + accent + '"><div style="max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1fr 1.2fr;gap:48px"><div' + _r(6) + '><span class="mono" style="font-size:13px;font-weight:600">02</span><h2 style="font-size:clamp(28px,5vw,52px);font-weight:700;letter-spacing:-.03em;margin-top:8px">Cennik</h2></div><div' + _r(7) + ' style="border:3px solid #111;background:white;padding:0">' + _mk_price_rows(svcs, "#111", False) + '</div></div></section>')

    # Opinie
    if "Opinie" in show:
        h.append('<section id="opinie" style="padding:80px 24px;border-top:3px solid #111"><div style="max-width:1200px;margin:0 auto"><div' + _r(8) + ' style="display:flex;align-items:baseline;gap:16px;margin-bottom:48px"><span class="mono" style="font-size:13px;color:' + accent + ';font-weight:600">03</span><h2 style="font-size:clamp(28px,5vw,52px);font-weight:700;letter-spacing:-.03em">Opinie</h2></div><div' + _r(9) + '>' + _mk_reviews(reviews, accent) + '</div></div></section>')

    # Kontakt
    if "Kontakt" in show:
        h.append('<section id="kontakt" style="padding:80px 24px;border-top:3px solid #111"><div style="max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:0"><div' + _r(10) + ' style="border:3px solid #111;padding:40px;background:' + accent + '"><span class="mono" style="font-size:13px;font-weight:600">04</span><h2 style="font-size:clamp(28px,4vw,48px);font-weight:700;letter-spacing:-.03em;margin-top:8px;margin-bottom:28px">Kontakt</h2>' + _mk_contact(addr, phone, accent) + '</div><div' + _r(11) + ' style="border:3px solid #111;border-left:0;padding:40px;background:white">' + _mk_form(accent) + '</div></div></section>')

    # Footer
    h.append('<footer style="padding:24px;border-top:3px solid #111;background:#111;color:#999"><div style="max-width:1200px;margin:0 auto;display:flex;justify-content:space-between;align-items:center"><span class="mono" style="font-size:12px">&copy; ' + year + ' ' + safe + '</span><div style="display:flex;gap:20px;font-size:12px"><a href="#oferta" style="color:#666">Oferta</a><a href="#cennik" style="color:#666">Cennik</a><a href="#kontakt" style="color:#666">Kontakt</a></div></div></footer>')
    h.append(_mk_reveal_script())
    h.append('</body></html>')

    return {"files": {"main/frontend/preview.html": "".join(h)}, "meta": {"title": title, "headline": headline, "subheadline": sub[:120], "ctaText": cta}}


# ============================================================
# TEMPLATE: MINIMAL - Inter only, lots of whitespace, subtle
# ============================================================
def _template_minimal(bn, safe, niche, addr, phone, rating, reviews_n, title, year,
                      hero_img, headline, sub, svcs, svc_imgs, reviews, accent, cta, show):
    h = []
    h.append('<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">')
    h.append('<title>' + title + '</title>')
    h.append('<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">')
    h.append('<script src="https://unpkg.com/lucide@latest"></script>')
    h.append('<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Inter,sans-serif;color:#111;background:white;line-height:1.6}a{color:inherit;text-decoration:none}</style></head><body>')

    # Header - minimal
    h.append('<header style="position:fixed;top:0;width:100%;z-index:50;background:rgba(255,255,255,.9);backdrop-filter:blur(12px);border-bottom:1px solid #f0f0f0"><div style="max-width:900px;margin:0 auto;padding:0 24px;height:56px;display:flex;align-items:center;justify-content:space-between"><span style="font-weight:600;font-size:14px;letter-spacing:-.02em">' + safe + '</span><div style="display:flex;gap:24px;align-items:center;font-size:13px;color:#888"><a href="#oferta">Oferta</a><a href="#cennik">Cennik</a><a href="#kontakt">Kontakt</a><a href="tel:' + phone + '" style="padding:8px 16px;background:#111;color:white;border-radius:8px;font-size:13px;font-weight:500"><i data-lucide="phone" style="width:13px;height:13px;vertical-align:-2px"></i> Zadzwon</a></div></div></header>')

    # Hero - centered, large type
    if "Hero" in show:
        h.append('<section style="padding:160px 24px 100px;max-width:800px;margin:0 auto;text-align:center"><div' + _r(0) + '><p style="font-size:13px;font-weight:500;color:' + accent + ';margin-bottom:16px">' + niche + '</p><h1 style="font-size:clamp(40px,7vw,72px);font-weight:700;line-height:1;letter-spacing:-.03em;margin-bottom:20px">' + headline + '</h1><p style="font-size:17px;color:#888;max-width:500px;margin:0 auto 40px;line-height:1.6">' + sub + '</p><a href="#kontakt" style="padding:14px 28px;background:#111;color:white;border-radius:10px;font-weight:600;font-size:15px;display:inline-flex;align-items:center;gap:8px">' + cta + ' <i data-lucide="arrow-right" style="width:16px;height:16px"></i></a><div style="margin-top:24px;font-size:14px;color:#bbb"><span style="color:#f59e0b">&#9733;</span> ' + rating + ' (' + reviews_n + ' opinii)</div></div></section>')

    # Hero image - full width
    if "Hero" in show:
        h.append('<div' + _r(1) + ' style="max-width:1100px;margin:0 auto 80px;padding:0 24px"><div style="border-radius:20px;overflow:hidden;aspect-ratio:2/1"><img src="' + hero_img + '" alt="' + safe + '" style="width:100%;height:100%;object-cover"></div></div>')

    # Oferta
    if "Oferta" in show:
        h.append('<section id="oferta" style="padding:0 24px 80px;max-width:900px;margin:0 auto"><div' + _r(2) + ' style="margin-bottom:40px"><h2 style="font-size:28px;font-weight:700">Oferta</h2></div><div' + _r(3) + '>' + _mk_svc_cards(svcs, svc_imgs, accent, "clean") + '</div></section>')

    # Cennik
    if "Cennik" in show:
        h.append('<section id="cennik" style="padding:80px 24px;background:#fafafa"><div style="max-width:900px;margin:0 auto"><div' + _r(4) + ' style="margin-bottom:32px"><h2 style="font-size:28px;font-weight:700">Cennik</h2><p style="color:#888;margin-top:8px">Jasne ceny, zero niespodzianek.</p></div><div' + _r(5) + ' style="background:white;border-radius:16px;padding:28px;border:1px solid #f0f0f0">' + _mk_price_rows(svcs, accent) + '</div></div></section>')

    # Opinie
    if "Opinie" in show:
        h.append('<section id="opinie" style="padding:80px 24px"><div style="max-width:900px;margin:0 auto"><div' + _r(6) + ' style="margin-bottom:40px"><h2 style="font-size:28px;font-weight:700">Opinie</h2></div><div' + _r(7) + '>' + _mk_reviews(reviews, accent) + '</div></div></section>')

    # Kontakt
    if "Kontakt" in show:
        h.append('<section id="kontakt" style="padding:80px 24px;background:#fafafa"><div style="max-width:900px;margin:0 auto"><div' + _r(8) + ' style="margin-bottom:32px"><h2 style="font-size:28px;font-weight:700">Kontakt</h2></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:40px"><div' + _r(9) + '>' + _mk_contact(addr, phone, accent) + '</div><div' + _r(10) + '>' + _mk_form(accent) + '</div></div></div></section>')

    # Footer
    h.append('<footer style="padding:40px 24px;border-top:1px solid #f0f0f0"><div style="max-width:900px;margin:0 auto;display:flex;justify-content:space-between;align-items:center"><p style="font-size:13px;color:#bbb">&copy; ' + year + ' ' + safe + '</p><div style="display:flex;gap:20px;font-size:13px;color:#bbb"><a href="#oferta">Oferta</a><a href="#cennik">Cennik</a><a href="#kontakt">Kontakt</a></div></div></footer>')
    h.append(_mk_reveal_script())
    h.append('</body></html>')

    return {"files": {"main/frontend/preview.html": "".join(h)}, "meta": {"title": title, "headline": headline, "subheadline": sub[:120], "ctaText": cta}}
