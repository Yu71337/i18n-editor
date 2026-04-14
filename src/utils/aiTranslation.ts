export async function generateAISuggestion(config: {
    sourceText: string;
    targetLang: string;
    apiKey: string;
    baseUrl: string;
    model: string;
    provider?: 'openai' | 'gemini' | 'local_llm';
    systemPrompt: string;
}) {
    const provider = config.provider || 'openai';
    const cleanBaseUrl = config.baseUrl.replace(/\/$/, '');

    if (provider === 'gemini') {
        const url = `${cleanBaseUrl || 'https://generativelanguage.googleapis.com'}/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
        
        const res = await globalThis.fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: config.systemPrompt }] },
                contents: [{ role: "user", parts: [{ text: config.sourceText }] }]
            })
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Gemini API Error (${res.status}): ${errText}`);
        }
        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    // OpenAI and Local LLM (LM Studio) share the same API format
    const authHeader = provider === 'local_llm' 
        ? (config.apiKey ? { "Authorization": `Bearer ${config.apiKey}` } : {})
        : { "Authorization": `Bearer ${config.apiKey}` };

    const res = await globalThis.fetch(`${cleanBaseUrl}/chat/completions`, {
        method: "POST",
        headers: { 
            "Content-Type": "application/json", 
            ...authHeader
        },
        body: JSON.stringify({
            model: config.model,
            messages: [
                { role: "system", content: config.systemPrompt },
                { role: "user", content: config.sourceText }
            ]
        })
    });
    
    if (!res.ok) {
        const errText = await res.text();
        const providerName = provider === 'local_llm' ? 'Local LLM' : 'OpenAI';
        throw new Error(`${providerName} API Error (${res.status}): ${errText}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
}
