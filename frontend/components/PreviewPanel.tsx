import React from 'react';
import { useSession } from '../contexts/SessionContext';
import { useLanguage } from '../contexts/LanguageContext';
import { FileText, Image, Settings } from 'lucide-react';

export function PreviewPanel() {
  const { template, folders, settings } = useSession();
  const { t } = useLanguage();

  const totalImages = folders.reduce((acc, folder) => acc + folder.images.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">{t('preview.title')}</h2>
        <p className="text-gray-600">
          Preview your presentation configuration before generating.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Template Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-3">
            <FileText className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-blue-900">Template</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-blue-700">Placeholders:</span>
              <span className="font-medium">{template?.placeholders.length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">Hash:</span>
              <span className="font-mono text-xs">{template?.hash.substring(0, 8)}...</span>
            </div>
          </div>
        </div>

        {/* Content Info */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-3">
            <Image className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-green-900">Content</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-green-700">Slides:</span>
              <span className="font-medium">{folders.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-700">Total Images:</span>
              <span className="font-medium">{totalImages}</span>
            </div>
          </div>
        </div>

        {/* Settings Info */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center space-x-3 mb-3">
            <Settings className="h-5 w-5 text-purple-600" />
            <h3 className="font-semibold text-purple-900">Settings</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-purple-700">Grid:</span>
              <span className="font-medium">
                {settings.layout.grid ? `${settings.layout.rows}×${settings.layout.columns}` : 'Off'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-purple-700">Placeholders:</span>
              <span className="font-medium">{settings.usePlaceholders ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Slide Preview */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Slide Preview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {folders.map((folder, index) => (
            <div key={folder.id} className="bg-white border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">Slide {index + 1}</h4>
                <span className="text-sm text-gray-500">{folder.images.length} images</span>
              </div>
              
              {settings.insertFolderNameAsTitle && (
                <div className="mb-3 p-2 bg-gray-50 rounded text-center">
                  <span className="text-sm font-medium">{folder.name}</span>
                </div>
              )}

              <div 
                className="grid gap-1 mb-3"
                style={{
                  gridTemplateColumns: `repeat(${Math.min(settings.layout.columns, folder.images.length)}, 1fr)`,
                }}
              >
                {folder.images.slice(0, settings.layout.rows * settings.layout.columns).map((image, imgIndex) => (
                  <div
                    key={imgIndex}
                    className="aspect-square bg-gray-100 rounded border overflow-hidden"
                  >
                    <img
                      src={image.url}
                      alt={image.filename}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>

              {folder.notes && (
                <div className="text-xs text-gray-600 bg-yellow-50 p-2 rounded">
                  <strong>Notes:</strong> {folder.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
