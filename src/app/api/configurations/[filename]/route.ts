
import { type NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const CONFIG_DIR = path.join(process.cwd(), 'src', 'data', 'configurations');

// Helper to sanitize filename to prevent directory traversal
function sanitizeFilename(filename: string): string | null {
    // Allow alphanumeric, underscore, hyphen, period. Ensure it doesn't contain '..'
    if (!/^[a-zA-Z0-9_.-]+$/.test(filename) || filename.includes('..')) {
        return null;
    }
    return filename;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const sanitizedFilename = sanitizeFilename(params.filename);
    if (!sanitizedFilename) {
      return NextResponse.json({ error: 'Invalid filename format' }, { status: 400 });
    }

    const filePath = path.join(CONFIG_DIR, `${sanitizedFilename}.json`);
    
    try {
        await fs.access(filePath);
    } catch (accessError) {
        if ((accessError as NodeJS.ErrnoException).code === 'ENOENT') {
            return NextResponse.json({ error: `Configuration file '${sanitizedFilename}.json' not found.` }, { status: 404 });
        }
        throw accessError; 
    }

    const fileContent = await fs.readFile(filePath, 'utf-8');
    const configData = JSON.parse(fileContent);
    
    return NextResponse.json(configData);
  } catch (error) {
    console.error(`Error reading configuration ${params.filename}:`, error);
    if (error instanceof SyntaxError) {
        return NextResponse.json({ error: `Invalid JSON in configuration file '${params.filename}.json'.` }, { status: 500 });
    }
    return NextResponse.json({ error: `Failed to read configuration '${params.filename}.json'`, details: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const sanitizedFilename = sanitizeFilename(params.filename);
    if (!sanitizedFilename) {
      return NextResponse.json({ error: 'Invalid filename format' }, { status: 400 });
    }

    const filePath = path.join(CONFIG_DIR, `${sanitizedFilename}.json`);

    try {
        await fs.access(filePath);
    } catch (accessError) {
        if ((accessError as NodeJS.ErrnoException).code === 'ENOENT') {
            return NextResponse.json({ error: `Configuration file '${sanitizedFilename}.json' not found.` }, { status: 404 });
        }
        throw accessError;
    }

    await fs.unlink(filePath);
    
    return NextResponse.json({ message: `Configuration '${sanitizedFilename}.json' deleted successfully.` });
  } catch (error) {
    console.error(`Error deleting configuration ${params.filename}:`, error);
    return NextResponse.json({ error: `Failed to delete configuration '${params.filename}.json'`, details: (error as Error).message }, { status: 500 });
  }
}
