import { api } from "encore.dev/api";
import { pptxDB } from "./db";
import { outputBucket } from "./storage";

interface GeneratedFile {
  id: number;
  sessionId: string;
  filename: string;
  filePath: string;
  downloadUrl: string;
  createdAt: Date;
}

interface ListGeneratedFilesRequest {
  sessionId?: string;
}

interface ListGeneratedFilesResponse {
  success: boolean;
  files: GeneratedFile[];
  error?: string;
}

// Lists generated presentation files, optionally filtered by session.
export const listGeneratedFiles = api<ListGeneratedFilesRequest, ListGeneratedFilesResponse>(
  { expose: true, method: "GET", path: "/generated-files" },
  async (req) => {
    try {
      let query;
      if (req.sessionId) {
        query = pptxDB.queryAll`
          SELECT id, session_id as "sessionId", filename, file_path as "filePath", created_at as "createdAt"
          FROM generated_files
          WHERE session_id = ${req.sessionId}
          ORDER BY created_at DESC
        `;
      } else {
        query = pptxDB.queryAll`
          SELECT id, session_id as "sessionId", filename, file_path as "filePath", created_at as "createdAt"
          FROM generated_files
          ORDER BY created_at DESC
        `;
      }

      const files = await query;
      
      const filesWithUrls = files.map(file => ({
        ...file,
        downloadUrl: outputBucket.publicUrl(file.filePath)
      }));

      return {
        success: true,
        files: filesWithUrls
      };
    } catch (error) {
      console.error("List generated files error:", error);
      return {
        success: false,
        files: [],
        error: "Failed to list generated files"
      };
    }
  }
);
