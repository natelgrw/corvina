export interface Annotation {
    id: string;
    x: number; // PDF coordinates (points)
    y: number;
    width: number;
    height: number;
    label: string;
    page: number;
}
