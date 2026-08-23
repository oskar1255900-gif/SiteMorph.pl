import React, { useState } from 'react';
import { Globe, Edit3, Save, Smartphone, Monitor } from 'lucide-react';

interface LivePreviewCMSProps {
  siteContent: any;
  onSaveProject: (updatedContent: any) => void;
}

export const LivePreviewCMS: React.FC<LivePreviewCMSProps> = ({ siteContent, onSaveProject }) => {
  const [content, setContent] = useState(
    siteContent || {
      hero: {
        title: "Move slower. Stay longer.",
        subtitle: "A yoga studio in Austin TX focused on slow flows and mindfulness.",
        cta_text: "Book a class",
        bg_image: "https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=1200&q=80"
      },
      services: [
        { title: "Slow Flow Yoga", desc: "Mindful movement for all levels." },
        { title: "Meditation & Breath", desc: "Find your center and release tension." }
      ],
      pricing: [
        { name: "Drop-in Class", price: "$25", features: ["1 session", "Mat included"] }
      ]
    }
  );

  const [activeTab, setActiveTab] = useState<'preview' | 'edit'>('preview');
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [savedNotification, setSavedNotification] = useState(false);

  const handleHeroChange = (field: string, value: string) => {
    setContent({
      ...content,
      hero: { ...content.hero, [field]: value }
    });
  };

  const handleServiceChange = (index: number, field: string, value: string) => {
    const newServices = [...content.services];
    newServices[index][field] = value;
    setContent({ ...content, services: newServices });
  };

  const handleSave = () => {
    onSaveProject(content);
    setSavedNotification(true);
    setTimeout(() => setSavedNotification(false), 3000);
  };

  return (
    <div className="space-y-6 animate-fadeIn py-6 max-w-7xl mx-auto">
      <div className="bg-neutral-100 dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <Globe className="text-apple-blue w-5 h-5" />
          <h1 className="text-base font-bold text-neutral-900 dark:text-white">Live Preview & CMS</h1>
        </div>

        <div className="flex items-center space-x-3">
          <div className="bg-white dark:bg-neutral-950 p-1 rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-center">
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'preview' ? 'bg-apple-blue text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Preview
            </button>
            <button
              onClick={() => setActiveTab('edit')}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'edit' ? 'bg-apple-blue text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              CMS Editor
            </button>
          </div>

          {activeTab === 'preview' && (
            <div className="bg-white dark:bg-neutral-950 p-1 rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-center">
              <button
                onClick={() => setViewMode('desktop')}
                className={`p-1.5 rounded-lg ${viewMode === 'desktop' ? 'text-apple-blue bg-neutral-100 dark:bg-neutral-900' : 'text-neutral-400'}`}
              >
                <Monitor className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('mobile')}
                className={`p-1.5 rounded-lg ${viewMode === 'mobile' ? 'text-apple-blue bg-neutral-100 dark:bg-neutral-900' : 'text-neutral-400'}`}
              >
                <Smartphone className="w-4 h-4" />
              </button>
            </div>
          )}

          <button
            onClick={handleSave}
            className="bg-apple-blue hover:bg-apple-blueHover text-white font-medium px-4 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 text-xs"
          >
            <Save className="w-3.5 h-3.5" /> Save changes
          </button>
        </div>
      </div>

      {savedNotification && (
        <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 text-apple-blue p-3 rounded-xl text-center text-xs font-medium">
          Changes saved successfully!
        </div>
      )}

      {activeTab === 'edit' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-neutral-100 dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 space-y-4">
            <h2 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <Edit3 className="text-apple-blue w-4 h-4" /> Hero Section Editor
            </h2>
            <div>
              <label className="block text-xs font-medium text-neutral-500 uppercase mb-1">Title (H1)</label>
              <input
                type="text"
                value={content.hero.title}
                onChange={(e) => handleHeroChange('title', e.target.value)}
                className="w-full bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 uppercase mb-1">Subtitle</label>
              <textarea
                value={content.hero.subtitle}
                onChange={(e) => handleHeroChange('subtitle', e.target.value)}
                rows={3}
                className="w-full bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>

          <div className="bg-neutral-100 dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 space-y-4">
            <h2 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <Globe className="text-apple-blue w-4 h-4" /> Services Editor
            </h2>
            {content.services.map((srv: any, idx: number) => (
              <div key={idx} className="bg-white dark:bg-neutral-950 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 space-y-2">
                <span className="text-xs font-bold text-apple-blue">Service {idx + 1}</span>
                <input
                  type="text"
                  value={srv.title}
                  onChange={(e) => handleServiceChange(idx, 'title', e.target.value)}
                  className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1.5 text-xs"
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex justify-center">
          <div className={`transition-all duration-300 ${viewMode === 'mobile' ? 'w-[380px]' : 'w-full'} bg-white dark:bg-neutral-950 rounded-3xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-apple`}>
            <div className="bg-neutral-100 dark:bg-neutral-900 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div className="flex space-x-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
              </div>
              <div className="bg-white dark:bg-neutral-950 px-3 py-1 rounded-md text-xs text-neutral-400 border border-neutral-200 dark:border-neutral-800">
                lotuslinen.com
              </div>
              <div></div>
            </div>

            <div className="text-neutral-900 dark:text-white min-h-[500px]">
              <div className="relative py-28 px-8 text-center bg-cover bg-center" style={{ backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0.7)), url(${content.hero.bg_image})` }}>
                <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight">{content.hero.title}</h1>
                <p className="mt-3 text-sm md:text-base text-neutral-200 max-w-xl mx-auto">{content.hero.subtitle}</p>
                <div className="mt-6">
                  <button className="bg-white text-neutral-900 font-medium px-6 py-2.5 rounded-full shadow-lg hover:bg-neutral-100 transition-all text-sm">
                    {content.hero.cta_text || 'Book a class'}
                  </button>
                </div>
              </div>

              <div className="py-16 px-8 max-w-4xl mx-auto">
                <h2 className="text-2xl font-bold text-center mb-8">Offerings</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {content.services.map((srv: any, idx: number) => (
                    <div key={idx} className="bg-neutral-50 dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800">
                      <h3 className="text-base font-semibold text-neutral-900 dark:text-white">{srv.title}</h3>
                      <p className="mt-1 text-xs text-neutral-500">{srv.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};