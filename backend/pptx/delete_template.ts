import { api, APIError } from "encore.dev/api";
import { pptxDB } from "./db";
import { templatesBucket } from "./storage";

interface DeleteTemplateRequest {
  templateId: number;
}

interface DeleteTemplateResponse {
  success: boolean;
  error?: string;
}

// Deletes a template and its associated file.
export const deleteTemplate = api<DeleteTemplateRequest, DeleteTemplateResponse>(
  { expose: true, method: "DELETE", path: "/templates/:templateId" },
  async (req) => {
    try {
      const template = await pptxDB.queryRow`
        SELECT file_path FROM templates WHERE id = ${req.templateId}
      `;

      if (!template) {
        throw APIError.notFound("Template not found");
      }

      // Delete from storage
      await templatesBucket.remove(template.file_path);

      // Delete from database
      await pptxDB.exec`
        DELETE FROM templates WHERE id = ${req.templateId}
      `;

      return { success: true };
    } catch (error) {
      console.error("Delete template error:", error);
      if (error instanceof APIError) {
        throw error;
      }
      return {
        success: false,
        error: "Failed to delete template"
      };
    }
  }
);
