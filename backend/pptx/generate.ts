import { api, APIError } from "encore.dev/api";
import { pptxDB } from "./db";
import { templatesBucket, outputBucket, imagesBucket } from "./storage";
import type { GenerateResponse, SessionData, FolderData, ImageData } from "./types";
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
      console.log(`Starting generation for session: ${req.sessionId}, template: ${req.templateId}`);

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

      if (sessionData.folders.length === 0) {
        throw APIError.invalidArgument("No folders found in session");
      }

      console.log(`Processing ${sessionData.folders.length} folders`);

      // Download template
      const templateBuffer = await templatesBucket.download(template.file_path);

      // Generate presentation
      const outputBuffer = await generatePresentation(templateBuffer, sessionData, req.sessionId);

      // Upload generated file
      const outputFilename = `presentation_${Date.now()}.pptx`;
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

      console.log(`Generation complete: ${outputFilename}`);

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

async function generatePresentation(templateBuffer: Buffer, sessionData: SessionData, sessionId: string): Promise<Buffer> {
  try {
    console.log('Starting presentation generation...');
    
    // Import required modules for PPTX processing
    const JSZip = require('jszip');
    const xml2js = require('xml2js');
    
    // Load the template PPTX file
    const zip = new JSZip();
    const pptx = await zip.loadAsync(templateBuffer);
    
    // Parse presentation structure
    const presentationXml = await pptx.file('ppt/presentation.xml')?.async('text');
    if (!presentationXml) {
      throw new Error('Invalid PowerPoint template');
    }
    
    const parser = new xml2js.Parser();
    const builder = new xml2js.Builder();
    const presentation = await parser.parseStringPromise(presentationXml);
    
    // Get slide master and layout references
    const slideIdList = presentation['p:presentation']['p:sldIdLst'][0]['p:sldId'] || [];
    const originalSlideCount = slideIdList.length;
    
    console.log(`Template has ${originalSlideCount} slides`);
    
    // Process each folder as a slide
    let slideIndex = originalSlideCount;
    const newSlideIds: any[] = [];
    
    for (const folder of sessionData.folders) {
      console.log(`Processing folder: ${folder.name} with ${folder.images.length} images`);
      
      slideIndex++;
      const slideId = slideIndex;
      const slideRId = `rId${slideIndex + 10}`;
      const slideName = `slide${slideIndex}.xml`;
      const slideRelName = `slide${slideIndex}.xml.rels`;
      
      // Create slide content
      const slideContent = await createSlideContent(folder, sessionData.settings, sessionId);
      
      // Add slide to zip
      pptx.file(`ppt/slides/${slideName}`, slideContent);
      
      // Create slide relationships
      const slideRels = createSlideRelationships(folder.images);
      pptx.file(`ppt/slides/_rels/${slideRelName}`, slideRels);
      
      // Add slide reference to presentation
      newSlideIds.push({
        '$': {
          'id': slideId.toString(),
          'r:id': slideRId
        }
      });
      
      // Copy images to the PPTX package
      for (let i = 0; i < folder.images.length; i++) {
        const image = folder.images[i];
        try {
          // Download image from storage
          const imagePath = extractImagePath(image.url, sessionId);
          const imageBuffer = await imagesBucket.download(imagePath);
          
          // Add to PPTX media folder
          const imageExt = image.filename.split('.').pop()?.toLowerCase() || 'jpg';
          const mediaName = `image${slideIndex}_${i + 1}.${imageExt}`;
          pptx.file(`ppt/media/${mediaName}`, imageBuffer);
        } catch (error) {
          console.error(`Failed to add image ${image.filename}:`, error);
        }
      }
    }
    
    // Update presentation.xml with new slides
    if (newSlideIds.length > 0) {
      slideIdList.push(...newSlideIds);
      const updatedPresentationXml = builder.buildObject(presentation);
      pptx.file('ppt/presentation.xml', updatedPresentationXml);
    }
    
    // Update content types and relationships
    await updateContentTypes(pptx, slideIndex - originalSlideCount);
    await updatePresentationRels(pptx, newSlideIds, originalSlideCount);
    
    // Generate the final PPTX buffer
    const outputBuffer = await pptx.generateAsync({ type: 'nodebuffer' });
    
    console.log(`Generated presentation with ${sessionData.folders.length} new slides`);
    return outputBuffer;
    
  } catch (error) {
    console.error('Error generating presentation:', error);
    // Return original template if generation fails
    return templateBuffer;
  }
}

