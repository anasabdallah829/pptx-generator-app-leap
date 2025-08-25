import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useLanguage } from '../contexts/LanguageContext';
import { useSession } from '../contexts/SessionContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { TemplateManager } from './TemplateManager';
import backend from '~backend/client';

export function TemplateUpload() {
  const { t } = useLanguage();
  const { template, setTemplate } = useSession();
  const { toast } = useToast();
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploadProgress(10);
      
      const fileData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // Remove data:... prefix
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setUploadProgress(50);

      const response = await backend.pptx.uploadTemplate({
        filename: file.name,
        fileData,
      });

      setUploadProgress(100);
      return response;
    },
    onSuccess: (data) => {
      if (data.success && data.templateId && data.hash) {
        setTemplate({
          id: data.templateId,
          filename: data.templateId.toString(),
          hash: data.hash,
          placeholders: data.placeholders || [],
        });
        toast({
          title: 'Success',
          description: 'Template uploaded successfully',
        });
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to upload template',
          variant: 'destructive',
        });
      }
      setUploadProgress(0);
    },
    onError: (error) => {
      console.error('Upload error:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload template',
        variant: 'destructive',
      });
      setUploadProgress(0);
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.pptx')) {
        toast({
          title: 'Invalid File',
          description: 'Please upload a .pptx file',
          variant: 'destructive',
        });
        return;
      }
      uploadMutation.mutate(file);
    }
  }, [uploadMutation, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    },
    maxFiles: 1,
  });

  const clearTemplate = () => {
    setTemplate(null);
    toast({
      title: 'Template Cleared',
      description: 'Template has been removed',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t('upload.template')}</h2>
        {template && (
          <Button variant="outline" size="sm" onClick={clearTemplate}>
            Clear Template
          </Button>
        )}
      </div>
      
      <p className="text-gray-600">{t('upload.template.description')}</p>

      {template ? (
        <div className="flex items-center space-x-3 p-4 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <div>
            <p className="font-medium text-green-900">Template Selected</p>
            <p className="text-sm text-green-700">
              {template.placeholders.length} placeholders detected
            </p>
          </div>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-blue-400 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input {...getInputProps()} />
          <div className="space-y-4">
            {uploadMutation.isPending ? (
              <div className="space-y-4">
                <Upload className="h-12 w-12 text-blue-500 mx-auto animate-pulse" />
                <div className="space-y-2">
                  <p className="text-lg font-medium">Uploading template...</p>
                  <Progress value={uploadProgress} className="w-full max-w-xs mx-auto" />
                </div>
              </div>
            ) : (
              <>
                <FileText className="h-12 w-12 text-gray-400 mx-auto" />
                <div>
                  <p className="text-lg font-medium">
                    {isDragActive ? 'Drop the template here' : 'Upload PowerPoint Template'}
                  </p>
                  <p className="text-gray-500">
                    Drag and drop a .pptx file here, or click to select
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {uploadMutation.isError && (
        <div className="flex items-center space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-red-700">Failed to upload template. Please try again.</p>
        </div>
      )}

      <Separator />

      <TemplateManager />
    </div>
  );
}
