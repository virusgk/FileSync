
import { type NextRequest, NextResponse } from 'next/server';
import net from 'net';

export async function POST(request: NextRequest) {
  try {
    const { host, port = 22 } = await request.json();

    if (!host) {
      return NextResponse.json({ error: 'Host is required' }, { status: 400 });
    }

    // Validate port
    const numericPort = Number(port);
    if (isNaN(numericPort) || numericPort <= 0 || numericPort > 65535) {
        return NextResponse.json({ error: 'Invalid port number' }, { status: 400 });
    }


    const checkConnection = (hostToCheck: string, portToCheck: number): Promise<boolean> => {
      return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(2000); // 2 seconds timeout

        socket.on('connect', () => {
          socket.destroy();
          resolve(true);
        });

        socket.on('timeout', () => {
          socket.destroy();
          resolve(false);
        });

        socket.on('error', (err) => {
          socket.destroy();
          resolve(false);
        });

        socket.connect(portToCheck, hostToCheck);
      });
    };

    const isReachable = await checkConnection(host as string, numericPort as number);
    return NextResponse.json({ reachable: isReachable });

  } catch (error) {
    console.error('Reachability check error:', error);
    return NextResponse.json({ error: 'Failed to check reachability', details: (error as Error).message }, { status: 500 });
  }
}
