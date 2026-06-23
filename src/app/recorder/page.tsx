"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Peer from "peerjs";
import { Marker, PeerMessage } from "@/lib/types";
import { formatTime, generateId } from "@/lib/utils";

export default function RecorderPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<Peer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const markerStartTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [peerId, setPeerId] = useState<string>("");
  const [connected, setConnected] = useState(false);
  const [recording, setRecording] = useState(false);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [screenActive, setScreenActive] = useState(false);
  const [driveAuth, setDriveAuth] = useState<"unauthorized" | "authorized" | "error">("unauthorized");
  const [driveUploading, setDriveUploading] = useState(false);
  const [driveUploaded, setDriveUploaded] = useState(false);

  useEffect(() => {
    const peer = new Peer(generateId(), {
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      },
    });

    peer.on("open", (id) => {
      setPeerId(id);
    });

    peer.on("connection", (conn) => {
      conn.on("open", () => {
        setConnected(true);
      });

      conn.on("data", (data) => {
        const msg = data as PeerMessage;
        if (msg.type === "marker") {
          const elapsedSinceStart = (Date.now() - markerStartTimeRef.current) / 1000;
          const newMarker: Marker = {
            id: crypto.randomUUID(),
            label: msg.label,
            timestamp: msg.timestamp,
            timeOffset: elapsedSinceStart,
          };
          setMarkers((prev) => [...prev, newMarker]);
        }
      });

      conn.on("close", () => {
        setConnected(false);
      });
    });

    peerRef.current = peer;

    return () => {
      peer.destroy();
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("drive") === "ready") {
      setDriveAuth("authorized");
      window.history.replaceState({}, "", "/recorder");
    } else if (params.get("drive") === "error") {
      setDriveAuth("error");
      window.history.replaceState({}, "", "/recorder");
    }
  }, []);

  const startCapture = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      let micStream: MediaStream | null = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        // mic not available, continue without it
      }

      const tracks: MediaStreamTrack[] = [...screenStream.getVideoTracks()];

      if (screenStream.getAudioTracks().length > 0) {
        tracks.push(screenStream.getAudioTracks()[0]);
      }

      if (micStream && micStream.getAudioTracks().length > 0) {
        tracks.push(micStream.getAudioTracks()[0]);
      }

      const combined = new MediaStream(tracks);

      streamRef.current = combined;
      if (videoRef.current) {
        videoRef.current.srcObject = combined;
      }
      setScreenActive(true);

      screenStream.getVideoTracks()[0].addEventListener("ended", () => {
        stopCapture();
      });
    } catch (err) {
      console.error("Capture failed:", err);
    }
  }, []);

  const stopCapture = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScreenActive(false);
    if (recording) {
      stopRecording();
    }
  }, [recording]);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    markerStartTimeRef.current = Date.now();
    setMarkers([]);

    const recorder = new MediaRecorder(streamRef.current, {
      mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm",
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      setRecordedBlob(blob);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setElapsed(0);
    };

    recorder.start(1000);
    recorderRef.current = recorder;
    setRecording(true);

    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed((Date.now() - startTimeRef.current) / 1000);
    }, 100);
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    setRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const download = useCallback(() => {
    if (!recordedBlob) return;

    const videoUrl = URL.createObjectURL(recordedBlob);
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = `recording-${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(videoUrl);

    if (markers.length > 0) {
      const markersBlob = new Blob([JSON.stringify(markers, null, 2)], { type: "application/json" });
      const m = document.createElement("a");
      m.href = URL.createObjectURL(markersBlob);
      m.download = `markers-${Date.now()}.json`;
      m.click();
    }
  }, [recordedBlob, markers]);

  const authorizeDrive = useCallback(() => {
    window.location.href = "/api/auth";
  }, []);

  const uploadToDrive = useCallback(async () => {
    if (!recordedBlob) return;
    setDriveUploading(true);
    try {
      const res = await fetch("/api/drive/upload", { method: "POST" });
      if (!res.ok) throw new Error("Auth failed");
      const { accessToken, folderId } = await res.json();

      const timestamp = Date.now();
      const parents = folderId ? [folderId] : [];

      const videoMetadata = {
        name: `recording-${timestamp}.webm`,
        parents,
      };

      const videoForm = new FormData();
      videoForm.append(
        "metadata",
        new Blob([JSON.stringify(videoMetadata)], { type: "application/json" })
      );
      videoForm.append("file", recordedBlob, videoMetadata.name);

      const videoRes = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: videoForm,
        }
      );
      if (!videoRes.ok) throw new Error("Video upload failed");

      if (markers.length > 0) {
        const markerMetadata = {
          name: `recording-${timestamp}-markers.json`,
          parents,
        };
        const markerForm = new FormData();
        markerForm.append(
          "metadata",
          new Blob([JSON.stringify(markerMetadata)], { type: "application/json" })
        );
        markerForm.append(
          "file",
          new Blob([JSON.stringify(markers, null, 2)], { type: "application/json" }),
          markerMetadata.name
        );
        const markerRes = await fetch(
          "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}` },
            body: markerForm,
          }
        );
        if (!markerRes.ok) throw new Error("Markers upload failed");
      }

      setDriveUploaded(true);
    } catch {
      setDriveAuth("error");
    } finally {
      setDriveUploading(false);
    }
  }, [recordedBlob, markers]);

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 gap-6">
      <h1 className="text-2xl font-bold">Recorder</h1>

      <div className="flex items-center gap-4 text-sm">
        <span className={`px-3 py-1 rounded-full ${peerId ? "bg-green-900 text-green-300" : "bg-gray-800 text-gray-400"}`}>
          {peerId ? `ID: ${peerId}` : "Connecting..."}
        </span>
        <span className={`px-3 py-1 rounded-full ${connected ? "bg-green-900 text-green-300" : "bg-gray-800 text-gray-400"}`}>
          {connected ? "Phone Connected" : "No Phone"}
        </span>
      </div>

      <div className="relative w-full max-w-3xl aspect-video bg-black rounded-xl overflow-hidden border border-gray-700">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
        {!screenActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <p className="text-gray-400">No screen capture active</p>
          </div>
        )}
        {recording && (
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-sm font-medium">REC {formatTime(elapsed)}</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-4 justify-center">
        {!screenActive ? (
          <button onClick={startCapture} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-medium transition-colors">
            Share Screen
          </button>
        ) : (
          <>
            {!recording ? (
              <button onClick={startRecording} className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-xl font-medium transition-colors">
                Start Recording
              </button>
            ) : (
              <button onClick={stopRecording} className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 rounded-xl font-medium transition-colors">
                Stop Recording
              </button>
            )}
            <button onClick={stopCapture} className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-medium transition-colors">
              Stop Sharing
            </button>
          </>
        )}
      </div>

      {recordedBlob && (
        <div className="flex flex-col items-center gap-4 w-full max-w-3xl">
          <button onClick={download} className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-xl font-medium transition-colors">
            Download Recording ({Math.round(recordedBlob.size / 1024 / 1024 * 10) / 10} MB)
          </button>

          {driveAuth === "unauthorized" && (
            <button onClick={authorizeDrive} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-medium transition-colors">
              Authorize Google Drive
            </button>
          )}
          {driveAuth === "authorized" && !driveUploaded && (
            <button onClick={uploadToDrive} disabled={driveUploading} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800/50 rounded-xl font-medium transition-colors">
              {driveUploading ? "Uploading..." : "Upload to Google Drive"}
            </button>
          )}
          {driveAuth === "authorized" && driveUploaded && (
            <span className="px-6 py-3 bg-green-900 text-green-400 rounded-xl font-medium">
              Uploaded to Google Drive ✓
            </span>
          )}
          {driveAuth === "error" && (
            <span className="px-6 py-3 bg-red-900 text-red-400 rounded-xl font-medium">
              Google Drive error — reauthorize
            </span>
          )}

          <video controls src={URL.createObjectURL(recordedBlob)} className="w-full rounded-xl border border-gray-700" />
        </div>
      )}

      {markers.length > 0 && (
        <div className="w-full max-w-3xl space-y-2">
          <h2 className="text-lg font-semibold">Markers ({markers.length})</h2>
          <div className="space-y-1">
            {markers.map((m, i) => (
              <div key={m.id} className="flex items-center gap-3 bg-gray-900 px-4 py-2 rounded-lg text-sm border border-gray-800">
                <span className="text-gray-500 w-6">#{i + 1}</span>
                <span className="text-gray-400">{m.label}</span>
                <span className="ml-auto font-mono text-gray-500">{formatTime(m.timeOffset)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
