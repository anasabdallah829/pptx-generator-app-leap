import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useSession } from '../contexts/SessionContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import backend from '~backend/client';

interface GenerateButtonProps {
  disabled?: boolean;
}

export function GenerateButton({ disabled }: GenerateButtonProps) {
  const { sessionId, template, saveSession } = useSession();
  const { toast } = useToast();
  const [progress, setProgress] = useState(0);

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!template) {
        throw new Error('No template selected');
      }

      setProgress(20);
      
      // Save session before generating
      saveSession();
      
      setProgress(40);

      const response = await backend.pptx.generate({
        sessionId,
        templateId: template.id,
      });

      setProgress(80);

      if (!response.success) {
        throw new Error(response.error || 'Failed to generate presentation');
      }

      setProgress(100);
      return response;
    },
    onSuccess: (data) => {
      if (data.downloadUrl) {
        // Create a temporary link to download the file
        const link = document.createElement('a');
        link.href = data.downloadUrl;
        link.download = `presentation_${Date.now()}.pptx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({
          title: 'Success!',
          description: 'Your presentation has been generated and downloaded.',
        });
      }
      setProgress(0);
    },
    onError: (error) => {
      console.error('Generate error:', error);
      toast({
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'Failed to generate presentation',
        variant: 'destructive',
      });
      setProgress(0);
    },
  });

  const handleGenerate = () => {
    generateMutation.mutate();
  };

  return (
    <div className="space-y-3">
      <Button
        onClick={handleGenerate}
        disabled={disabled || generateMutation.isPending}
        className="w-full"
        size="lg"
      >
        {generateMutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Download className="h-4 w-4 mr-2" />
            Generate Presentation
          </>
        )}
      </Button>

      {generateMutation.isPending && (
        <div className="space-y-2">
          <Progress value={progress} className="w-full" />
          <p className="text-sm text-center text-gray-600">
            {progress < 40 ? 'Preparing...' : 
             progress < 80 ? 'Generating slides...' : 
             'Finalizing...'}
          </p>
        </div>
      )}

      {disabled && (
        <p className="text-sm text-gray-500 text-center">
          Upload a template and images to generate your presentation
        </p>
      )}
    </div>
  );
}
