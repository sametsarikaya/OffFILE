export interface ToolResult {
  blob: Blob;
  filename: string;
}

export interface ToolOption {
  id: string;
  label: string;
  type: 'select' | 'range' | 'number' | 'checkbox' | 'text';
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  defaultValue: string | number | boolean;
  placeholder?: string;
}

export interface Tool {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  category: 'pdf' | 'image' | 'convert';
  acceptedTypes: string;
  multiple: boolean;
  /** PDF: 100 MB, Image: 50 MB - warn user if exceeded */
  maxWarnBytes?: number;
  options?: ToolOption[];

  /**
   * When set, the result is not shown as a download but rendered inline.
   * 'color-palette-json' - blob is JSON with { colors: PaletteColor[] }
   */
  resultType?: 'file' | 'color-palette-json';

  /**
   * Interactive panel rendered after file selection, replacing the default
   * options panel. Receives the live options object (mutated in-place).
   * Return an HTMLElement that the router inserts into the work area.
   */
  renderInteractivePanel?: (
    files: File[],
    options: Record<string, unknown>
  ) => Promise<HTMLElement>;

  /** When true, tool page skips the drop zone (e.g. QR code has no file input) */
  skipDropZone?: boolean;

  /** Legacy fallback - worker handles processing for all tools */
  process?: (
    files: File[],
    options: Record<string, unknown>,
    onProgress: (percent: number) => void
  ) => Promise<ToolResult>;
}

export interface PaletteColor {
  hex: string;
  r: number;
  g: number;
  b: number;
}

export interface DropZoneConfig {
  acceptedTypes: string;
  multiple: boolean;
  onFiles: (files: File[]) => void;
  color: string;
  maxWarnBytes?: number;
}

export interface WorkerRequest {
  id: string;
  toolId: string;
  buffers: ArrayBuffer[];
  fileNames: string[];
  fileMimes: string[];
  options: Record<string, unknown>;
}

export type WorkerResponse =
  | { type: 'progress'; id: string; percent: number }
  | { type: 'result';   id: string; buffer: ArrayBuffer; filename: string; mime: string }
  | { type: 'error';    id: string; message: string };
