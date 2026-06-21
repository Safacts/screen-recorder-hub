"use client";

import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 gap-12">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-bold tracking-tight">Screen Recorder Hub</h1>
        <p className="text-lg text-gray-400 max-w-md">
          Record your screen while using your phone to place edit markers in real-time.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 w-full max-w-lg">
        <Link
          href="/recorder"
          className="flex-1 flex flex-col items-center gap-3 p-8 rounded-2xl border border-gray-700 bg-gray-900 hover:bg-gray-800 transition-colors"
        >
          <span className="text-4xl">💻</span>
          <span className="text-xl font-semibold">Start Recording</span>
          <span className="text-sm text-gray-400 text-center">Open this on your laptop to capture screen + mic</span>
        </Link>

        <Link
          href="/remote"
          className="flex-1 flex flex-col items-center gap-3 p-8 rounded-2xl border border-gray-700 bg-gray-900 hover:bg-gray-800 transition-colors"
        >
          <span className="text-4xl">📱</span>
          <span className="text-xl font-semibold">Remote Controller</span>
          <span className="text-sm text-gray-400 text-center">Open this on your phone to place markers</span>
        </Link>
      </div>
    </main>
  );
}
