import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Folder, Image, Edit2, Trash2, GripVertical } from 'lucide-react';
import { useSession } from '../contexts/SessionContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function FolderManager() {
  const { folders, updateFolder, deleteFolder, reorderFolders } = useSession();
  const { t } = useLanguage();
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    
    reorderFolders(result.source.index, result.destination.index);
  };

  const startEdit = (folder: any) => {
    setEditingFolder(folder.id);
    setEditName(folder.name);
    setEditNotes(folder.notes || '');
  };

  const saveEdit = () => {
    if (editingFolder) {
      updateFolder(editingFolder, {
        name: editName,
        notes: editNotes,
      });
      setEditingFolder(null);
    }
  };

  const cancelEdit = () => {
    setEditingFolder(null);
    setEditName('');
    setEditNotes('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">{t('organize.folders')}</h2>
        <p className="text-gray-600">
          Drag and drop to reorder folders. Each folder will become a slide.
        </p>
      </div>

      {folders.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Folder className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>No folders uploaded yet. Upload some images to get started.</p>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="folders">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-4"
              >
                {folders.map((folder, index) => (
                  <Draggable key={folder.id} draggableId={folder.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`bg-white border rounded-lg p-4 transition-shadow ${
                          snapshot.isDragging ? 'shadow-lg' : 'shadow-sm'
                        }`}
                      >
                        <div className="flex items-start space-x-4">
                          <div
                            {...provided.dragHandleProps}
                            className="mt-2 text-gray-400 hover:text-gray-600 cursor-grab"
                          >
                            <GripVertical className="h-5 w-5" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center space-x-2">
                                <Folder className="h-5 w-5 text-blue-600" />
                                <h3 className="font-semibold text-lg">{folder.name}</h3>
                                <span className="text-sm text-gray-500">
                                  (Slide {index + 1})
                                </span>
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => startEdit(folder)}
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Edit Folder</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div>
                                        <Label htmlFor="folder-name">{t('folder.name')}</Label>
                                        <Input
                                          id="folder-name"
                                          value={editName}
                                          onChange={(e) => setEditName(e.target.value)}
                                          className="mt-1"
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="folder-notes">{t('folder.notes')}</Label>
                                        <Textarea
                                          id="folder-notes"
                                          value={editNotes}
                                          onChange={(e) => setEditNotes(e.target.value)}
                                          className="mt-1"
                                          rows={3}
                                        />
                                      </div>
                                      <div className="flex justify-end space-x-2">
                                        <Button variant="outline" onClick={cancelEdit}>
                                          Cancel
                                        </Button>
                                        <Button onClick={saveEdit}>
                                          Save Changes
                                        </Button>
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>

                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      <Trash2 className="h-4 w-4 text-red-600" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Folder</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete "{folder.name}"? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteFolder(folder.id)}
                                        className="bg-red-600 hover:bg-red-700"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>

                            {folder.notes && (
                              <p className="text-gray-600 mb-3 text-sm">{folder.notes}</p>
                            )}

                            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
                              {folder.images.map((image, imgIndex) => (
                                <div
                                  key={imgIndex}
                                  className="aspect-square bg-gray-100 rounded border overflow-hidden"
                                >
                                  <img
                                    src={image.url}
                                    alt={image.filename}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                </div>
                              ))}
                            </div>

                            <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
                              <span>{folder.images.length} images</span>
                              <span>Order: {folder.order}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}
    </div>
  );
}
