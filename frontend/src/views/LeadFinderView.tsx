import * as React from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe,
  Search,
  MapPin,
  Phone,
  X,
  ChevronRight,
  Info,
  Copy as CopyIcon,
} from 'lucide-react';
import { cineChild, cineParent, cineSoft } from '../lib/shared';
import { apiFetch } from '../lib/api';
import { Lead } from '../types';

export const LEAD_COUNTRIES = ['Polska','USA','UK'] as const
export const LEAD_INDUSTRIES = ['Restauracje','Kawiarnie','Bary i puby','Fast food','Piekarnie i cukiernie','Salony fryzjerskie','Salony kosmetyczne','Salony piękności','Manicure','Spa','Stomatolog','Przychodnia lekarska','Fizjoterapeuta','Weterynarz','Restauracja','Kawiarnia','Piekarnia','Pizzeria','Bar szybkiej obsługi','Catering','Hotel','Siłownia','Studio jogi','Trener personalny','Nieruchomości','Kancelaria prawna','Księgowość','Ubezpieczenia','Warsztat samochodowy','Salon samochodowy','Myjnia samochodowa','Fotograf','Usługi ślubne','Sprzątanie','Budownictwo','Hydraulik','Elektryk','Dekarz','Malarz','Przeprowadzki','Agencja marketingowa','Usługi IT','Serwis komputerowy','Sklep osiedlowy','Sklep odzieżowy','Sklep meblowy','Kwiaciarnia','Sklep zoologiczny','Fryzjer męski','Korepetycje','Szkoła muzyczna','Nauka jazdy']

type CityOption = { display_name: string; name: string; lat: string; lon: string; osm_id: number; osm_type: string; place_type: string; country_code?: string; importance?: number }

