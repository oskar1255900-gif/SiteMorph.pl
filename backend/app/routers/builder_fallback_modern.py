import re
import time


def fallback_content(data):
    """Modern 2024 fallback — gradients, glassmorphism, smooth animations."""
    import random

    src = (data.extraPrompt or "") + " " + (data.description or "")
    def _extract(pattern, default=None):
        m = re.search(pattern, src, re.I | re.S)
        if not m: return default
        try: return (m.group(1) if m.lastindex else m.group(0)).strip()
        except: return m.group(0).strip()

    m2 = re.search(r'dla firmy\s*["„"]([^"""]+)[""""]', src, re.I)
    bn = m2.group(1).strip() if m2 and len(m2.group(1).strip()) > 2 and "Branż" not in m2.group(1) else (data.business_name or "Twoja Firma")
    if bn.lower() in ("restauracja","kawiarnia","piekarnia","barber","salon","siłownia","warsztat"):
        ef = (data.extraPrompt or "").split("\n")[0][:60] if data.extraPrompt else ""
        if ef and len(ef) > 3: bn = ef

    parsed_addr = _extract(r'(?:ul\.?\s*)?[A-ZĄ-ź][a-zą-ź\s]+\s+\d+[a-z]?[/\s]*\d*-?\d*\s*[Łódź]')
    if not parsed_addr: parsed_addr = _extract(r'\d{2}-\d{3}\s+[A-ZĄ-ź][a-zą-ź]+')
    parsed_phone = _extract(r'(?:\+?48[\s-]?)?\d{3}[\s-]?\d{3}[\s-]?\d{3}')
    rating_m = re.search(r'(\d[,\.]\d)\s*\((\d+)\)', src)
    rating = rating_m.group(1).replace(',','.') if rating_m else "4.8"
    reviews_n = rating_m.group(2) if rating_m else "127"
    niche = data.niche or "Usługi lokalne"
    title = f"{bn} - {niche}"
    year = time.strftime("%Y")
    safe = (bn or "Site").strip()[:30] or "Site"
    addr = parsed_addr or "Adres do uzupełnienia"
    phone = parsed_phone or "+48 000 000 000"

    accent = random.choice(["#2563eb","#111827","#d97706","#059669","#7c3aed","#dc2626","#0891b2","#c026d3","#ea580c","#0d9488","#6366f1","#e11d48"])
    # 4 different visual styles
    visual_style = random.choice(["editorial", "dark-bold", "color-block", "brutalist"])
    layout = random.choice(["split","centered","full","dark"])
    anim = random.choice(["morph","float","glow","slide"])

    niche_l = (niche or "").lower()
    is_rest = any(k in niche_l for k in ["restaurac","kebab","kurczaki","ziemniaki","jedzenie","food","pizzeria","bistro","kawiarni","cafe"])
    is_barber = any(k in niche_l for k in ["barber","fryzjer","strzyż","salon fryzj"])
    is_beauty = any(k in niche_l for k in ["beauty","kosmetolog","salon urod","spa","manicure","paznokci"])

    # Dynamic content pools
    if is_rest:
        hero_imgs = ["https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1400&q=80","https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1400&q=80","https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1400&q=80"]
        food_imgs = ["https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80","https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80","https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=600&q=80","https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=600&q=80"]
        svc_pool = [
            ("Danie dnia","Świeże, sezonowe składniki. Zmienia się codziennie — zawsze jest w czym wybierać.","od 18 zł","utensils"),
            ("Kurczaki","Smażone na złoto, z surówką i pieczywem. Porcja, po której nie wstaniesz od stołu.","od 16 zł","flame"),
            ("Kebab","Klasyczny, w bułce lub na talerzu. Trzy sosy do wyboru — każdy inny, każdy dobry.","od 22 zł","star"),
            ("Zestaw rodzinny","Cztery dania, surówki, napoje. Rodzinny obiad bez gotowania.","od 79 zł","heart"),
            ("Desery","Domowe ciasta i lody. Słodkie zakończenie, które zapamiętasz.","od 12 zł","sparkles"),
        ]
        price_pool = [("Danie dnia","18-22 zł"),("Kebab w bułce","22 zł"),("Kurczak + frytki","25 zł"),("Zestaw rodzinny","79-99 zł"),("Surówka","5-8 zł"),("Napój","4-6 zł"),("Deser","12-18 zł")]
        headline_pool = ["Jedzenie, do którego się wraca","Smak, który zapamiętasz","Tu się je inaczej","Prawdziwy smak, prawdziwe ceny","Gdzie apetyt rośnie z każdym kęsem","Kęs, który zmieni Twój dzień","Tu nie ma kompromisów — jest smak"]
        sub_pool = ["Od 15 lat karmimy mieszkańców. Duże porcje, ceny bez niespodzianek.","Świeże składniki codziennie. Zero mrożonek. Przyjdź i sprawdź.","Duże porcje w cenach, które nie przerażają.","Gotujemy jak w domu, tylko lepiej. Przyjdź głodny, wyjdź szczęśliwy."]
    elif is_barber:
        hero_imgs = ["https://images.unsplash.com/photo-1585747860019-024afab6236e?w=1400&q=80","https://images.unsplash.com/photo-1593702288056-7927b442d0fa?w=1400&q=80"]
        food_imgs = ["https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=600&q=80","https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=600&q=80","https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&q=80"]
        svc_pool = [("Strzyżenie","Dobierzemy fryzurę do Twojej twarzy i stylu życia. Doradztwo gratis.","od 50 zł","scissors"),("Golenie brzytwą","Gorący ręcznik, balsam, brzytwa. Rytuał, który pokochasz.","od 40 zł","sparkles"),("Trymowanie brody","Każdy włosek na swoim miejscu. Precyzja i styl.","od 30 zł","star"),("Pakiet full","Strzyżenie + golenie + modelowanie. Wyjdziesz nowy człowiek.","od 90 zł","heart")]
        price_pool = [("Strzyżenie męskie","50-65 zł"),("Golenie brzytwą","40-55 zł"),("Trymowanie brody","30-40 zł"),("Strzyżenie + golenie","80-95 zł"),("Koloryzacja","120-180 zł")]
        headline_pool = ["Fryzura, która robi wrażenie","Twoja broda zasługuje na mistrza","Tu się strzyże inaczej","Wyjdź nowy człowiek","Styl zaczyna się od włosów","Broda jak z katalogu"]
        sub_pool = ["Od 12 lat strzyżemy mężczyzn. Znamy się na trendach i na brodach.","Brzytwa, gorący ręcznik i mistrz fachu. Twój barber zna się na rzeczy.","Strzyżenie to nie tylko włosy — to Twój styl."]
    elif is_beauty:
        hero_imgs = ["https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1400&q=80","https://images.unsplash.com/photo-1487412912498-0447578fcca8?w=1400&q=80"]
        food_imgs = ["https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&q=80","https://images.unsplash.com/photo-1457972729786-0411a3b2b626?w=600&q=80","https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80"]
        svc_pool = [("Manicure hybrydowy","200+ odcieni. Trwałość 3 tygodnie. Twoje dłonie będą mówić same za siebie.","od 80 zł","sparkles"),("Zabieg na twarz","Oczyszczanie, nawilżenie, odmładzanie. Dobieramy pod typ Twojej skóry.","od 150 zł","heart"),("Depilacja woskiem","Szybko, na długo, bez podrażnień.","od 60 zł","star"),("Pakiet SPA","Manicure + pedicure + zabieg na twarz. Dzień tylko dla Ciebie.","od 280 zł","flame")]
        price_pool = [("Manicure hybrydowy","80-100 zł"),("Manicure + pedicure","140-180 zł"),("Zabieg na twarz","150-250 zł"),("Depilacja nóg","100-150 zł"),("Pakiet SPA","280-400 zł")]
        headline_pool = ["Twoje dłonie zasługują na piękno","Zadbaj o siebie — my zadbamy o detale","Tu piękno spotyka precyzję","Manicure, który robi wrażenie","Dzień tylko dla Ciebie","Piękno to nie luksus — to norma"]
        sub_pool = ["Salon urody, w którym jakość spotyka się z dbałością o każdy szczegół.","Ponad 200 odcieni, trwałość 3 tygodnie.","Zabiegi na twarz, dłonie i ciało. Dobieramy pod Twój typ skóry."]
    else:
        hero_imgs = ["https://images.unsplash.com/photo-1497366216548-37526070297c?w=1400&q=80","https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1400&q=80","https://images.unsplash.com/photo-1497215842964-222b430dc094?w=1400&q=80"]
        food_imgs = ["https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&q=80","https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&q=80","https://images.unsplash.com/photo-1553877522-43269d4ea984?w=600&q=80"]
        svc_pool = [("Strategia","Analizujemy rynek i Twoje cele. Plan, który przynosi kasę.","od 3 000 zł","zap"),("Realizacja","Od pomysłu po produkt. Jeden zespół, zero chaosu.","od 8 000 zł","sparkles"),("Wsparcie","Po wdrożeniu nie zostawiamy Cię. Aktualizacje, pomoc 24/7.","od 1 500 zł/mies.","shield"),("Audyt","Sprawdzimy co nie działa i powiemy jak to naprawić.","od 2 000 zł","star")]
        price_pool = [("Pakiet startowy","3 000-5 000 zł"),("Pakiet business","8 000-15 000 zł"),("Pakiet premium","15 000-30 000 zł"),("Konsultacja","500-1 000 zł"),("Wsparcie miesięczne","1 500-3 000 zł/mies.")]
        headline_pool = ["Twój biznes zasługuje na więcej","Nie czekaj na klienta — przyciągnij go","Strategia, która przynosi rezultaty","Od pomysłu do pieniędzy","Bądź o krok przed konkurencją","Twój Next Level zaczyna się tutaj"]
        sub_pool = ["Pomagamy firmom rosnąć. Strategia, projektowanie, realizacja.","Nie daj się konkurencji. Zbudujemy narzędzia, które sprzedają za Ciebie.","Widzimy trendy, zanim staną się mainstreamem."]

    hero_img = random.choice(hero_imgs)
    headline = random.choice(headline_pool)
    sub = random.choice(sub_pool)
    chosen_svc = random.sample(svc_pool, min(3, len(svc_pool)))
    chosen_prices = random.sample(price_pool, min(4, len(price_pool)))

    review_pool = [
        ("Najlepsze w okolicy! Polecam każdemu.","Marek K.","MK"),("Stały klient. Ceny OK, obsługa super.","Anna N.","AN"),
        ("Pierwszy raz — wrócę na pewno!","Tomek R.","TR"),("Super atmosfera, szybka obsługa.","Kasia W.","KW"),
        ("Mój znajomy polecił — i miał rację!","Piotr S.","PS"),("Szukałam czegoś dobrego — znalazłam.","Ola M.","OM"),
        ("Chodzę co tydzień. Uzależniona!","Tomek L.","TL"),("Żona zabrała mnie — i nie żałuję.","Jakub D.","JD"),
        ("Duże porcje, małe ceny. Dzieciaki zachwycone.","Marta B.","MB"),("Jakość idzie w parze z ceną.","Arek Z.","AZ"),
        ("Polecam z czystym sumieniem.","Kasia P.","KP"),("Odkryłam to miesiąc temu. Jestem uzależniona.","Natalia F.","NF"),
    ]
    chosen_reviews = random.sample(review_pool, 3)

    # Visual style variables
    if visual_style == "editorial":
        font_stack = "'Playfair Display',Georgia,serif"
        body_color = "#1a1a1a"
        body_bg = "#faf8f5"
        header_bg = "rgba(250,248,245,.92)"
        header_border = "1px solid rgba(0,0,0,.06)"
        section_bg = "white"
        section_alt_bg = "#faf8f5"
        card_text = "#666"
    elif visual_style == "dark-bold":
        font_stack = "'Space Grotesk',system-ui,sans-serif"
        body_color = "#e5e5e5"
        body_bg = "#0a0a0a"
        header_bg = "rgba(10,10,10,.85)"
        header_border = "1px solid #222"
        section_bg = "#0f0f0f"
        section_alt_bg = "#141414"
        card_text = "#aaa"
    elif visual_style == "color-block":
        font_stack = "'Outfit',system-ui,sans-serif"
        body_color = "#1a1a1a"
        body_bg = "white"
        header_bg = accent
        header_border = "none"
        section_bg = "#f8f8f8"
        section_alt_bg = accent
        card_text = "#555"
    else:  # brutalist
        font_stack = "'Space Grotesk',system-ui,sans-serif"
        body_color = "#111"
        body_bg = "#f5f0e8"
        header_bg = "#f5f0e8"
        header_border = "3px solid #111"
        section_bg = "white"
        section_alt_bg = "#f5f0e8"
        card_text = "#444"

    # Build service cards
    svc_cards = ""
    for i, (nm, ds, pr, icon) in enumerate(chosen_svc):
        img = food_imgs[i % len(food_imgs)]
        svc_cards += f'<div class="group relative"><div class="aspect-[4/3] rounded-2xl overflow-hidden mb-4"><img src="{img}" alt="{nm}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"/></div><div class="flex items-center gap-2.5 mb-2"><i data-lucide="{icon}" class="w-5 h-5" style="color:{accent}"></i><h3 class="font-semibold text-[15px]">{nm}</h3></div><p class="text-gray-500 text-sm leading-relaxed mb-2">{ds}</p><span class="text-sm font-semibold" style="color:{accent}">{pr}</span></div>'

    price_rows = "".join(f'<div class="flex justify-between items-center py-4 border-b border-gray-100/60 last:border-0"><span class="text-gray-600 text-[15px]">{n}</span><span class="font-semibold" style="color:{accent}">{p}</span></div>' for n, p in chosen_prices)

    rev_cards = ""
    for txt, nm, ini in chosen_reviews:
        rev_cards += f'<div class="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-100/50"><div class="flex items-center gap-0.5 text-amber-400 mb-3"><i data-lucide="star" class="w-4 h-4 fill-amber-400"></i><i data-lucide="star" class="w-4 h-4 fill-amber-400"></i><i data-lucide="star" class="w-4 h-4 fill-amber-400"></i><i data-lucide="star" class="w-4 h-4 fill-amber-400"></i><i data-lucide="star" class="w-4 h-4 fill-amber-400"></i></div><p class="text-gray-600 text-sm leading-relaxed mb-4 italic">"{txt}"</p><div class="flex items-center gap-3"><div class="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-white" style="background:{accent}">{ini}</div><div><p class="text-sm font-medium">{nm}</p><p class="text-xs text-gray-400">Klient</p></div></div></div>'

    # Animation CSS
    anim_css = {
        "morph": "@keyframes morph{0%,100%{border-radius:60% 40% 30% 70%/60% 30% 70% 40%}50%{border-radius:30% 60% 70% 40%/50% 60% 30% 60%}} .blob{animation:morph 8s ease-in-out infinite}",
        "float": "@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}} .float{animation:float 4s ease-in-out infinite}",
        "glow": f"@keyframes glow{{0%,100%{{box-shadow:0 0 0 0 {accent}30}}50%{{box-shadow:0 0 30px 8px {accent}15}}}} .glow{{animation:glow 3s ease-in-out infinite}}",
        "slide": "@keyframes slide{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}} .slide{animation:slide .8s ease forwards}",
    }[anim]

    # Hero section based on layout
    if layout == "dark":
        hero_section = f'''<section class="relative min-h-[85vh] flex items-center overflow-hidden" style="background:{body_bg}">
<img src="{hero_img}" alt="{safe}" class="absolute inset-0 w-full h-full object-cover opacity-20"/>
<div class="absolute inset-0 bg-gradient-to-b from-black/60 via-black/80 to-black"/>
<div class="max-w-6xl mx-auto px-6 relative z-10 text-center fade-up">
<p class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur border border-white/10 text-xs font-medium text-white/70 mb-8"><i data-lucide="map-pin" class="w-3.5 h-3.5"></i>{niche} · {addr}</p>
<h1 class="text-5xl md:text-7xl lg:text-8xl font-bold leading-[0.9] tracking-tight mb-6" style="color:{body_color}">{headline}</h1>
<p class="text-lg mb-10 max-w-2xl mx-auto leading-relaxed" style="color:{body_color};opacity:.6">{sub}</p>
<div class="flex flex-wrap gap-4 justify-center mb-10"><a href="#kontakt" class="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-lg font-semibold transition-all hover:scale-105 hover:shadow-2xl shadow-lg" style="background:{accent};color:white">Skontaktuj się <i data-lucide="arrow-right" class="w-5 h-5"></i></a><a href="#oferta" class="px-8 py-4 rounded-2xl border-2 border-white/20 text-lg font-semibold text-white hover:bg-white/10 transition-all">Zobacz ofertę</a></div>
<div class="flex items-center gap-3 justify-center text-white/70"><div class="flex items-center gap-0.5 text-amber-400"><i data-lucide="star" class="w-5 h-5 fill-amber-400"></i></div><span class="font-semibold text-white">{rating}</span><span>· {reviews_n} opinii</span></div></div></section>'''
    elif layout == "centered":
        hero_section = f'''<section class="pt-28 pb-20 md:pt-36 md:pb-28 bg-gradient-to-b from-gray-50 to-white">
<div class="max-w-4xl mx-auto px-6 text-center fade-up">
<p class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-gray-200 text-xs font-medium text-gray-500 mb-8 shadow-sm"><i data-lucide="map-pin" class="w-3.5 h-3.5" style="color:{accent}"></i>{niche} · {addr}</p>
<h1 class="text-5xl md:text-7xl lg:text-8xl font-bold leading-[0.9] tracking-tight mb-6">{headline}</h1>
<p class="text-lg text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">{sub}</p>
<div class="flex flex-wrap gap-4 justify-center mb-10"><a href="#kontakt" class="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-lg font-semibold text-white transition-all hover:scale-105 hover:shadow-2xl shadow-lg" style="background:{accent}">Skontaktuj się <i data-lucide="arrow-right" class="w-5 h-5"></i></a><a href="#oferta" class="px-8 py-4 rounded-2xl border-2 border-gray-200 text-lg font-semibold text-gray-700 hover:border-gray-400 transition-all">Zobacz ofertę</a></div>
<div class="flex items-center gap-3 justify-center text-sm text-gray-400"><div class="flex items-center gap-0.5 text-amber-400"><i data-lucide="star" class="w-4 h-4 fill-amber-400"></i></div><span class="font-medium text-gray-700">{rating}</span><span>· {reviews_n} opinii na Google</span></div>
<div class="mt-12 aspect-video rounded-3xl overflow-hidden max-w-3xl mx-auto shadow-2xl"><img src="{hero_img}" alt="{safe}" class="w-full h-full object-cover"/></div></div></section>'''
    else:  # split or split-left
        hero_section = f'''<section class="pt-28 pb-20 md:pt-36 md:pb-28">
<div class="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
<div class="fade-up">
<p class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-xs font-medium text-gray-500 mb-6"><i data-lucide="map-pin" class="w-3.5 h-3.5" style="color:{accent}"></i>{niche} · {addr}</p>
<h1 class="text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight mb-5">{headline}</h1>
<p class="text-gray-500 text-base md:text-lg leading-relaxed mb-8 max-w-md">{sub}</p>
<div class="flex flex-wrap gap-3 mb-8"><a href="#kontakt" class="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-semibold text-white transition-all hover:scale-105 hover:shadow-xl shadow-lg" style="background:{accent}">Skontaktuj się <i data-lucide="arrow-right" class="w-4 h-4"></i></a><a href="#oferta" class="px-6 py-3.5 rounded-2xl border-2 border-gray-200 text-sm font-semibold text-gray-700 hover:border-gray-400 transition-all">Zobacz ofertę</a></div>
<div class="flex items-center gap-2.5 text-sm"><div class="flex items-center gap-0.5 text-amber-400"><i data-lucide="star" class="w-4 h-4 fill-amber-400"></i></div><span class="font-medium">{rating}</span><span class="text-gray-400">· {reviews_n} opinii</span></div></div>
<div class="fade-up relative"><div class="absolute -inset-4 rounded-3xl opacity-20 blur-2xl" style="background:linear-gradient(135deg,{accent}30,transparent)"></div><div class="relative rounded-3xl overflow-hidden shadow-2xl"><img src="{hero_img}" alt="{safe}" class="w-full h-[420px] md:h-[480px] object-cover"/></div></div></div></section>'''

    # Build complete HTML
    html = f'''<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Space+Grotesk:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://unpkg.com/lucide@latest"></script>
<style>
*{{margin:0;padding:0;box-sizing:border-box;scroll-behavior:smooth}}
body{{font-family:'Inter',system-ui,sans-serif;color:#111827;line-height:1.6;background:#fafafa}}
.fade-up{{opacity:0;transform:translateY(24px);transition:opacity .6s cubic-bezier(.16,1,.3,1),transform .6s cubic-bezier(.16,1,.3,1)}}
.fade-up.visible{{opacity:1;transform:translateY(0)}}
.fade-up-d1{{transition-delay:.1s}}.fade-up-d2{{transition-delay:.2s}}.fade-up-d3{{transition-delay:.3s}}
{anim_css}
.glass{{background:rgba(255,255,255,.8);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}}
.shadow-modern{{box-shadow:0 4px 6px -1px rgba(0,0,0,.05),0 10px 15px -3px rgba(0,0,0,.05),0 20px 25px -5px rgba(0,0,0,.03)}}
.shadow-modern-lg{{box-shadow:0 10px 15px -3px rgba(0,0,0,.08),0 20px 25px -5px rgba(0,0,0,.04)}}
</style>
</head>
<body>
<header class="fixed top-0 w-full z-50 glass" style="background:{header_bg};border-bottom:{header_border}">
<div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
<div class="flex items-center gap-3">
<div class="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-modern" style="background:linear-gradient(135deg,{accent},{accent}bb)">{safe[0]}</div>
<span class="font-bold text-sm">{safe}</span></div>
<nav class="hidden md:flex items-center gap-8 text-sm text-gray-500">
<a href="#oferta" class="hover:text-gray-900 transition-colors">Oferta</a>
<a href="#cennik" class="hover:text-gray-900 transition-colors">Cennik</a>
<a href="#opinie" class="hover:text-gray-900 transition-colors">Opinie</a>
<a href="#kontakt" class="hover:text-gray-900 transition-colors">Kontakt</a></nav>
<a href="tel:{phone}" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg" style="background:{accent}"><i data-lucide="phone" class="w-4 h-4"></i>Zadzwoń</a></div></header>

{hero_section}

<section id="oferta" class="py-20 md:py-28" style="background:{section_bg}">
<div class="max-w-6xl mx-auto px-6">
<div class="fade-up mb-14"><p class="text-xs font-semibold tracking-wider uppercase mb-3" style="color:{accent}">Oferta</p><h2 class="text-3xl md:text-4xl font-bold tracking-tight">{random.choice(["Co dla Ciebie przygotowaliśmy","Nasza oferta","Co mamy w ofercie","Sprawdź naszą ofertę"])}</h2></div>
<div class="fade-up grid sm:grid-cols-2 lg:grid-cols-3 gap-8">{svc_cards}</div></div></section>

<section id="cennik" class="py-20 md:py-28" style="background:{section_alt_bg}">
<div class="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-start">
<div class="fade-up"><p class="text-xs font-semibold tracking-wider uppercase mb-3" style="color:{accent}">Cennik</p><h2 class="text-3xl md:text-4xl font-bold tracking-tight mb-3">Ile to kosztuje</h2><p class="text-gray-500 mb-6">{random.choice(["Przejrzyste ceny — bez niespodzianek.","Jasny cennik, zero ukrytych kosztów.","Co ile kosztuje? Sprawdź poniżej."])}</p>
<div class="flex items-center gap-2 text-sm text-gray-500"><i data-lucide="phone" class="w-4 h-4" style="color:{accent}"></i><span>Pytaj: <a href="tel:{phone}" class="font-semibold" style="color:{accent}">{phone}</a></span></div></div>
<div class="fade-up bg-white rounded-2xl p-6 md:p-8 shadow-modern border border-gray-100">{price_rows}</div></div></section>

<section id="opinie" class="py-20 md:py-28" style="background:{section_bg}"
<div class="max-w-6xl mx-auto px-6">
<div class="fade-up mb-14"><p class="text-xs font-semibold tracking-wider uppercase mb-3" style="color:{accent}">Opinie</p><h2 class="text-3xl md:text-4xl font-bold tracking-tight">{random.choice(["Co mówią nasi klienci","Opinie klientów","Klienci polecają nas dalej"])}</h2><p class="text-gray-500 mt-2">{reviews_n} zadowolonych klientów nie kłamie.</p></div>
<div class="fade-up grid sm:grid-cols-2 lg:grid-cols-3 gap-6">{rev_cards}</div></div></section>

<section id="kontakt" class="py-20 md:py-28" style="background:{section_alt_bg}">
<div class="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12">
<div class="fade-up"><p class="text-xs font-semibold tracking-wider uppercase mb-3" style="color:{accent}">Kontakt</p><h2 class="text-3xl md:text-4xl font-bold tracking-tight mb-4">Porozmawiajmy</h2><p class="text-gray-500 mb-8">{random.choice(["Napisz lub zadzwoń — odpowiadamy szybko.","Masz pytanie? Dzwoń śmiało.","Czekamy na Ciebie."])}</p>
<div class="space-y-5">
<div class="flex items-start gap-4"><div class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style="background:{accent}10"><i data-lucide="map-pin" class="w-5 h-5" style="color:{accent}"></i></div><div><p class="font-medium text-sm">{addr}</p><p class="text-gray-400 text-xs mt-0.5">Dojazd samochodem i komunikacją</p></div></div>
<div class="flex items-start gap-4"><div class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style="background:{accent}10"><i data-lucide="phone" class="w-5 h-5" style="color:{accent}"></i></div><div><a href="tel:{phone}" class="font-medium text-sm hover:underline" style="color:{accent}">{phone}</a><p class="text-gray-400 text-xs mt-0.5">Pon-Pt 8:00-18:00</p></div></div>
<div class="flex items-start gap-4"><div class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style="background:{accent}10"><i data-lucide="clock" class="w-5 h-5" style="color:{accent}"></i></div><div><p class="font-medium text-sm">Pon-Sob: 10:00 - 22:00</p><p class="text-gray-400 text-xs mt-0.5">Niedziela: 12:00 - 20:00</p></div></div></div></div>
<div class="fade-up"><form style="background:{rev_bg};border:{rev_border};border-radius:16px;padding:24px" class="space-y-4">
<div><label class="block text-xs font-semibold text-gray-600 mb-1.5">Imię</label><input type="text" placeholder="Jan Kowalski" class="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all" style="--tw-ring-color:{accent}"></div>
<div class="grid grid-cols-2 gap-4"><div><label class="block text-xs font-semibold text-gray-600 mb-1.5">Email</label><input type="email" placeholder="jan@firma.pl" class="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all" style="--tw-ring-color:{accent}"></div>
<div><label class="block text-xs font-semibold text-gray-600 mb-1.5">Telefon</label><input type="tel" placeholder="+48 123 456 789" class="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all" style="--tw-ring-color:{accent}"></div></div>
<div><label class="block text-xs font-semibold text-gray-600 mb-1.5">Wiadomość</label><textarea rows="4" placeholder="W czym możemy pomóc?" class="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:border-transparent transition-all" style="--tw-ring-color:{accent}"></textarea></div>
<button type="submit" class="w-full py-3 rounded-xl text-white text-sm font-semibold transition-all hover:shadow-lg hover:scale-[1.01]" style="background:{accent}">Wyślij wiadomość</button></form></div></div></section>

<footer class="border-t py-10" style="border-color:rgba(128,128,128,.2);background:{section_bg}">
<div class="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
<p class="text-sm" style="color:{card_text}">© {year} {safe}</p>
<div class="flex items-center gap-6 text-sm" style="color:{card_text}">
<a href="#oferta" class="hover:text-gray-700 transition-colors">Oferta</a>
<a href="#cennik" class="hover:text-gray-700 transition-colors">Cennik</a>
<a href="#kontakt" class="hover:text-gray-700 transition-colors">Kontakt</a></div></div></footer>

<script>
lucide.createIcons();
const o=new IntersectionObserver(e=>{{e.forEach(x=>{{if(x.isIntersecting){{x.target.classList.add('visible');o.unobserve(x.target)}}}})}},{{threshold:.15}});
document.querySelectorAll('.fade-up').forEach(el=>o.observe(el));
</script>
</body></html>'''

    return {"files": {"main/frontend/preview.html": html}, "meta": {"title": title, "headline": headline, "subheadline": sub[:120], "ctaText": "Skontaktuj się"}}
