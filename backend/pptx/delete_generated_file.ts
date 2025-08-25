import { api, APIError } from "encore.dev/api";
import { pptxDB } from "./db";
import { outputBucket } from "./storage";

interface DeleteGeneratedFileRequest {
  fileId: number;
}

interface DeleteGeneratedFileResponse {
  success: boolean;
  error?: string;
}

// Deletes a generated presentation file.
export const deleteGeneratedFile = api<DeleteGeneratedFileRequest, DeleteGeneratedFileResponse>(
  { expose: true, method: "DELETE", path: "/generated-files/:fileId" },
  async (req) => {
    try {
      const file = await pptxDB.queryRow`
        SELECT file_path FROM generated_files WHERE id = ${req.fileId}
      `;

      if (!file) {
        throw APIError.notFound("Generated file not found");
      }

      // Delete from storage
      await outputBucket.remove(file.file_path);

      // Delete from database
      await pptxDB.exec`
        DELETE FROM generated_files WHERE id = ${req.fileId}
      `;

      return { success: true };
    } catch (error) {
      console.error("Delete generated file error:", error);
      if (error instanceof APIError) {
        throw error;
      }
      return {
        success: false,
        error: "Failed to delete generated file"
      };
    }
  }
);
