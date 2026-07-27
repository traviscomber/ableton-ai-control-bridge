'use client';

import { Download, FileJson, FileText, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function DownloadM4LPage() {
  const handleDownload = async (filename: string) => {
    try {
      const response = await fetch(`/api/download-m4l?file=${encodeURIComponent(filename)}`);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
      alert('Error downloading file');
    }
  };

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">Max for Live Setup</h1>
        <p className="text-text-dim mb-8">Download files for Ableton AI Control Bridge Receiver</p>

        {/* Info Box */}
        <div className="mb-8 p-4 bg-surface-raised border border-border rounded-lg flex gap-3">
          <AlertCircle className="text-yellow-500 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-text-secondary">
            <p className="font-semibold mb-1">Installation Required</p>
            <p>Download both files below and follow the setup guide to install in Ableton Live 11.</p>
          </div>
        </div>

        {/* Download Files */}
        <div className="space-y-4 mb-8">
          <div className="p-4 bg-surface-raised border border-border rounded-lg hover:border-brand-dim transition">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <FileJson className="text-brand mt-1" size={24} />
                <div>
                  <h3 className="font-semibold">AI-Control-Bridge-Receiver.maxpat</h3>
                  <p className="text-sm text-text-dim">Max for Live MIDI effect device (169 KB)</p>
                </div>
              </div>
              <button
                onClick={() => handleDownload('AI-Control-Bridge-Receiver.maxpat')}
                className="ml-4 px-4 py-2 bg-brand hover:bg-brand-dim text-white rounded font-semibold flex items-center gap-2 transition"
              >
                <Download size={18} />
                Download
              </button>
            </div>
          </div>

          <div className="p-4 bg-surface-raised border border-border rounded-lg hover:border-brand-dim transition">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <FileJson className="text-brand mt-1" size={24} />
                <div>
                  <h3 className="font-semibold">bridge_receiver.js</h3>
                  <p className="text-sm text-text-dim">JavaScript backend for UDP/OSC communication (8 KB)</p>
                </div>
              </div>
              <button
                onClick={() => handleDownload('bridge_receiver.js')}
                className="ml-4 px-4 py-2 bg-brand hover:bg-brand-dim text-white rounded font-semibold flex items-center gap-2 transition"
              >
                <Download size={18} />
                Download
              </button>
            </div>
          </div>

          <div className="p-4 bg-surface-raised border border-border rounded-lg hover:border-brand-dim transition">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <FileText className="text-brand mt-1" size={24} />
                <div>
                  <h3 className="font-semibold">MAX_FOR_LIVE_SETUP.md</h3>
                  <p className="text-sm text-text-dim">Complete installation and troubleshooting guide (12 KB)</p>
                </div>
              </div>
              <button
                onClick={() => handleDownload('MAX_FOR_LIVE_SETUP.md')}
                className="ml-4 px-4 py-2 bg-brand hover:bg-brand-dim text-white rounded font-semibold flex items-center gap-2 transition"
              >
                <Download size={18} />
                Download
              </button>
            </div>
          </div>
        </div>

        {/* Quick Start */}
        <div className="p-6 bg-surface-raised border border-border rounded-lg">
          <h2 className="text-xl font-bold mb-4">Quick Start</h2>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="font-bold text-brand flex-shrink-0">1</span>
              <span>Download all three files above</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-brand flex-shrink-0">2</span>
              <span>Read <code className="bg-background px-2 py-1 rounded text-xs">MAX_FOR_LIVE_SETUP.md</code> for installation path</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-brand flex-shrink-0">3</span>
              <span>Copy <code className="bg-background px-2 py-1 rounded text-xs">.maxpat</code> and <code className="bg-background px-2 py-1 rounded text-xs">.js</code> to the midifx folder</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-brand flex-shrink-0">4</span>
              <span>Restart Ableton Live 11</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-brand flex-shrink-0">5</span>
              <span>Go to <strong>Options → Rescan Max for Live Library</strong></span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-brand flex-shrink-0">6</span>
              <span>Create a MIDI track and add the device</span>
            </li>
          </ol>
        </div>

        {/* Footer Link */}
        <div className="mt-8 text-center text-text-dim">
          <Link href="/" className="text-brand hover:underline">
            ← Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
