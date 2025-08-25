import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';

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
  language: 'en' | 'ar';
}

export interface TemplateInfo {
  id: number;
  filename: string;
  hash: string;
  placeholders: any[];
}

interface SessionContextType {
  sessionId: string;
  template: TemplateInfo | null;
  folders: FolderData[];
  settings: Settings;
  setTemplate: (template: TemplateInfo | null) => void;
  setFolders: (folders: FolderData[]) => void;
  updateFolder: (folderId: string, updates: Partial<FolderData>) => void;
  deleteFolder: (folderId: string) => void;
  reorderFolders: (startIndex: number, endIndex: number) => void;
  updateSettings: (settings: Partial<Settings>) => void;
  saveSession: () => void;
}

const defaultSettings: Settings = {
  layout: {
    grid: true,
    rows: 2,
    columns: 3,
    autoFit: true,
    preserveAspect: true,
  },
  usePlaceholders: true,
  insertFolderNameAsTitle: true,
  language: 'en',
};

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionId] = useState(() => {
    const stored = localStorage.getItem('pptx-session-id');
    return stored || uuidv4();
  });
  
  const [template, setTemplate] = useState<TemplateInfo | null>(null);
  const [folders, setFoldersState] = useState<FolderData[]>([]);
  const [settings, setSettingsState] = useState<Settings>(defaultSettings);

  // Load session from localStorage on mount
  useEffect(() => {
    localStorage.setItem('pptx-session-id', sessionId);
    
    const storedTemplate = localStorage.getItem('pptx-template');
    const storedFolders = localStorage.getItem('pptx-folders');
    const storedSettings = localStorage.getItem('pptx-settings');

    if (storedTemplate) {
      try {
        setTemplate(JSON.parse(storedTemplate));
      } catch (e) {
        console.error('Failed to parse stored template:', e);
      }
    }

    if (storedFolders) {
      try {
        setFoldersState(JSON.parse(storedFolders));
      } catch (e) {
        console.error('Failed to parse stored folders:', e);
      }
    }

    if (storedSettings) {
      try {
        setSettingsState({ ...defaultSettings, ...JSON.parse(storedSettings) });
      } catch (e) {
        console.error('Failed to parse stored settings:', e);
      }
    }
  }, [sessionId]);

  const setFolders = (newFolders: FolderData[]) => {
    setFoldersState(newFolders);
    localStorage.setItem('pptx-folders', JSON.stringify(newFolders));
  };

  const updateFolder = (folderId: string, updates: Partial<FolderData>) => {
    const newFolders = folders.map(folder =>
      folder.id === folderId ? { ...folder, ...updates } : folder
    );
    setFolders(newFolders);
  };

  const deleteFolder = (folderId: string) => {
    const newFolders = folders.filter(folder => folder.id !== folderId);
    setFolders(newFolders);
  };

  const reorderFolders = (startIndex: number, endIndex: number) => {
    const newFolders = [...folders];
    const [removed] = newFolders.splice(startIndex, 1);
    newFolders.splice(endIndex, 0, removed);
    
    // Update order property
    newFolders.forEach((folder, index) => {
      folder.order = index + 1;
    });
    
    setFolders(newFolders);
  };

  const updateSettings = (newSettings: Partial<Settings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettingsState(updatedSettings);
    localStorage.setItem('pptx-settings', JSON.stringify(updatedSettings));
  };

  const saveSession = () => {
    if (template) {
      localStorage.setItem('pptx-template', JSON.stringify(template));
    }
    localStorage.setItem('pptx-folders', JSON.stringify(folders));
    localStorage.setItem('pptx-settings', JSON.stringify(settings));
  };

  const handleSetTemplate = (newTemplate: TemplateInfo | null) => {
    setTemplate(newTemplate);
    if (newTemplate) {
      localStorage.setItem('pptx-template', JSON.stringify(newTemplate));
    } else {
      localStorage.removeItem('pptx-template');
    }
  };

  return (
    <SessionContext.Provider
      value={{
        sessionId,
        template,
        folders,
        settings,
        setTemplate: handleSetTemplate,
        setFolders,
        updateFolder,
        deleteFolder,
        reorderFolders,
        updateSettings,
        saveSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
