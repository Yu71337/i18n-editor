import { useState, useMemo, useEffect } from 'react';
import { parseXliff, buildXliff } from './utils/xliffParser';
import { parseXlsx, buildXlsx, buildExcelForExport, parseExcelForBatchOverwrite } from './utils/xlsxParser';
import type { TransUnit } from './utils/xliffParser';
import { TranslationCard } from './components/TranslationCard';
import { Download, Upload, Settings, Languages, Bot, Search, FileSpreadsheet, FileUp } from 'lucide-react';
import { generateAISuggestion } from './utils/aiTranslation';

const defaultPrompt = `You are a translation engine. Translate the following text to exactly: {{targetLang}}.
CRITICAL INSTRUCTIONS:
1. Output ONLY the raw translated text.
2. DO NOT include greetings, thinking steps, explanations, or quotes.
3. DO NOT use markdown code blocks.
4. Keep standard localized button phrases unchanged if conventional.
5. Do not translate variables wrapped in {}; keep them exactly as formatted.`;

export default function App() {
  const [doc, setDoc] = useState<Document | null>(null);
  const [uploadType, setUploadType] = useState<'xliff' | 'xlsx' | null>(null);
  const [targetLang, setTargetLang] = useState('en');
  const [items, setItems] = useState<TransUnit[]>([]);
  const [updates, setUpdates] = useState<Record<string, {target: string, state: string}>>({});
  
  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState({
    apiKey: localStorage.getItem('xliff_apikey') || '',
    baseUrl: localStorage.getItem('xliff_baseurl') || 'https://api.openai.com/v1',
    model: localStorage.getItem('xliff_model') || 'gpt-4o-mini',
    provider: (localStorage.getItem('xliff_provider') as 'openai' | 'gemini') || 'openai',
    systemPrompt: localStorage.getItem('xliff_systemPrompt') || defaultPrompt
  });

  // Draft Filters
  const [draftSearchId, setDraftSearchId] = useState('');
  const [draftSearchSource, setDraftSearchSource] = useState('');
  const [draftSearchTarget, setDraftSearchTarget] = useState('');
  const [draftSearchNotSource, setDraftSearchNotSource] = useState('');
  const [draftSearchNotTarget, setDraftSearchNotTarget] = useState('');
  const [draftSearchState, setDraftSearchState] = useState('All');
  const [draftSearchLengthRatio, setDraftSearchLengthRatio] = useState('All');
  const [draftSearchCustomRatio, setDraftSearchCustomRatio] = useState('1.5');
  const [draftSearchNoChange, setDraftSearchNoChange] = useState(false);

  // Applied Filters
  const [appliedFilters, setAppliedFilters] = useState({
    id: '', source: '', target: '', notSource: '', notTarget: '', state: 'All', lengthRatio: 'All', customRatio: '0', noChange: false
  });

  // Batch state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchState, setBatchState] = useState('translated');
  
  // Global Loading
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem('xliff_apikey', config.apiKey);
    localStorage.setItem('xliff_baseurl', config.baseUrl);
    localStorage.setItem('xliff_model', config.model);
    localStorage.setItem('xliff_provider', config.provider);
    localStorage.setItem('xliff_systemPrompt', config.systemPrompt);
  }, [config]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const isXlsx = file.name.toLowerCase().endsWith('.xlsx');
    
    const applyParsed = (parsed: any, type: 'xliff' | 'xlsx', rawDoc: any) => {
        setUploadType(type);
        setDoc(rawDoc);
        if (parsed.targetLanguage) setTargetLang(parsed.targetLanguage);
        setItems(parsed.items);
        setUpdates({});
        setSelectedIds([]);
        setAppliedFilters({ id: '', source: '', target: '', notSource: '', notTarget: '', state: 'All', lengthRatio: 'All', customRatio: '0' });
        setDraftSearchId('');
        setDraftSearchSource('');
        setDraftSearchTarget('');
        setDraftSearchNotSource('');
        setDraftSearchNotTarget('');
        setDraftSearchState('All');
        setDraftSearchLengthRatio('All');
        setDraftSearchCustomRatio('1.5');
        setDraftSearchNoChange(false);
    }

    if (isXlsx) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const buf = evt.target?.result as ArrayBuffer;
          applyParsed(parseXlsx(buf), 'xlsx', null);
        } catch (err) {
          alert("Failed to parse XLSX file");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const text = evt.target?.result as string;
          const parsed = parseXliff(text);
          applyParsed(parsed, 'xliff', parsed._doc);
        } catch (err) {
          alert("Failed to parse XLIFF file");
        }
      };
      reader.readAsText(file);
    }
    
    e.target.value = '';
  };

  const handleDownload = () => {
    if (uploadType === 'xlsx') {
      const buf = buildXlsx(items, updates);
      const blob = new Blob([buf], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `translations_${targetLang}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (uploadType === 'xliff' && doc) {
      const newXmlStr = buildXliff(doc, updates);
      const blob = new Blob([newXmlStr], { type: "text/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `translations_${targetLang}.xliff`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleExportExcelFiltered = () => {
    const buf = buildExcelForExport(filteredItems, updates);
    const blob = new Blob([buf], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `translations_filtered_${targetLang}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpdate = (id: string, target: string, state: string) => {
    setUpdates(prev => ({ ...prev, [id]: { target, state } }));
  };

  const handleApplySearch = () => {
    setAppliedFilters({
      id: draftSearchId,
      source: draftSearchSource,
      target: draftSearchTarget,
      notSource: draftSearchNotSource,
      notTarget: draftSearchNotTarget,
      state: draftSearchState,
      lengthRatio: draftSearchLengthRatio,
      customRatio: draftSearchLengthRatio === 'Custom' ? draftSearchCustomRatio : '0',
      noChange: draftSearchNoChange
    });
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const currentTarget = updates[item.id]?.target ?? item.target;
      const currentState = updates[item.id]?.state ?? item.state;
      
      const sourceLen = item.source.length;
      const targetLen = currentTarget.length;
      const ratio = targetLen / Math.max(sourceLen, 1);
      
      if (appliedFilters.lengthRatio === '< 1.5x' && ratio >= 1.5) return false;
      if (appliedFilters.lengthRatio === '1.5x - 2.0x' && (ratio < 1.5 || ratio > 2.0)) return false;
      if (appliedFilters.lengthRatio === '> 2.0x' && ratio <= 2.0) return false;
      if (appliedFilters.lengthRatio === 'Custom' && ratio <= parseFloat(appliedFilters.customRatio || '0')) return false;
      
      if (appliedFilters.state !== 'All' && currentState !== appliedFilters.state) return false;
      if (appliedFilters.id && !item.id.toLowerCase().includes(appliedFilters.id.toLowerCase())) return false;
      if (appliedFilters.source && !item.source.toLowerCase().includes(appliedFilters.source.toLowerCase())) return false;
      if (appliedFilters.target && !currentTarget.toLowerCase().includes(appliedFilters.target.toLowerCase())) return false;
      
      if (appliedFilters.notSource && item.source.toLowerCase().includes(appliedFilters.notSource.toLowerCase())) return false;
      if (appliedFilters.notTarget && currentTarget.toLowerCase().includes(appliedFilters.notTarget.toLowerCase())) return false;
      
      if (appliedFilters.noChange && item.source !== currentTarget) return false;
      
      return true;
    });
  }, [items, updates, appliedFilters]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredItems.map(i => i.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBatchSync = () => {
    const newUpdates = { ...updates };
    selectedIds.forEach(id => {
      const item = items.find(i => i.id === id);
      if (item) {
        newUpdates[id] = { target: item.source, state: 'translated' };
      }
    });
    setUpdates(newUpdates);
  };

  const handleBatchState = () => {
    const newUpdates = { ...updates };
    selectedIds.forEach(id => {
      const currentTarget = updates[id]?.target ?? items.find(i => i.id === id)?.target ?? '';
      newUpdates[id] = { target: currentTarget, state: batchState };
    });
    setUpdates(newUpdates);
  };

  const handleBatchOverwrite = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const buf = evt.target?.result as ArrayBuffer;
          const excelUpdates = parseExcelForBatchOverwrite(buf);
          const newUpdates = { ...updates };
          let matchedCount = 0;
          
          Object.entries(excelUpdates).forEach(([id, translation]) => {
            const item = items.find(i => i.id === id);
            if (item) {
              newUpdates[id] = { target: translation, state: updates[id]?.state ?? item.state };
              matchedCount++;
            }
          });
          
          setUpdates(newUpdates);
          alert(`Successfully updated ${matchedCount} items via Excel.`);
        } catch (err) {
          alert("Failed to parse Excel file for overwrite");
        }
      };
      reader.readAsArrayBuffer(file);
    };
    input.click();
  };

  const handleBatchAI = async () => {
    if (!config.apiKey) return alert("Configure API key first in Settings.");
    setIsGlobalLoading(true);
    
    let currentUpdates = { ...updates };
    for (const id of selectedIds) {
      const item = items.find(i => i.id === id);
      if (!item) continue;
      
      try {
        const res = await generateAISuggestion({
          sourceText: item.source,
          targetLang,
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          model: config.model,
          provider: config.provider,
          systemPrompt: config.systemPrompt.replace('{{targetLang}}', targetLang)
        });
        currentUpdates = { ...currentUpdates, [id]: { target: res, state: 'translated' } };
        setUpdates({ ...currentUpdates });
      } catch (e: any) {
        console.error(`AI failure on ${id}: ${e.message}`);
      }
    }
    
    setIsGlobalLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans relative">
      {isGlobalLoading && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/40 flex items-center justify-center cursor-wait backdrop-blur-[2px]">
           <div className="bg-white px-6 py-4 rounded-xl shadow-2xl font-bold flex items-center gap-3 text-indigo-700 text-lg">
              <Bot className="animate-pulse" size={28} /> Processing AI Translations...
           </div>
        </div>
      )}

      <header className="bg-white shadow-sm border-b border-slate-200 py-3 px-6 sticky top-0 z-10 flex justify-between items-center">
        <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">MultiLingual AI Editor</h1>
        
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
             Target Language:
             <input type="text" className="border border-slate-300 rounded px-2 py-1 w-32 font-normal text-slate-900" value={targetLang} onChange={e => setTargetLang(e.target.value)} />
          </label>
        
          <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded text-sm font-medium flex items-center gap-2 transition-colors">
            <Upload size={16} /> Open
            <input type="file" accept=".xliff,.xml,.xlsx" className="hidden" onChange={handleFileUpload} />
          </label>
          <button 
            disabled={!uploadType}
            onClick={handleDownload}
            className="disabled:opacity-50 disabled:cursor-not-allowed bg-slate-600 hover:bg-slate-700 text-white px-3 py-2 rounded text-sm font-medium flex items-center gap-2 transition-colors"
            title="Download full file (XLIFF/XLSX)"
          >
            <Download size={16} /> Export
          </button>
          <button 
            disabled={!uploadType}
            onClick={handleExportExcelFiltered}
            className="disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded text-sm font-medium flex items-center gap-2 transition-colors"
            title="Export filtered results to Excel (with ID, 原文, 译文, 状态)"
          >
            <FileSpreadsheet size={16} /> 导出 Excel
          </button>
          <button 
            onClick={() => setShowSettings(true)}
            className="text-slate-500 hover:text-slate-800 p-2"
            title="AI Settings"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      {showSettings && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">AI Configuration</h2>
            <div className="flex flex-col gap-4">
              <label className="text-sm font-medium">
                Provider
                <select className="w-full mt-1 border border-gray-300 rounded p-2" value={config.provider} onChange={e => setConfig({...config, provider: e.target.value as 'openai'|'gemini'})}>
                  <option value="openai">OpenAI (or Compatible)</option>
                  <option value="gemini">Google Gemini natively</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                Base URL
                <input type="text" className="w-full mt-1 border border-gray-300 rounded p-2 font-mono text-xs" value={config.baseUrl} onChange={e => setConfig({...config, baseUrl: e.target.value})} placeholder="e.g. https://api.openai.com/v1" />
              </label>
              <label className="text-sm font-medium">
                Model Name
                <input type="text" className="w-full mt-1 border border-gray-300 rounded p-2 font-mono text-xs" value={config.model} onChange={e => setConfig({...config, model: e.target.value})} />
              </label>
              <label className="text-sm font-medium">
                API Key
                <input type="password" placeholder="sk-..." className="w-full mt-1 border border-gray-300 rounded p-2 font-mono text-xs" value={config.apiKey} onChange={e => setConfig({...config, apiKey: e.target.value})} />
              </label>
              <label className="text-sm font-medium flex flex-col">
                System Prompt (Use {"{{targetLang}}"} for language dynamic injection)
                <textarea 
                  className="w-full mt-1 border border-gray-300 rounded p-2 font-mono text-xs min-h-[150px]" 
                  value={config.systemPrompt} 
                  onChange={e => setConfig({...config, systemPrompt: e.target.value})} 
                />
              </label>
            </div>
            <div className="mt-6 flex justify-between">
              <button 
                onClick={() => setConfig({...config, systemPrompt: defaultPrompt})}
                className="text-slate-500 hover:text-slate-800 text-sm font-medium px-4 py-2"
              >
                Reset Prompt
              </button>
              <button 
                onClick={() => setShowSettings(false)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded transition-colors"
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto p-6">
        {!uploadType ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 text-indigo-500 mb-4">
              <Languages size={32} />
            </div>
            <h2 className="text-xl font-medium text-slate-800">No Translations Loaded</h2>
            <p className="text-slate-500 mt-2 max-w-sm mx-auto">Upload an XLIFF or XLSX file to start viewing and translating your content.</p>
          </div>
        ) : (
          <>
            {/* Filter Section with Draft Search */}
            <div className="bg-white p-4 rounded shadow-sm border border-slate-200 mb-6 flex items-end gap-4 overflow-x-auto">
               <div className="flex flex-wrap gap-4 flex-1">
                 <label className="flex flex-col flex-1 min-w-[120px] text-xs font-semibold text-slate-600">
                    Search ID
                    <input type="text" className="mt-1 border border-slate-300 rounded p-2 text-sm font-normal" placeholder="header.title..." value={draftSearchId} onChange={e => setDraftSearchId(e.target.value)} />
                 </label>
                 <label className="flex flex-col flex-1 min-w-[120px] text-xs font-semibold text-slate-600">
                    Search Source
                    <input type="text" className="mt-1 border border-slate-300 rounded p-2 text-sm font-normal" placeholder="Hello..." value={draftSearchSource} onChange={e => setDraftSearchSource(e.target.value)} />
                 </label>
                 <label className="flex flex-col flex-1 min-w-[120px] text-xs font-semibold text-slate-600">
                    Search Target
                    <input type="text" className="mt-1 border border-slate-300 rounded p-2 text-sm font-normal" placeholder="你好..." value={draftSearchTarget} onChange={e => setDraftSearchTarget(e.target.value)} />
                 </label>
                 <label className="flex flex-col flex-1 min-w-[120px] text-xs font-semibold text-slate-600">
                    Exclude Source
                    <input type="text" className="mt-1 border border-slate-300 rounded p-2 text-sm font-normal" placeholder="Error..." value={draftSearchNotSource} onChange={e => setDraftSearchNotSource(e.target.value)} />
                 </label>
                 <label className="flex flex-col flex-1 min-w-[120px] text-xs font-semibold text-slate-600">
                    Exclude Target
                    <input type="text" className="mt-1 border border-slate-300 rounded p-2 text-sm font-normal" placeholder="错误..." value={draftSearchNotTarget} onChange={e => setDraftSearchNotTarget(e.target.value)} />
                 </label>
                 <label className="flex flex-col flex-1 min-w-[120px] text-xs font-semibold text-slate-600">
                    State
                    <select className="mt-1 border border-slate-300 rounded p-2 text-sm font-normal" value={draftSearchState} onChange={e => setDraftSearchState(e.target.value)}>
                      <option value="All">All</option>
                      <option value="needs-translation">needs-translation</option>
                      <option value="translated">translated</option>
                      <option value="reviewed">reviewed</option>
                      <option value="final">final</option>
                    </select>
                 </label>
                 <label className="flex flex-col flex-1 min-w-[120px] text-xs font-semibold text-slate-600">
                    Length Ratio
                    <div className="flex gap-1 mt-1">
                      <select className="border border-slate-300 rounded p-2 text-sm font-normal flex-1" value={draftSearchLengthRatio} onChange={e => setDraftSearchLengthRatio(e.target.value)}>
                        <option value="All">All</option>
                        <option value="< 1.5x">&lt; 1.5x</option>
                        <option value="1.5x - 2.0x">1.5x - 2.0x</option>
                        <option value="> 2.0x">&gt; 2.0x</option>
                        <option value="Custom">Custom (&gt;)...</option>
                      </select>
                      {draftSearchLengthRatio === 'Custom' && (
                        <input 
                          type="number" 
                          step="0.1" 
                          className="border border-slate-300 rounded p-2 text-sm font-normal w-16" 
                          value={draftSearchCustomRatio} 
                          onChange={e => setDraftSearchCustomRatio(e.target.value)} 
                        />
                      )}
                    </div>
                  </label>
                  <label className="flex flex-col text-xs font-semibold text-slate-600 justify-center">
                    <span className="mb-2">Extra</span>
                    <div className="flex items-center gap-1 bg-slate-100 px-2 py-1.5 rounded border border-slate-300 h-[38px] cursor-pointer hover:bg-slate-200 transition-colors">
                      <input 
                        type="checkbox" 
                        id="noChange"
                        checked={draftSearchNoChange} 
                        onChange={e => setDraftSearchNoChange(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded border-gray-300" 
                      />
                      <label htmlFor="noChange" className="text-xs font-medium text-slate-700 cursor-pointer ml-1 select-none whitespace-nowrap">无变化</label>
                    </div>
                  </label>
               </div>
               <button 
                  onClick={handleApplySearch}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded text-sm font-medium flex items-center gap-2 transition-colors h-[38px] shrink-0"
               >
                  <Search size={16} /> Search
               </button>
            </div>

            {/* Batch Operations */}
            <div className="mb-4 bg-slate-100 p-3 rounded flex items-center justify-between border border-slate-200 shadow-sm">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={filteredItems.length > 0 && selectedIds.length === filteredItems.length}
                  onChange={e => handleSelectAll(e.target.checked)} 
                  className="w-4 h-4 text-indigo-600 rounded border-gray-300" 
                />
                Select All Filtered
              </label>
              
              <div className="flex items-center gap-3">
                 <span className="text-xs text-slate-500">{selectedIds.length} selected</span>
                 <button 
                   disabled={selectedIds.length === 0}
                   onClick={handleBatchSync}
                   className="disabled:opacity-50 text-xs bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-3 py-1.5 rounded transition-colors"
                 >
                   ⎘ Sync Selected
                 </button>
                 <div className="flex bg-white border border-slate-300 rounded overflow-hidden">
                    <select 
                       value={batchState} 
                       onChange={e => setBatchState(e.target.value)}
                       className="text-xs p-1.5 border-none bg-transparent outline-none"
                    >
                       <option value="needs-translation">needs-translation</option>
                       <option value="translated">translated</option>
                       <option value="reviewed">reviewed</option>
                       <option value="final">final</option>
                    </select>
                    <button 
                       disabled={selectedIds.length === 0}
                       onClick={handleBatchState}
                       className="disabled:opacity-50 text-xs bg-slate-50 hover:bg-slate-100 border-l border-slate-300 px-3 py-1.5 transition-colors"
                    >
                       Set State
                    </button>
                 </div>
                 <button 
                   disabled={selectedIds.length === 0}
                   onClick={handleBatchAI}
                   className="disabled:opacity-50 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 px-3 py-1.5 rounded flex items-center gap-1 transition-colors"
                 >
                   <Bot size={14} />
                   AI Translate Selected
                 </button>
                 <button 
                   disabled={!uploadType}
                   onClick={handleBatchOverwrite}
                   className="text-xs bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-3 py-1.5 rounded flex items-center gap-1 transition-colors"
                 >
                   <FileUp size={14} />
                   批量覆盖 (Excel)
                 </button>
              </div>
            </div>

            {/* List */}
            <div className="mb-2 text-sm text-slate-500">
               Showing {filteredItems.length} of {items.length} items (Target Language: <span className="font-bold">{targetLang}</span>)
            </div>
            <div className="space-y-4">
               {filteredItems.map(item => (
                 <TranslationCard 
                   key={item.id} 
                   item={{
                     ...item, 
                     target: updates[item.id]?.target ?? item.target,
                     state: updates[item.id]?.state ?? item.state
                   }} 
                   isSelected={selectedIds.includes(item.id)}
                   onToggleSelect={() => handleToggleSelect(item.id)}
                   targetLang={targetLang}
                   config={config}
                   onUpdate={(target, state) => handleUpdate(item.id, target, state)} 
                   onGlobalLoadingChange={(loading) => setIsGlobalLoading(loading)}
                 />
               ))}
               {filteredItems.length === 0 && (
                 <div className="py-10 text-center text-slate-500 bg-white shadow-sm rounded border border-slate-200">No items match your filters.</div>
               )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
