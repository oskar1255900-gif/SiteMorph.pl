import React, { useState } from 'react';
import { Cpu, Sparkles, CheckCircle } from 'lucide-react';

interface AiBuilderProps {
  onSiteGenerated: (siteData: any) => void;
  initialLead?: any;
}

export const AiBuilder: React.FC<AiBuilderProps> = ({ onSiteGenerated, initialLead }) => {
  const [businessName, setBusinessName] = useState(initialLead ? initialLead.company_name : '');
  const [niche, setNiche] = useState(initialLead ? initialLead.niche : '');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState<any>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/builder/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_name: businessName, niche, description }),
      });
      const data = await res.json();
      setGenerated(data.content);
      onSiteGenerated({
        name: businessName,
        domain: `${businessName.toLowerCase().replace(/\s+/g, '')}.pl`,
        niche,
        content: data.content
      });
    } catch (err) {
      console.error('Błąd generowania strony', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fadeIn py-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
          A sentence. A website. Today.
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm">
          Type what you want. Watch it come to life. Change anything by asking.
        </p>
      </div>

      <form onSubmit={handleGenerate} className="bg-neutral-100 dark:bg-neutral-900 p-8 rounded-3xl border border-neutral-200 dark:border-neutral-800 space-y-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-medium text-neutral-500 uppercase mb-2">Business Name</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Lotus & Linen Yoga"
              className="w-full bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-apple-blue"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 uppercase mb-2">Industry / Niche</label>
            <input
              type="text"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="Yoga Studio"
              className="w-full bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-apple-blue"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-500 uppercase mb-2">What does your business do?</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A yoga studio in Austin TX focused on slow flows and mindfulness..."
            rows={4}
            className="w-full bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-apple-blue"
            required
          ></textarea>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-apple-blue hover:bg-apple-blueHover text-white font-medium py-3.5 rounded-xl transition-all shadow-sm flex items-center justify-center space-x-2 text-sm disabled:opacity-50"
        >
          {loading ? (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Generating website in 4m 32s...</span>
            </div>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Generate Website with AI</span>
            </>
          )}
        </button>
      </form>

      {generated && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-8 rounded-3xl space-y-6 shadow-apple animate-fadeIn">
          <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-4">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <CheckCircle className="text-apple-blue w-5 h-5" /> Website successfully generated!
            </h2>
            <span className="px-3 py-1 bg-blue-50 dark:bg-blue-950 text-apple-blue rounded-full text-xs font-semibold">Ready to preview</span>
          </div>

          <div className="space-y-4">
            <div className="bg-neutral-50 dark:bg-neutral-950 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800">
              <span className="text-xs font-semibold text-apple-blue uppercase">Hero Section</span>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white mt-1">{generated.hero.title}</h3>
              <p className="text-xs text-neutral-500 mt-1">{generated.hero.subtitle}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};