async function createSlideContent(folder: FolderData, settings: any, sessionId: string): Promise<string> {
  const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" 
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" 
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      ${settings.insertFolderNameAsTitle ? createTitleShape(folder.name) : ''}
      ${createImageShapes(folder.images, settings)}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr>
    <a:masterClrMapping/>
  </p:clrMapOvr>
</p:sld>`;
  
  return slideXml;
}

function createTitleShape(title: string): string {
  return `
    <p:sp>
      <p:nvSpPr>
        <p:cNvPr id="2" name="Title"/>
        <p:cNvSpPr>
          <a:spLocks noGrp="1"/>
        </p:cNvSpPr>
        <p:nvPr>
          <p:ph type="title"/>
        </p:nvPr>
      </p:nvSpPr>
      <p:spPr/>
      <p:txBody>
        <a:bodyPr/>
        <a:lstStyle/>
        <a:p>
          <a:r>
            <a:rPr lang="en-US" dirty="0" smtClean="0"/>
            <a:t>${title}</a:t>
          </a:r>
          <a:endParaRPr lang="en-US" dirty="0"/>
        </a:p>
      </p:txBody>
    </p:sp>`;
}

function createImageShapes(images: ImageData[], settings: any): string {
  const { rows, columns } = settings.layout;
  const slideWidth = 9144000; // 10 inches in EMUs
  const slideHeight = 6858000; // 7.5 inches in EMUs
  const margin = 457200; // 0.5 inch margin
  
  const contentWidth = slideWidth - (2 * margin);
  const contentHeight = slideHeight - (2 * margin) - (settings.insertFolderNameAsTitle ? 914400 : 0); // Leave space for title
  
  const cellWidth = contentWidth / columns;
  const cellHeight = contentHeight / rows;
  
  let shapes = '';
  let shapeId = 3; // Start after title
  
  for (let i = 0; i < Math.min(images.length, rows * columns); i++) {
    const row = Math.floor(i / columns);
    const col = i % columns;
    
    const x = margin + (col * cellWidth);
    const y = margin + (settings.insertFolderNameAsTitle ? 914400 : 0) + (row * cellHeight);
    
    shapes += `
      <p:pic>
        <p:nvPicPr>
          <p:cNvPr id="${shapeId}" name="Picture ${shapeId}"/>
          <p:cNvPicPr/>
          <p:nvPr/>
        </p:nvPicPr>
        <p:blipFill>
          <a:blip r:embed="rId${i + 1}"/>
          <a:stretch>
            <a:fillRect/>
          </a:stretch>
        </p:blipFill>
        <p:spPr>
          <a:xfrm>
            <a:off x="${Math.round(x)}" y="${Math.round(y)}"/>
            <a:ext cx="${Math.round(cellWidth * 0.9)}" cy="${Math.round(cellHeight * 0.9)}"/>
          </a:xfrm>
          <a:prstGeom prst="rect">
            <a:avLst/>
          </a:prstGeom>
        </p:spPr>
      </p:pic>`;
    
    shapeId++;
  }
  
  return shapes;
}

function createSlideRelationships(images: ImageData[]): string {
  let relationships = '';
  
  for (let i = 0; i < images.length; i++) {
    const imageExt = images[i].filename.split('.').pop()?.toLowerCase() || 'jpg';
    relationships += `
      <Relationship Id="rId${i + 1}" 
                    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" 
                    Target="../media/image${i + 1}.${imageExt}"/>`;
  }
  
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${relationships}
</Relationships>`;
}

async function updateContentTypes(pptx: any, newSlideCount: number): Promise<void> {
  try {
    const contentTypesXml = await pptx.file('[Content_Types].xml')?.async('text');
    if (!contentTypesXml) return;
    
    const parser = new (require('xml2js')).Parser();
    const builder = new (require('xml2js')).Builder();
    const contentTypes = await parser.parseStringPromise(contentTypesXml);
    
    // Add new slide content types
    const overrides = contentTypes.Types.Override || [];
    for (let i = 1; i <= newSlideCount; i++) {
      overrides.push({
        '$': {
          'PartName': `/ppt/slides/slide${i}.xml`,
          'ContentType': 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml'
        }
      });
    }
    
    contentTypes.Types.Override = overrides;
    const updatedContentTypesXml = builder.buildObject(contentTypes);
    pptx.file('[Content_Types].xml', updatedContentTypesXml);
  } catch (error) {
    console.error('Error updating content types:', error);
  }
}

async function updatePresentationRels(pptx: any, newSlideIds: any[], originalSlideCount: number): Promise<void> {
  try {
    const relsXml = await pptx.file('ppt/_rels/presentation.xml.rels')?.async('text');
    if (!relsXml) return;
    
    const parser = new (require('xml2js')).Parser();
    const builder = new (require('xml2js')).Builder();
    const rels = await parser.parseStringPromise(relsXml);
    
    // Add new slide relationships
    const relationships = rels.Relationships.Relationship || [];
    for (let i = 0; i < newSlideIds.length; i++) {
      const slideNum = originalSlideCount + i + 1;
      relationships.push({
        '$': {
          'Id': `rId${slideNum + 10}`,
          'Type': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide',
          'Target': `slides/slide${slideNum}.xml`
        }
      });
    }
    
    rels.Relationships.Relationship = relationships;
    const updatedRelsXml = builder.buildObject(rels);
    pptx.file('ppt/_rels/presentation.xml.rels', updatedRelsXml);
  } catch (error) {
    console.error('Error updating presentation relationships:', error);
  }
}

function extractImagePath(imageUrl: string, sessionId: string): string {
  // Extract the path from the public URL
  // Assuming the URL format is: https://domain/bucket/path
  const urlParts = imageUrl.split('/');
  const pathIndex = urlParts.findIndex(part => part === 'images');
  if (pathIndex !== -1) {
    return urlParts.slice(pathIndex).join('/');
  }
  // Fallback: construct path from sessionId
  const filename = urlParts[urlParts.length - 1];
  return `images/${sessionId}/${filename}`;
}
