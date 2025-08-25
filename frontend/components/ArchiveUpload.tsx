import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Archive, CheckCircle, AlertCircle, FolderPlus } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useLanguage } from '../contexts/LanguageContext';
import { useSession } from '../contexts/SessionContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import backend from '~backend/client';

export function ArchiveUpload() {
  const { t } = useLanguage();
  const { sessionId, folders, setFolders } = useSession();
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

      const response = await backend.pptx.uploadArchive({
        sessionId,
        filename: file.name,
        fileData,
      });

      setUploadProgress(100);
      return response;
    },
    onSuccess: (data) => {
      if (data.success && data.folders) {
        // Merge with existing folders
        const existingFolderIds = new Set(folders.map(f => f.id));
        const newFolders = data.folders.filter(f => !existingFolderIds.has(f.id));
        setFolders([...folders, ...newFolders]);
        
        toast({
          title: 'Success',
          description: `Extracted ${data.folders.reduce((acc, f) => acc + f.images.length, 0)} images from ${data.folders.length} folders`,
        });
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to upload archive',
          variant: 'destructive',
        });
      }
      setUploadProgress(0);
    },
    onError: (error) => {
      console.error('Upload error:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload archive',
        variant: 'destructive',
      });
      setUploadProgress(0);
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        toast({
          title: 'Invalid File',
          description: 'Please upload a ZIP file',
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
      'application/zip': ['.zip'],
    },
    maxFiles: 1,
  });

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Upload Archive</h3>
      <p className="text-gray-600">Upload a ZIP file containing organized folders of images</p>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-purple-400 bg-purple-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        <div className="space-y-3">
          {uploadMutation.isPending ? (
            <div className="space-y-3">
              <Upload className="h-10 w-10 text-purple-500 mx-auto animate-pulse" />
              <div className="space-y-2">
                <p className="font-medium">Extracting archive...</p>
                <Progress value={uploadProgress} className="w-full max-w-xs mx-auto" />
              </div>
            </div>
          ) : (
            <>
              <Archive className="h-10 w-10 text-gray-400 mx-auto" />
              <div>
                <p className="font-medium">
                  {isDragActive ? 'Drop the archive here' : 'Upload ZIP Archive'}
                </p>
                <p className="text-sm text-gray-500">
                  Drag and drop a ZIP file here, or click to select
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {uploadMutation.isError && (
        <div className="flex items-center space-x-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <p className="text-red-700 text-sm">Failed to upload archive. Please try again.</p>
        </div>
      )}
    </div>
  );
}
