import React, { useState, useEffect } from 'react';
import { Settings, Palette, Move, Resize, Type, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

interface PlaceholderSettingsPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeholder: PlaceholderInfo | null;
  onSave: (properties: any, position?: any) => void;
}

export function PlaceholderSettingsPopup({
  open,
  onOpenChange,
  placeholder,
  onSave
}: PlaceholderSettingsPopupProps) {
  const [properties, setProperties] = useState<any>({});
  const [position, setPosition] = useState<any>({});

  useEffect(() => {
    if (placeholder) {
      setProperties(placeholder.properties || {});
      setPosition({
        left: placeholder.left,
        top: placeholder.top,
        width: placeholder.width,
        height: placeholder.height
      });
    }
  }, [placeholder]);

  const handlePropertyChange = (key: string, value: any) => {
    setProperties(prev => ({ ...prev, [key]: value }));
  };

  const handlePositionChange = (key: string, value: number) => {
    setPosition(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave(properties, position);
  };

  const handleReset = () => {
    if (placeholder) {
      setProperties(placeholder.properties || {});
      setPosition({
        left: placeholder.left,
        top: placeholder.top,
        width: placeholder.width,
        height: placeholder.height
      });
    }
  };

  const convertEmuToInches = (emu: number) => {
    return Math.round((emu / 914400) * 100) / 100;
  };

  const convertInchesToEmu = (inches: number) => {
    return Math.round(inches * 914400);
  };

  if (!placeholder) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Edit Placeholder: {placeholder.name || placeholder.placeholderType}</span>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="appearance" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="appearance" className="flex items-center space-x-1">
              <Palette className="h-4 w-4" />
              <span>Style</span>
            </TabsTrigger>
            <TabsTrigger value="position" className="flex items-center space-x-1">
              <Move className="h-4 w-4" />
              <span>Position</span>
            </TabsTrigger>
            <TabsTrigger value="size" className="flex items-center space-x-1">
              <Resize className="h-4 w-4" />
              <span>Size</span>
            </TabsTrigger>
            <TabsTrigger value="content" className="flex items-center space-x-1">
              <ImageIcon className="h-4 w-4" />
              <span>Content</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="appearance" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="bg-color">Background Color</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <Input
                    id="bg-color"
                    type="color"
                    value={properties.backgroundColor || '#ffffff'}
                    onChange={(e) => handlePropertyChange('backgroundColor', e.target.value)}
                    className="w-16 h-8"
                  />
                  <Input
                    value={properties.backgroundColor || '#ffffff'}
                    onChange={(e) => handlePropertyChange('backgroundColor', e.target.value)}
                    placeholder="#ffffff"
                    className="flex-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="border-color">Border Color</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <Input
                    id="border-color"
                    type="color"
                    value={properties.borderColor || '#000000'}
                    onChange={(e) => handlePropertyChange('borderColor', e.target.value)}
                    className="w-16 h-8"
                  />
                  <Input
                    value={properties.borderColor || '#000000'}
                    onChange={(e) => handlePropertyChange('borderColor', e.target.value)}
                    placeholder="#000000"
                    className="flex-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="border-width">Border Width: {properties.borderWidth || 0}px</Label>
                <Slider
                  id="border-width"
                  value={[properties.borderWidth || 0]}
                  onValueChange={(value) => handlePropertyChange('borderWidth', value[0])}
                  max={10}
                  step={1}
                  className="mt-2"
                />
              </div>

              {placeholder.placeholderType === 'title' && (
                <>
                  <Separator />
                  <div>
                    <Label htmlFor="font-family">Font Family</Label>
                    <Select value={properties.fontFamily || 'Arial'} onValueChange={(value) => handlePropertyChange('fontFamily', value)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Arial">Arial</SelectItem>
                        <SelectItem value="Helvetica">Helvetica</SelectItem>
                        <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                        <SelectItem value="Calibri">Calibri</SelectItem>
                        <SelectItem value="Verdana">Verdana</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="font-size">Font Size: {properties.fontSize || 12}pt</Label>
                    <Slider
                      id="font-size"
                      value={[properties.fontSize || 12]}
                      onValueChange={(value) => handlePropertyChange('fontSize', value[0])}
                      min={8}
                      max={72}
                      step={1}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="font-color">Font Color</Label>
                    <div className="flex items-center space-x-2 mt-1">
                      <Input
                        id="font-color"
                        type="color"
                        value={properties.fontColor || '#000000'}
                        onChange={(e) => handlePropertyChange('fontColor', e.target.value)}
                        className="w-16 h-8"
                      />
                      <Input
                        value={properties.fontColor || '#000000'}
                        onChange={(e) => handlePropertyChange('fontColor', e.target.value)}
                        placeholder="#000000"
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="text-align">Text Alignment</Label>
                      <Select value={properties.textAlign || 'center'} onValueChange={(value) => handlePropertyChange('textAlign', value)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">Left</SelectItem>
                          <SelectItem value="center">Center</SelectItem>
                          <SelectItem value="right">Right</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="vertical-align">Vertical Alignment</Label>
                      <Select value={properties.verticalAlign || 'middle'} onValueChange={(value) => handlePropertyChange('verticalAlign', value)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="top">Top</SelectItem>
                          <SelectItem value="middle">Middle</SelectItem>
                          <SelectItem value="bottom">Bottom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="position" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pos-left">Left Position (inches)</Label>
                <Input
                  id="pos-left"
                  type="number"
                  step="0.1"
                  value={convertEmuToInches(position.left || 0)}
                  onChange={(e) => handlePositionChange('left', convertInchesToEmu(parseFloat(e.target.value) || 0))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="pos-top">Top Position (inches)</Label>
                <Input
                  id="pos-top"
                  type="number"
                  step="0.1"
                  value={convertEmuToInches(position.top || 0)}
                  onChange={(e) => handlePositionChange('top', convertInchesToEmu(parseFloat(e.target.value) || 0))}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
              <p><strong>Current Position:</strong></p>
              <p>Left: {convertEmuToInches(position.left || 0)}" ({position.left || 0} EMUs)</p>
              <p>Top: {convertEmuToInches(position.top || 0)}" ({position.top || 0} EMUs)</p>
            </div>
          </TabsContent>

          <TabsContent value="size" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pos-width">Width (inches)</Label>
                <Input
                  id="pos-width"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={convertEmuToInches(position.width || 0)}
                  onChange={(e) => handlePositionChange('width', convertInchesToEmu(parseFloat(e.target.value) || 0))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="pos-height">Height (inches)</Label>
                <Input
                  id="pos-height"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={convertEmuToInches(position.height || 0)}
                  onChange={(e) => handlePositionChange('height', convertInchesToEmu(parseFloat(e.target.value) || 0))}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
              <p><strong>Current Size:</strong></p>
              <p>Width: {convertEmuToInches(position.width || 0)}" ({position.width || 0} EMUs)</p>
              <p>Height: {convertEmuToInches(position.height || 0)}" ({position.height || 0} EMUs)</p>
            </div>
          </TabsContent>

          <TabsContent value="content" className="space-y-4">
            {placeholder.placeholderType === 'content' && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="image-alignment">Image Alignment</Label>
                  <Select value={properties.imageAlignment || 'center'} onValueChange={(value) => handlePropertyChange('imageAlignment', value)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="image-scaling">Image Scaling</Label>
                  <Select value={properties.imageScaling || 'fit'} onValueChange={(value) => handlePropertyChange('imageScaling', value)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fit">Fit (maintain aspect ratio)</SelectItem>
                      <SelectItem value="fill">Fill (may crop)</SelectItem>
                      <SelectItem value="stretch">Stretch (may distort)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="padding">Padding: {convertEmuToInches(properties.padding || 0)}"</Label>
                  <Slider
                    id="padding"
                    value={[convertEmuToInches(properties.padding || 0)]}
                    onValueChange={(value) => handlePropertyChange('padding', convertInchesToEmu(value[0]))}
                    max={1}
                    step={0.1}
                    className="mt-2"
                  />
                </div>
              </div>
            )}

            {placeholder.placeholderType === 'title' && (
              <div className="text-center text-gray-600 py-8">
                <Type className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p>Title content settings are configured in the Style tab</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleReset}>
            Reset to Default
          </Button>
          <div className="space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
