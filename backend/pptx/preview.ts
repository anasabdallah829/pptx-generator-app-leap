import { api, APIError } from "encore.dev/api";
import { pptxDB } from "./db";
import type { PreviewResponse, TemplateInfo, SessionData, PlaceholderInfo } from "./types";

interface PreviewRequest {
  sessionId?: string;
  templateId?: number;
}

// Returns preview information for template and session data.
export const preview = api<PreviewRequest, PreviewResponse>(
  { expose: true, method: "GET", path: "/preview" },
  async (req) => {
    try {
      let template: TemplateInfo | undefined;
      let session: SessionData | undefined;

      if (req.templateId) {
        const templateRow = await pptxDB.queryRow`
          SELECT id, filename, hash FROM templates WHERE id = ${req.templateId}
        `;

        if (templateRow) {
          const placeholders = await getTemplatePlaceholders(req.templateId);
          template = {
            id: templateRow.id,
            filename: templateRow.filename,
            hash: templateRow.hash,
            placeholders
          };
        }
      }

      if (req.sessionId) {
        const sessionRow = await pptxDB.queryRow`
          SELECT folders_data, settings_data FROM sessions WHERE session_id = ${req.sessionId}
        `;

        if (sessionRow) {
          session = {
            folders: sessionRow.folders_data || [],
            settings: sessionRow.settings_data || getDefaultSettings()
          };
        }
      }

      return {
        success: true,
        template,
        session
      };
    } catch (error) {
      console.error("Preview error:", error);
      return {
        success: false,
        error: "Failed to get preview data"
      };
    }
  }
);

async function getTemplatePlaceholders(templateId: number): Promise<PlaceholderInfo[]> {
  // This would parse the actual PPTX file to extract placeholders
  // For now, return mock data
  return [
    {
      slideIndex: 0,
      placeholderType: "title",
      name: "Title Placeholder",
      left: 100,
      top: 50,
      width: 800,
      height: 100
    },
    {
      slideIndex: 0,
      placeholderType: "content",
      name: "Content Placeholder",
      left: 100,
      top: 200,
      width: 800,
      height: 400
    }
  ];
}

function getDefaultSettings() {
  return {
    layout: {
      grid: true,
      rows: 2,
      columns: 3,
      autoFit: true,
      preserveAspect: true
    },
    usePlaceholders: true,
    insertFolderNameAsTitle: true,
    language: "en"
  };
}
