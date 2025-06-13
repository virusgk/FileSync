
import { type NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import type { FileNode } from '@/types';

// Basic path validation to prevent obviously malicious input
// Production systems should use more robust validation and sandboxing.
const isValidPath = (targetPath: string): boolean => {
  if (targetPath.length > 4096) return false; // Max path length
  // Disallow '..' to prevent directory traversal.
  // Disallow common command injection characters for safety, though parameters are passed separately.
  if (targetPath.includes('..') || /[;&|`$><\(\)]/.test(targetPath)) {
    return false;
  }
  // For this prototype, add a specific check for root paths if not in a designated test area
  // THIS IS A VERY WEAK SANDBOXING ATTEMPT AND NOT SUITABLE FOR PRODUCTION
  if ((targetPath.toLowerCase() === "c:\\" || targetPath === "/") && !targetPath.includes("filesync_test_area")) {
    // console.warn("Attempt to list root directory blocked for safety in prototype mode.");
    // return false; // Uncomment to block root listing
  }
  return true;
};

export async function POST(request: NextRequest) {
  try {
    const { targetPath } = await request.json();
    console.log(`[API /api/list-files] Received request for targetPath: ${targetPath}`); // Logging

    if (!targetPath || typeof targetPath !== 'string') {
      console.error(`[API /api/list-files] Invalid targetPath: ${targetPath}`);
      return NextResponse.json({ error: 'targetPath is required and must be a string' }, { status: 400 });
    }

    if (!isValidPath(targetPath)) {
      console.error(`[API /api/list-files] Invalid or unsafe targetPath format: ${targetPath}`);
      return NextResponse.json({ error: 'Invalid targetPath format or potentially unsafe path.' }, { status: 400 });
    }

    const scriptPath = path.join(process.cwd(), 'src', 'scripts', 'get-file-structure.ps1');
    
    const psArgs = [
        '-NoProfile',
        '-NonInteractive',
        // '-ExecutionPolicy', 'Bypass', // Might be needed depending on server config
        '-File', scriptPath,
        '-RootPath', targetPath
    ];
    console.log(`[API /api/list-files] Executing PowerShell with args: powershell.exe ${psArgs.join(' ')}`); // Logging

    return new Promise((resolve) => {
      const psProcess = spawn('powershell.exe', psArgs, { stdio: ['ignore', 'pipe', 'pipe'] }); // stdin, stdout, stderr

      let stdoutData = '';
      let stderrData = '';

      psProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      psProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      psProcess.on('error', (err) => {
        console.error('[API /api/list-files] Failed to start PowerShell process:', err.message);
        resolve(NextResponse.json({ error: 'Failed to start PowerShell process', details: err.message }, { status: 500 }));
      });

      psProcess.on('exit', (code) => {
        if (stderrData && code !== 0) {
            console.error(`[API /api/list-files] PowerShell script STDERR for (${targetPath}): ${stderrData}`);
        }
        if (code === 0) {
          try {
            // Important: The PS script outputs multiple JSON objects if not careful (one per Write-Output in children)
            // The PS script was modified to output a single JSON array string at the end.
            const files: FileNode[] = JSON.parse(stdoutData);
            resolve(NextResponse.json(files));
          } catch (parseError) {
            console.error('[API /api/list-files] Failed to parse PowerShell output:', parseError, 'Raw output:', stdoutData.substring(0, 1000)); // Log more raw output
            resolve(NextResponse.json({ error: 'Failed to parse script output', details: (parseError as Error).message, rawOutput: stdoutData.substring(0, 500) }, { status: 500 }));
          }
        } else {
          console.warn(`[API /api/list-files] script for ${targetPath} exited with code ${code}. Output: ${stdoutData.substring(0,1000)}. Errors: ${stderrData}`);
          resolve(NextResponse.json({ error: `Script exited with code ${code}`, details: stderrData.trim() || stdoutData.trim() }, { status: 500 }));
        }
      });
    });

  } catch (error) {
    console.error('[API /api/list-files] API error:', error);
    return NextResponse.json({ error: 'Failed to list files', details: (error as Error).message }, { status: 500 });
  }
}
