import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Download, ZoomIn, ZoomOut, RotateCw, Eye, EyeOff } from 'lucide-react';
import { useSession } from '../contexts/SessionContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import backend from '~backend/client';

interface ImagePlaceholder {
  id: string;
  slideIndex: number;
  imageIndex: number;
  left: number;
  top: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  borderWidth: number;
  borderColor: string;
  shadowEnabled: boolean;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowColor: string;
  zIndex: number;
}

interface SlidePreview {
  slideIndex: number;
  title: string;
  placeholders: ImagePlaceholder[];
  backgroundImage?: string;
}

export function InteractiveSlideEditor() {
  const { sessionId, folders } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLDivElement>(null);
  
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [selectedPlaceholder, setSelectedPlaceholder] = useState<ImagePlaceholder | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [scale, setScale] = useState(1);
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
  }>({ isDragging: false, startX: 0, startY: 0, startLeft: 0, startTop: 0 });

  const { data: slideData, isLoading } = useQuery({
    queryKey: ['slide-preview', sessionId, selectedSlide],
    queryFn: () => backend.pptx.getSlidePreview({ sessionId, slideIndex: selectedSlide }),
    enabled: folders.length > 0,
  });

  const updatePlaceholderMutation = useMutation({
    mutationFn: (params: { placeholderId: string; properties: Partial<ImagePlaceholder> }) =>
      backend.pptx.updatePlaceholder({
        sessionId,
        slideIndex: selectedSlide,
        placeholderId: params.placeholderId,
        properties: params.properties,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slide-preview', sessionId] });
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

  const currentSlide = slideData?.slides?.[0];
  const currentFolder = folders[selectedSlide];

  const handlePlaceholderClick = (placeholder: ImagePlaceholder) => {
    setSelectedPlaceholder(placeholder);
    setShowSettings(true);
  };

  const handlePlaceholderUpdate = (properties: Partial<ImagePlaceholder>) => {
    if (!selectedPlaceholder) return;

    const updatedPlaceholder = { ...selectedPlaceholder, ...properties };
    setSelectedPlaceholder(updatedPlaceholder);
    
    updatePlaceholderMutation.mutate({
      placeholderId: selectedPlaceholder.id,
      properties,
    });
  };

  const handleMouseDown = (e: React.MouseEvent, placeholder: ImagePlaceholder) => {
    e.preventDefault();
    e.stopPropagation();
    
    setSelectedPlaceholder(placeholder);
    setDragState({
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: placeholder.left,
      startTop: placeholder.top,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState.isDragging || !selectedPlaceholder) return;

    const deltaX = (e.clientX - dragState.startX) / scale;
    const deltaY = (e.clientY - dragState.startY) / scale;

    const newLeft = Math.max(0, Math.min(960 - selectedPlaceholder.width, dragState.startLeft + deltaX));
    const newTop = Math.max(0, Math.min(720 - selectedPlaceholder.height, dragState.startTop + deltaY));

    handlePlaceholderUpdate({ left: newLeft, top: newTop });
  };

  const handleMouseUp = () => {
    setDragState({ isDragging: false, startX: 0, startY: 0, startLeft: 0, startTop: 0 });
  };

  const handleZoom = (direction: 'in' | 'out') => {
    setScale(prev => {
      const newScale = direction === 'in' ? prev * 1.2 : prev / 1.2;
      return Math.max(0.2, Math.min(3, newScale));
    });
  };

  if (folders.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Settings className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p>Upload images to start editing slides</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Interactive Slide Editor</h3>
        </div>
        <div className="animate-pulse bg-gray-200 h-96 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Interactive Slide Editor</h3>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => handleZoom('out')}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">{Math.round(scale * 100)}%</span>
          <Button variant="outline" size="sm" onClick={() => handleZoom('in')}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Slide Navigation */}
      <div className="flex space-x-2 overflow-x-auto pb-2">
        {folders.map((folder, index) => (
          <Button
            key={folder.id}
            variant={selectedSlide === index ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedSlide(index)}
            className="flex-shrink-0"
          >
            Slide {index + 1}: {folder.name}
          </Button>
        ))}
      </div>

      {/* Slide Canvas */}
      <div className="border rounded-lg p-4 bg-gray-50">
        <div
          ref={canvasRef}
          className="relative bg-white border rounded shadow-lg mx-auto overflow-hidden cursor-crosshair"
          style={{
            width: 960 * scale,
            height: 720 * scale,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Slide Title */}
          {currentFolder && (
            <div
              className="absolute inset-x-0 top-0 p-4 text-center bg-gray-100 border-b"
              style={{ height: 60 }}
            >
              <h4 className="text-lg font-semibold">{currentFolder.name}</h4>
            </div>
          )}

          {/* Image Placeholders */}
          {currentSlide?.placeholders.map((placeholder) => {
            const image = currentFolder?.images[placeholder.imageIndex];
            const isSelected = selectedPlaceholder?.id === placeholder.id;

            return (
              <div
                key={placeholder.id}
                className={`absolute border-2 cursor-pointer transition-all ${
                  isSelected 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                style={{
                  left: placeholder.left,
                  top: placeholder.top,
                  width: placeholder.width,
                  height: placeholder.height,
                  transform: `rotate(${placeholder.rotation}deg)`,
                  opacity: placeholder.opacity / 100,
                  borderWidth: placeholder.borderWidth,
                  borderColor: placeholder.borderColor,
                  boxShadow: placeholder.shadowEnabled
                    ? `${placeholder.shadowOffsetX}px ${placeholder.shadowOffsetY}px ${placeholder.shadowBlur}px ${placeholder.shadowColor}`
                    : 'none',
                  zIndex: placeholder.zIndex,
                }}
                onClick={() => handlePlaceholderClick(placeholder)}
                onMouseDown={(e) => handleMouseDown(e, placeholder)}
              >
                {image && (
                  <img
                    src={image.url}
                    alt={image.filename}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                )}
                
                {/* Resize Handles */}
                {isSelected && (
                  <>
                    <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-500 rounded-full cursor-nw-resize"></div>
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full cursor-ne-resize"></div>
                    <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-500 rounded-full cursor-sw-resize"></div>
                    <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-blue-500 rounded-full cursor-se-resize"></div>
                  </>
                )}

                {/* Placeholder Index */}
                <div className="absolute top-1 left-1 bg-black bg-opacity-50 text-white text-xs px-1 rounded">
                  {placeholder.imageIndex + 1}
                </div>
              </div>
            );
          })}

          {/* Grid Overlay */}
          <div className="absolute inset-0 pointer-events-none">
            <svg className="w-full h-full opacity-20">
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

      {/* Placeholder Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Placeholder Settings</DialogTitle>
          </DialogHeader>
          
          {selectedPlaceholder && (
            <div className="space-y-4">
              {/* Position and Size */}
              <div className="space-y-3">
                <h4 className="font-medium">Position & Size</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="left">Left (px)</Label>
                    <Input
                      id="left"
                      type="number"
                      value={Math.round(selectedPlaceholder.left)}
                      onChange={(e) => handlePlaceholderUpdate({ left: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="top">Top (px)</Label>
                    <Input
                      id="top"
                      type="number"
                      value={Math.round(selectedPlaceholder.top)}
                      onChange={(e) => handlePlaceholderUpdate({ top: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="width">Width (px)</Label>
                    <Input
                      id="width"
                      type="number"
                      value={Math.round(selectedPlaceholder.width)}
                      onChange={(e) => handlePlaceholderUpdate({ width: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="height">Height (px)</Label>
                    <Input
                      id="height"
                      type="number"
                      value={Math.round(selectedPlaceholder.height)}
                      onChange={(e) => handlePlaceholderUpdate({ height: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Appearance */}
              <div className="space-y-3">
                <h4 className="font-medium">Appearance</h4>
                
                <div>
                  <Label>Rotation ({selectedPlaceholder.rotation}°)</Label>
                  <Slider
                    value={[selectedPlaceholder.rotation]}
                    onValueChange={([value]) => handlePlaceholderUpdate({ rotation: value })}
                    min={-180}
                    max={180}
                    step={5}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Opacity ({selectedPlaceholder.opacity}%)</Label>
                  <Slider
                    value={[selectedPlaceholder.opacity]}
                    onValueChange={([value]) => handlePlaceholderUpdate({ opacity: value })}
                    min={0}
                    max={100}
                    step={5}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Z-Index</Label>
                  <Input
                    type="number"
                    value={selectedPlaceholder.zIndex}
                    onChange={(e) => handlePlaceholderUpdate({ zIndex: Number(e.target.value) })}
                    min={1}
                    max={100}
                    className="mt-1"
                  />
                </div>
              </div>

              <Separator />

              {/* Border */}
              <div className="space-y-3">
                <h4 className="font-medium">Border</h4>
                
                <div>
                  <Label>Border Width ({selectedPlaceholder.borderWidth}px)</Label>
                  <Slider
                    value={[selectedPlaceholder.borderWidth]}
                    onValueChange={([value]) => handlePlaceholderUpdate({ borderWidth: value })}
                    min={0}
                    max={10}
                    step={1}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="border-color">Border Color</Label>
                  <Input
                    id="border-color"
                    type="color"
                    value={selectedPlaceholder.borderColor}
                    onChange={(e) => handlePlaceholderUpdate({ borderColor: e.target.value })}
                    className="mt-1 h-10"
                  />
                </div>
              </div>

              <Separator />

              {/* Shadow */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Shadow</h4>
                  <Switch
                    checked={selectedPlaceholder.shadowEnabled}
                    onCheckedChange={(checked) => handlePlaceholderUpdate({ shadowEnabled: checked })}
                  />
                </div>

                {selectedPlaceholder.shadowEnabled && (
                  <>
                    <div>
                      <Label>Blur ({selectedPlaceholder.shadowBlur}px)</Label>
                      <Slider
                        value={[selectedPlaceholder.shadowBlur]}
                        onValueChange={([value]) => handlePlaceholderUpdate({ shadowBlur: value })}
                        min={0}
                        max={20}
                        step={1}
                        className="mt-1"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Offset X ({selectedPlaceholder.shadowOffsetX}px)</Label>
                        <Slider
                          value={[selectedPlaceholder.shadowOffsetX]}
                          onValueChange={([value]) => handlePlaceholderUpdate({ shadowOffsetX: value })}
                          min={-20}
                          max={20}
                          step={1}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label>Offset Y ({selectedPlaceholder.shadowOffsetY}px)</Label>
                        <Slider
                          value={[selectedPlaceholder.shadowOffsetY]}
                          onValueChange={([value]) => handlePlaceholderUpdate({ shadowOffsetY: value })}
                          min={-20}
                          max={20}
                          step={1}
                          className="mt-1"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="shadow-color">Shadow Color</Label>
                      <Input
                        id="shadow-color"
                        type="color"
                        value={selectedPlaceholder.shadowColor}
                        onChange={(e) => handlePlaceholderUpdate({ shadowColor: e.target.value })}
                        className="mt-1 h-10"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setShowSettings(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick Actions */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg border">
        <div className="text-sm text-gray-600">
          {selectedPlaceholder 
            ? `Selected: Image ${selectedPlaceholder.imageIndex + 1}` 
            : 'Click on an image placeholder to edit its properties'
          }
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedPlaceholder(null)}
            disabled={!selectedPlaceholder}
          >
            Deselect
          </Button>
        </div>
      </div>
    </div>
  );
}
