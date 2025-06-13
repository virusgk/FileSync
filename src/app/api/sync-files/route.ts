
import { type NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import type { FileDifference } from '@/types';

// Basic path validation (rudimentary)
const isValidSyncRootPath = (targetPath: string): boolean => {
  if (targetPath.length > 4096) return false;
  if (targetPath.includes('..') || /[;&|`$><\(\)]/.test(targetPath)) return false;
  // THIS IS A VERY WEAK SANDBOXING ATTEMPT AND NOT SUITABLE FOR PRODUCTION
  if ((targetPath.toLowerCase() === "c:\\" || targetPath === "/") && !targetPath.includes("filesync_test_area")) {
     // console.warn("Attempt to sync root directory blocked for safety in prototype mode.");
     // return false; // Uncomment to block root sync
  }
  return true;
};

const isValidRelativePath = (relPath: string): boolean => {
    if (relPath.includes('..') || /[;&|`$><\(\)]/.test(relPath)) return false;
    return true;
}

export async function POST(request: NextRequest) {
  try {
    const { primaryRoot, drRoot, operations } = await request.json();

    if (!primaryRoot || typeof primaryRoot !== 'string' || !drRoot || typeof drRoot !== 'string') {
      return NextResponse.json({ error: 'primaryRoot and drRoot are required strings' }, { status: 400 });
    }
    if (!Array.isArray(operations)) {
      return NextResponse.json({ error: 'operations must be an array' }, { status: 400 });
    }

    if (!isValidSyncRootPath(primaryRoot) || !isValidSyncRootPath(drRoot)) {
        return NextResponse.json({ error: 'Invalid root path format or potentially unsafe path.' }, { status: 400 });
    }
    
    const sanitizedOperations = operations.map((op: any) => {
        if (!op.path || typeof op.path !== 'string' || !isValidRelativePath(op.path) || 
            !op.status || typeof op.status !== 'string' ||
            !op.type || typeof op.type !== 'string') {
            throw new Error('Invalid operation format: Each operation must have a valid path, status, and type.');
        }
        return { path: op.path, status: op.status, type: op.type };
    });


    const scriptPath = path.join(process.cwd(), 'src', 'scripts', 'execute-sync-operations.ps1');
    const operationsJson = JSON.stringify(sanitizedOperations);

    const psArgs = [
        '-NoProfile',
        '-NonInteractive',
        // '-ExecutionPolicy', 'Bypass',
        '-File', scriptPath,
        '-PrimaryRoot', primaryRoot,
        '-DRRoot', drRoot,
        '-OperationsJson', operationsJson
    ];

    return new Promise((resolve) => {
      const psProcess = spawn('powershell.exe', psArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

      let stdoutData = '';
      let stderrData = '';

      psProcess.stdout.on('data', (data) => { stdoutData += data.toString(); });
      psProcess.stderr.on('data', (data) => { stderrData += data.toString(); });

      psProcess.on('error', (err) => {
        console.error('Failed to start PowerShell process for sync-files:', err.message);
        resolve(NextResponse.json({ error: 'Failed to start PowerShell process for sync', details: err.message }, { status: 500 }));
      });

      psProcess.on('exit', (code) => {
        if (stderrData && code !== 0) {
            console.error(`PowerShell script STDERR for sync-files: ${stderrData}`);
        }
        if (code === 0) {
          try {
            const results = JSON.parse(stdoutData);
            resolve(NextResponse.json({ message: 'Sync operations processed.', results }));
          } catch (parseError) {
            console.error('Failed to parse sync script output:', parseError, "Raw:", stdoutData);
            resolve(NextResponse.json({ error: 'Failed to parse sync script output', details: (parseError as Error).message, rawOutput: stdoutData.substring(0,500) }, { status: 500 }));
          }
        } else {
          console.warn(`sync-files script exited with code ${code}. Output: ${stdoutData}. Errors: ${stderrData}`);
          resolve(NextResponse.json({ error: `Sync script exited with code ${code}`, details: stderrData.trim() || stdoutData.trim() }, { status: 500 }));
        }
      });
    });

  } catch (error) {
    console.error('sync-files API error:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to execute sync operations', details: message }, { status: 500 });
  }
}
