
import { type NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

// Basic validation for hostnames/IPs to prevent obviously malicious input
// Production systems should use more robust validation.
const isValidHost = (host: string): boolean => {
  if (host.length > 253) return false; // Max hostname length
  return /^[a-zA-Z0-9.-_]+$/.test(host);
};

export async function POST(request: NextRequest) {
  try {
    const { host, port = 22 } = await request.json();

    if (!host || typeof host !== 'string') {
      return NextResponse.json({ error: 'Host is required and must be a string' }, { status: 400 });
    }

    if (!isValidHost(host)) {
      return NextResponse.json({ error: 'Invalid host format' }, { status: 400 });
    }

    const numericPort = Number(port);
    if (isNaN(numericPort) || numericPort <= 0 || numericPort > 65535) {
        return NextResponse.json({ error: 'Invalid port number' }, { status: 400 });
    }

    const scriptPath = path.join(process.cwd(), 'src', 'scripts', 'check-reachability.ps1');
    
    // It's generally safer to avoid -ExecutionPolicy Bypass if possible,
    // but it might be needed depending on the server's configuration.
    // For local dev, ensure your execution policy allows running local scripts.
    const psArgs = [
        '-NoProfile',         // Speeds up PowerShell startup
        '-NonInteractive',    // Ensures no interactive prompts
        // '-ExecutionPolicy', 
        // 'Bypass',          // Uncomment if execution policy issues arise
        '-File', scriptPath,
        '-TargetHost', host,
        '-TargetPort', numericPort.toString()
    ];

    return new Promise((resolve) => {
      const psProcess = spawn('powershell.exe', psArgs, { stdio: 'pipe' }); // Capture stdio

      let stdoutData = '';
      let stderrData = '';

      psProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      psProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      psProcess.on('error', (err) => {
        console.error('Failed to start PowerShell process:', err.message);
        resolve(NextResponse.json({ error: 'Failed to start PowerShell process', details: err.message }, { status: 500 }));
      });

      psProcess.on('exit', (code) => {
        if (stderrData && code !== 0) {
            // Log stderr for debugging server-side if script had issues
            console.error(`PowerShell script STDERR for ${host}:${numericPort}: ${stderrData}`);
        }
        if (code === 0) {
          resolve(NextResponse.json({ reachable: true }));
        } else {
          // Log non-zero exit code details if available
          console.warn(`Reachability check for ${host}:${numericPort} failed with exit code ${code}. Output: ${stdoutData}. Errors: ${stderrData}`);
          resolve(NextResponse.json({ reachable: false, details: `Script exited with code ${code}. ${stderrData.trim()}` }));
        }
      });
    });

  } catch (error) {
    console.error('Reachability check API error:', error);
    return NextResponse.json({ error: 'Failed to check reachability', details: (error as Error).message }, { status: 500 });
  }
}
