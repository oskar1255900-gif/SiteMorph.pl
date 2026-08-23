import React, { useState, useEffect } from 'react';
import { FolderGit2, Globe, ExternalLink, Github, CheckCircle, Plus } from 'lucide-react';

interface ProjectsManagerProps {
  onOpenProject: (project: any) => void;
  onNewProject: () => void;
}

export const ProjectsManager: React.FC<ProjectsManagerProps> = ({ onOpenProject, onNewProject }) => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportingId, setExportingId] = useState<number | null>(null);
  const [repoName, setRepoName] = useState('');
  
  const GITHUB_CLIENT_ID = "Ov23liSJrmj4RJUmCC1Z";
  const GITHUB_CLIENT_SECRET = "27f4577c7ca60a6dc1b73cbf73471b8d0147044b";

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects/');
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error('Błąd pobierania projektów', err);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleGitHubExport = async (projectId: number) => {
    if (!repoName) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/export-github`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_name: repoName,
          github_token: GITHUB_CLIENT_SECRET
        }),
      });
      const data = await res.json();
      alert(data.message);
      setExportingId(null);
      setRepoName('');
      fetchProjects();
    } catch (err) {
      console.error('Błąd eksportu do GitHuba', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FolderGit2 className="text-lime-400 w-7 h-7" /> Project Manager & GitHub Sync
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Zarządzaj swoimi serwisami, edytuj je w locie oraz eksportuj gotowy kod bezpośrednio do repozytorium GitHub.
          </p>
        </div>
        <button
          onClick={onNewProject}
          className="bg-lime-400 hover:bg-lime-300 text-slate-950 font-bold px-6 py-3 rounded-xl transition-all shadow-neon flex items-center justify-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" /> Nowy Projekt
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((proj) => (
          <div key={proj.id} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 hover:border-lime-400/50 transition-all flex flex-col justify-between group">
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className="px-3 py-1 bg-lime-400/10 text-lime-400 border border-lime-400/20 rounded-full text-xs font-bold">
                  {proj.niche}
                </span>
                <span className="text-xs text-slate-400 font-mono">{proj.domain}</span>
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-lime-400 transition-colors">
                {proj.name}
              </h3>
              <p className="text-xs text-slate-400 mt-2">
                GitHub Client ID: <span className="text-lime-400 font-mono">{GITHUB_CLIENT_ID.substring(0, 8)}...</span>
              </p>
              {proj.github_repo && (
                <a
                  href={proj.github_repo}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs text-lime-400 bg-lime-400/10 px-3 py-1 rounded-lg border border-lime-400/20 hover:bg-lime-400/20 transition-all"
                >
                  <Github className="w-3.5 h-3.5" /> Zsynchronizowano z GitHub <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={() => onOpenProject(proj)}
                className="bg-slate-800 hover:bg-lime-400 hover:text-slate-950 text-slate-200 px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
              >
                <Globe className="w-3.5 h-3.5" /> Edytuj / CMS
              </button>

              <button
                onClick={() => setExportingId(proj.id)}
                className="bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
              >
                <Github className="w-3.5 h-3.5 text-lime-400" /> Eksport GitHub
              </button>
            </div>

            {exportingId === proj.id && (
              <div className="mt-4 p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3 animate-fadeIn">
                <span className="text-xs font-bold text-lime-400">Podaj nazwę repozytorium GitHub:</span>
                <input
                  type="text"
                  placeholder="np. sitemorph-projekt-1"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 text-xs focus:border-lime-400"
                />
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleGitHubExport(proj.id)}
                    disabled={loading}
                    className="flex-1 bg-lime-400 hover:bg-lime-300 text-slate-950 text-xs font-bold py-2 rounded-lg transition-all"
                  >
                    {loading ? 'Wysyłanie...' : 'Wyślij kod'}
                  </button>
                  <button
                    onClick={() => setExportingId(null)}
                    className="px-3 bg-slate-800 text-slate-300 text-xs py-2 rounded-lg"
                  >
                    Anuluj
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};