
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
            return NextResponse.json({ error: `Configuration file '${sanitizedFilename}.json' not found for deletion.` }, { status: 404 });
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

export async function PUT(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const oldSanitizedFilename = sanitizeFilename(params.filename);
    if (!oldSanitizedFilename) {
      return NextResponse.json({ error: 'Invalid old filename format' }, { status: 400 });
    }

    const { newName } = await request.json();
    if (!newName || typeof newName !== 'string') {
      return NextResponse.json({ error: 'New name is required and must be a string' }, { status: 400 });
    }

    const newSanitizedFilename = sanitizeFilename(newName);
    if (!newSanitizedFilename) {
      return NextResponse.json({ error: 'Invalid new filename format' }, { status: 400 });
    }

    if (newSanitizedFilename === oldSanitizedFilename) {
        return NextResponse.json({ message: 'New name is the same as the old name. No changes made.' });
    }

    const oldFilePath = path.join(CONFIG_DIR, `${oldSanitizedFilename}.json`);
    const newFilePath = path.join(CONFIG_DIR, `${newSanitizedFilename}.json`);

    try {
        await fs.access(oldFilePath);
    } catch (accessError) {
        if ((accessError as NodeJS.ErrnoException).code === 'ENOENT') {
            return NextResponse.json({ error: `Configuration file '${oldSanitizedFilename}.json' not found for renaming.` }, { status: 404 });
        }
        throw accessError;
    }

    try {
        await fs.access(newFilePath);
        // If newFilePath exists, it's a conflict
        return NextResponse.json({ error: `Configuration file '${newSanitizedFilename}.json' already exists. Cannot rename.` }, { status: 409 });
    } catch (accessError) {
        // If it's ENOENT, newFilePath does not exist, which is good.
        if ((accessError as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw accessError; // Other access error
        }
    }
    
    await fs.rename(oldFilePath, newFilePath);
    
    return NextResponse.json({ message: `Configuration '${oldSanitizedFilename}.json' renamed to '${newSanitizedFilename}.json' successfully.` });
  } catch (error) {
    console.error(`Error renaming configuration ${params.filename}:`, error);
    return NextResponse.json({ error: `Failed to rename configuration '${params.filename}.json'`, details: (error as Error).message }, { status: 500 });
  }
}
    