export interface TransUnit {
    id: string;
    source: string;
    target: string;
    state: string;
}

export function parseXliff(xmlStr: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlStr, "text/xml");
    
    // Check for parse errors
    const errorNode = doc.querySelector('parsererror');
    if (errorNode) {
        throw new Error('Invalid XML structure');
    }
    
    const fileNode = doc.querySelector('file');
    const targetLanguage = fileNode?.getAttribute('target-language') || 'en';
    
    const items: TransUnit[] = [];
    const transUnits = doc.querySelectorAll('trans-unit');
    
    transUnits.forEach(unit => {
        const id = unit.getAttribute('id') || '';
        const sourceNode = unit.querySelector('source');
        const targetNode = unit.querySelector('target');
        
        items.push({
            id,
            source: sourceNode?.textContent || '',
            target: targetNode?.textContent || '',
            state: targetNode?.getAttribute('state') || 'needs-translation'
        });
    });
    
    return { targetLanguage, items, _doc: doc };
}

export function buildXliff(doc: Document, updates: Record<string, { target: string, state: string }>): string {
    const transUnits = doc.querySelectorAll('trans-unit');
    transUnits.forEach(unit => {
        const id = unit.getAttribute('id');
        if (id && updates[id]) {
            let targetNode = unit.querySelector('target');
            if (!targetNode) {
                targetNode = doc.createElement('target');
                unit.appendChild(targetNode);
            }
            targetNode.textContent = updates[id].target;
            targetNode.setAttribute('state', updates[id].state);
        }
    });
    
    const serializer = new XMLSerializer();
    return serializer.serializeToString(doc);
}
