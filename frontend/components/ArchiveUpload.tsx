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
      try {
        setUploadProgress(10);

        // Convert file to base64
        const fileData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const base64Data = result.split(',')[1]; // Remove data:... prefix
            resolve(base64Data);
          };
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });

        setUploadProgress(30);

        // Upload to backend
        const response = await backend.pptx.uploadArchive({
          sessionId,
          filename: file.name,
          fileData,
        });

        setUploadProgress(90);

        if (!response.success) {
          throw new Error(response.error || 'Upload failed');
        }

        setUploadProgress(100);
        return response;
      } catch (error) {
        setUploadProgress(0);
        throw error;
      }
    },
    onSuccess: (data) => {
      try {
        if (data.success && data.folders) {
          // Merge with existing folders
          const existingFolderIds = new Set(folders.map(f => f.id));
          const newFolders = data.folders.filter(f => !existingFolderIds.has(f.id));
          const updatedFolders = [...folders, ...newFolders];
          setFolders(updatedFolders);
          
          const totalImages = data.folders.reduce((acc, f) => acc + f.images.length, 0);
          toast({
            title: 'Archive Extracted Successfully',
            description: `Extracted ${totalImages} images from ${data.folders.length} folders`,
          });
        } else {
          toast({
            title: 'Upload Failed',
            description: data.error || 'Failed to extract archive',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Success handler error:', error);
        toast({
          title: 'Error Processing Response',
          description: 'Archive uploaded but failed to process response',
          variant: 'destructive',
        });
      }
      setUploadProgress(0);
    },
    onError: (error) => {
      console.error('Upload archive error:', error);
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Failed to upload archive',
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
          title: 'Invalid File Type',
          description: 'Please upload a ZIP file',
          variant: 'destructive',
        });
        return;
      }

      if (file.size > 100 * 1024 * 1024) { // 100MB limit
        toast({
          title: 'File Too Large',
          description: 'Please upload a file smaller than 100MB',
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
      'application/x-zip-compressed': ['.zip'],
    },
    maxFiles: 1,
    disabled: uploadMutation.isPending,
  });

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Upload Archive</h3>
      <p className="text-gray-600">Upload a ZIP file containing organized folders of images</p>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          uploadMutation.isPending
            ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
            : isDragActive
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
                <p className="font-medium">
                  {uploadProgress < 30 ? 'Reading file...' : 
                   uploadProgress < 90 ? 'Extracting archive...' : 
                   'Processing images...'}
                </p>
                <Progress value={uploadProgress} className="w-full max-w-xs mx-auto" />
                <p className="text-sm text-gray-500">{uploadProgress}%</p>
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
                <p className="text-xs text-gray-400 mt-1">
                  Maximum file size: 100MB
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {uploadMutation.isError && (
        <div className="flex items-center space-x-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-red-700 text-sm font-medium">Upload Failed</p>
            <p className="text-red-600 text-xs">
              {uploadMutation.error instanceof Error 
                ? uploadMutation.error.message 
                : 'Please check your file and try again'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
