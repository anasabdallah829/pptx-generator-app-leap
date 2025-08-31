import { api, APIError } from "encore.dev/api";
import { pptxDB } from "./db";
import type { InteractivePreviewResponse, SlidePreview, PlaceholderInfo, SessionData } from "./types";

interface InteractivePreviewRequest {
  sessionId: string;
  templateId?: number;
}

// Returns interactive preview data for the presentation with clickable placeholders.
export const interactivePreview = api<InteractivePreviewRequest, InteractivePreviewResponse>(
  { expose: true, method: "GET", path: "/interactive-preview" },
  async (req) => {
    try {
      // Get session data
      const session = await pptxDB.queryRow`
        SELECT folders_data, settings_data FROM sessions WHERE session_id = ${req.sessionId}
      `;

      if (!session) {
        throw APIError.notFound("Session not found");
      }

      const sessionData: SessionData = {
        folders: session.folders_data || [],
        settings: session.settings_data || getDefaultSettings()
      };

      let template: any = null;
      let templatePlaceholders: PlaceholderInfo[] = [];

      if (req.templateId) {
        const templateRow = await pptxDB.queryRow`
          SELECT id, filename, hash FROM templates WHERE id = ${req.templateId}
        `;

        if (templateRow) {
          // Get template placeholders (would normally analyze the actual PPTX)
          templatePlaceholders = await getTemplatePlaceholders(req.templateId);
          template = {
            id: templateRow.id,
            filename: templateRow.filename,
            hash: templateRow.hash,
            placeholders: templatePlaceholders
          };
        }
      }

      // Generate slide previews based on folders
      const slides: SlidePreview[] = sessionData.folders.map((folder, index) => {
        // Clone template placeholders for this slide
        const slidePlaceholders: PlaceholderInfo[] = templatePlaceholders.map(placeholder => ({
          ...placeholder,
          id: `${placeholder.id}-slide-${index}`,
          slideIndex: index,
        }));

        // If no template placeholders, create default ones
        if (slidePlaceholders.length === 0) {
          slidePlaceholders.push(
            {
              id: `title-placeholder-slide-${index}`,
              slideIndex: index,
              placeholderType: 'title',
              name: 'Title Placeholder',
              left: 914400, // 1 inch in EMUs
              top: 457200, // 0.5 inch in EMUs
              width: 7315200, // 8 inches in EMUs
              height: 1143000, // 1.25 inches in EMUs
              properties: {
                backgroundColor: 'transparent',
                borderColor: '#000000',
                borderWidth: 0,
                fontFamily: 'Arial',
                fontSize: 24,
                fontColor: '#000000',
                textAlign: 'center',
                verticalAlign: 'middle'
              }
            },
            {
              id: `content-placeholder-slide-${index}`,
              slideIndex: index,
              placeholderType: 'content',
              name: 'Content Placeholder',
              left: 914400, // 1 inch in EMUs
              top: 1828800, // 2 inches in EMUs
              width: 7315200, // 8 inches in EMUs
              height: 4571000, // 5 inches in EMUs
              properties: {
                backgroundColor: 'transparent',
                borderColor: '#000000',
                borderWidth: 1,
                imageAlignment: 'center',
                imageScaling: 'fit',
                padding: 91440 // 0.1 inch in EMUs
              }
            }
          );
        }

        return {
          slideIndex: index,
          title: sessionData.settings.insertFolderNameAsTitle ? folder.name : undefined,
          placeholders: slidePlaceholders,
          content: {
            folderId: folder.id,
            folderName: folder.name,
            imageCount: folder.images.length
          }
        };
      });

      return {
        success: true,
        slides,
        template
      };
    } catch (error) {
      console.error("Interactive preview error:", error);
      if (error instanceof APIError) {
        throw error;
      }
      return {
        success: false,
        error: "Failed to generate interactive preview"
      };
    }
  }
);

async function getTemplatePlaceholders(templateId: number): Promise<PlaceholderInfo[]> {
  // This would parse the actual PPTX file to extract placeholders
  // For now, return mock data with realistic placeholder configurations
  return [
    {
      id: 'title-placeholder',
      slideIndex: 0,
      placeholderType: 'title',
      name: 'Title Placeholder',
      left: 914400, // 1 inch in EMUs
      top: 457200, // 0.5 inch in EMUs
      width: 7315200, // 8 inches in EMUs
      height: 1143000, // 1.25 inches in EMUs
      properties: {
        backgroundColor: 'transparent',
        borderColor: '#000000',
        borderWidth: 0,
        fontFamily: 'Arial',
        fontSize: 24,
        fontColor: '#000000',
        textAlign: 'center',
        verticalAlign: 'middle'
      }
    },
    {
      id: 'content-placeholder',
      slideIndex: 0,
      placeholderType: 'content',
      name: 'Content Placeholder',
      left: 914400, // 1 inch in EMUs
      top: 1828800, // 2 inches in EMUs
      width: 7315200, // 8 inches in EMUs
      height: 4571000, // 5 inches in EMUs
      properties: {
        backgroundColor: 'transparent',
        borderColor: '#000000',
        borderWidth: 1,
        imageAlignment: 'center',
        imageScaling: 'fit',
        padding: 91440 // 0.1 inch in EMUs
      }
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
