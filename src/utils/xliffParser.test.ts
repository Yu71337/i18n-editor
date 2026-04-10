import { describe, it, expect } from 'vitest';
import { parseXliff, buildXliff } from './xliffParser';

describe('xliffParser', () => {
    it('should extract trans-units from generic xliff', () => {
        const xml = `<xliff><file target-language="zh-CN"><body><trans-unit id="test1"><source>Hello</source><target state="needs-translation">你好</target></trans-unit></body></file></xliff>`;
        const result = parseXliff(xml);
        expect(result.targetLanguage).toBe('zh-CN');
        expect(result.items[0].id).toBe('test1');
        expect(result.items[0].source).toBe('Hello');
        expect(result.items[0].target).toBe('你好');
        expect(result.items[0].state).toBe('needs-translation');
    });

    it('should build updated xliff string', () => {
        const xml = `<xliff><file target-language="zh-CN"><body><trans-unit id="test1"><source>Hello</source><target state="needs-translation">你好</target></trans-unit></body></file></xliff>`;
        const { _doc } = parseXliff(xml);
        const updatedXml = buildXliff(_doc, { "test1": { target: "更新了", state: "translated" } });
        
        expect(updatedXml).toContain('更新了');
        expect(updatedXml).toContain('state="translated"');
    });
});
