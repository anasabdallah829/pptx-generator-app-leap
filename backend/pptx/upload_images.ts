import { api, APIError } from "encore.dev/api";
import { imagesBucket } from "./storage";
import { pptxDB } from "./db";
import type { FolderData, ImageData, UploadImagesResponse } from "./types";
import crypto from "crypto";

interface UploadImagesRequest {
  sessionId: string;
  files: UploadedFile[];
  isArchive?: boolean;
}

interface UploadedFile {
  filename: string;
  fileData: string; // base64 encoded
  folder?: string;
}

// Uploads images either from archive or individual files and organizes them into folders.
export const uploadImages = api<UploadImagesRequest, UploadImagesResponse>(
  { expose: true, method: "POST", path: "/upload-images" },
  async (req) => {
    try {
      const folders: FolderData[] = [];
      const folderMap = new Map<string, FolderData>();

      for (const file of req.files) {
        if (!isImageFile(file.filename)) {
          continue;
        }

        const fileBuffer = Buffer.from(file.fileData, 'base64');
        const hash = crypto.createHash('md5').update(fileBuffer).digest('hex');
        const extension = file.filename.split('.').pop()?.toLowerCase() || 'jpg';
        const storedFilename = `${hash}.${extension}`;
        
        const folderName = file.folder || 'Default';
        const folderId = `folder-${crypto.createHash('md5').update(folderName).digest('hex').substring(0, 8)}`;
        
        // Upload image to storage
        const imagePath = `images/${req.sessionId}/${folderId}/${storedFilename}`;
        await imagesBucket.upload(imagePath, fileBuffer, {
          contentType: getContentType(extension)
        });

        const imageUrl = imagesBucket.publicUrl(imagePath);

        const imageData: ImageData = {
          filename: file.filename,
          url: imageUrl,
          order: 1
        };

        if (!folderMap.has(folderId)) {
          const folderData: FolderData = {
            name: folderName,
            id: folderId,
            order: folderMap.size + 1,
            images: [],
            notes: ""
          };
          folderMap.set(folderId, folderData);
          folders.push(folderData);
        }

        const folder = folderMap.get(folderId)!;
        imageData.order = folder.images.length + 1;
        folder.images.push(imageData);
      }

      // Update session with new folders
      await updateSessionFolders(req.sessionId, folders);

      return {
        success: true,
        folders
      };
    } catch (error) {
      console.error("Upload images error:", error);
      return {
        success: false,
        error: "Failed to upload images"
      };
    }
  }
);

function isImageFile(filename: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
  const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return imageExtensions.includes(extension);
}

function getContentType(extension: string): string {
  const contentTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'webp': 'image/webp'
  };
  return contentTypes[extension] || 'image/jpeg';
}

async function updateSessionFolders(sessionId: string, newFolders: FolderData[]): Promise<void> {
  const existingSession = await pptxDB.queryRow`
    SELECT folders_data FROM sessions WHERE session_id = ${sessionId}
  `;

  let allFolders = newFolders;
  
  if (existingSession) {
    const existingFolders = existingSession.folders_data as FolderData[];
    // Merge with existing folders, avoiding duplicates
    const existingFolderIds = new Set(existingFolders.map(f => f.id));
    allFolders = [
      ...existingFolders,
      ...newFolders.filter(f => !existingFolderIds.has(f.id))
    ];

    await pptxDB.exec`
      UPDATE sessions 
      SET folders_data = ${JSON.stringify(allFolders)}, updated_at = CURRENT_TIMESTAMP
      WHERE session_id = ${sessionId}
    `;
  } else {
    await pptxDB.exec`
      INSERT INTO sessions (session_id, folders_data, settings_data)
      VALUES (${sessionId}, ${JSON.stringify(allFolders)}, ${JSON.stringify({})})
    `;
  }
}
