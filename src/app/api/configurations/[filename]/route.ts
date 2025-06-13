
import { type NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const CONFIG_DIR = path.join(process.cwd(), 'src', 'data', 'configurations');

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = params.filename;
    if (!filename || !/^[a-zA-Z0-9_.-]+$/.test(filename)) { // Basic filename validation
      return NextResponse.json({ error: 'Invalid filename format' }, { status: 400 });
    }

    const filePath = path.join(CONFIG_DIR, `${filename}.json`);
    
    // Check if file exists before trying to read
    try {
        await fs.access(filePath);
    } catch (accessError) {
        if ((accessError as NodeJS.ErrnoException).code === 'ENOENT') {
            return NextResponse.json({ error: `Configuration file '${filename}.json' not found.` }, { status: 404 });
        }
        throw accessError; // Re-throw other access errors
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
