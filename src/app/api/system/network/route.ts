import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Store previous reading to calculate rate
let prevReading: { timestamp: number; rxBytes: number; txBytes: number } | null = null;

export async function GET() {
  try {
    // Read network stats from /proc/net/dev (Linux)
    const { stdout } = await execAsync('cat /proc/net/dev 2>/dev/null || echo "not available"');
    
    if (stdout.includes('not available')) {
      return NextResponse.json({
        success: false,
        error: 'Network stats not available on this platform',
      });
    }
    
    // Parse /proc/net/dev output
    // Format: Interface: rx_bytes rx_packets ... tx_bytes tx_packets ...
    const lines = stdout.split('\n');
    let totalRxBytes = 0;
    let totalTxBytes = 0;
    
    for (const line of lines) {
      // Skip header lines
      if (line.includes('|') || !line.trim()) continue;
      
      const parts = line.trim().split(/\s+/);
      if (parts.length < 10) continue;
      
      const iface = parts[0].replace(':', '');
      // Skip loopback
      if (iface === 'lo') continue;
      
      const rxBytes = parseInt(parts[1], 10) || 0;
      const txBytes = parseInt(parts[9], 10) || 0;
      
      totalRxBytes += rxBytes;
      totalTxBytes += txBytes;
    }
    
    const now = Date.now();
    let rxRate = 0;
    let txRate = 0;
    
    if (prevReading) {
      const timeDiff = (now - prevReading.timestamp) / 1000; // seconds
      if (timeDiff > 0) {
        rxRate = (totalRxBytes - prevReading.rxBytes) / timeDiff; // bytes per second
        txRate = (totalTxBytes - prevReading.txBytes) / timeDiff;
      }
    }
    
    // Update previous reading
    prevReading = {
      timestamp: now,
      rxBytes: totalRxBytes,
      txBytes: totalTxBytes,
    };
    
    return NextResponse.json({
      success: true,
      rxBytes: totalRxBytes,
      txBytes: totalTxBytes,
      rxRate: Math.max(0, rxRate), // bytes per second (download)
      txRate: Math.max(0, txRate), // bytes per second (upload)
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    });
  }
}

