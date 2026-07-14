export const TAG_PREFIX = '#[[';
export const TAG_SUFFIX = ']]';

const TAG_MARKER_PATTERN = /#\[\[([^\r\n]*?)\]\]/g;

export interface ParsedTagMarkers {
    notes: string;
    tagNames: string[];
}

export function normalizeTagName(name: string): string {
    return name.trim();
}

export function validateTagName(name: string): string | null {
    const normalized = normalizeTagName(name);
    if (!normalized) return 'Tag name is required.';
    if (normalized.includes(TAG_PREFIX) || normalized.includes(TAG_SUFFIX)) {
        return `Tag names cannot contain ${TAG_PREFIX} or ${TAG_SUFFIX}.`;
    }
    return null;
}

export function formatTagMarkers(tagNames: string[]): string {
    return tagNames
        .map(normalizeTagName)
        .filter(Boolean)
        .map(name => `${TAG_PREFIX}${name}${TAG_SUFFIX}`)
        .join(' ');
}

export function appendTagMarkers(notes: string | null | undefined, tagNames: string[]): string {
    const markers = formatTagMarkers(tagNames);
    const normalizedNotes = notes?.trim() ?? '';
    if (!markers) return normalizedNotes;
    return normalizedNotes ? `${normalizedNotes} ${markers}` : markers;
}

export function parseTagMarkers(value: string | null | undefined): ParsedTagMarkers {
    if (!value) return { notes: '', tagNames: [] };

    const tagNames: string[] = [];
    const seen = new Set<string>();
    const notes = value.replace(TAG_MARKER_PATTERN, (marker, capturedName: string) => {
        const name = normalizeTagName(capturedName);
        if (name && !validateTagName(name)) {
            const key = name.toLocaleLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                tagNames.push(name);
            }
            return '\uE000';
        }
        return marker;
    });

    return {
        notes: notes
            .replace(/[ \t]*\uE000[ \t]*/g, ' ')
            .replace(/\uE000/g, '')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim(),
        tagNames
    };
}
