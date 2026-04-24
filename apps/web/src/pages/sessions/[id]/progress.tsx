import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import type { WebSocketEvent, SessionStatus } from "@video-cv/types";
import { apiClient } from "@/lib/api";
import { getToken } from "@/lib/auth";

type Stage = SessionStatus;

const STAGES: { key: Stage; label: string; description: string }[] = [
  { key: "transcribing", label: "Transcribing", description: "Converting speech to text" },
  { key: "cleaning", label: "Cleaning", description: "Removing filler words and pauses" },
  { key: "extracting", label: "Extracting", description: "Identifying CV information" },
  { key: "building", label: "Building CV", description: "Generating your PDF document" },
  { key: "processing", label: "Processing video", description: "Editing and exporting clean video" },
  { key: "complete", label: "Publishing", description: "Creating your public profile" },
];

export default function ProgressPage() {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const [currentStage, setCurrentStage] = useState<Stage | null>(null);
  const [stagePercent, setStagePercent] = useState(0);
  const [completedStages, setCompletedStages] = useState<Set<Stage>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const token = getToken();
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001";
    const url = `${wsUrl}/sessions/${id}/events${token ? `?token=${token}` : ""}`;
    const ws = new WebSocket(url);

    ws.onmessage = (ev) => {
      try {
        const event: WebSocketEvent = JSON.parse(ev.data as string);

        if (event.type === "pipeline:progress") {
          setCurrentStage(event.stage);
          setStagePercent(event.percentage);
          if (event.percentage >= 100) {
            setCompletedStages((prev) => new Set([...prev, event.stage]));
          }
        } else if (event.type === "pipeline:complete") {
          ws.close();
          router.push(`/sessions/${id}/review`);
        } else if (event.type === "pipeline:error") {
          setErrorMessage(event.message ?? "An error occurred during processing.");
          ws.close();
        }
      } catch {
        // ignore malformed frames
      }
    };

    ws.onerror = () => {
      setErrorMessage("Lost connection to the server. Please refresh the page.");
    };

    return () => ws.close();
  }, [id, router]);

  // Also poll status as fallback
  useEffect(() => {
    if (!id || errorMessage) return;
    const interval = setInterval(async () => {
      try {
        const { status } = await apiClient.sessions.getPipelineStatus(id);
        if (status === "complete") {
          clearInterval(interval);
          router.push(`/sessions/${id}/review`);
        } else if (status === "error") {
          clearInterval(interval);
          setErrorMessage("Processing failed. Please try recording again.");
        }
      } catch {
        // ignore poll errors
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [id, errorMessage, router]);

  if (errorMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full card text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Processing failed</h2>
          <p className="text-gray-600 text-sm mb-6">{errorMessage}</p>
          <div className="flex gap-3 justify-center">
            <Link href="/record" className="btn-primary">
              Record again
            </Link>
            <Link href="/dashboard" className="btn-secondary">
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Processing your Video CV</h1>
          <p className="mt-2 text-gray-500 text-sm">This usually takes 2–5 minutes. You can leave this page.</p>
        </div>

        <div className="card space-y-4">
          {STAGES.map((stage, i) => {
            const isCompleted = completedStages.has(stage.key);
            const isCurrent = stage.key === currentStage;
            const isPending = !isCompleted && !isCurrent;

            return (
              <div key={stage.key} className="flex items-start gap-4">
                {/* Status icon */}
                <div className="flex-shrink-0 mt-0.5">
                  {isCompleted ? (
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : isCurrent ? (
                    <div className="w-6 h-6 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
                  ) : (
                    <div className="w-6 h-6 rounded-full border-2 border-gray-200" />
                  )}
                </div>

                {/* Stage info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-medium ${isPending ? "text-gray-400" : "text-gray-900"}`}>
                      {stage.label}
                    </p>
                    {isCurrent && (
                      <span className="text-xs text-brand-600 font-medium">{stagePercent}%</span>
                    )}
                  </div>
                  <p className={`text-xs mt-0.5 ${isPending ? "text-gray-300" : "text-gray-500"}`}>
                    {stage.description}
                  </p>
                  {isCurrent && (
                    <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full transition-all duration-500"
                        style={{ width: `${stagePercent}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Session ID: {id}
        </p>
      </div>
    </div>
  );
}
