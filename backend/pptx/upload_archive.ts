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
  chunkIndex?: number;
  totalChunks?: number;
  uploadId?: string;
}

interface UploadArchiveChunkRequest {
  sessionId: string;
  uploadId: string;
  chunkIndex: number;
  totalChunks: number;
  chunkData: string; // base64 encoded chunk
}

interface InitiateUploadRequest {
  sessionId: string;
  filename: string;
  fileSize: number;
}

interface InitiateUploadResponse {
  success: boolean;
  uploadId?: string;
  chunkSize?: number;
  error?: string;
}

// Initiates a chunked upload for large archive files.
export const initiateArchiveUpload = api<InitiateUploadRequest, InitiateUploadResponse>(
  { expose: true, method: "POST", path: "/upload-archive/initiate" },
  async (req) => {
    try {
      const uploadId = crypto.randomUUID();
      const chunkSize = 5 * 1024 * 1024; // 5MB chunks

      // Store upload metadata in database
      await pptxDB.exec`
        INSERT INTO upload_sessions (upload_id, session_id, filename, file_size, status, created_at)
        VALUES (${uploadId}, ${req.sessionId}, ${req.filename}, ${req.fileSize}, 'initiated', CURRENT_TIMESTAMP)
      `;

      return {
        success: true,
        uploadId,
        chunkSize
      };
    } catch (error) {
      console.error("Initiate upload error:", error);
      return {
        success: false,
        error: "Failed to initiate upload"
      };
    }
  }
);

// Uploads a chunk of the archive file.
export const uploadArchiveChunk = api<UploadArchiveChunkRequest, { success: boolean; error?: string }>(
  { expose: true, method: "POST", path: "/upload-archive/chunk" },
  async (req) => {
    try {
      console.log(`Uploading chunk ${req.chunkIndex + 1}/${req.totalChunks} for upload ${req.uploadId}`);

      // Verify upload session exists
      const uploadSession = await pptxDB.queryRow`
        SELECT id, status FROM upload_sessions WHERE upload_id = ${req.uploadId} AND session_id = ${req.sessionId}
      `;

      if (!uploadSession) {
        throw APIError.notFound("Upload session not found");
      }

      if (uploadSession.status === 'completed') {
        throw APIError.invalidArgument("Upload already completed");
      }

      // Store chunk data
      const chunkBuffer = Buffer.from(req.chunkData, 'base64');
      const chunkPath = `temp/${req.uploadId}/chunk_${req.chunkIndex}`;
      
      await imagesBucket.upload(chunkPath, chunkBuffer);

      // Update chunk status
      await pptxDB.exec`
        INSERT INTO upload_chunks (upload_id, chunk_index, chunk_path, uploaded_at)
        VALUES (${req.uploadId}, ${req.chunkIndex}, ${chunkPath}, CURRENT_TIMESTAMP)
        ON CONFLICT (upload_id, chunk_index) DO UPDATE SET
          chunk_path = EXCLUDED.chunk_path,
          uploaded_at = EXCLUDED.uploaded_at
      `;

      // Check if all chunks are uploaded
      const uploadedChunks = await pptxDB.queryAll`
        SELECT chunk_index FROM upload_chunks WHERE upload_id = ${req.uploadId} ORDER BY chunk_index
      `;

      if (uploadedChunks.length === req.totalChunks) {
        // All chunks uploaded, trigger assembly
        await assembleAndProcessArchive(req.uploadId, req.sessionId);
      }

      return { success: true };
    } catch (error) {
      console.error("Upload chunk error:", error);
      if (error instanceof APIError) {
        throw error;
      }
      return {
        success: false,
        error: "Failed to upload chunk"
      };
    }
  }
);

