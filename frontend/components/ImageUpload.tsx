import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Image, CheckCircle, AlertCircle, FolderPlus } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useLanguage } from '../contexts/LanguageContext';
import { useSession } from '../contexts/SessionContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import backend from '~backend/client';

export function ImageUpload() {
  const { t } = useLanguage();
  const { sessionId, folders, setFolders } = useSession();
  const { toast } = useToast();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [customFolderName, setCustomFolderName] = useState('');

  const uploadMutation = useMutation({
    mutationFn: async ({ files, folderName }: { files: File[]; folderName?: string }) => {
      setUploadProgress(10);

      const uploadFiles = await Promise.all(
        files.map(async (file) => {
          const fileData = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1]); // Remove data:... prefix
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          return {
            filename: file.name,
            fileData,
            folder: folderName || 'Default',
          };
        })
      );

      setUploadProgress(50);

      const response = await backend.pptx.uploadImages({
        sessionId,
        files: uploadFiles,
        isArchive: false,
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
          description: `Uploaded ${data.folders.reduce((acc, f) => acc + f.images.length, 0)} images`,
        });
        setCustomFolderName('');
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to upload images',
          variant: 'destructive',
        });
      }
      setUploadProgress(0);
    },
    onError: (error) => {
      console.error('Upload error:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload images',
        variant: 'destructive',
      });
      setUploadProgress(0);
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const imageFiles = acceptedFiles.filter(file => 
        file.type.startsWith('image/')
      );
      
      if (imageFiles.length === 0) {
        toast({
          title: 'No Images Found',
          description: 'Please upload image files (JPG, PNG, GIF, etc.)',
          variant: 'destructive',
        });
        return;
      }

      uploadMutation.mutate({ 
        files: imageFiles, 
        folderName: customFolderName || undefined 
      });
    }
  }, [uploadMutation, customFolderName, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'],
    },
    multiple: true,
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">{t('upload.images')}</h2>
      <p className="text-gray-600">{t('upload.images.description')}</p>

      <div className="space-y-4">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <Label htmlFor="folder-name">Custom Folder Name (Optional)</Label>
            <Input
              id="folder-name"
              value={customFolderName}
              onChange={(e) => setCustomFolderName(e.target.value)}
              placeholder="Enter folder name..."
              className="mt-1"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCustomFolderName('')}
            disabled={!customFolderName}
          >
            Clear
          </Button>
        </div>

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
                  <p className="text-lg font-medium">Uploading images...</p>
                  <Progress value={uploadProgress} className="w-full max-w-xs mx-auto" />
                </div>
              </div>
            ) : (
              <>
                <Image className="h-12 w-12 text-gray-400 mx-auto" />
                <div>
                  <p className="text-lg font-medium">
                    {isDragActive ? 'Drop the images here' : 'Upload Images'}
                  </p>
                  <p className="text-gray-500">
                    Drag and drop images here, or click to select multiple files
                  </p>
                  {customFolderName && (
                    <p className="text-sm text-blue-600 mt-2">
                      Images will be added to: "{customFolderName}"
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {folders.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium">Uploaded Folders:</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {folders.map((folder) => (
              <div
                key={folder.id}
                className="flex items-center space-x-3 p-3 bg-green-50 border border-green-200 rounded-lg"
              >
                <FolderPlus className="h-4 w-4 text-green-600" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-green-900 truncate">{folder.name}</p>
                  <p className="text-sm text-green-700">
                    {folder.images.length} image{folder.images.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {uploadMutation.isError && (
        <div className="flex items-center space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-red-700">Failed to upload images. Please try again.</p>
        </div>
      )}
    </div>
  );
}
