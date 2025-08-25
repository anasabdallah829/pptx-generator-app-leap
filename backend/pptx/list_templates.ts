import { api } from "encore.dev/api";
import { pptxDB } from "./db";

interface Template {
  id: number;
  filename: string;
  hash: string;
  createdAt: Date;
}

interface ListTemplatesResponse {
  success: boolean;
  templates: Template[];
  error?: string;
}

// Lists all available templates.
export const listTemplates = api<void, ListTemplatesResponse>(
  { expose: true, method: "GET", path: "/templates" },
  async () => {
    try {
      const templates = await pptxDB.queryAll<Template>`
        SELECT id, filename, hash, created_at as "createdAt"
        FROM templates
        ORDER BY created_at DESC
      `;

      return {
        success: true,
        templates
      };
    } catch (error) {
      console.error("List templates error:", error);
      return {
        success: false,
        templates: [],
        error: "Failed to list templates"
      };
    }
  }
);
