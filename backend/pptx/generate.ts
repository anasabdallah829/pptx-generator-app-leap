import { api, APIError } from "encore.dev/api";
import { pptxDB } from "./db";
import { templatesBucket, outputBucket } from "./storage";
import type { GenerateResponse, SessionData } from "./types";
import crypto from "crypto";

interface GenerateRequest {
  sessionId: string;
  templateId: number;
}

// Generates a PowerPoint presentation from template and session data.
export const generate = api<GenerateRequest, GenerateResponse>(
  { expose: true, method: "POST", path: "/generate" },
  async (req) => {
    try {
      // Get session data
      const session = await pptxDB.queryRow`
        SELECT folders_data, settings_data FROM sessions WHERE session_id = ${req.sessionId}
      `;

      if (!session) {
        throw APIError.notFound("Session not found");
      }

      // Get template
      const template = await pptxDB.queryRow`
        SELECT filename, file_path FROM templates WHERE id = ${req.templateId}
      `;

      if (!template) {
        throw APIError.notFound("Template not found");
      }

      const sessionData: SessionData = {
        folders: session.folders_data || [],
        settings: session.settings_data || getDefaultSettings()
      };

      // Download template
      const templateBuffer = await templatesBucket.download(template.file_path);

      // Generate presentation
      const outputBuffer = await generatePresentation(templateBuffer, sessionData);

      // Upload generated file
      const outputFilename = `generated_${Date.now()}.pptx`;
      const outputPath = `output/${req.sessionId}/${outputFilename}`;
      
      await outputBucket.upload(outputPath, outputBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      });

      // Save to database
      await pptxDB.exec`
        INSERT INTO generated_files (session_id, filename, file_path)
        VALUES (${req.sessionId}, ${outputFilename}, ${outputPath})
      `;

      const downloadUrl = outputBucket.publicUrl(outputPath);

      return {
        success: true,
        downloadUrl
      };
    } catch (error) {
      console.error("Generate error:", error);
      if (error instanceof APIError) {
        throw error;
      }
      return {
        success: false,
        error: "Failed to generate presentation"
      };
    }
  }
);

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

async function generatePresentation(templateBuffer: Buffer, sessionData: SessionData): Promise<Buffer> {
  // This is a simplified implementation
  // In a real implementation, you would use python-pptx equivalent or call a Python service
  
  // For now, return the template as-is
  // In production, this would:
  // 1. Parse the PPTX template
  // 2. Create slides for each folder
  // 3. Insert images according to settings
  // 4. Add titles and notes
  // 5. Return the modified PPTX
  
  return templateBuffer;
}
