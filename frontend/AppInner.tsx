import React, { useState } from 'react';
import { Header } from './components/Header';
import { TemplateUpload } from './components/TemplateUpload';
import { ImageUpload } from './components/ImageUpload';
import { FolderManager } from './components/FolderManager';
import { SettingsPanel } from './components/SettingsPanel';
import { PreviewPanel } from './components/PreviewPanel';
import { GenerateButton } from './components/GenerateButton';
import { useSession } from './contexts/SessionContext';

export default function AppInner() {
  const { template, folders } = useSession();
  const [activeTab, setActiveTab] = useState<'upload' | 'organize' | 'settings' | 'preview'>('upload');

  const canProceed = template && folders.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Tab Navigation */}
            <div className="flex space-x-1 mb-6 bg-white rounded-lg p-1 shadow-sm">
              <button
                onClick={() => setActiveTab('upload')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'upload'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Upload
              </button>
              <button
                onClick={() => setActiveTab('organize')}
                disabled={!template}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'organize'
                    ? 'bg-blue-500 text-white'
                    : template
                    ? 'text-gray-600 hover:text-gray-900'
                    : 'text-gray-400 cursor-not-allowed'
                }`}
              >
                Organize
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                disabled={!canProceed}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'settings'
                    ? 'bg-blue-500 text-white'
                    : canProceed
                    ? 'text-gray-600 hover:text-gray-900'
                    : 'text-gray-400 cursor-not-allowed'
                }`}
              >
                Settings
              </button>
              <button
                onClick={() => setActiveTab('preview')}
                disabled={!canProceed}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'preview'
                    ? 'bg-blue-500 text-white'
                    : canProceed
                    ? 'text-gray-600 hover:text-gray-900'
                    : 'text-gray-400 cursor-not-allowed'
                }`}
              >
                Preview
              </button>
            </div>

            {/* Tab Content */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              {activeTab === 'upload' && (
                <div className="space-y-8">
                  <TemplateUpload />
                  <ImageUpload />
                </div>
              )}
              
              {activeTab === 'organize' && template && (
                <FolderManager />
              )}
              
              {activeTab === 'settings' && canProceed && (
                <SettingsPanel />
              )}
              
              {activeTab === 'preview' && canProceed && (
                <PreviewPanel />
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-4">
                <GenerateButton disabled={!canProceed} />
                
                <div className="text-sm text-gray-600">
                  <div className="flex items-center justify-between mb-2">
                    <span>Template:</span>
                    <span className={template ? 'text-green-600' : 'text-red-600'}>
                      {template ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Images:</span>
                    <span className={folders.length > 0 ? 'text-green-600' : 'text-red-600'}>
                      {folders.length > 0 ? `${folders.length} folders` : '✗'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
