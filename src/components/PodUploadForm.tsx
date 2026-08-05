"use client";

import { useFormStatus } from "react-dom";
import { useId, useRef, useState, type DragEvent } from "react";
import { uploadPod } from "@/lib/actions/freight";
import { SAMPLE_SIGNED_BOL_PATH } from "@/lib/display-text";

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";
const MAX_BYTES = 8 * 1024 * 1024;

type Props = {
  shipmentId: string;
  defaultSignedBy?: string;
  /** When true, uploading replaces the POD already on file. */
  replacing?: boolean;
};

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function SubmitButton({
  disabled,
  replacing,
}: {
  disabled: boolean;
  replacing: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="btn btn-success btn-sm"
      disabled={disabled || pending}
    >
      {pending ? (
        <>
          <span className="loading loading-spinner loading-xs" />
          Uploading POD…
        </>
      ) : replacing ? (
        "Replace POD with new file"
      ) : (
        "Attach signed BOL & confirm delivery"
      )}
    </button>
  );
}

export function PodUploadForm({
  shipmentId,
  defaultSignedBy = "",
  replacing = false,
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [sampleBusy, setSampleBusy] = useState(false);

  function clearPreview() {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setPreviewUrl(null);
  }

  function assignInputFile(next: File) {
    if (!inputRef.current) return;
    const dt = new DataTransfer();
    dt.items.add(next);
    inputRef.current.files = dt.files;
  }

  function pickFile(next: File | null) {
    setError(null);
    clearPreview();
    if (!next) {
      setFile(null);
      return;
    }
    if (next.size > MAX_BYTES) {
      setFile(null);
      setError("File must be 8 MB or smaller.");
      return;
    }
    const okType =
      next.type === "application/pdf" ||
      next.type === "image/jpeg" ||
      next.type === "image/png" ||
      next.type === "image/webp";
    if (!okType) {
      setFile(null);
      setError("Use a PDF or image (JPEG, PNG, or WebP).");
      return;
    }
    setFile(next);
    assignInputFile(next);
    if (next.type.startsWith("image/")) {
      const url = URL.createObjectURL(next);
      previewRef.current = url;
      setPreviewUrl(url);
    }
  }

  async function loadSampleBol() {
    setSampleBusy(true);
    setError(null);
    try {
      const res = await fetch(SAMPLE_SIGNED_BOL_PATH);
      if (!res.ok) throw new Error("Sample BOL missing");
      const blob = await res.blob();
      const sample = new File([blob], "signed-bol-sample.pdf", {
        type: "application/pdf",
      });
      pickFile(sample);
    } catch {
      setError("Could not load the sample signed BOL.");
    } finally {
      setSampleBusy(false);
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0] ?? null;
    pickFile(dropped);
  }

  return (
    <form action={uploadPod} className="mt-3 grid gap-3">
      <input type="hidden" name="shipment_id" value={shipmentId} />
      {replacing ? <input type="hidden" name="replace" value="1" /> : null}

      {replacing ? (
        <p className="text-sm opacity-70">
          A POD is already on file. Upload a new signed BOL to replace it.
        </p>
      ) : null}

      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={onDrop}
        className={`rounded-box border-2 border-dashed p-4 transition-colors ${
          dragging
            ? "border-success bg-success/10"
            : "border-base-300 bg-base-200/60"
        }`}
      >
        <label htmlFor={inputId} className="cursor-pointer block">
          <div className="text-sm font-medium">Signed BOL / POD file</div>
          <p className="mt-1 text-xs opacity-70">
            Drag and drop a PDF or photo of the signed delivery document, or click
            to browse.
          </p>
          <input
            ref={inputRef}
            id={inputId}
            name="pod_file"
            type="file"
            accept={ACCEPT}
            required
            className="mt-3 file-input file-input-bordered file-input-sm w-full max-w-full"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <button
          type="button"
          className="btn btn-outline btn-xs mt-3"
          disabled={sampleBusy}
          onClick={() => void loadSampleBol()}
        >
          {sampleBusy ? "Loading sample…" : "Use sample signed BOL"}
        </button>

        {file ? (
          <div className="mt-3 flex flex-wrap items-start gap-3 rounded-box bg-base-100 p-3 text-sm">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="POD preview"
                className="h-20 w-20 rounded object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded bg-base-200 text-xs font-semibold uppercase tracking-wide opacity-70">
                PDF
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{file.name}</div>
              <div className="opacity-70">
                {formatBytes(file.size)}
                {file.type ? ` · ${file.type}` : ""}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-xs mt-1 px-0"
                onClick={() => {
                  pickFile(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
              >
                Remove file
              </button>
            </div>
          </div>
        ) : null}

        {error ? <p className="mt-2 text-sm text-error">{error}</p> : null}
      </div>

      <input
        name="signed_by"
        placeholder="Receiver name on the BOL"
        className="input input-bordered input-sm"
        required
        defaultValue={defaultSignedBy}
        maxLength={200}
      />
      <input
        name="notes"
        placeholder="Delivery notes (optional)"
        className="input input-bordered input-sm"
        maxLength={2000}
      />

      <SubmitButton disabled={Boolean(error)} replacing={replacing} />
      <p className="text-xs opacity-60">
        {replacing
          ? "The previous POD link will be replaced after a successful upload."
          : "Uploading confirms delivery and attaches the document for billing review."}
      </p>
    </form>
  );
}
