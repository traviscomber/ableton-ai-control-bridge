import { readFile } from 'fs/promises';
import { join } from 'path';
import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_FILES = [
  'AI-Control-Bridge-Receiver.maxpat',
  'bridge_receiver.js',
  'MAX_FOR_LIVE_SETUP.md',
];

export async function GET(req: NextRequest) {
  try {
    const file = req.nextUrl.searchParams.get('file');

    if (!file || !ALLOWED_FILES.includes(file)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Determine source path based on file
    let sourcePath: string;
    if (file === 'MAX_FOR_LIVE_SETUP.md') {
      sourcePath = join(process.cwd(), file);
    } else {
      sourcePath = join(process.cwd(), 'max-for-live', file);
    }

    const fileContent = await readFile(sourcePath);

    const headers: Record<string, string> = {
      'Content-Disposition': `attachment; filename="${file}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    };

    // Set correct MIME type
    if (file.endsWith('.maxpat')) {
      headers['Content-Type'] = 'application/json';
    } else if (file.endsWith('.js')) {
      headers['Content-Type'] = 'application/javascript';
    } else if (file.endsWith('.md')) {
      headers['Content-Type'] = 'text/markdown';
    }

    return new NextResponse(fileContent, { headers, status: 200 });
  } catch (err) {
    console.error('[download-m4l] Error:', err);
    return NextResponse.json(
      { error: 'Failed to download file' },
      { status: 500 }
    );
  }
}