// Normalizacja nazwy do porownan - ignoruje polskie znaki (Wrocław == wroclaw)
const foldPl = (s: string) => (s || '').toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export const LeadFinderView = ({
  onGenerateSiteForLead
}: {
  theme: 'light' | 'dark';
  onGenerateSiteForLead: (lead: Lead, opts?: { withImages?: boolean }) => void;
}) => {
  const [country, setCountry] = useState<string>('')
  const [industry, setIndustry] = useState<string>('')
  const [onlyWithoutWebsite, setOnlyWithoutWebsite] = useState(true)
  const [citySelected, setCitySelected] = useState<string>('')
  const [cityDetails, setCityDetails] = useState<CityOption | null>(null)
  const [cityOpen, setCityOpen] = useState(false)
  const [cityQuery, setCityQuery] = useState('')
  const [cityResults, setCityResults] = useState<CityOption[]>([])
  const [cityLoading, setCityLoading] = useState(false)
  const [cityError, setCityError] = useState<string | null>(null)
  const [allCities, setAllCities] = useState<CityOption[]>([])
  const [citiesLoading, setCitiesLoading] = useState(false)
  const cityReqIdRef = React.useRef(0)
  const citiesReqIdRef = React.useRef(0)
  const cityInputRef = React.useRef<HTMLInputElement>(null)
  const [industryOpen, setIndustryOpen] = useState(false)
  const [industryQuery, setIndustryQuery] = useState('')
  const industryInputRef = React.useRef<HTMLInputElement>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [leads, setLeads] = useState<any[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchWarning, setSearchWarning] = useState<string | null>(null)
  const [searchRemaining, setSearchRemaining] = useState<number | null>(null)
  const [websiteFilter, setWebsiteFilter] = useState<'all' | 'no-website' | 'has-website'>('all')
  const [leadSearch, setLeadSearch] = useState('')
  const [sortBy, setSortBy] = useState<'score' | 'name' | 'industry'>('score')
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 20
  const [savingId, setSavingId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    setCitySelected('')
    setCityDetails(null)
    setCityQuery('')
    setCityResults([])
    setCityError(null)
    setCityOpen(false)
    setLeads([])
    setHasSearched(false)
    setSearchError(null)
    setSearchWarning(null)
  }, [country])
  // Pelna lista miast dla wybranego kraju (prawdziwe dane OSM, cache 24h na backendzie)
  useEffect(() => {
    if (!country) {
      setAllCities([])
      setCitiesLoading(false)
      return
    }
    const reqId = ++citiesReqIdRef.current
    setCitiesLoading(true)
    ;(async () => {
      try {
        const res = await apiFetch(`/api/geocode/all-cities?country=${encodeURIComponent(country)}`)
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.detail || errData.error || `Błąd ${res.status}`)
        }
        const data = await res.json()
        if (reqId !== citiesReqIdRef.current) return
        if (Array.isArray(data.results)) setAllCities(data.results as CityOption[])
        else setAllCities([])
      } catch (e: any) {
        console.error('[LeadFinderView] Cities load error:', e)
        if (reqId === citiesReqIdRef.current) setAllCities([])
      } finally {
        if (reqId === citiesReqIdRef.current) setCitiesLoading(false)
      }
    })()
  }, [country])
  useEffect(() => {
    if (!cityOpen) return
    const q = cityQuery.trim()
    // Zdalne podpowiedzi (mniejsze miejscowosci spoza listy city/town) od 2 znakow
    if (q.length < 2 || !country) {
      setCityResults([])
      setCityLoading(false)
      return
    }
    const reqId = ++cityReqIdRef.current
    setCityLoading(true)
    setCityError(null)
    const t = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/geocode/autocomplete?q=${encodeURIComponent(q)}&country=${encodeURIComponent(country)}`)
        const data = await res.json()
        if (reqId !== cityReqIdRef.current) return
        if (data.error) {
          setCityError(data.error)
          setCityResults([])
        } else {
          setCityResults((data.results || []) as CityOption[])
        }
      } catch (e: any) {
        if (reqId !== cityReqIdRef.current) return
        setCityError('Błąd pobierania podpowiedzi')
        setCityResults([])
      } finally {
        if (reqId === cityReqIdRef.current) setCityLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [cityQuery, country, cityOpen])
  useEffect(() => {
    if (cityOpen) setTimeout(() => cityInputRef.current?.focus(), 50)
  }, [cityOpen])
  useEffect(() => {
    if (industryOpen) setTimeout(() => industryInputRef.current?.focus(), 50)
  }, [industryOpen])
  const filteredIndustries = React.useMemo(() => {
    const q = industryQuery.trim().toLowerCase()
    if (!q) return LEAD_INDUSTRIES as unknown as string[]
    return (LEAD_INDUSTRIES as unknown as string[]).filter(i => i.toLowerCase().includes(q))
  }, [industryQuery])
  const MAX_CITY_ROWS = 3000
  // Lista miast w dropdownie: pelna lista (filtr lokalnie, bez ogonkow) + zdalne
  // podpowiedzi mniejszych miejscowosci doklejone na koniec
  const cityDisplayList = React.useMemo(() => {
    const qf = foldPl(cityQuery.trim())
    let base: CityOption[] = []
    if (!qf) {
      base = allCities
    } else {
      const starts: CityOption[] = []
      const incl: CityOption[] = []
      for (const c of allCities) {
        const nf = foldPl(c.name)
        if (nf.startsWith(qf)) starts.push(c)
        else if (nf.includes(qf)) incl.push(c)
      }
      base = [...starts, ...incl]
    }
    const seen = new Set(base.map(c => foldPl(c.name)))
    const extras = cityResults.filter(r => r.name && !seen.has(foldPl(r.name))).slice(0, 8)
    return [...base, ...extras]
  }, [allCities, cityQuery, cityResults])
  const hiddenCityCount = Math.max(0, cityDisplayList.length - MAX_CITY_ROWS)
  const displayLeads = React.useMemo(() => {
    let out = [...leads]
    if (websiteFilter === 'no-website') out = out.filter(l => !l.website)
    else if (websiteFilter === 'has-website') out = out.filter(l => !!l.website)
    if (leadSearch.trim()) {
      const q = leadSearch.toLowerCase()
      out = out.filter(l => (l.name || '').toLowerCase().includes(q) || (l.industry || l.category || '').toLowerCase().includes(q) || (l.address || '').toLowerCase().includes(q))
    }
    if (sortBy === 'score') out.sort((a,b) => (b.leadScore ?? b.readinessScore ?? 0) - (a.leadScore ?? a.readinessScore ?? 0))
    else if (sortBy === 'name') out.sort((a,b) => (a.name || '').localeCompare(b.name || ''))
    else if (sortBy === 'industry') out.sort((a,b) => ((a.industry || a.category || '') as string).localeCompare((b.industry || b.category || '') as string))
    return out
  }, [leads, websiteFilter, leadSearch, sortBy])
  useEffect(() => { setCurrentPage(1) }, [displayLeads.length, websiteFilter, leadSearch, sortBy])
  const totalPages = Math.max(1, Math.ceil(displayLeads.length / PAGE_SIZE))
  const pagedLeads = displayLeads.slice((currentPage-1)*PAGE_SIZE, currentPage*PAGE_SIZE)
  const noWebsiteCount = leads.filter(l => !l.website).length
  const withWebsiteCount = leads.filter(l => !!l.website).length
  const handleFind = async () => {
    if (!country || !citySelected || !industry) return
    setIsSearching(true)
    setHasSearched(true)
    setSearchError(null)
    setSearchWarning(null)
    setLeads([])
    try {
      const plan = (() => { try { return localStorage.getItem('sitemorph-plan') || 'Starter' } catch { return 'Starter' } })()
      const body: any = {
        country,
        city: citySelected,
        industry,
        onlyWithoutWebsite,
        limit: 60,
      }
      if (cityDetails) {
        body.latitude = cityDetails.lat ? parseFloat(cityDetails.lat) : undefined
        body.longitude = cityDetails.lon ? parseFloat(cityDetails.lon) : undefined
        body.osmId = cityDetails.osm_id ? String(cityDetails.osm_id) : undefined
        body.osmType = cityDetails.osm_type || undefined
      }
      const controller = new AbortController()
      const searchTimeout = setTimeout(() => controller.abort(), 35000)
      let res: Response
      try {
        res = await apiFetch('/api/leads/search', {
          method: 'POST',
          headers: { 'X-User-Plan': plan },
          body: JSON.stringify(body),
          signal: controller.signal,
        })
      } finally {
        clearTimeout(searchTimeout)
      }
      const data = await res.json()
      if (!res.ok) {
        const msg = data?.detail || data?.warning || data?.message || `Błąd ${res.status}`
        setSearchError(msg)
        if (data?.remaining !== undefined) setSearchRemaining(data.remaining)
        return
      }
      if (data.remaining !== undefined) setSearchRemaining(data.remaining)
      if (data.warning) setSearchWarning(data.warning)
      else setSearchWarning(null)
      if (Array.isArray(data.leads)) setLeads(data.leads)
      else setLeads([])
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        setSearchError('Wyszukiwanie trwało za długo (>35s). Overpass API może być przeciążony — spróbuj mniejsze miasto lub inną branżę.')
      } else {
        setSearchError('Błąd połączenia z serwerem - spróbuj ponownie')
      }
    } finally {
      setIsSearching(false)
    }
  }
  const handleSave = async (lead: any) => {
    const id = String(lead.id)
    setSavingId(id)
    try {
      const res = await apiFetch('/api/leads/save', {
        method: 'POST',
        body: JSON.stringify({
          name: lead.name,
          industry: lead.industry || lead.category,
          address: lead.address,
          city: lead.city || lead.location,
          country: lead.country || country,
          phone: lead.phone,
          website: lead.website || null,
          latitude: lead.latitude,
          longitude: lead.longitude,
          osmId: lead.osmId,
          osmType: lead.osmType,
          leadScore: lead.leadScore ?? lead.readinessScore,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setSavedIds(prev => new Set(prev).add(id))
      } else {
        setSearchError(data?.detail || 'Błąd zapisu')
      }
    } catch {
      setSearchError('Błąd zapisu - brak połączenia')
    } finally {
      setSavingId(null)
    }
  }
  const copyLeadInfo = async (lead: any) => {
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([lead.name, lead.address || '', lead.city || lead.location || '', lead.country || country].filter(Boolean).join(' '))}`
    const lines: (string | null)[] = [
      lead.name,
      lead.rating ? `${String(lead.rating).replace('.', ',')} (${lead.userRatingsTotal ?? '?'} opinii)` : null,
      (lead.industry || lead.category) || null,
      lead.address ? `Adres: ${lead.address}` : null,
      [lead.city || lead.location, lead.country].filter(Boolean).join(', ') || null,
      lead.phone ? `Telefon: ${lead.phone}` : null,
      lead.website ? `Strona: ${lead.website}` : null,
      lead.openingHours ? `Godziny otwarcia: ${lead.openingHours}` : null,
      `Google Maps: ${mapsUrl}`,
      '',
      'Do uzupełnienia z Google Maps: pełny adres, godziny otwarcia, ceny, zdjęcia.'
    ]
    const text = lines.filter((x): x is string => !!x).join('\n')
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch { /* pomiń */ }
      document.body.removeChild(ta)
    }
    setCopiedId(String(lead.id))
    setTimeout(() => setCopiedId(null), 2000)
  }
  const exportCsv = () => {
    const header = ['Nazwa','Branża','Adres','Miasto','Kraj','Telefon','Strona WWW','Szerokość','Długość','Wynik','OSM ID']
    const rows = displayLeads.map(l => {
      const vals = [
        l.name || '',
        l.industry || l.category || '',
        l.address || '',
        l.city || l.location || '',
        l.country || country || '',
        l.phone || '',
        l.website || '',
        l.latitude != null ? String(l.latitude) : '',
        l.longitude != null ? String(l.longitude) : '',
        String(l.leadScore ?? l.readinessScore ?? ''),
        l.osmId || ''
      ]
      return vals.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    })
    const csv = [header.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `leads-${(citySelected || 'results').replace(/\s+/g,'_')}.csv`; a.click()
    URL.revokeObjectURL(url)
  }
  const cityRef = React.useRef<HTMLDivElement>(null)
  const industryRef = React.useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) setCityOpen(false)
      if (industryRef.current && !industryRef.current.contains(e.target as Node)) setIndustryOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  return (
    <motion.div
      variants={cineParent}
      initial="hidden"
      animate="visible"
      className="mx-auto max-w-[860px] space-y-6 px-4 py-8 pb-24 text-[var(--sm-text)] sm:px-6"
      style={{ fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      <div className="space-y-3">
        <div className="flex items-start gap-2.5">
          <h1 className="sm-h1">Lead Finder</h1>
          <span
            className="mt-2 inline-flex shrink-0 text-[var(--sm-text-3)]"
            title="Dane pochodzą z OpenStreetMap. Przed kontaktem warto potwierdzić informacje o firmie."
            aria-label="Informacja o źródle danych"
          >
            <Info size={18} />
          </span>
        </div>
        <p className="max-w-xl text-[16px] leading-[1.55] text-[var(--sm-text-2)]">
          Wybierz kraj, miasto i branżę — pokażemy lokalne firmy z OpenStreetMap.
        </p>
      </div>
      <motion.div variants={cineChild} className="sm-card space-y-6 p-5 sm:p-6">
        <div>
          <label htmlFor="lf-country" className="sm-label">Kraj</label>
          <div className="relative">
            <select
              id="lf-country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="sm-select appearance-none cursor-pointer pr-10 font-medium"
            >
              <option value="" disabled>Wybierz kraj...</option>
              {(LEAD_COUNTRIES as unknown as string[]).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <ChevronRight className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-[var(--sm-text-3)]" size={18} />
          </div>
        </div>
        <div ref={cityRef}>
          <label className="sm-label">Miasto</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setCityOpen(!cityOpen)}
              className="sm-select flex items-center justify-between gap-3 text-left font-medium cursor-pointer"
              style={!citySelected ? { color: 'var(--sm-text-3)' } : undefined}
              aria-expanded={cityOpen}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <Search size={18} className="shrink-0 text-[var(--sm-text-3)]" />
                <span className="truncate">{citySelected || 'Wybierz miasto z listy…'}</span>
              </span>
              <ChevronRight size={18} className={`shrink-0 text-[var(--sm-text-3)] transition-transform ${cityOpen ? '-rotate-90' : 'rotate-90'}`} />
            </button>
            <AnimatePresence>
              {cityOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{ type: 'spring' as const, stiffness: 400, damping: 28 }}
                  className="absolute z-30 mt-2 w-full overflow-hidden rounded-[12px] border border-[var(--sm-border)] bg-[var(--sm-surface)] shadow-2xl"
                >
                  <div className="border-b border-[var(--sm-border)] p-2.5">
                    <div className="relative">
                      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--sm-text-3)]" />
                      <input
                        ref={cityInputRef}
                        value={cityQuery}
                        onChange={(e) => setCityQuery(e.target.value)}
                        placeholder="Filtruj lub wybierz z listy..."
                        className="sm-input pl-10 text-[15px]"
                      />
                    </div>
                    <p className="mt-2 px-1 text-[13px] text-[var(--sm-text-3)]">{country ? (citiesLoading ? 'Pobieram pełną listę miejscowości...' : `${allCities.length} miejscowości - przewiń lub wpisz nazwę, aby zawęzić`) : 'Pełna lista miast - najpierw wybierz kraj'}</p>
                  </div>
                  <div className="sm-scroll max-h-[320px] overflow-y-auto">
                    {!country && <div className="p-4 text-center text-xs font-bold opacity-50">Najpierw wybierz kraj</div>}
                    {country && citiesLoading && <div className="p-4 text-center text-xs font-bold opacity-60 flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /> Pobieram pełną listę miejscowości...</div>}
                    {country && !citiesLoading && cityError && cityDisplayList.length === 0 && <div className="p-3 text-xs font-bold text-rose-600">{cityError}</div>}
                    {country && !citiesLoading && cityDisplayList.length === 0 && (
                      <div className="p-4 text-center text-xs font-bold opacity-50">Brak wyników{cityQuery.trim() ? ` dla „${cityQuery.trim()}"` : ''} - spróbuj innej pisowni</div>
                    )}
                    {country && !citiesLoading && cityDisplayList.slice(0, MAX_CITY_ROWS).map((r) => (
                      <button
                        key={`${r.osm_type}_${r.osm_id}_${foldPl(r.name)}`}
                        onClick={() => { setCitySelected(r.name); setCityDetails(r); setCityQuery(r.name); setCityOpen(false) }}
                        className={`w-full min-h-[56px] border-b border-[var(--sm-border)] px-4 py-2.5 text-left transition last:border-0 hover:bg-[var(--sm-surface-2)] ${citySelected === r.name ? 'bg-[var(--sm-surface-2)]' : ''}`}
                      >
                        <div className="text-[15px] font-medium leading-tight">{r.name}</div>
                        <div className="truncate text-[13px] leading-tight text-[var(--sm-text-2)]">{r.display_name}</div>
                        <div className="text-[12px] text-[var(--sm-text-3)]">{r.place_type}{(r as any).importance ? ` • ${Number((r as any).importance).toLocaleString('pl-PL')} mieszk.` : ''}</div>
                      </button>
                    ))}
                    {country && !citiesLoading && hiddenCityCount > 0 && (
                      <div className="p-3 text-center text-[11px] font-bold opacity-50">+{hiddenCityCount} więcej - wpisz nazwę, aby zawęzić</div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <div ref={industryRef}>
          <label className="sm-label">Branża</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIndustryOpen(!industryOpen)}
              className="sm-select flex items-center justify-between gap-3 text-left font-medium cursor-pointer"
              style={!industry ? { color: 'var(--sm-text-3)' } : undefined}
              aria-expanded={industryOpen}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <Search size={18} className="shrink-0 text-[var(--sm-text-3)]" />
                <span className="truncate">{industry || 'Wybierz branżę…'}</span>
              </span>
              <ChevronRight size={18} className={`shrink-0 text-[var(--sm-text-3)] transition-transform ${industryOpen ? '-rotate-90' : 'rotate-90'}`} />
            </button>
            <AnimatePresence>
              {industryOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{ type: 'spring' as const, stiffness: 400, damping: 28 }}
                  className="absolute z-30 mt-2 w-full overflow-hidden rounded-[12px] border border-[var(--sm-border)] bg-[var(--sm-surface)] shadow-2xl"
                >
                  <div className="border-b border-[var(--sm-border)] p-2.5">
                    <div className="relative">
                      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--sm-text-3)]" />
                      <input
                        ref={industryInputRef}
                        value={industryQuery}
                        onChange={(e) => setIndustryQuery(e.target.value)}
                        placeholder="Filtruj branżę, np. Stomatolog, Hydraulik..."
                        className="sm-input pl-10 text-[15px]"
                      />
                    </div>
                  </div>
                  <div className="sm-scroll max-h-[320px] overflow-y-auto">
                    {filteredIndustries.length===0 && <div className="p-4 text-center text-xs font-bold opacity-50">Brak branż dla filtra</div>}
                    {filteredIndustries.map((ind) => (
                      <button
                        key={ind}
                        onClick={() => { setIndustry(ind); setIndustryQuery(''); setIndustryOpen(false) }}
                        className={`w-full min-h-[44px] border-b border-[var(--sm-border)] px-4 py-2.5 text-left text-[15px] font-medium last:border-0 hover:bg-[var(--sm-surface-2)] transition ${industry===ind ? 'bg-[var(--sm-surface-2)]' : ''}`}
                      >
                        {ind}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <label className="sm-card-quiet flex min-h-[56px] cursor-pointer items-center gap-3 p-3.5 transition-colors hover:border-[var(--sm-border-strong)]">
          <input type="checkbox" checked={onlyWithoutWebsite} onChange={(e) => setOnlyWithoutWebsite(e.target.checked)} className="sm-check" />
          <span className="text-[15px] font-medium">Tylko firmy bez strony</span>
          <span className="ml-auto text-[13px] text-[var(--sm-text-3)]">domyślnie zaznaczone</span>
        </label>
        <button
          onClick={handleFind}
          disabled={isSearching || !country || !citySelected || !industry}
          className="sm-btn sm-btn-lg sm-btn-primary w-full"
        >
          {isSearching
            ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> Szukam…</>
            : 'Szukaj leadów'}
        </button>
        <p className="text-center text-[13px] leading-relaxed text-[var(--sm-text-3)]">
          Dane pochodzą z OpenStreetMap. Przed kontaktem warto potwierdzić informacje o firmie.
        </p>
      </motion.div>
      {!hasSearched ? (
        <motion.div variants={cineSoft} className="sm-card mx-auto flex max-w-2xl items-center gap-3.5 p-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] border border-[var(--sm-border)] bg-[var(--sm-surface-2)]">
            <Search size={19} className="text-[var(--sm-text-3)]" />
          </span>
          <p className="text-[15px] leading-[1.55] text-[var(--sm-text-2)]">
            Ustaw filtry powyżej, aby zobaczyć listę firm.
          </p>
        </motion.div>
      ) : (
        <motion.div variants={cineSoft} className="space-y-4">
          {searchError && (
            <div role="alert" className="rounded-[10px] border border-[color-mix(in_srgb,var(--sm-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--sm-danger)_10%,transparent)] px-4 py-3 text-[15px] text-[var(--sm-danger)]">
              {searchError}
            </div>
          )}
          {searchWarning && !searchError && (
            <div role="status" className="rounded-[10px] border border-[color-mix(in_srgb,var(--sm-warning)_40%,transparent)] bg-[color-mix(in_srgb,var(--sm-warning)_10%,transparent)] px-4 py-3 text-[15px] text-[var(--sm-warning)]">
              {searchWarning}
            </div>
          )}
          {isSearching && (
            <div className="sm-card flex items-center gap-3.5 p-5">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--sm-accent)] border-t-transparent" />
              <span className="text-[15px] text-[var(--sm-text-2)]">Szukam firm w OpenStreetMap — to może potrwać kilka sekund…</span>
            </div>
          )}
          {!isSearching && (
            <>
              <div className="sm-card-quiet flex flex-wrap items-center gap-x-3 gap-y-2 p-3.5 text-[15px] font-medium">
                <span>Znalezione firmy: {leads.length}</span>
                <span className="text-[var(--sm-text-3)]">•</span>
                <span className="text-[var(--sm-warning)]">Bez strony: {noWebsiteCount}</span>
                <span className="text-[var(--sm-text-3)]">•</span>
                <span className="text-[var(--sm-success)]">Ze stroną: {withWebsiteCount}</span>
                <button
                  onClick={exportCsv}
                  disabled={displayLeads.length===0}
                  className="sm-btn ml-auto"
                >
                  Eksport CSV
                </button>
              </div>
              {leads.length > 0 && (
                <div className="flex items-start gap-2.5 rounded-[10px] border border-[var(--sm-border)] bg-[var(--sm-surface-2)] px-4 py-3 text-[14px] leading-[1.55] text-[var(--sm-text-2)]">
                  <Info size={16} className="mt-0.5 shrink-0 text-[var(--sm-text-3)]" />
                  <span>Część firm może mieć stronę mimo braku jej w danych OpenStreetMap — przed kontaktem potwierdź informacje o firmie (przycisk „Otwórz w mapach”).</span>
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex gap-1 rounded-[10px] border border-[var(--sm-border)] bg-[var(--sm-surface)] p-1">
                  {(['all','no-website','has-website'] as const).map(f => (
                    <button key={f} onClick={() => setWebsiteFilter(f)} className={`min-h-[44px] px-3.5 rounded-[8px] text-[14px] font-medium transition ${websiteFilter===f ? 'bg-[var(--sm-surface-2)] text-[var(--sm-text)]' : 'text-[var(--sm-text-2)] hover:text-[var(--sm-text)]'}`}>
                      {f==='all' ? 'Wszystkie' : f==='no-website' ? 'Bez strony' : 'Ze stroną'}
                    </button>
                  ))}
                </div>
                <div className="relative flex-1">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--sm-text-3)]" />
                  <input value={leadSearch} onChange={(e)=>setLeadSearch(e.target.value)} placeholder="Szukaj firm po nazwie…" aria-label="Filtruj wyniki po nazwie" className="sm-input pl-10 text-[15px]" />
                </div>
                <select value={sortBy} onChange={(e)=>setSortBy(e.target.value as any)} aria-label="Sortowanie wyników" className="sm-select w-auto cursor-pointer text-[15px] font-medium">
                  <option value="score">Sortuj: Wynik</option>
                  <option value="name">Sortuj: Nazwa</option>
                  <option value="industry">Sortuj: Branża</option>
                </select>
              </div>
              {displayLeads.length===0 ? (
                <div className="sm-card space-y-1.5 p-8 text-center">
                  <div className="text-[16px] font-semibold">Brak wyników</div>
                  <div className="text-[15px] leading-[1.55] text-[var(--sm-text-2)]">{leads.length===0 ? 'Nie znaleziono firm spełniających kryteria w tej okolicy. Spróbuj inne miasto lub branżę.' : `Brak wyników dla filtra „${leadSearch}”.`}</div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3">
                    {pagedLeads.map((l) => {
                      const score = l.leadScore ?? l.readinessScore ?? 0
                      const isSaved = savedIds.has(String(l.id))
                      const addr = l.address || null
                      const phone = l.phone || null
                      const website = l.website || null
                      const cityCountry = [l.city || l.location, l.country || country].filter(Boolean).join(', ')
                      // Szukamy po nazwie + adresie, nie po kordynatach - wtedy Google Maps
                      // otwiera profil firmy (oceny, zdjecia, godziny), a nie pusty punkt na mapie
                      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([l.name, addr || '', cityCountry].filter(Boolean).join(' '))}`
                      return (
                        <motion.div layout key={String(l.id)} className="sm-card flex flex-col gap-3.5 p-5 transition-colors hover:border-[var(--sm-border-strong)]">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <h4 className="truncate text-[17px] font-semibold leading-tight" title={l.name}>{l.name}</h4>
                              <div className="mt-1 text-[14px] text-[var(--sm-text-2)]">{l.industry || l.category}</div>
                            </div>
                            <span
                              title="Punkty: +35 firma, +20 adres, +20 telefon, +20 brak strony, + do 5 bonus za nazwę"
                              className="sm-pill shrink-0 cursor-help"
                            >
                              Wynik {score}
                            </span>
                          </div>
                          <div className="space-y-1.5 text-[14px] text-[var(--sm-text-2)]">
                            <div className="flex items-start gap-2"><MapPin size={15} className="mt-0.5 shrink-0 text-[var(--sm-text-3)]" /><span>{cityCountry || 'Brak danych'}</span></div>
                            <div className="flex items-start gap-2"><MapPin size={15} className="mt-0.5 shrink-0 text-[var(--sm-text-3)]" /><span>{addr || 'Brak danych'}</span></div>
                            <div className="flex items-center gap-2"><Phone size={15} className="shrink-0 text-[var(--sm-text-3)]" /><span>{phone || 'Brak danych'}</span></div>
                            <div className="flex items-center gap-2"><Globe size={15} className="shrink-0 text-[var(--sm-text-3)]" />{website ? <a href={website.startsWith('http') ? website : `https://${website}`} target="_blank" rel="noreferrer" className="max-w-[260px] truncate underline">{website}</a> : <span>Brak strony</span>}</div>
                          </div>
                          <div className="flex flex-wrap gap-2 border-t border-[var(--sm-border)] pt-4">
                            <button
                              onClick={() => handleSave(l)}
                              disabled={!!savingId || isSaved}
                              className="sm-btn"
                            >
                              {isSaved ? '✓ Zapisano' : savingId===String(l.id) ? 'Zapisywanie…' : 'Zapisz lead'}
                            </button>
                            <button onClick={() => copyLeadInfo(l)} className="sm-btn">
                              <CopyIcon size={16} className="shrink-0" />
                              {copiedId===String(l.id) ? '✓ Skopiowano' : 'Kopiuj dane'}
                            </button>
                            <a href={mapsUrl} target="_blank" rel="noreferrer" className="sm-btn">Otwórz w mapach</a>
                            <button onClick={() => onGenerateSiteForLead(l)} className="sm-btn sm-btn-primary">Stwórz stronę</button>
                          </div>
                          <p className="text-[13px] leading-[1.5] text-[var(--sm-text-3)]">
                            Wskazówka: zanim zbudujesz stronę, otwórz firmę w Google Maps i dopisz brakujące dane
                            (godziny otwarcia, ceny, zdjęcia do galerii).
                          </p>
                        </motion.div>
                      )
                    })}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <span className="text-[14px] text-[var(--sm-text-2)]">
                      Strona {currentPage} z {totalPages} · {displayLeads.length} wyników
                    </span>
                    <div className="flex gap-2">
                      <button disabled={currentPage<=1} onClick={() => setCurrentPage(p=>Math.max(1,p-1))} className="sm-btn">Poprzednia</button>
                      <button disabled={currentPage>=totalPages} onClick={() => setCurrentPage(p=>Math.min(totalPages,p+1))} className="sm-btn">Następna</button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </motion.div>
      )}
    </motion.div>
  )
}



// ============================================================================
// 11. WIDOK: CENNIK
// ============================================================================
