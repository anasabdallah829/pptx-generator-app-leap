import { api, APIError } from "encore.dev/api";
import { imagesBucket } from "./storage";
import { pptxDB } from "./db";
import type { FolderData, ImageData, UploadImagesResponse } from "./types";
import crypto from "crypto";
import JSZip from "jszip";

interface UploadArchiveRequest {
  sessionId: string;
  filename: string;
  fileData: string; // base64 encoded
}

// Uploads and extracts images from archive files (ZIP).
export const uploadArchive = api<UploadArchiveRequest, UploadImagesResponse>(
  { expose: true, method: "POST", path: "/upload-archive" },
  async (req) => {
    try {
      if (!req.filename.toLowerCase().endsWith('.zip')) {
        throw APIError.invalidArgument("Only ZIP files are supported");
      }

      const fileBuffer = Buffer.from(req.fileData, 'base64');
      const zip = new JSZip();
      const zipContents = await zip.loadAsync(fileBuffer);

      const folders: FolderData[] = [];
      const folderMap = new Map<string, FolderData>();

      for (const [path, file] of Object.entries(zipContents.files)) {
        if (file.dir || !isImageFile(path)) {
          continue;
        }

        const pathParts = path.split('/');
        const filename = pathParts[pathParts.length - 1];
        const folderPath = pathParts.slice(0, -1).join('/');
        const folderName = folderPath || 'Root';
        const folderId = `folder-${crypto.createHash('md5').update(folderName).digest('hex').substring(0, 8)}`;

        const imageBuffer = await file.async('nodebuffer');
        const hash = crypto.createHash('md5').update(imageBuffer).digest('hex');
        const extension = filename.split('.').pop()?.toLowerCase() || 'jpg';
        const storedFilename = `${hash}.${extension}`;

        // Upload image to storage
        const imagePath = `images/${req.sessionId}/${folderId}/${storedFilename}`;
        await imagesBucket.upload(imagePath, imageBuffer, {
          contentType: getContentType(extension)
        });

        const imageUrl = imagesBucket.publicUrl(imagePath);

        const imageData: ImageData = {
          filename,
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

      if (folders.length === 0) {
        throw APIError.invalidArgument("No images found in archive");
      }

      // Update session with new folders
      await updateSessionFolders(req.sessionId, folders);

      return {
        success: true,
        folders
      };
    } catch (error) {
      console.error("Upload archive error:", error);
      if (error instanceof APIError) {
        throw error;
      }
      return {
        success: false,
        error: "Failed to upload archive"
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
