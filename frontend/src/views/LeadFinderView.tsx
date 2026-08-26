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
      const res = await apiFetch('/api/leads/search', {
        method: 'POST',
        headers: { 'X-User-Plan': plan },
        body: JSON.stringify(body),
      })
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
      setSearchError('Błąd połączenia z serwerem - spróbuj ponownie')
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
      className="max-w-[760px] mx-auto py-8 px-4 sm:px-6 space-y-6 pb-24 text-[#111111] dark:text-white"
      style={{ perspective: 1200, fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      <div className="text-center space-y-3">
        <h2 className="text-[32px] sm:text-[36px] font-black tracking-tighter text-center" style={{ fontFamily: "'SF Pro Display', sans-serif", letterSpacing: '-0.03em' }}>LEAD FINDER</h2>
        <p className="text-[13px] font-semibold opacity-60 max-w-md mx-auto">Wybierz kraj, miasto i branżę - wyszukamy prawdziwe firmy z OSM. Bez mocków.</p>
        <div className="flex justify-center px-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-[10px] font-bold text-amber-800 dark:text-amber-300 text-left">
            <Info size={12} className="shrink-0" />
            Wersja 1.0 - może mieć błędy i czasem pokazywać dziwne informacje, ale ok. 90% wyników jest poprawnych
          </span>
        </div>
      </div>
      <motion.div variants={cineChild} className="p-6 sm:p-7 rounded-lg border shadow-xl space-y-5 bg-white dark:bg-black border-[#EAEAEA] dark:border-white/[0.08]">
        <div className="space-y-1.5">
          <label className="text-[11px] font-black uppercase tracking-widest opacity-60">Kraj</label>
          <div className="relative">
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full appearance-none pl-4 pr-10 py-[13px] rounded-lg text-[14px] font-semibold outline-none border bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-700 cursor-pointer shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500 transition"
              style={{ fontFamily: "'SF Pro Display', sans-serif" }}
            >
              <option value="" disabled>Wybierz kraj...</option>
              {(LEAD_COUNTRIES as unknown as string[]).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <ChevronRight className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 rotate-90 opacity-40" size={16} />
          </div>
        </div>
        <div className="space-y-1.5" ref={cityRef}>
          <label className="text-[11px] font-black uppercase tracking-widest opacity-60">Miasto</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setCityOpen(!cityOpen)}
              className={`w-full flex items-center justify-between pl-4 pr-10 py-[13px] rounded-lg text-[14px] font-semibold border bg-white dark:bg-neutral-950 shadow-sm text-left transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${cityOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'} ${!citySelected ? 'text-neutral-400' : 'text-[#111111] dark:text-white'}`}
              style={{ fontFamily: "'SF Pro Display', sans-serif" }}
            >
              <span className="flex items-center gap-2 truncate">
                <Search size={16} className="opacity-40 shrink-0" />
                <span className="truncate">{citySelected ? (cityDetails ? `${citySelected}` : citySelected) : 'Wybierz miasto z listy...'}</span>
              </span>
              <ChevronRight size={16} className={`opacity-40 shrink-0 transition-transform ${cityOpen ? '-rotate-90' : 'rotate-90'}`} />
            </button>
            <AnimatePresence>
              {cityOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{ type: 'spring' as const, stiffness: 400, damping: 28 }}
                  className="absolute z-30 mt-2 w-full rounded-lg border bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden"
                >
                  <div className="p-2 border-b border-neutral-100 dark:border-neutral-900">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                      <input
                        ref={cityInputRef}
                        value={cityQuery}
                        onChange={(e) => setCityQuery(e.target.value)}
                        placeholder="Filtruj lub wybierz z listy..."
                        className="w-full pl-9 pr-3 py-2.5 rounded-lg border text-[13px] font-semibold bg-[#F7F6F3]/40 dark:bg-neutral-900 border-[#EAEAEA] dark:border-white/[0.08] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <p className="text-[10px] font-bold opacity-50 mt-1.5 px-1">{country ? (citiesLoading ? 'Pobieram pełną listę miejscowości...' : `${allCities.length} miejscowości - przewiń lub wpisz nazwę, aby zawęzić`) : 'Pełna lista miast - najpierw wybierz kraj'}</p>
                  </div>
                  <div className="max-h-[260px] overflow-y-auto no-scrollbar">
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
                        className={`w-full text-left px-4 py-2.5 hover:bg-[#F7F6F3] dark:hover:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-900 last:border-0 transition ${citySelected === r.name ? 'bg-[#F7F6F3] dark:bg-neutral-900' : ''}`}
                      >
                        <div className="text-[13px] font-black leading-tight">{r.name}</div>
                        <div className="text-[11px] font-semibold opacity-60 leading-tight truncate">{r.display_name}</div>
                        <div className="text-[10px] font-bold opacity-40">{r.place_type}{(r as any).importance ? ` • ${Number((r as any).importance).toLocaleString('pl-PL')} mieszk.` : ''}</div>
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
        <div className="space-y-1.5" ref={industryRef}>
          <label className="text-[11px] font-black uppercase tracking-widest opacity-60">Branża</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIndustryOpen(!industryOpen)}
              className={`w-full flex items-center justify-between pl-4 pr-10 py-[13px] rounded-lg text-[14px] font-semibold border bg-white dark:bg-neutral-950 shadow-sm text-left transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${industryOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'} ${!industry ? 'text-neutral-400' : 'text-[#111111] dark:text-white'}`}
              style={{ fontFamily: "'SF Pro Display', sans-serif" }}
            >
              <span className="flex items-center gap-2 truncate">
                <Search size={16} className="opacity-40 shrink-0" />
                <span className="truncate">{industry || 'Wybierz branżę...'}</span>
              </span>
              <ChevronRight size={16} className={`opacity-40 shrink-0 transition-transform ${industryOpen ? '-rotate-90' : 'rotate-90'}`} />
            </button>
            <AnimatePresence>
              {industryOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{ type: 'spring' as const, stiffness: 400, damping: 28 }}
                  className="absolute z-30 mt-2 w-full rounded-lg border bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden"
                >
                  <div className="p-2 border-b border-neutral-100 dark:border-neutral-900">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                      <input
                        ref={industryInputRef}
                        value={industryQuery}
                        onChange={(e) => setIndustryQuery(e.target.value)}
                        placeholder="Filtruj branżę, np. Stomatolog, Hydraulik..."
                        className="w-full pl-9 pr-3 py-2.5 rounded-lg border text-[13px] font-semibold bg-[#F7F6F3]/40 dark:bg-neutral-900 border-[#EAEAEA] dark:border-white/[0.08] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                  <div className="max-h-[260px] overflow-y-auto no-scrollbar">
                    {filteredIndustries.length===0 && <div className="p-4 text-center text-xs font-bold opacity-50">Brak branż dla filtra</div>}
                    {filteredIndustries.map((ind) => (
                      <button
                        key={ind}
                        onClick={() => { setIndustry(ind); setIndustryQuery(''); setIndustryOpen(false) }}
                        className={`w-full text-left px-4 py-2.5 text-[13px] font-semibold hover:bg-[#F7F6F3] dark:hover:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-900 last:border-0 transition ${industry===ind ? 'bg-[#111111] text-white dark:bg-white dark:text-black hover:bg-[#111111] dark:hover:bg-white' : ''}`}
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
        <label className="flex items-center gap-3 p-3.5 rounded-lg border bg-[#F7F6F3]/50 dark:bg-neutral-900 border-[#EAEAEA] dark:border-neutral-800 cursor-pointer hover:bg-[#F7F6F3] dark:hover:bg-neutral-900/80 transition">
          <input type="checkbox" checked={onlyWithoutWebsite} onChange={(e) => setOnlyWithoutWebsite(e.target.checked)} className="sm-check" />
          <span className="text-[13px] font-bold">Tylko firmy bez strony</span>
          <span className="ml-auto text-[11px] font-bold opacity-50">domyślnie zaznaczone</span>
        </label>
        <button
          onClick={handleFind}
          disabled={isSearching || !country || !citySelected || !industry}
          className="w-full py-[14px] rounded-lg bg-[#111111] dark:bg-white text-white dark:text-black font-black text-[15px] shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          style={{ fontFamily: "'SF Pro Display', sans-serif" }}
        >
          {isSearching ? <><span className="w-4 h-4 border-2 border-white dark:border-black border-t-transparent rounded-full animate-spin" /> Szukam...</> : 'Szukaj leadów'}
        </button>
        <p className="text-[10px] font-bold opacity-40 text-center">Backend → Nominatim + Overpass • prawdziwe dane OSM • {searchRemaining !== null ? `zostało ${searchRemaining}` : '10/mies Starter, 30/mies Business+'}</p>
      </motion.div>
      {!hasSearched ? (
        <motion.div variants={cineSoft} className="p-10 rounded-lg border text-center space-y-3 shadow-sm bg-white dark:bg-black border-[#EAEAEA] dark:border-white/[0.08] max-w-2xl mx-auto">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center mx-auto shadow-sm bg-[#F7F6F3] dark:bg-neutral-900 border border-[#EAEAEA] dark:border-white/[0.08]">
            <Search size={20} className="opacity-60" />
          </div>
          <h3 className="text-[15px] font-black">Wybierz filtry i kliknij Szukaj leadów</h3>
          <p className="text-[12px] font-semibold opacity-60">Pokazujemy tylko zweryfikowane firmy - żadnych mocków. Jeśli brak wyników, zobaczysz pusty stan.</p>
        </motion.div>
      ) : (
        <motion.div variants={cineSoft} className="space-y-4">
          {searchError && <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-[13px] font-bold text-rose-700 dark:text-rose-300">{searchError}</div>}
          {searchWarning && !searchError && <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-[13px] font-bold text-amber-800 dark:text-amber-300">{searchWarning}</div>}
          {isSearching && <div className="p-8 rounded-lg border bg-white dark:bg-black border-[#EAEAEA] dark:border-white/[0.08] flex flex-col items-center gap-3"><span className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /><span className="text-[13px] font-bold">Szukam firm w OSM - to może potrwać 3–8s...</span></div>}
          {!isSearching && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-[13px] font-black p-3 rounded-lg bg-[#F7F6F3]/60 dark:bg-neutral-900 border border-[#EAEAEA] dark:border-white/[0.08]">
                <span>Znalezione firmy: {leads.length}</span><span className="opacity-30">•</span><span className="text-amber-600 dark:text-amber-400">Bez strony: {noWebsiteCount}</span><span className="opacity-30">•</span><span className="text-emerald-600 dark:text-emerald-400">Ze stroną: {withWebsiteCount}</span>
                <button onClick={exportCsv} disabled={displayLeads.length===0} className="ml-auto text-[11px] font-black px-3 py-1.5 rounded-lg border bg-white dark:bg-neutral-950 border-[#EAEAEA] dark:border-neutral-800 hover:bg-[#F7F6F3] dark:hover:bg-neutral-800 disabled:opacity-40">Eksport CSV</button>
              </div>
              {leads.length > 0 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-[12px] font-semibold text-amber-800 dark:text-amber-300">
                  <Info size={14} className="mt-0.5 shrink-0" />
                  <span>Część firm może mieć stronę mimo braku jej w danych OSM - przed kontaktem zweryfikuj firmę w Google Maps (przycisk „Otwórz w mapach”).</span>
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex rounded-lg border overflow-hidden bg-white dark:bg-neutral-950 border-[#EAEAEA] dark:border-white/[0.08] p-1 gap-1">
                  {(['all','no-website','has-website'] as const).map(f => (
                    <button key={f} onClick={() => setWebsiteFilter(f)} className={`px-3 py-1.5 rounded-lg text-[12px] font-black transition ${websiteFilter===f ? 'bg-[#111111] text-white dark:bg-white dark:text-black shadow-sm' : 'hover:bg-[#F7F6F3] dark:hover:bg-neutral-900'}`}>
                      {f==='all' ? 'Wszystkie' : f==='no-website' ? 'Bez strony' : 'Ze stroną'}
                    </button>
                  ))}
                </div>
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                  <input value={leadSearch} onChange={(e)=>setLeadSearch(e.target.value)} placeholder="Szukaj firm (filtr po nazwie)..." className="w-full pl-9 pr-3 py-2.5 rounded-lg border text-[13px] font-semibold bg-white dark:bg-neutral-950 border-[#EAEAEA] dark:border-white/[0.08] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <select value={sortBy} onChange={(e)=>setSortBy(e.target.value as any)} className="px-3 py-2.5 rounded-lg border text-[13px] font-black bg-white dark:bg-neutral-950 border-[#EAEAEA] dark:border-white/[0.08] cursor-pointer outline-none focus:border-blue-500">
                  <option value="score">Sortuj: Wynik</option>
                  <option value="name">Sortuj: Nazwa</option>
                  <option value="industry">Sortuj: Branża</option>
                </select>
              </div>
              {displayLeads.length===0 ? (
                <div className="p-12 rounded-lg border bg-white dark:bg-black border-[#EAEAEA] dark:border-white/[0.08] text-center space-y-2">
                  <div className="text-[14px] font-black">Brak wyników</div>
                  <div className="text-[13px] font-semibold opacity-60">{leads.length===0 ? 'Nie znaleziono firm spełniających kryteria w tej okolicy. Spróbuj inne miasto lub branżę. Pokazujemy tylko prawdziwe dane OSM - niczego nie generujemy.' : `Brak wyników dla filtra "${leadSearch}" lub "${websiteFilter}".`}</div>
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
                        <motion.div layout key={String(l.id)} className="p-4 sm:p-5 rounded-lg border bg-white dark:bg-neutral-950 border-[#EAEAEA] dark:border-white/[0.08] hover:shadow-lg transition flex flex-col gap-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-black text-[15px] leading-tight truncate" title={l.name}>{l.name}</h4>
                              <div className="text-[12px] font-bold opacity-60">{l.industry || l.category}</div>
                            </div>
                            <div className="shrink-0 flex items-center gap-2">
                              <span title="Punkty: +35 firma, +20 adres, +20 telefon, +20 brak strony, + do 5 bonus za nazwę" className="px-2.5 py-1 rounded-lg bg-[#111111] dark:bg-white text-white dark:text-black text-[11px] font-black cursor-help">Wynik {score}</span>
                            </div>
                          </div>
                          <div className="space-y-1 text-[12px] font-semibold">
                            <div className="flex items-start gap-1.5 opacity-80"><MapPin size={12} className="mt-0.5 shrink-0" /><span>{cityCountry || 'Brak danych'}</span></div>
                            <div className="flex items-start gap-1.5 opacity-80"><MapPin size={12} className="mt-0.5 shrink-0" /><span className={addr ? '' : 'opacity-50'}>{addr || 'Brak danych'}</span></div>
                            <div className="flex items-center gap-1.5 opacity-80"><Phone size={12} className="shrink-0" /><span className={phone ? '' : 'opacity-50'}>{phone || 'Brak danych'}</span></div>
                            <div className="flex items-center gap-1.5 opacity-80"><Globe size={12} className="shrink-0" />{website ? <a href={website.startsWith('http') ? website : `https://${website}`} target="_blank" rel="noreferrer" className="underline text-[#111111] dark:text-white truncate max-w-[220px]">{website}</a> : <span className="opacity-60">Brak strony</span>}</div>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-blue-50 dark:border-neutral-900">
                            <button onClick={() => handleSave(l)} disabled={!!savingId || isSaved} className={`px-3 py-1.5 rounded-lg text-[12px] font-black border transition ${isSaved ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200' : 'bg-[#111111] dark:bg-white text-white dark:text-black border-transparent hover:opacity-90 disabled:opacity-50'}`}>{isSaved ? '✓ Zapisano' : savingId===String(l.id) ? 'Zapisywanie...' : 'Zapisz lead'}</button>
                            <button onClick={() => copyLeadInfo(l)} className={`px-3 py-1.5 rounded-lg text-[12px] font-black border transition inline-flex items-center gap-1.5 ${copiedId===String(l.id) ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200' : 'bg-white dark:bg-neutral-900 border-[#EAEAEA] dark:border-neutral-800 hover:bg-[#F7F6F3] dark:hover:bg-neutral-800'}`}>
                              <CopyIcon size={12} className="shrink-0" />
                              {copiedId===String(l.id) ? '✓ Skopiowano' : 'Kopiuj dane'}
                            </button>
                            <a href={mapsUrl} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg text-[12px] font-black border bg-white dark:bg-neutral-900 border-[#EAEAEA] dark:border-neutral-800 hover:bg-[#F7F6F3] dark:hover:bg-neutral-800">Otwórz w mapach</a>
                            <button onClick={() => onGenerateSiteForLead(l)} className="px-3 py-1.5 rounded-lg text-[12px] font-black border bg-lime-300 text-black border-lime-400 hover:bg-lime-400">Stwórz stronę</button>
                          </div>
                          <p className="text-[10px] font-semibold opacity-50 leading-snug -mt-1">
                            Wskazówka: przed budowaniem strony otwórz firmę w Google Maps i skopiuj dodatkowe dane (pełny adres, godziny otwarcia, ceny, zdjęcia do galerii) - przycisk „Kopiuj dane" zapisuje wszystko, co już mamy.
                          </p>
                        </motion.div>
                      )
                    })}
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[12px] font-bold opacity-60">Strona {currentPage} z {totalPages} • {displayLeads.length} wyników • 20/stronę</span>
                    <div className="flex gap-2">
                      <button disabled={currentPage<=1} onClick={() => setCurrentPage(p=>Math.max(1,p-1))} className="px-3 py-1.5 rounded-lg border text-[12px] font-black bg-white dark:bg-neutral-950 border-[#EAEAEA] dark:border-white/[0.08] disabled:opacity-40 hover:bg-[#F7F6F3] dark:hover:bg-neutral-900">Poprzednia</button>
                      <button disabled={currentPage>=totalPages} onClick={() => setCurrentPage(p=>Math.min(totalPages,p+1))} className="px-3 py-1.5 rounded-lg border text-[12px] font-black bg-white dark:bg-neutral-950 border-[#EAEAEA] dark:border-white/[0.08] disabled:opacity-40 hover:bg-[#F7F6F3] dark:hover:bg-neutral-900">Następna</button>
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
