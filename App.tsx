
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { GeminiService } from './services/geminiService';
import { ResourceType, SearchResult, GroundingSource, ScoutLog, ScoutProgress } from './types';
import ResultCard from './components/ResultCard';
import ResourceViewer from './components/ResourceViewer';
import * as Icons from './components/Icons';
import Tooltip from './components/Tooltip';

const HISTORY_KEY = 'omniscout_history_v3';
const LIBRARY_KEY = 'omniscout_library';
const SESSION_VAULT_KEY = 'omniscout_session_vault';

type SystemMode = 'standard' | 'stealth' | 'neural' | 'matrix';

const App: React.FC = () => {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<ResourceType>('all');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ScoutProgress | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [sources, setSources] = useState<GroundingSource[]>([]);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ScoutLog[]>([]);
  const [library, setLibrary] = useState<SearchResult[]>([]);
  const [sessionVault, setSessionVault] = useState<SearchResult[]>([]);
  const [selectedResource, setSelectedResource] = useState<SearchResult | null>(null);
  
  // Layout States
  const [systemMode, setSystemMode] = useState<SystemMode>('standard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [vaultSearch, setVaultSearch] = useState('');
  const [isFooterMinimized, setIsFooterMinimized] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  // Filter States
  const [filterText, setFilterText] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<ResourceType[]>([]);
  const [sortBy, setSortBy] = useState<'default' | 'alpha'>('default');

  const gemini = useRef(new GeminiService());

  const isStealth = systemMode === 'stealth';
  const isNeural = systemMode === 'neural';
  const isMatrix = systemMode === 'matrix';

  useEffect(() => {
    const savedHistory = localStorage.getItem(HISTORY_KEY);
    const savedLibrary = localStorage.getItem(LIBRARY_KEY);
    const savedVault = sessionStorage.getItem(SESSION_VAULT_KEY);
    
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    if (savedLibrary) setLibrary(JSON.parse(savedLibrary));
    if (savedVault) setSessionVault(JSON.parse(savedVault));

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addToHistory = (q: string, count: number, type: ResourceType) => {
    if (isStealth) return;
    const newEntry: ScoutLog = { query: q.trim(), timestamp: Date.now(), resultCount: count, type };
    const newHistory = [newEntry, ...history.filter(h => h.query.toLowerCase() !== q.trim().toLowerCase())].slice(0, 20);
    setHistory(newHistory);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
  };

  const clearSessionVault = () => {
    setSessionVault([]);
    sessionStorage.removeItem(SESSION_VAULT_KEY);
    setVaultOpen(false);
  };

  const startNewScout = () => {
    setResults([]);
    setSources([]);
    setSummary('');
    setQuery('');
    setError(null);
    setFilterText('');
    setSelectedTypes([]);
    setActiveTab('all');
    setMenuOpen(false);
    clearSessionVault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const performScout = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResults([]);
    setSources([]);
    setSummary('');
    
    const stages = [
      { p: 10, s: isMatrix ? 'LOADING_CORE_NODE' : 'Waking Neural Node...' },
      { p: 40, s: isMatrix ? 'INFILTRATING_GRID' : 'Infiltrating Web Fabric...' },
      { p: 70, s: isMatrix ? 'HARVESTING_ASSETS' : 'Aggregating Asset Streams...' },
      { p: 95, s: isMatrix ? 'CHECKSUM_VERIFIED' : 'Verifying Checksums...' }
    ];

    let currentStage = 0;
    const interval = setInterval(() => {
      if (currentStage < stages.length) {
        setProgress(stages[currentStage]);
        currentStage++;
      }
    }, 1000);

    try {
      const response = await gemini.current.scout(searchQuery, activeTab === 'library' ? 'all' : activeTab);
      clearInterval(interval);
      setProgress({ percent: 100, status: isMatrix ? 'DATA_SYNC_SUCCESS' : 'Exfiltration Complete' });
      
      setResults(response.results);
      setSources(response.sources);
      setSummary(response.answer);
      
      setSessionVault(prev => {
        const currentVault = Array.isArray(prev) ? prev : [];
        const existingUrls = new Set(currentVault.map(p => p.sourceUrl));
        const uniqueNew = response.results.filter(r => !existingUrls.has(r.sourceUrl));
        const updated = [...currentVault, ...uniqueNew];
        sessionStorage.setItem(SESSION_VAULT_KEY, JSON.stringify(updated));
        if (updated.length > 0 && !vaultOpen) setVaultOpen(true);
        return updated;
      });
      
      addToHistory(searchQuery, response.results.length, activeTab);
      setTimeout(() => setProgress(null), 1000);
    } catch (err: any) {
      clearInterval(interval);
      setError(err.message || 'Signal lost.');
      setProgress(null);
    } finally {
      setLoading(false);
    }
  }, [activeTab, loading, vaultOpen, isStealth, isMatrix]);

  const saveAllToLibrary = () => {
    setLibrary(prev => {
      const existingUrls = new Set(prev.map(p => p.sourceUrl));
      const uniqueToSave = sessionVault.filter(r => !existingUrls.has(r.sourceUrl)).map(r => ({ ...r, savedAt: Date.now() }));
      const updated = [...prev, ...uniqueToSave];
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(updated));
      return updated;
    });
    setVaultOpen(false);
  };

  const getAccentColor = () => {
    if (isStealth) return 'text-purple-500';
    if (isNeural) return 'text-amber-500';
    if (isMatrix) return 'text-[#00FF41]';
    return 'text-blue-500';
  };

  const getAccentBg = () => {
    if (isStealth) return 'bg-purple-600';
    if (isNeural) return 'bg-amber-600';
    if (isMatrix) return 'bg-[#00FF41]';
    return 'bg-blue-600';
  };

  const processedResults = useMemo(() => {
    let pool = activeTab === 'library' ? library : results;
    let filtered = pool.filter(res => {
      const matchesText = !filterText || res.title.toLowerCase().includes(filterText.toLowerCase());
      const matchesType = selectedTypes.length === 0 || selectedTypes.includes(res.type);
      return matchesText && matchesType;
    });
    if (sortBy === 'alpha') filtered = [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    return filtered;
  }, [results, library, activeTab, filterText, selectedTypes, sortBy]);

  const filteredVault = useMemo(() => {
    const safeVault = Array.isArray(sessionVault) ? sessionVault : [];
    return safeVault.filter(v => v.title.toLowerCase().includes(vaultSearch.toLowerCase()));
  }, [sessionVault, vaultSearch]);

  const vaultGroups = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {};
    filteredVault.forEach(item => {
      if (!groups[item.type]) groups[item.type] = [];
      groups[item.type].push(item);
    });
    return groups;
  }, [filteredVault]);

  return (
    <div className={`min-h-screen transition-all duration-700 relative overflow-hidden ${isStealth ? 'bg-[#0a0514]' : isNeural ? 'bg-[#0a0a05]' : isMatrix ? 'bg-[#000802]' : 'bg-[#020617]'} ${isMatrix ? 'font-mono' : ''} text-slate-200 selection:bg-white/10 ${isFooterMinimized ? 'pb-16' : 'pb-44'}`}>
      
      {/* Matrix Special Effects Overlay */}
      {isMatrix && (
        <>
          <div className="fixed inset-0 pointer-events-none z-[1] opacity-[0.03]" style={{ background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 2px, 3px 100%' }}></div>
          <div className="fixed inset-0 pointer-events-none z-[1] opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(#00FF41 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }}></div>
          <div className="matrix-scanline"></div>
        </>
      )}

      {/* Search Progress Bar */}
      {progress && (
        <div className="fixed top-0 left-0 right-0 z-[110] h-1.5 bg-white/5">
          <div className={`h-full transition-all duration-500 ease-out shadow-[0_0_20px] ${isStealth ? 'bg-purple-500 shadow-purple-500' : isNeural ? 'bg-amber-500 shadow-amber-500' : isMatrix ? 'bg-[#00FF41] shadow-[#00FF41]/50' : 'bg-blue-500 shadow-blue-500'}`} style={{ width: `${progress.percent}%` }} />
        </div>
      )}

      {/* LEFT SIDEBAR: Session Vault */}
      <div className={`fixed top-0 left-0 bottom-0 w-96 glass z-[90] transition-transform duration-500 border-r border-white/10 backdrop-blur-4xl ${vaultOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full p-8 relative z-10">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3">
              <Icons.Library className={`w-5 h-5 ${getAccentColor()}`} />
              <h2 className={`text-sm font-black uppercase tracking-[0.4em] text-white ${isMatrix ? 'animate-pulse' : ''}`}>
                {isMatrix ? 'DATA_CACHE' : 'Cache Vault'}
              </h2>
            </div>
            <button onClick={() => setVaultOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
              <Icons.X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          <div className="mb-6 space-y-4">
            <input 
              type="text" 
              value={vaultSearch}
              onChange={(e) => setVaultSearch(e.target.value)}
              placeholder={isMatrix ? '> FILTER_SEARCH' : 'Search cache...'} 
              className={`w-full bg-slate-950/50 border border-white/5 rounded-xl py-3 px-4 text-xs text-white outline-none focus:border-white/10 transition-all ${isMatrix ? 'border-[#00FF41]/20 focus:border-[#00FF41]/50' : ''}`}
            />
            {sessionVault.length > 0 && (
              <div className="flex gap-2">
                <button onClick={saveAllToLibrary} className={`flex-grow py-3 rounded-xl text-[10px] font-black uppercase text-white transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2 ${isMatrix ? 'bg-[#00FF41] text-black hover:bg-[#00CC33]' : getAccentBg()}`}>
                  <Icons.BookmarkCheck className="w-4 h-4" />
                  {isMatrix ? 'SYNC_LIBRARY' : 'Sync to Library'}
                </button>
                <button onClick={clearSessionVault} className="px-4 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all border border-red-500/20">
                  <Icons.Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
            {Object.keys(vaultGroups).length > 0 ? (Object.entries(vaultGroups) as [string, SearchResult[]][]).map(([type, items]) => (
              <div key={type} className="mb-8">
                <div className="flex items-center gap-3 mb-4 text-[9px] font-black text-slate-600 uppercase tracking-widest px-1">
                  <span>{isMatrix ? `EXTRACT_${type.toUpperCase()}` : `${type} • ${items.length}`}</span>
                  <div className={`h-px flex-grow ${isMatrix ? 'bg-[#00FF41]/10' : 'bg-white/5'}`}></div>
                </div>
                <div className="space-y-1.5">
                  {items.map(item => (
                    <button key={item.id} onClick={() => setSelectedResource(item)} className={`w-full text-left p-3.5 hover:bg-white/5 rounded-xl transition-all flex items-center gap-4 group ${isMatrix ? 'hover:border-[#00FF41]/20 border border-transparent' : ''}`}>
                      <Icons.ArrowRight className={`w-3.5 h-3.5 text-slate-700 group-hover:translate-x-1 transition-all ${isMatrix ? 'group-hover:text-[#00FF41]' : 'group-hover:text-blue-500'}`} />
                      <h4 className="text-[11px] font-bold text-slate-300 truncate group-hover:text-white leading-none">{item.title}</h4>
                    </button>
                  ))}
                </div>
              </div>
            )) : (
              <div className="text-center py-20 opacity-20">
                <Icons.Layers className="w-12 h-12 mx-auto mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest">{isMatrix ? 'NULL_SET' : 'No assets cached'}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT SIDEBAR: Command Journal */}
      <div className={`fixed top-0 right-0 bottom-0 w-96 glass z-[90] transition-transform duration-500 border-l border-white/10 backdrop-blur-4xl ${journalOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col h-full p-8 relative z-10">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3">
              <Icons.Terminal className={`w-5 h-5 ${getAccentColor()}`} />
              <h2 className="text-sm font-black uppercase tracking-[0.4em] text-white">{isMatrix ? 'NODE_LOG' : 'Journal'}</h2>
            </div>
            <button onClick={() => setJournalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
              <Icons.X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          <div className="flex-grow overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {history.length > 0 ? history.map((log, i) => (
              <div key={i} className={`group p-5 bg-white/5 rounded-2xl border transition-all ${isMatrix ? 'border-[#00FF41]/10 hover:border-[#00FF41]/30' : 'border-white/5 hover:border-white/20'}`}>
                <div className="flex justify-between items-start mb-2 text-[10px] font-mono text-slate-600">
                  <span>[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                  <span className={`px-2 py-0.5 rounded border ${getAccentColor()} border-current opacity-60 text-[8px] font-black uppercase tracking-tighter`}>{log.type}</span>
                </div>
                <h4 className="text-sm font-bold text-slate-300 line-clamp-1 mb-2 group-hover:text-white leading-none">{log.query}</h4>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black text-slate-500 uppercase">{log.resultCount} {isMatrix ? 'ENTRIES' : 'Assets'}</span>
                  <button onClick={() => { setQuery(log.query); performScout(log.query); setJournalOpen(false); }} className={`p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${isMatrix ? 'bg-[#00FF41] text-black' : getAccentBg()} text-white`}>
                    <Icons.RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )) : <div className="text-center py-20 opacity-20"><Icons.History className="w-12 h-12 mx-auto mb-4" /><p className="text-[10px] font-black uppercase tracking-widest">Journal Empty</p></div>}
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-[60] py-6 px-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className={`flex items-center gap-4 glass px-6 py-3.5 rounded-2xl border transition-all ${isMatrix ? 'border-[#00FF41]/30 shadow-[0_0_15px_rgba(0,255,65,0.1)]' : 'border-white/10'}`}>
             <Icons.Layers className={`w-5 h-5 ${getAccentColor()}`} />
             <div className="flex flex-col">
               <span className={`text-sm font-black uppercase text-white leading-none ${isMatrix ? 'tracking-[0.1em]' : ''}`}>OmniScout</span>
               <span className={`text-[9px] font-black uppercase tracking-[0.3em] mt-1.5 ${getAccentColor()}`}>{systemMode.toUpperCase()} NODE</span>
             </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={startNewScout} className={`flex items-center gap-2.5 glass px-6 py-4 rounded-2xl border border-white/10 text-[10px] font-black uppercase hover:text-white transition-all ${getAccentBg()}/0 hover:${getAccentBg()} ${isMatrix ? 'hover:text-black border-[#00FF41]/20' : ''}`}><Icons.Plus className="w-4 h-4" />New Scout</button>
            <button onClick={() => setJournalOpen(!journalOpen)} className={`p-4 rounded-2xl border border-white/10 glass transition-all ${journalOpen ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'} ${isMatrix && journalOpen ? 'border-[#00FF41]/50 text-[#00FF41]' : ''}`}><Icons.Terminal className="w-5 h-5" /></button>
            <button onClick={() => setVaultOpen(!vaultOpen)} className={`relative p-4 rounded-2xl border border-white/10 glass transition-all ${sessionVault.length > 0 ? getAccentColor() + ' animate-pulse-slow' : (vaultOpen ? 'text-white bg-white/10' : 'text-slate-400 hover:text-white')} ${isMatrix && vaultOpen ? 'border-[#00FF41]/50' : ''}`}>
              <Icons.Library className="w-5 h-5" />
              {sessionVault.length > 0 && <span className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white ${getAccentBg()} ${isMatrix ? 'text-black' : ''}`}>{sessionVault.length}</span>}
            </button>
            
            {/* PROTOCOLS SELECTOR */}
            <div className="relative" ref={menuRef}>
              <button onClick={() => setMenuOpen(!menuOpen)} className={`p-4 rounded-2xl border border-white/10 glass transition-all ${menuOpen ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'} ${isMatrix ? 'border-[#00FF41]/30 hover:border-[#00FF41]/50' : ''}`}>
                <Icons.MoreVertical className="w-5 h-5" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-4 w-64 glass border border-white/10 rounded-[2rem] p-5 shadow-4xl animate-in zoom-in-95 duration-200 origin-top-right z-[120]">
                   <div className="mb-4 px-2">
                     <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Node Protocol</span>
                   </div>
                   <div className="space-y-1">
                    {[
                      { id: 'standard', label: 'Standard', icon: <Icons.LayoutDashboard className="w-4 h-4" /> },
                      { id: 'stealth', label: 'Stealth', icon: <Icons.Ghost className="w-4 h-4" /> },
                      { id: 'neural', label: 'Neural', icon: <Icons.Crosshair className="w-4 h-4" /> },
                      { id: 'matrix', label: 'Matrix', icon: <Icons.Terminal className="w-4 h-4" /> }
                    ].map((mode) => (
                      <button 
                        key={mode.id} 
                        onClick={() => { setSystemMode(mode.id as SystemMode); setMenuOpen(false); }} 
                        className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${systemMode === mode.id ? (isMatrix && mode.id === 'matrix' ? 'bg-[#00FF41] text-black' : getAccentBg() + ' text-white') : 'hover:bg-white/5 text-slate-400 hover:text-white'}`}
                      >
                        {mode.icon}
                        <span className="text-xs font-bold uppercase tracking-widest leading-none">{mode.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Matrix Container */}
      <main className="pt-48 pb-20 px-6 max-w-7xl mx-auto relative z-[5]">
        <div className="max-w-4xl mx-auto text-center mb-24 relative">
          {/* Neural Radar Ping Animation */}
          {loading && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[32rem] h-[32rem] pointer-events-none">
              <div className={`absolute inset-0 border border-current rounded-full animate-ping opacity-10 ${getAccentColor()}`}></div>
              <div className={`absolute inset-16 border border-current rounded-full animate-ping opacity-5 ${getAccentColor()}`} style={{ animationDelay: '0.5s' }}></div>
              <div className={`absolute inset-32 border border-current rounded-full animate-ping opacity-5 ${getAccentColor()}`} style={{ animationDelay: '1s' }}></div>
              {isMatrix && (
                <div className="absolute inset-0 border-[0.5px] border-[#00FF41]/20 rounded-full scale-[1.5] opacity-20 animate-pulse"></div>
              )}
            </div>
          )}
          
          <h1 className={`text-8xl font-black tracking-tighter text-white mb-10 leading-none ${isMatrix ? 'tracking-[-0.05em]' : ''}`}>
            Omni<span className={`transition-all duration-1000 ${isStealth ? 'text-purple-500' : isNeural ? 'text-amber-500' : isMatrix ? 'text-[#00FF41] matrix-glow' : 'gradient-text'}`}>Scout</span>
          </h1>
          
          <form onSubmit={e => { e.preventDefault(); performScout(query); }} className="relative group">
            <Icons.Search className={`absolute left-8 top-1/2 -translate-y-1/2 w-7 h-7 ${isMatrix ? 'text-[#00FF41]/50' : 'text-slate-500'}`} />
            <input 
              type="text" 
              value={query} 
              onChange={e => setQuery(e.target.value)} 
              placeholder={isMatrix ? '> EXECUTE_SEARCH_QUERY' : "Infiltrate search matrix (e.g. 'Advanced AI PDF Research')..."} 
              className={`w-full bg-slate-900/60 border border-white/10 rounded-[2.5rem] py-8 pl-20 pr-44 outline-none text-white text-xl shadow-4xl backdrop-blur-2xl transition-all focus:border-white/20 ${isMatrix ? 'font-mono text-[#00FF41] border-[#00FF41]/20 focus:border-[#00FF41]/50 focus:shadow-[0_0_30px_rgba(0,255,65,0.05)] placeholder:text-[#00FF41]/20' : ''}`} 
            />
            <button type="submit" disabled={loading || !query.trim()} className={`absolute right-4 top-4 bottom-4 px-12 disabled:opacity-50 text-white font-black uppercase tracking-widest text-[11px] rounded-[1.8rem] transition-all ${isMatrix ? 'bg-[#00FF41] text-black hover:bg-[#00CC33]' : getAccentBg()}`}>
              {loading ? <Icons.Loader2 className="animate-spin w-5 h-5" /> : (isMatrix ? 'RUN' : 'Scout')}
            </button>
          </form>

          <div className="flex flex-wrap justify-center gap-4 mt-16 pt-12 border-t border-white/5">
            {['all', 'books', 'research', 'media', 'social', 'audio', 'library'].map(tab => (
              <button 
                key={tab} 
                onClick={() => { setActiveTab(tab as ResourceType); if(tab === 'library') startNewScout(); }} 
                className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? (isMatrix ? 'bg-[#00FF41] text-black shadow-[0_0_20px_rgba(0,255,65,0.2)]' : getAccentBg() + ' text-white shadow-xl') : 'bg-slate-900/40 text-slate-500 border border-white/5 hover:text-white'}`}
              >
                {tab === 'all' && <Icons.Compass className="w-3.5 h-3.5" />}
                {tab === 'library' && <Icons.Library className="w-3.5 h-3.5" />}
                {tab}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="max-w-xl mx-auto p-12 glass border-red-500/20 text-center rounded-[3rem] mb-20 animate-in fade-in slide-in-from-bottom-4"><Icons.AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" /><h3 className="text-white font-black uppercase mb-2">Protocol Interrupted</h3><p className="text-slate-400 text-sm">{error}</p></div>}

        {/* Neural Summary Briefing */}
        {summary && !loading && (
          <div className="max-w-7xl mx-auto mb-16 animate-in fade-in slide-in-from-bottom-12 duration-700">
             <div className={`glass p-12 rounded-[3.5rem] border transition-all duration-1000 shadow-5xl relative overflow-hidden ${isMatrix ? 'border-[#00FF41]/20 bg-[#000802]/80' : 'border-white/10'}`}>
                <div className={`absolute top-0 left-0 w-2 h-full ${getAccentBg()}`}></div>
                <div className="flex items-start gap-10">
                   <div className={`p-6 rounded-3xl ${getAccentBg()} text-white shadow-2xl flex-shrink-0 ${isMatrix ? 'text-black' : ''}`}><Icons.Info className="w-8 h-8" /></div>
                   <div className="flex-grow">
                      <h2 className={`text-[11px] font-black uppercase tracking-[0.5em] text-slate-500 mb-2 ${isMatrix ? 'text-[#00FF41]/50' : ''}`}>{isMatrix ? 'INTEL_RECOVERY' : 'Intelligence Briefing'}</h2>
                      <p className={`text-2xl font-bold text-white tracking-tight leading-relaxed mb-10 max-w-5xl ${isMatrix ? 'font-mono text-[#00FF41]' : ''}`}>
                        {summary}
                      </p>
                      {sources.length > 0 && (
                        <div className={`pt-8 border-t flex flex-wrap gap-3 ${isMatrix ? 'border-[#00FF41]/10' : 'border-white/5'}`}>
                           <span className={`text-[9px] font-black uppercase tracking-widest mr-4 self-center ${isMatrix ? 'text-[#00FF41]/30' : 'text-slate-600'}`}>Grounding Matrix:</span>
                           {sources.map((s, idx) => (
                             <a key={idx} href={s.uri} target="_blank" className={`flex items-center gap-2.5 px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all border group ${isMatrix ? 'border-[#00FF41]/10 hover:border-[#00FF41]/40' : 'border-white/5'}`}>
                               <Icons.ExternalLink className={`w-3.5 h-3.5 group-hover:scale-110 transition-transform ${isMatrix ? 'text-[#00FF41]' : 'text-blue-500'}`} />
                               <span className={`text-[10px] font-bold truncate max-w-[200px] ${isMatrix ? 'text-[#00FF41]/70 group-hover:text-[#00FF41]' : 'text-slate-400 group-hover:text-white'}`}>{s.title}</span>
                             </a>
                           ))}
                        </div>
                      )}
                   </div>
                </div>
             </div>
          </div>
        )}

        {/* Results Matrix */}
        {!loading && processedResults.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {processedResults.map(res => (
              <ResultCard 
                key={res.id} 
                result={res} 
                onOpenViewer={setSelectedResource} 
                isSaved={sessionVault.some(v => v.sourceUrl === res.sourceUrl)} 
                onToggleSave={() => setSessionVault(prev => prev.some(v => v.sourceUrl === res.sourceUrl) ? prev.filter(v => v.sourceUrl !== res.sourceUrl) : [...prev, res])} 
              />
            ))}
          </div>
        )}
      </main>

      {selectedResource && <ResourceViewer resource={selectedResource} onClose={() => setSelectedResource(null)} />}

      {/* Persistent Footer Status */}
      <footer className={`fixed bottom-0 left-0 right-0 glass border-t border-white/10 z-[80] transition-all duration-500 ${isFooterMinimized ? 'h-14' : 'h-40'} ${isMatrix ? 'border-[#00FF41]/20' : ''}`}>
        <div className="max-w-7xl mx-auto h-full px-8 flex items-center justify-between">
           <div className="flex items-center gap-8">
             {/* Mode Indicator */}
             <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full animate-blink ${getAccentBg()} shadow-[0_0_8px] shadow-current`}></div>
                <span className={`text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 ${isMatrix ? 'text-[#00FF41]/50' : ''}`}>Mode: {systemMode.toUpperCase()}</span>
             </div>
             
             <div className="h-4 w-px bg-white/10"></div>
             
             {/* Signal Status Indicator - Green for Active (Standard/Neural/Matrix), Red for Inactive (Stealth or Loading) */}
             <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full animate-blink transition-colors duration-500 ${ (loading || isStealth) ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]'}`}></div>
                <span className={`text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 ${isMatrix ? 'text-[#00FF41]/30' : ''}`}>
                  {isMatrix ? (loading ? 'NODE_LOCKING...' : 'SIGNAL_LOCKED') : `Signal: ${loading ? 'Acquiring...' : (isStealth ? 'Sync Disabled' : 'Sync Active')}`}
                </span>
             </div>
           </div>
           
           <button onClick={() => setIsFooterMinimized(!isFooterMinimized)} className={`p-2 hover:bg-white/5 rounded-xl transition-all text-slate-500 ${isMatrix ? 'hover:text-[#00FF41]' : ''}`}>
             {isFooterMinimized ? <Icons.ChevronUp className="w-5 h-5" /> : <Icons.ChevronDown className="w-5 h-5" />}
           </button>

           <div className="flex items-center gap-6">
              <span className={`text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 ${isMatrix ? 'text-[#00FF41]/30' : ''}`}>{sessionVault.length} {isMatrix ? 'STAGED_PACKETS' : 'Assets Staged'}</span>
              <Icons.Library className={`w-4 h-4 text-slate-600 ${isMatrix ? 'text-[#00FF41]/40' : ''}`} />
           </div>
        </div>
      </footer>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .animate-pulse-slow { animation: pulse 4s infinite ease-in-out; }
        .animate-blink { animation: blink 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
        @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.05); opacity: 0.8; } }
        
        .matrix-glow { text-shadow: 0 0 10px rgba(0, 255, 65, 0.4); }
        .matrix-scanline {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(rgba(18, 16, 16, 0) 0%, rgba(0, 255, 65, 0.05) 50%, rgba(18, 16, 16, 0) 100%);
          background-size: 100% 4px;
          z-index: 2;
          pointer-events: none;
          animation: scanline 8s linear infinite;
        }
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
      `}</style>
    </div>
  );
};

export default App;
