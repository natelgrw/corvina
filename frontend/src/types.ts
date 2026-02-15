export interface Annotation {
    id: string;
    // Box properties
    x: number; // PDF coordinates (points) - for box, or bounding box of line
    y: number;
    width: number;
    height: number;

    // Line properties
    type: 'box' | 'line' | 'node' | 'connection' | 'text';
    points?: { x: number, y: number }[]; // For legacy lines

    // Connection Logic
    sourceId?: string;
    targetId?: string;

    label: string;
    subtype?: string;
    content?: any; // Replaces 'text', stores String | Object | Array
    page: number;
    order?: number;

    // Transcription Data
    isIgnored?: boolean;
    transcriptionBox?: { x: number, y: number, width: number, height: number };
    rawText?: string;
    linkedAnnotationId?: string; // ID of the Component/Node this text describes
    values?: Array<{
        value: string;
        unitPrefix: string;
        unitSuffix: string;
    }>;
}
