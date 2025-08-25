export interface ImageData {
  filename: string;
  url: string;
  order: number;
}

export interface FolderData {
  name: string;
  id: string;
  order: number;
  images: ImageData[];
  notes?: string;
}

export interface LayoutSettings {
  grid: boolean;
  rows: number;
  columns: number;
  autoFit: boolean;
  preserveAspect: boolean;
}

export interface Settings {
  layout: LayoutSettings;
  usePlaceholders: boolean;
  insertFolderNameAsTitle: boolean;
  language: "en" | "ar";
}

export interface SessionData {
  folders: FolderData[];
  settings: Settings;
}

export interface TemplateInfo {
  id: number;
  filename: string;
  hash: string;
  placeholders: PlaceholderInfo[];
}

export interface PlaceholderInfo {
  slideIndex: number;
  placeholderType: string;
  name?: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface UploadTemplateResponse {
  success: boolean;
  templateId?: number;
  hash?: string;
  placeholders?: PlaceholderInfo[];
  error?: string;
}

export interface UploadImagesResponse {
  success: boolean;
  folders?: FolderData[];
  error?: string;
}

export interface GenerateResponse {
  success: boolean;
  downloadUrl?: string;
  error?: string;
}

export interface PreviewResponse {
  success: boolean;
  template?: TemplateInfo;
  session?: SessionData;
  error?: string;
}
