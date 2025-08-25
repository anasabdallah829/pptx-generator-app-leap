import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Folder, Trash2, Download, Calendar, Image } from 'lucide-react';
import { useSession } from '../contexts/SessionContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
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
import backend from '~backend/client';

export function SessionManager() {
  const { sessionId } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sessionsData, isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => backend.pptx.listSessions(),
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (sessionIdToDelete: string) => backend.pptx.deleteSession({ sessionId: sessionIdToDelete }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast({
        title: 'Success',
        description: 'Session deleted successfully',
      });
    },
    onError: (error) => {
      console.error('Delete session error:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete session',
        variant: 'destructive',
      });
    },
  });

  const handleDeleteSession = (sessionIdToDelete: string) => {
    if (sessionIdToDelete === sessionId) {
      toast({
        title: 'Cannot Delete',
        description: 'Cannot delete the current session',
        variant: 'destructive',
      });
      return;
    }
    deleteSessionMutation.mutate(sessionIdToDelete);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Previous Sessions</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-gray-100 h-20 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  const sessions = sessionsData?.sessions || [];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Previous Sessions</h3>
      
      {sessions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Folder className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p>No previous sessions found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`border rounded-lg p-4 transition-colors ${
                session.sessionId === sessionId
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Folder className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium">
                      Session {session.sessionId.substring(0, 8)}...
                      {session.sessionId === sessionId && (
                        <span className="ml-2 text-sm text-green-600">(Current)</span>
                      )}
                    </p>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Folder className="h-3 w-3" />
                        <span>{session.foldersCount} folders</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Image className="h-3 w-3" />
                        <span>{session.imagesCount} images</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(session.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {session.sessionId !== sessionId && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Session</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this session? This will remove all associated images and generated files. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteSession(session.sessionId)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
