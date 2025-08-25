import React from 'react';
import { useSession } from '../contexts/SessionContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

export function SettingsPanel() {
  const { settings, updateSettings } = useSession();
  const { t } = useLanguage();

  const handleLayoutChange = (key: string, value: any) => {
    updateSettings({
      layout: {
        ...settings.layout,
        [key]: value,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">{t('settings.title')}</h2>
        <p className="text-gray-600">
          Configure how images are arranged in your presentation.
        </p>
      </div>

      <div className="space-y-6">
        {/* Layout Settings */}
        <div>
          <h3 className="text-lg font-medium mb-4">{t('settings.layout')}</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="grid-layout">{t('settings.grid')}</Label>
              <Switch
                id="grid-layout"
                checked={settings.layout.grid}
                onCheckedChange={(checked) => handleLayoutChange('grid', checked)}
              />
            </div>

            {settings.layout.grid && (
              <div className="grid grid-cols-2 gap-4 pl-6">
                <div>
                  <Label htmlFor="rows">{t('settings.rows')}</Label>
                  <Input
                    id="rows"
                    type="number"
                    min="1"
                    max="10"
                    value={settings.layout.rows}
                    onChange={(e) => handleLayoutChange('rows', parseInt(e.target.value) || 1)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="columns">{t('settings.columns')}</Label>
                  <Input
                    id="columns"
                    type="number"
                    min="1"
                    max="10"
                    value={settings.layout.columns}
                    onChange={(e) => handleLayoutChange('columns', parseInt(e.target.value) || 1)}
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label htmlFor="auto-fit">{t('settings.autofit')}</Label>
              <Switch
                id="auto-fit"
                checked={settings.layout.autoFit}
                onCheckedChange={(checked) => handleLayoutChange('autoFit', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="preserve-aspect">{t('settings.aspect')}</Label>
              <Switch
                id="preserve-aspect"
                checked={settings.layout.preserveAspect}
                onCheckedChange={(checked) => handleLayoutChange('preserveAspect', checked)}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Content Settings */}
        <div>
          <h3 className="text-lg font-medium mb-4">Content Settings</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="use-placeholders">{t('settings.placeholders')}</Label>
                <p className="text-sm text-gray-500">
                  Use template placeholders when available
                </p>
              </div>
              <Switch
                id="use-placeholders"
                checked={settings.usePlaceholders}
                onCheckedChange={(checked) => updateSettings({ usePlaceholders: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="insert-title">{t('settings.title.insert')}</Label>
                <p className="text-sm text-gray-500">
                  Add folder name as slide title
                </p>
              </div>
              <Switch
                id="insert-title"
                checked={settings.insertFolderNameAsTitle}
                onCheckedChange={(checked) => updateSettings({ insertFolderNameAsTitle: checked })}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Preview */}
        <div>
          <h3 className="text-lg font-medium mb-4">Layout Preview</h3>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="bg-white border rounded p-4 max-w-md mx-auto">
              <div className="text-center mb-3">
                <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
              </div>
              <div 
                className="grid gap-1"
                style={{
                  gridTemplateColumns: `repeat(${settings.layout.columns}, 1fr)`,
                  gridTemplateRows: `repeat(${settings.layout.rows}, 1fr)`,
                }}
              >
                {Array.from({ length: settings.layout.rows * settings.layout.columns }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-square bg-blue-100 rounded border border-blue-200"
                  ></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
