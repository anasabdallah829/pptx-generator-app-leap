import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Settings, Save, RotateCcw } from 'lucide-react';
import { useSession } from '../contexts/SessionContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PlaceholderSettingsPopup } from './PlaceholderSettingsPopup';
import backend from '~backend/client';

interface SlidePreview {
  slideIndex: number;
  title?: string;
  placeholders: PlaceholderInfo[];
  content?: {
    folderId?: string;
    folderName?: string;
    imageCount?: number;
  };
}

interface PlaceholderInfo {
  id: string;
  slideIndex: number;
  placeholderType: string;
  name?: string;
  left: number;
  top: number;
  width: number;
  height: number;
  properties?: any;
}

export function InteractivePreview() {
  const { sessionId, template } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [selectedPlaceholder, setSelectedPlaceholder] = useState<PlaceholderInfo | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const slideRef = useRef<HTMLDivElement>(null);

  const { data: previewData, isLoading } = useQuery({
    queryKey: ['interactive-preview', sessionId, template?.id],
    queryFn: () => backend.pptx.interactivePreview({
      sessionId,
      templateId: template?.id
    }),
    enabled: !!template
  });

  const updatePlaceholderMutation = useMutation({
    mutationFn: (params: {
      placeholderId: string;
      slideIndex: number;
      properties: any;
      position?: any;
    }) => backend.pptx.updatePlaceholder({
      sessionId,
      ...params
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interactive-preview'] });
      toast({
        title: 'Success',
        description: 'Placeholder updated successfully',
      });
    },
    onError: (error) => {
      console.error('Update placeholder error:', error);
      toast({
        title: 'Error',
        description: 'Failed to update placeholder',
        variant: 'destructive',
      });
    },
  });

  const slides = previewData?.slides || [];

  const handlePlaceholderClick = (placeholder: PlaceholderInfo) => {
    setSelectedPlaceholder(placeholder);
    setShowSettings(true);
  };

  const handleSavePlaceholder = (properties: any, position?: any) => {
    if (selectedPlaceholder) {
      updatePlaceholderMutation.mutate({
        placeholderId: selectedPlaceholder.id,
        slideIndex: selectedPlaceholder.slideIndex,
        properties,
        position
      });
      setShowSettings(false);
      setSelectedPlaceholder(null);
    }
  };

  const convertEmuToPixels = (emu: number, scaleFactor: number = 0.1) => {
    // EMU to pixels conversion (approximately 914400 EMUs = 96 pixels at 96 DPI)
    return (emu / 914400) * 96 * scaleFactor;
  };

  const renderPlaceholder = (placeholder: PlaceholderInfo) => {
    const left = convertEmuToPixels(placeholder.left);
    const top = convertEmuToPixels(placeholder.top);
    const width = convertEmuToPixels(placeholder.width);
    const height = convertEmuToPixels(placeholder.height);

    const isSelected = selectedPlaceholder?.id === placeholder.id;

    return (
      <div
        key={placeholder.id}
        className={`absolute border-2 border-dashed cursor-pointer transition-all duration-200 hover:border-blue-500 hover:bg-blue-50 ${
          isSelected ? 'border-blue-500 bg-blue-100' : 'border-gray-300 bg-gray-50'
        }`}
        style={{
          left: `${left}px`,
          top: `${top}px`,
          width: `${width}px`,
          height: `${height}px`,
          backgroundColor: placeholder.properties?.backgroundColor || 'transparent',
          borderColor: placeholder.properties?.borderColor || '#ccc',
          borderWidth: placeholder.properties?.borderWidth || 2,
        }}
        onClick={() => handlePlaceholderClick(placeholder)}
        title={`Click to edit ${placeholder.name || placeholder.placeholderType}`}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-xs text-gray-600 p-2">
            <Settings className="h-4 w-4 mx-auto mb-1" />
            <div className="font-medium">{placeholder.name || placeholder.placeholderType}</div>
            <div className="text-xs text-gray-500">Click to edit</div>
          </div>
        </div>
        
        {isSelected && (
          <div className="absolute -top-8 left-0 bg-blue-600 text-white text-xs px-2 py-1 rounded">
            Selected
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading interactive preview...</p>
        </div>
      </div>
    );
  }

  if (!previewData?.success || slides.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Settings className="h-8 w-8 mx-auto mb-2 text-gray-300" />
        <p>No slides available for interactive preview</p>
        <p className="text-sm">Upload a template and images to get started</p>
      </div>
    );
  }

  const currentSlideData = slides[currentSlide];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Interactive Preview</h2>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">
            Slide {currentSlide + 1} of {slides.length}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
            disabled={currentSlide === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))}
            disabled={currentSlide === slides.length - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          {/* Slide Title */}
          {currentSlideData.title && (
            <div className="mb-4 text-center">
              <h3 className="text-lg font-semibold text-gray-900">
                {currentSlideData.title}
              </h3>
              <p className="text-sm text-gray-600">
                {currentSlideData.content?.imageCount} images from folder "{currentSlideData.content?.folderName}"
              </p>
            </div>
          )}

          {/* Slide Canvas */}
          <div className="relative bg-white border-2 border-gray-200 rounded-lg mx-auto" style={{ width: '800px', height: '600px' }}>
            <div
              ref={slideRef}
              className="relative w-full h-full overflow-hidden"
              style={{ transform: 'scale(1)', transformOrigin: 'top left' }}
            >
              {/* Background */}
              <div className="absolute inset-0 bg-white"></div>
              
              {/* Placeholders */}
              {currentSlideData.placeholders.map(renderPlaceholder)}
              
              {/* Grid overlay (optional) */}
              <div className="absolute inset-0 pointer-events-none opacity-10">
                <svg width="100%" height="100%">
                  <defs>
                    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#ccc" strokeWidth="1"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-4 text-center text-sm text-gray-600">
            <p>Click on any placeholder to edit its properties and positioning</p>
          </div>
        </CardContent>
      </Card>

      {/* Placeholder Settings Popup */}
      <PlaceholderSettingsPopup
        open={showSettings}
        onOpenChange={setShowSettings}
        placeholder={selectedPlaceholder}
        onSave={handleSavePlaceholder}
      />

      {/* Slide Navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {slides.map((slide, index) => (
          <Card
            key={slide.slideIndex}
            className={`cursor-pointer transition-all ${
              index === currentSlide
                ? 'ring-2 ring-blue-500 border-blue-500'
                : 'hover:border-gray-300'
            }`}
            onClick={() => setCurrentSlide(index)}
          >
            <CardContent className="p-3">
              <div className="aspect-video bg-gray-100 rounded mb-2 relative overflow-hidden">
                <div className="absolute inset-0 scale-[0.15] origin-top-left">
                  <div className="w-[800px] h-[600px] bg-white relative">
                    {slide.placeholders.map((placeholder) => (
                      <div
                        key={placeholder.id}
                        className="absolute border border-gray-300 bg-gray-100"
                        style={{
                          left: `${convertEmuToPixels(placeholder.left, 1)}px`,
                          top: `${convertEmuToPixels(placeholder.top, 1)}px`,
                          width: `${convertEmuToPixels(placeholder.width, 1)}px`,
                          height: `${convertEmuToPixels(placeholder.height, 1)}px`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="text-sm">
                <div className="font-medium">Slide {index + 1}</div>
                {slide.title && (
                  <div className="text-gray-600 truncate">{slide.title}</div>
                )}
                <div className="text-xs text-gray-500">
                  {slide.placeholders.length} placeholders
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
