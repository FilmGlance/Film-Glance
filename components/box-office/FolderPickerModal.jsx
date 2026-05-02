"use client";

// FolderPickerModal — heart-click destination picker for /boxoffice favorites.
//
// Mirrors the result page's "Add to Favorites" picker (film-glance.jsx
// :3216-3354) — italic gold-gradient heading, Syne body copy, .fg-shiny-flat
// row buttons, inline "New folder…" reveal — but lives in its own component
// so /boxoffice consumes the same UX without reaching into film-glance state.
//
// Props:
//   entry      — the CardEntry the user just clicked the heart on
//   folders    — list of {id, name, position}
//   onConfirm  — (folderId | null) => void; null routes to Unsorted
//   onCreateFolder — async (name) => string|null; new folder id or null on
//                    validation/duplicate/network failure
//   onClose    — () => void
//
// Save flow:
//   • Pick an existing folder OR Unsorted → onConfirm(folderId)
//   • "New folder…" reveals an inline input. Enter / Save → onCreateFolder()
//     then onConfirm(newId). On null return we surface an inline error and
//     leave the modal open so the user can retry or cancel.

import React, { useState } from "react";
import { Folder, FolderPlus, Inbox, Check } from "lucide-react";

export default function FolderPickerModal({
  entry,
  folders,
  onConfirm,
  onCreateFolder,
  onClose,
}) {
  const [newFolderName, setNewFolderName] = useState(null); // null = collapsed; "" = open
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!entry) return null;

  const handleNewFolder = async () => {
    const name = (newFolderName || "").trim();
    if (!name) return;
    if (folders.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
      setError("You already have a folder with that name.");
      return;
    }
    setBusy(true);
    setError(null);
    const newId = await onCreateFolder(name);
    setBusy(false);
    if (!newId) {
      setError("Couldn't create folder. Try again?");
      return;
    }
    onConfirm(newId);
  };

  return (
    <div
      className="bom-fav-modal-back"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bom-fav-title"
    >
      <div className="bom-fav-modal" onClick={(e) => e.stopPropagation()}>
        <h3
          id="bom-fav-title"
          style={{
            fontFamily: "'Playfair Display', serif",
            fontStyle: "italic",
            fontSize: 32,
            fontWeight: 600,
            color: "#FFD700",
            letterSpacing: -0.6,
            marginBottom: 10,
            lineHeight: 1.08,
            textAlign: "center",
          }}
        >
          Add to Favorites
        </h3>
        <p
          style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: 17,
            color: "rgba(255, 255, 255, 0.78)",
            lineHeight: 1.5,
            margin: "0 0 4px",
            textAlign: "center",
          }}
        >
          Pick or create a folder to save this favorite.
        </p>
        {error && (
          <p
            style={{
              color: "#ff8b8b",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              letterSpacing: 0.6,
              margin: "10px 0 0",
              textAlign: "center",
            }}
          >
            {error}
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 18 }}>
          <button
            type="button"
            className="fg-shiny fg-shiny-flat"
            onClick={() => onConfirm(null)}
            disabled={busy}
            style={{ justifyContent: "center", padding: "13px 18px", fontSize: 16 }}
          >
            <span className="fg-shiny-label" style={{ justifyContent: "center" }}>
              <Inbox size={16} aria-hidden="true" />
              <span>Unsorted</span>
            </span>
          </button>

          {folders.map((fld) => (
            <button
              key={fld.id}
              type="button"
              className="fg-shiny fg-shiny-flat"
              onClick={() => onConfirm(fld.id)}
              disabled={busy}
              style={{ justifyContent: "center", padding: "13px 18px", fontSize: 16 }}
            >
              <span className="fg-shiny-label" style={{ justifyContent: "center" }}>
                <Folder size={16} aria-hidden="true" />
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: 280,
                  }}
                >
                  {fld.name}
                </span>
              </span>
            </button>
          ))}

          {newFolderName === null ? (
            <button
              type="button"
              className="fg-shiny fg-shiny-cta"
              onClick={() => {
                setNewFolderName("");
                setError(null);
              }}
              disabled={busy}
              style={{ justifyContent: "center", padding: "13px 18px", fontSize: 16 }}
            >
              <span className="fg-shiny-label" style={{ justifyContent: "center" }}>
                <FolderPlus size={16} aria-hidden="true" />
                <span>New folder…</span>
              </span>
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
              <input
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value.slice(0, 60))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleNewFolder();
                  if (e.key === "Escape") {
                    setNewFolderName(null);
                    setError(null);
                  }
                }}
                className="bom-folder-input"
                placeholder="Folder name…"
                maxLength={60}
                aria-label="New folder name"
                style={{ flex: 1, width: "auto" }}
              />
              <button
                type="button"
                className="fg-shiny fg-shiny-cta"
                onClick={handleNewFolder}
                disabled={busy || !newFolderName.trim()}
                style={{ padding: "8px 16px" }}
              >
                <span className="fg-shiny-label">
                  <Check size={13} aria-hidden="true" />
                  <span>Save</span>
                </span>
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="bom-fav-cancel"
        >
          Cancel
        </button>
      </div>

      <style jsx>{`
        .bom-fav-modal-back {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 1100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          animation: bomFavFadeIn 0.2s ease-out;
        }
        .bom-fav-modal {
          width: 100%;
          max-width: 460px;
          background: rgba(10, 8, 4, 0.96);
          border: 1px solid rgba(255, 215, 0, 0.22);
          border-radius: 16px;
          padding: 26px 28px 22px;
          box-shadow:
            0 24px 64px rgba(0, 0, 0, 0.75),
            0 0 60px rgba(255, 215, 0, 0.05);
          animation: bomFavSlideUp 0.32s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .bom-folder-input {
          background: #0a0805;
          border: 1px solid rgba(255, 215, 0, 0.55);
          border-radius: 999px;
          padding: 8px 14px;
          color: #ffd700;
          font-family: "Syne", sans-serif;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.2px;
          outline: none;
          width: 200px;
          box-shadow:
            0 0 22px rgba(255, 215, 0, 0.22),
            inset 0 1px 0 rgba(255, 215, 0, 0.18);
        }
        .bom-folder-input::placeholder {
          color: rgba(255, 215, 0, 0.42);
        }
        .bom-fav-cancel {
          margin-top: 18px;
          width: 100%;
          padding: 13px 18px;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 999px;
          color: rgba(255, 255, 255, 0.62);
          font-family: "Syne", sans-serif;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.4px;
          cursor: pointer;
          transition:
            border-color 0.25s,
            color 0.25s;
          text-align: center;
        }
        .bom-fav-cancel:hover:not(:disabled) {
          border-color: rgba(255, 255, 255, 0.28);
          color: rgba(255, 255, 255, 0.92);
        }
        .bom-fav-cancel:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        @keyframes bomFavFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes bomFavSlideUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
