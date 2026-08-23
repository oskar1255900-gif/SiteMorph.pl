import React, { useState, useEffect } from 'react';
import { Search, Building2, Globe, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';

interface Lead {
  id: number;
  company_name: string;
  website: string;
  niche: string;
  status: string;
  ai_score: number;
}

interface LeadFinderProps {
  onSelectLeadForBuilder: (lead: Lead) => void;
}

export const LeadFinder: React.FC<LeadFinderProps> = ({ onSelectLeadForBuilder }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [niche, setNiche] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchLeads = async () => {
    try {
      const res = await fetch('/api/leads/');
      const data = await res.json();
      setLeads(data);
    } catch (err) {
      console.error('Błąd pobierania leadów', err);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!niche || !location) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/leads/search?niche=${encodeURIComponent(niche)}&location=${encodeURIComponent(location)}`, {
        method: 'POST',
      });
      await res.json();
      fetchLeads();
      setNiche('');
      setLocation('');
    } catch (err) {
      console.error('Błąd wyszukiwania leada', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10 animate-fadeIn max-w-6xl mx-auto py-6">
      <div className="text-center space-y-3">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white">
          Find local customers in seconds.
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm max-w-xl mx-auto">
          Included with every plan: pull 200M+ local businesses out of Google. Phone, email, address — auto-flagged when they don’t have a website.
        </p>
      </div>

      <form onSubmit={handleSearch} className="bg-neutral-100 dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 grid grid-cols-1 md:grid-cols-3 gap-4 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-neutral-500 uppercase mb-2">Business type</label>
          <input
            type="text"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="Yoga studios"
            className="w-full bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-apple-blue transition-all"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-500 uppercase mb-2">Location</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Austin, TX"
            className="w-full bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-apple-blue transition-all"
            required
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-apple-blue hover:bg-apple-blueHover text-white font-medium py-3 px-6 rounded-xl transition-all shadow-sm flex items-center justify-center space-x-2 text-sm disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Find Leads</span>
              </>
            )}
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {leads.map((lead) => (
          <div key={lead.id} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 hover:shadow-apple transition-all flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold px-2.5 py-0.5 bg-blue-50 dark:bg-blue-950/50 text-apple-blue rounded-full">
                  {lead.niche}
                </span>
                <span className="text-xs text-neutral-400">AI Score: {lead.ai_score}%</span>
              </div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-neutral-400" /> {lead.company_name}
              </h3>
              <p className="text-xs text-neutral-500">No website detected</p>
            </div>
            <button
              onClick={() => onSelectLeadForBuilder(lead)}
              className="bg-neutral-100 dark:bg-neutral-800 hover:bg-apple-blue hover:text-white text-neutral-800 dark:text-neutral-200 px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5"
            >
              Build Page <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};