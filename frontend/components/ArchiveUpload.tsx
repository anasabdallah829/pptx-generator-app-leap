import React, { useCallback, useState, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Archive, CheckCircle, AlertCircle, FolderPlus } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useLanguage } from '../contexts/LanguageContext';
import { useSession } from '../contexts/SessionContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import backend from '~backend/client';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
const MAX_SINGLE_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB

export function ArchiveUpload() {
  const { t } = useLanguage();
  const { sessionId, folders, setFolders } = useSession();
  const { toast } = useToast();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      try {
        setUploadProgress(5);
        setUploadStatus('Preparing upload...');

        // Check file size to determine upload method
        if (file.size <= MAX_SINGLE_UPLOAD_SIZE) {
          return await uploadSingleFile(file);
        } else {
          return await uploadChunkedFile(file);
        }
      } catch (error) {
        setUploadProgress(0);
        setUploadStatus('');
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
      setUploadStatus('');
    },
    onError: (error) => {
      console.error('Upload archive error:', error);
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Failed to upload archive',
        variant: 'destructive',
      });
      setUploadProgress(0);
      setUploadStatus('');
    },
  });

  const uploadSingleFile = async (file: File) => {
    setUploadStatus('Reading file...');
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

    setUploadStatus('Uploading...');
    setUploadProgress(50);

    // Upload to backend
    const response = await backend.pptx.uploadArchive({
      sessionId,
      filename: file.name,
      fileData,
    });

    setUploadProgress(100);
    return response;
  };

  const uploadChunkedFile = async (file: File) => {
    // Create abort controller for this upload
    abortControllerRef.current = new AbortController();

    setUploadStatus('Initiating chunked upload...');
    setUploadProgress(5);

    // Initiate chunked upload
    const initResponse = await backend.pptx.initiateArchiveUpload({
      sessionId,
      filename: file.name,
      fileSize: file.size,
    });

    if (!initResponse.success || !initResponse.uploadId) {
      throw new Error(initResponse.error || 'Failed to initiate upload');
    }

    const uploadId = initResponse.uploadId;
    const chunkSize = initResponse.chunkSize || CHUNK_SIZE;
    const totalChunks = Math.ceil(file.size / chunkSize);

    setUploadStatus(`Uploading chunks (0/${totalChunks})...`);
    setUploadProgress(10);

    // Upload chunks
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('Upload cancelled');
      }

      const start = chunkIndex * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);

      // Convert chunk to base64
      const chunkData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1]; // Remove data:... prefix
          resolve(base64Data);
        };
        reader.onerror = () => reject(new Error('Failed to read chunk'));
        reader.readAsDataURL(chunk);
      });

      // Upload chunk
      const chunkResponse = await backend.pptx.uploadArchiveChunk({
        sessionId,
        uploadId,
        chunkIndex,
        totalChunks,
        chunkData,
      });

      if (!chunkResponse.success) {
        throw new Error(chunkResponse.error || `Failed to upload chunk ${chunkIndex + 1}`);
      }

      const progress = 10 + ((chunkIndex + 1) / totalChunks) * 70; // 10-80% for chunk upload
      setUploadProgress(progress);
      setUploadStatus(`Uploading chunks (${chunkIndex + 1}/${totalChunks})...`);
    }

    setUploadStatus('Processing archive...');
    setUploadProgress(85);

    // Poll for completion
    return await pollUploadStatus(uploadId);
  };

  const pollUploadStatus = async (uploadId: string): Promise<any> => {
    const maxAttempts = 60; // 5 minutes max
    let attempts = 0;

    while (attempts < maxAttempts) {
      if (abortControllerRef.current?.signal.aborted) {
        throw new Error('Upload cancelled');
      }

      const statusResponse = await backend.pptx.getUploadStatus({ uploadId });
      
      if (!statusResponse.success) {
        throw new Error(statusResponse.error || 'Failed to get upload status');
      }

      const { status, progress, folders, error } = statusResponse;

      if (status === 'completed') {
        setUploadProgress(100);
        return { success: true, folders };
      }

      if (status === 'failed') {
        throw new Error(error || 'Upload processing failed');
      }

      if (status === 'processing') {
        const processingProgress = 85 + (progress || 0) * 0.15; // 85-100% for processing
        setUploadProgress(processingProgress);
        setUploadStatus('Processing archive...');
      }

      attempts++;
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    }

    throw new Error('Upload processing timeout');
  };

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

      if (file.size > 500 * 1024 * 1024) { // 500MB limit
        toast({
          title: 'File Too Large',
          description: 'Please upload a file smaller than 500MB',
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

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    uploadMutation.reset();
    setUploadProgress(0);
    setUploadStatus('');
  };

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
                <p className="font-medium">{uploadStatus}</p>
                <Progress value={uploadProgress} className="w-full max-w-xs mx-auto" />
                <p className="text-sm text-gray-500">{Math.round(uploadProgress)}%</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleCancel}
                  className="mt-2"
                >
                  Cancel Upload
                </Button>
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
                  Maximum file size: 500MB
                </p>
                <p className="text-xs text-gray-400">
                  Large files will be uploaded in chunks automatically
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
