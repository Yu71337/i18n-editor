import { useState } from 'react';
import { Bot, Check, Languages } from 'lucide-react';
import { generateAISuggestion } from '../utils/aiTranslation';
import type { TransUnit } from '../utils/xliffParser';

interface Props {
  item: TransUnit;
  targetLang: string;
  config: { apiKey: string; baseUrl: string; model: string; provider?: 'openai' | 'gemini' | 'local_llm'; systemPrompt: string };
  onUpdate: (target: string, state: string) => void;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onGlobalLoadingChange?: (loading: boolean) => void;
  aiSuggestion?: string;
  onAiSuggestionChange?: (id: string, suggestion: string) => void;
}

import { useEffect } from 'react';

export function TranslationCard({ 
  item, 
  targetLang, 
  config, 
  onUpdate, 
  isSelected = false, 
  onToggleSelect, 
  onGlobalLoadingChange,
  aiSuggestion = '',
  onAiSuggestionChange
}: Props) {
  const [localTarget, setLocalTarget] = useState(item.target);
  const [localState, setLocalState] = useState(item.state);

  useEffect(() => {
    setLocalTarget(item.target);
    setLocalState(item.state);
  }, [item.target, item.state]);
  
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState('');

  const handleBlur = () => {
    if (localTarget !== item.target || localState !== item.state) {
      onUpdate(localTarget, localState);
    }
  };

  const handleAskAI = async () => {
    if (config.provider !== 'local_llm' && !config.apiKey) {
      setAiError('Please configure API keys first.');
      return;
    }
    setLoadingAI(true);
    if (onGlobalLoadingChange) onGlobalLoadingChange(true);
    setAiError('');
    try {
      const res = await generateAISuggestion({
        sourceText: item.source,
        targetLang,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl || 'https://api.openai.com/v1',
        model: config.model || 'gpt-4',
        provider: config.provider,
        systemPrompt: config.systemPrompt.replace('{{targetLang}}', targetLang)
      });
      if (onAiSuggestionChange) {
        onAiSuggestionChange(item.id, res);
      }
    } catch (e: any) {
      setAiError(e.message);
    } finally {
      setLoadingAI(false);
      if (onGlobalLoadingChange) onGlobalLoadingChange(false);
    }
  };

  const sourceLen = item.source.length;
  const targetLen = localTarget.length;
  const lengthRatio = targetLen / Math.max(sourceLen, 1);

  let targetCountColor = "text-slate-400";
  if (lengthRatio > 2.0) targetCountColor = "text-red-500 font-bold";
  else if (lengthRatio >= 1.5) targetCountColor = "text-amber-500 font-bold";

  return (
    <div className="bg-white p-4 rounded shadow mb-4 flex flex-col md:flex-row gap-4 border border-gray-200">
      <div className="flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-1">
          {onToggleSelect && (
            <input 
              type="checkbox" 
              checked={isSelected} 
              onChange={onToggleSelect} 
              className="w-4 h-4 text-indigo-600 rounded border-gray-300" 
            />
          )}
          <div className="text-xs font-mono text-gray-500">{item.id}</div>
        </div>
        <div className="text-sm font-medium text-gray-900 bg-gray-50 p-2 rounded border border-gray-100 min-h-[4rem]">
           {item.source}
        </div>
        <div className="text-right text-[10px] text-slate-400 mt-1">{sourceLen} chars</div>
      </div>
      
      <div className="flex-1 flex flex-col gap-2">
        <div className="flex justify-between items-center">
            <select 
               className="text-xs border border-gray-300 rounded p-1"
               value={localState} 
               onChange={(e) => {
                 setLocalState(e.target.value);
                 onUpdate(localTarget, e.target.value);
               }}
            >
               <option value="needs-translation">needs-translation</option>
               <option value="translated">translated</option>
               <option value="reviewed">reviewed</option>
               <option value="final">final</option>
            </select>
            <div className="flex gap-2">
              <button 
                 onClick={() => {
                   setLocalTarget(item.source);
                   setLocalState('translated');
                   onUpdate(item.source, 'translated');
                 }}
                 className="text-xs bg-slate-100 text-slate-600 hover:bg-slate-200 px-2 py-1 flex items-center gap-1 rounded transition-colors"
              >
                 ⎘ Sync
              </button>
              <button 
                 onClick={handleAskAI} 
                 disabled={loadingAI}
                 className="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2 py-1 flex items-center gap-1 rounded transition-colors disabled:opacity-50"
              >
                 <Bot size={14} />
                 {loadingAI ? 'Thinking...' : 'Ask AI'}
              </button>
            </div>
        </div>
        
        <textarea 
          className="w-full text-sm border border-gray-300 rounded p-2 focus:ring-2 focus:ring-indigo-400 focus:outline-none min-h-[4rem]"
          value={localTarget}
          onChange={(e) => setLocalTarget(e.target.value)}
          onBlur={handleBlur}
          dir="auto"
        />
        <div className={`text-right text-[10px] mt-1 ${targetCountColor}`}>{targetLen} chars</div>
        
        {aiError && <div className="text-xs text-red-500 mt-1">{aiError}</div>}
        
        {aiSuggestion && (
          <div className="mt-2 bg-indigo-50 border border-indigo-100 rounded p-3 text-sm">
             <div className="text-xs text-indigo-500 mb-1 font-semibold flex items-center gap-1">
               <Languages size={14} /> AI Suggestion
             </div>
             <div>{aiSuggestion}</div>
             <button 
               className="mt-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded flex items-center gap-1 transition-colors"
               onClick={() => {
                 const newState = 'translated';
                 setLocalTarget(aiSuggestion);
                 setLocalState(newState);
                 onUpdate(aiSuggestion, newState);
               }}
             >
               <Check size={14} /> Apply Translation
             </button>
          </div>
        )}
      </div>
    </div>
  );
}
