import { describe, it, expect, vi } from 'vitest';
import { generateAISuggestion } from './aiTranslation';

globalThis.fetch = vi.fn();

describe('aiTranslation', () => {
    it('constructs correct prompt and parameters', async () => {
        (globalThis.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ choices: [{ message: { content: "Test output" } }] })
        });
        
        const result = await generateAISuggestion({
            sourceText: "Hello {name}",
            targetLang: "zh-CN",
            apiKey: "test",
            baseUrl: "https://api.openai.com/v1",
            model: "gpt-4",
            provider: "openai",
            systemPrompt: "You are a test bot targeting zh-CN"
        });
        
        expect(result).toBe("Test output");
        expect(globalThis.fetch).toHaveBeenCalled();
        
        const callArgs = (globalThis.fetch as any).mock.calls[0];
        expect(callArgs[0]).toBe("https://api.openai.com/v1/chat/completions");
        
        const body = JSON.parse(callArgs[1].body);
        expect(body.model).toBe("gpt-4");
        expect(body.messages[0].content).toContain("zh-CN");
    });
    
    it('constructs correct gemini prompt and parameters', async () => {
        (globalThis.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ candidates: [{ content: { parts: [{ text: "Gemini output" }] } }] })
        });
        
        const result = await generateAISuggestion({
            sourceText: "Hello",
            targetLang: "zh-CN",
            apiKey: "gemini-key",
            baseUrl: "https://generativelanguage.googleapis.com",
            model: "gemini-1.5-flash",
            provider: "gemini",
            systemPrompt: "You are Gemini targeting zh-CN"
        });
        
        expect(result).toBe("Gemini output");
        
        const callArgs = (globalThis.fetch as any).mock.calls[1];
        expect(callArgs[0]).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=gemini-key");
        
        const body = JSON.parse(callArgs[1].body);
        expect(body.systemInstruction.parts[0].text).toContain("zh-CN");
        expect(body.contents[0].parts[0].text).toBe("Hello");
    });
});

