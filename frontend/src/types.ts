export interface Annotation {
    id: string;
    x: number; // PDF coordinates (points)
    y: number;
    width: number;
    height: number;
    label: string;
    subtype?: string;
    content?: any; // Replaces 'text', stores String | Object | Array
    page: number;
    order?: number;
}
