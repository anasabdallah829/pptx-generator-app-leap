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
      console.log(`Starting archive upload for session: ${req.sessionId}`);
      
      if (!req.filename.toLowerCase().endsWith('.zip')) {
        throw APIError.invalidArgument("Only ZIP files are supported");
      }

      if (!req.fileData) {
        throw APIError.invalidArgument("No file data provided");
      }

      // Decode base64 file data
      let fileBuffer: Buffer;
      try {
        fileBuffer = Buffer.from(req.fileData, 'base64');
        console.log(`File buffer size: ${fileBuffer.length} bytes`);
      } catch (error) {
        console.error('Base64 decode error:', error);
        throw APIError.invalidArgument("Invalid file data encoding");
      }

      // Load and extract ZIP file
      const zip = new JSZip();
      let zipContents: JSZip;
      try {
        zipContents = await zip.loadAsync(fileBuffer);
        console.log(`ZIP loaded successfully, files count: ${Object.keys(zipContents.files).length}`);
      } catch (error) {
        console.error('ZIP load error:', error);
        throw APIError.invalidArgument("Invalid or corrupted ZIP file");
      }

      const folders: FolderData[] = [];
      const folderMap = new Map<string, FolderData>();
      let processedImages = 0;

      // Process each file in the ZIP
      for (const [path, file] of Object.entries(zipContents.files)) {
        if (file.dir) {
          console.log(`Skipping directory: ${path}`);
          continue;
        }

        if (!isImageFile(path)) {
          console.log(`Skipping non-image file: ${path}`);
          continue;
        }

        try {
          console.log(`Processing image: ${path}`);
          
          const pathParts = path.split('/').filter(part => part.length > 0);
          const filename = pathParts[pathParts.length - 1];
          const folderPath = pathParts.slice(0, -1).join('/');
          const folderName = folderPath || 'Root';
          const folderId = `folder-${crypto.createHash('md5').update(folderName).digest('hex').substring(0, 8)}`;

          // Extract image data
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

          // Create or get folder
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
            console.log(`Created folder: ${folderName} (${folderId})`);
          }

          const folder = folderMap.get(folderId)!;
          imageData.order = folder.images.length + 1;
          folder.images.push(imageData);
          processedImages++;

          console.log(`Processed image ${processedImages}: ${filename} -> ${folderName}`);
        } catch (error) {
          console.error(`Error processing image ${path}:`, error);
          // Continue processing other images
        }
      }

      if (folders.length === 0) {
        throw APIError.invalidArgument("No images found in archive");
      }

      console.log(`Archive processing complete. Folders: ${folders.length}, Images: ${processedImages}`);

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
      throw APIError.internal("Failed to process archive");
    }
  }
);

function isImageFile(filename: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.svg'];
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
    'webp': 'image/webp',
    'tiff': 'image/tiff',
    'svg': 'image/svg+xml'
  };
  return contentTypes[extension] || 'image/jpeg';
}

async function updateSessionFolders(sessionId: string, newFolders: FolderData[]): Promise<void> {
  try {
    const existingSession = await pptxDB.queryRow`
      SELECT folders_data FROM sessions WHERE session_id = ${sessionId}
    `;

    let allFolders = newFolders;
    
    if (existingSession && existingSession.folders_data) {
      const existingFolders = existingSession.folders_data as FolderData[];
      // Merge with existing folders, avoiding duplicates
      const existingFolderIds = new Set(existingFolders.map(f => f.id));
      const uniqueNewFolders = newFolders.filter(f => !existingFolderIds.has(f.id));
      allFolders = [...existingFolders, ...uniqueNewFolders];

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

    console.log(`Session updated with ${allFolders.length} folders`);
  } catch (error) {
    console.error('Error updating session folders:', error);
    throw error;
  }
}