// Gets the status of a chunked upload.
export const getUploadStatus = api<{ uploadId: string }, { success: boolean; status?: string; progress?: number; folders?: FolderData[]; error?: string }>(
  { expose: true, method: "GET", path: "/upload-archive/status/:uploadId" },
  async (req) => {
    try {
      const uploadSession = await pptxDB.queryRow`
        SELECT status, total_chunks, error_message FROM upload_sessions WHERE upload_id = ${req.uploadId}
      `;

      if (!uploadSession) {
        throw APIError.notFound("Upload session not found");
      }

      const uploadedChunks = await pptxDB.queryAll`
        SELECT chunk_index FROM upload_chunks WHERE upload_id = ${req.uploadId}
      `;

      const progress = uploadSession.total_chunks > 0 ? 
        (uploadedChunks.length / uploadSession.total_chunks) * 100 : 0;

      let folders: FolderData[] | undefined;
      if (uploadSession.status === 'completed') {
        const result = await pptxDB.queryRow`
          SELECT result_data FROM upload_sessions WHERE upload_id = ${req.uploadId}
        `;
        if (result?.result_data) {
          folders = result.result_data as FolderData[];
        }
      }

      return {
        success: true,
        status: uploadSession.status,
        progress,
        folders,
        error: uploadSession.error_message
      };
    } catch (error) {
      console.error("Get upload status error:", error);
      if (error instanceof APIError) {
        throw error;
      }
      return {
        success: false,
        error: "Failed to get upload status"
      };
    }
  }
);

// Original single-request upload for smaller files (fallback)
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

      // Check file size (base64 encoded size)
      const estimatedSize = (req.fileData.length * 3) / 4; // Approximate original size
      if (estimatedSize > 10 * 1024 * 1024) { // 10MB limit for single upload
        throw APIError.invalidArgument("File too large for single upload. Use chunked upload instead.");
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

      const folders = await processZipFile(fileBuffer, req.sessionId);

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

async function assembleAndProcessArchive(uploadId: string, sessionId: string): Promise<void> {
  try {
    console.log(`Assembling archive for upload ${uploadId}`);

    // Update status to processing
    await pptxDB.exec`
      UPDATE upload_sessions SET status = 'processing', updated_at = CURRENT_TIMESTAMP
      WHERE upload_id = ${uploadId}
    `;

    // Get all chunks
    const chunks = await pptxDB.queryAll`
      SELECT chunk_index, chunk_path FROM upload_chunks 
      WHERE upload_id = ${uploadId} 
      ORDER BY chunk_index
    `;

    // Download and assemble chunks
    const chunkBuffers: Buffer[] = [];
    for (const chunk of chunks) {
      const chunkBuffer = await imagesBucket.download(chunk.chunk_path);
      chunkBuffers.push(chunkBuffer);
    }

    const assembledBuffer = Buffer.concat(chunkBuffers);
    console.log(`Assembled file size: ${assembledBuffer.length} bytes`);

    // Process the assembled ZIP file
    const folders = await processZipFile(assembledBuffer, sessionId);

    // Update session with results
    await updateSessionFolders(sessionId, folders);

    // Mark upload as completed
    await pptxDB.exec`
      UPDATE upload_sessions 
      SET status = 'completed', result_data = ${JSON.stringify(folders)}, updated_at = CURRENT_TIMESTAMP
      WHERE upload_id = ${uploadId}
    `;

    // Clean up temporary chunks
    await cleanupUploadChunks(uploadId);

    console.log(`Archive processing complete for upload ${uploadId}. Folders: ${folders.length}`);
  } catch (error) {
    console.error(`Error assembling archive for upload ${uploadId}:`, error);
    
    // Mark upload as failed
    await pptxDB.exec`
      UPDATE upload_sessions 
      SET status = 'failed', error_message = ${error instanceof Error ? error.message : 'Unknown error'}, updated_at = CURRENT_TIMESTAMP
      WHERE upload_id = ${uploadId}
    `;
    
    // Clean up temporary chunks
    await cleanupUploadChunks(uploadId);
  }
}

async function processZipFile(fileBuffer: Buffer, sessionId: string): Promise<FolderData[]> {
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
      const imagePath = `images/${sessionId}/${folderId}/${storedFilename}`;
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
  return folders;
}

async function cleanupUploadChunks(uploadId: string): Promise<void> {
  try {
    // Get all chunk paths
    const chunks = await pptxDB.queryAll`
      SELECT chunk_path FROM upload_chunks WHERE upload_id = ${uploadId}
    `;

    // Delete chunk files from storage
    for (const chunk of chunks) {
      try {
        await imagesBucket.remove(chunk.chunk_path);
      } catch (error) {
        console.warn(`Failed to delete chunk ${chunk.chunk_path}:`, error);
      }
    }

    // Delete chunk records
    await pptxDB.exec`
      DELETE FROM upload_chunks WHERE upload_id = ${uploadId}
    `;

    console.log(`Cleaned up ${chunks.length} chunks for upload ${uploadId}`);
  } catch (error) {
    console.error(`Error cleaning up chunks for upload ${uploadId}:`, error);
  }
}

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
