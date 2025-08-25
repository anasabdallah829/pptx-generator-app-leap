import React, { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'en' | 'ar';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  en: {
    'app.title': 'PowerPoint Generator',
    'upload.template': 'Upload Template',
    'upload.images': 'Upload Images',
    'upload.template.description': 'Upload a PowerPoint template (.pptx) file',
    'upload.images.description': 'Upload images or archive files',
    'organize.folders': 'Organize Folders',
    'settings.title': 'Settings',
    'preview.title': 'Preview',
    'generate.button': 'Generate Presentation',
    'language.switch': 'Language',
    'folder.name': 'Folder Name',
    'folder.notes': 'Notes',
    'settings.layout': 'Layout Settings',
    'settings.grid': 'Grid Layout',
    'settings.rows': 'Rows',
    'settings.columns': 'Columns',
    'settings.autofit': 'Auto Fit',
    'settings.aspect': 'Preserve Aspect Ratio',
    'settings.placeholders': 'Use Placeholders',
    'settings.title.insert': 'Insert Folder Name as Title',
  },
  ar: {
    'app.title': 'مولد العروض التقديمية',
    'upload.template': 'رفع القالب',
    'upload.images': 'رفع الصور',
    'upload.template.description': 'رفع ملف قالب PowerPoint (.pptx)',
    'upload.images.description': 'رفع الصور أو ملفات الأرشيف',
    'organize.folders': 'تنظيم المجلدات',
    'settings.title': 'الإعدادات',
    'preview.title': 'معاينة',
    'generate.button': 'إنشاء العرض التقديمي',
    'language.switch': 'اللغة',
    'folder.name': 'اسم المجلد',
    'folder.notes': 'ملاحظات',
    'settings.layout': 'إعدادات التخطيط',
    'settings.grid': 'تخطيط الشبكة',
    'settings.rows': 'الصفوف',
    'settings.columns': 'الأعمدة',
    'settings.autofit': 'ملائمة تلقائية',
    'settings.aspect': 'الحفاظ على نسبة العرض إلى الارتفاع',
    'settings.placeholders': 'استخدام العناصر النائبة',
    'settings.title.insert': 'إدراج اسم المجلد كعنوان',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations['en']] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      <div dir={language === 'ar' ? 'rtl' : 'ltr'}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
