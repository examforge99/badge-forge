"use client";

import { useState } from "react";
import { PRESETS } from "@/lib/presets";
import { ProjectSummary } from "@/lib/projects";

interface EditorDrawerProps {
  open: boolean;
  onClose: () => void;
  onPlacePreset: (presetKey: string) => void;
  onNewProject: () => void;
  onOpenProject: (id: string) => void;
  projects: ProjectSummary[];
  currentProjectId: string | null;
}

export default function EditorDrawer({
  open,
  onClose,
  onPlacePreset,
  onNewProject,
  onOpenProject,
  projects,
  currentProjectId,
}: EditorDrawerProps) {
  const [shapesExpanded, setShapesExpanded] = useState(true);
  const [filesExpanded, setFilesExpanded] = useState(true);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-screen w-64 z-50 flex flex-col bg-white
          border-r border-neutral-200
          transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-neutral-200">
          <span className="text-sm font-semibold text-neutral-800">Badge Forge</span>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 text-neutral-500"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          <button
            onClick={onNewProject}
            className="w-full text-left px-3 py-2 mb-3 rounded-lg text-sm font-medium bg-indigo-600 text-white"
          >
            + New Badge
          </button>

          {/* Shapes section */}
          <div className="mb-2">
            <button
              onClick={() => setShapesExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs uppercase tracking-wide text-neutral-500 font-semibold"
            >
              Shapes
              <span>{shapesExpanded ? "▾" : "▸"}</span>
            </button>
            {shapesExpanded && (
              <div className="flex flex-col gap-1 px-1">
                {Object.entries(PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => {
                      onPlacePreset(key);
                      onClose();
                    }}
                    className="text-left px-3 py-2 rounded-lg text-sm text-neutral-800 hover:bg-neutral-100"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Files section */}
          <div className="mb-2">
            <button
              onClick={() => setFilesExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs uppercase tracking-wide text-neutral-500 font-semibold"
            >
              Files
              <span>{filesExpanded ? "▾" : "▸"}</span>
            </button>
            {filesExpanded && (
              <div className="flex flex-col gap-1 px-1">
                {projects.length === 0 && (
                  <div className="text-sm text-neutral-400 px-3 py-2">
                    No saved badges yet.
                  </div>
                )}
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onOpenProject(p.id)}
                    className={`text-left px-3 py-2 rounded-lg text-sm truncate ${
                      p.id === currentProjectId
                        ? "bg-indigo-50 text-indigo-700 font-medium"
                        : "text-neutral-800 hover:bg-neutral-100"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
    }
