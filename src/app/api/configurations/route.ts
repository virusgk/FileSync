
import { type NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid'; // For unique filenames

const CONFIG_DIR = path.join(process.cwd(), 'src', 'data', 'configurations');
const CONFIG_VERSION = "1.0"; // Consistent with frontend

// Ensure the directory exists
async function ensureConfigDirExists() {
  try {
    await fs.access(CONFIG_DIR);
  } catch (error) {
    // Directory does not exist, try to create it
    try {
      await fs.mkdir(CONFIG_DIR, { recursive: true });
      console.log(`Configuration directory created: ${CONFIG_DIR}`);
    } catch (mkdirError) {
      console.error(`Error creating configuration directory ${CONFIG_DIR}:`, mkdirError);
      // If we can't create it, we'll let subsequent operations fail,
      // as this is a critical setup step.
      throw new Error(`Failed to create configuration directory: ${(mkdirError as Error).message}`);
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureConfigDirExists();
    const files = await fs.readdir(CONFIG_DIR);
    const jsonFiles = files.filter(file => file.endsWith('.json'))
                           .map(file => file.replace('.json', '')); // Return names without .json extension
    return NextResponse.json(jsonFiles);
  } catch (error) {
    console.error('Error listing configurations:', error);
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // If directory still doesn't exist after attempt to create
        return NextResponse.json({ error: `Configuration directory ${CONFIG_DIR} not found and could not be created.` }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to list configurations', details: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureConfigDirExists();
    const configData = await request.json();

    // Basic validation (could be more extensive with Zod)
    if (!configData || typeof configData !== 'object' || !configData.version) {
        return NextResponse.json({ error: 'Invalid configuration data format or missing version.' }, { status: 400 });
    }
    if (configData.version !== CONFIG_VERSION) {
        return NextResponse.json({ error: `Configuration version mismatch. API expects ${CONFIG_VERSION}, received ${configData.version}.` }, { status: 400 });
    }


    // Prefer a name from config if available and simple, otherwise generate one
    let baseName = 'config';
    if (configData.applications && Array.isArray(configData.applications) && configData.applications.length > 0 && configData.applications[0].name) {
        baseName = configData.applications[0].name.replace(/[^a-z0-9_.-]/gi, '_').substring(0, 50);
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${baseName}_${timestamp}_${uuidv4().substring(0,8)}.json`;
    const filePath = path.join(CONFIG_DIR, filename);

    await fs.writeFile(filePath, JSON.stringify(configData, null, 2));
    
    return NextResponse.json({ message: 'Configuration saved successfully', filename: filename.replace('.json','') }, { status: 201 });
  } catch (error) {
    console.error('Error saving configuration:', error);
    return NextResponse.json({ error: 'Failed to save configuration', details: (error as Error).message }, { status: 500 });
  }
}
