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

export interface PlaceholderProperties {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  fontFamily?: string;
  fontSize?: number;
  fontColor?: string;
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  imageAlignment?: 'left' | 'center' | 'right';
  imageScaling?: 'fit' | 'fill' | 'stretch';
  padding?: number;
}

export interface PlaceholderInfo {
  id: string;
  slideIndex: number;
  placeholderType: string;
  name?: string;
  left: number;
  top: number;
  width: number;
  height: number;
  properties?: PlaceholderProperties;
}

export interface TemplateInfo {
  id: number;
  filename: string;
  hash: string;
  placeholders: PlaceholderInfo[];
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

export interface SlidePreview {
  slideIndex: number;
  title?: string;
  placeholders: PlaceholderInfo[];
  content?: {
    folderId?: string;
    folderName?: string;
    imageCount?: number;
  };
}

export interface InteractivePreviewResponse {
  success: boolean;
  slides?: SlidePreview[];
  template?: TemplateInfo;
  error?: string;
}
