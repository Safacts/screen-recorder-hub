"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Peer from "peerjs";
import { Marker, PeerMessage } from "@/lib/types";
import { formatTime } from "@/lib/utils";

export default function RemotePage() {
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<ReturnType<Peer["connect"]> | null>(null);
  const [myId, setMyId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [inputId, setInputId] = useState("");
  const [connected, setConnected] = useState(false);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [sessionActive, setSessionActive] = useState(false);

  useEffect(() => {
    const peer = new Peer({
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      },
    });

    peer.on("open", (id) => {
      setMyId(id);
    });

    peerRef.current = peer;

    return () => {
      peer.destroy();
    };
  }, []);

  const connect = useCallback(() => {
    if (!inputId.trim() || !peerRef.current) return;

    const conn = peerRef.current.connect(inputId.trim(), { reliable: true });

    conn.on("open", () => {
      setConnected(true);
      setSessionActive(true);
      setTargetId(inputId.trim());
    });

    conn.on("close", () => {
      setConnected(false);
      setSessionActive(false);
    });

    connRef.current = conn;
  }, [inputId]);

  const sendMarker = useCallback((label: string) => {
    if (!connRef.current || !connRef.current.open) return;

    const msg: PeerMessage = {
      type: "marker",
      label,
      timestamp: Date.now(),
    };

    connRef.current.send(msg);

    const newMarker: Marker = {
      id: crypto.randomUUID(),
      label,
      timestamp: msg.timestamp,
      timeOffset: 0,
    };
    setMarkers((prev) => [...prev, newMarker]);
  }, []);

  const disconnect = useCallback(() => {
    if (connRef.current) {
      connRef.current.close();
      connRef.current = null;
    }
    setConnected(false);
    setSessionActive(false);
    setMarkers([]);
  }, []);

  const quickLabels = ["✂️ Cut here", "📌 Trim start", "📌 Trim end", "🎬 Keep this"];

  return (
    <main className="flex min-h-screen flex-col items-center p-6 gap-8">
      <h1 className="text-2xl font-bold">Remote Controller</h1>

      {!sessionActive ? (
        <div className="flex flex-col items-center gap-6 w-full max-w-sm">
          <div className="text-center space-y-2">
            <p className="text-sm text-gray-400">Enter the ID shown on the recorder laptop:</p>
            <input
              type="text"
              value={inputId}
              onChange={(e) => setInputId(e.target.value.toUpperCase())}
              placeholder="e.g. ABC123"
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-center text-xl font-mono uppercase tracking-widest focus:outline-none focus:border-blue-500"
              maxLength={6}
            />
          </div>

          <button
            onClick={connect}
            disabled={inputId.length < 4}
            className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl font-medium transition-colors text-lg"
          >
            Connect
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6 w-full max-w-sm">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-green-900 text-green-300 text-sm">Connected to {targetId}</span>
            <button onClick={disconnect} className="text-sm text-gray-400 underline">
              Disconnect
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full">
            {quickLabels.map((label) => (
              <button
                key={label}
                onClick={() => sendMarker(label)}
                className="aspect-square flex flex-col items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 border border-gray-700 rounded-2xl text-lg font-medium transition-colors active:scale-95"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="w-full space-y-2">
            <textarea
              placeholder="Custom label..."
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl resize-none focus:outline-none focus:border-blue-500"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  const target = e.target as HTMLTextAreaElement;
                  if (target.value.trim()) {
                    sendMarker(target.value.trim());
                    target.value = "";
                  }
                }
              }}
            />
            <p className="text-xs text-gray-500 text-center">Type a label and press Enter to send</p>
          </div>

          {markers.length > 0 && (
            <div className="w-full space-y-2">
              <h2 className="text-sm font-semibold text-gray-400">Sent Markers ({markers.length})</h2>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {markers.map((m, i) => (
                  <div key={m.id} className="flex items-center gap-2 bg-gray-900 px-3 py-2 rounded-lg text-sm border border-gray-800">
                    <span className="text-gray-500 w-5">#{i + 1}</span>
                    <span className="truncate flex-1">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
