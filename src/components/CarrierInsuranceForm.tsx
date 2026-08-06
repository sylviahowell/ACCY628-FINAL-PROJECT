"use client";

import { useFormStatus } from "react-dom";
import { useId, useRef, useState } from "react";
import { updateCarrierInsurance } from "@/lib/actions/freight";
import { normalizePodUrl } from "@/lib/display-text";
import { insuranceRiskStatus, insuranceStatusLabel } from "@/lib/risk-credit";

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";
const MAX_BYTES = 8 * 1024 * 1024;

type Props = {
  currentExpiration: string | null;
  certificateUrl: string | null;
  today: string;
};

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary btn-sm" disabled={disabled || pending}>
      {pending ? (
        <>
          <span className="loading loading-spinner loading-xs" />
          Saving…
        </>
      ) : (
        "Save insurance"
      )}
    </button>
  );
}

export function CarrierInsuranceForm({
  currentExpiration,
  certificateUrl,
  today,
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const certHref = normalizePodUrl(certificateUrl);
  const risk = insuranceRiskStatus(currentExpiration, today);
  const needsCertificate = !certificateUrl;

  function onFileChange(next: File | null) {
    setError(null);
    if (!next) {
      setFile(null);
      return;
    }
    if (next.size > MAX_BYTES) {
      setError("File must be 8 MB or smaller.");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (next.type && !ACCEPT.split(",").includes(next.type)) {
      setError("Use a PDF or image (JPEG, PNG, or WebP).");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFile(next);
  }

  return (
    <div id="carrier-insurance" className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="opacity-70">Current status:</span>
        <span className="badge badge-outline badge-sm">{insuranceStatusLabel(risk.status)}</span>
        <span className="tabular-nums opacity-70">
          {currentExpiration ? `Expires ${currentExpiration}` : "No expiration on file"}
        </span>
      </div>

      {certHref ? (
        <p className="text-sm">
          <a href={certHref} target="_blank" rel="noreferrer" className="link link-primary">
            View certificate on file
          </a>
        </p>
      ) : (
        <p className="text-sm opacity-70">No certificate file on record yet.</p>
      )}

      <form action={updateCarrierInsurance} className="grid gap-3 sm:grid-cols-2">
        <label className="form-control w-full sm:col-span-1">
          <span className="label-text text-sm">New expiration date</span>
          <input
            name="insurance_expiration"
            type="date"
            required
            defaultValue={currentExpiration ?? ""}
            className="input input-bordered"
          />
        </label>

        <label className="form-control w-full sm:col-span-1">
          <span className="label-text text-sm">
            Certificate file {needsCertificate ? "(required)" : "(optional replace)"}
          </span>
          <input
            id={inputId}
            ref={inputRef}
            name="insurance_file"
            type="file"
            accept={ACCEPT}
            required={needsCertificate}
            className="file-input file-input-bordered w-full"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
        </label>

        {file ? (
          <p className="text-xs opacity-60 sm:col-span-2">
            Selected: {file.name} ({Math.max(1, Math.round(file.size / 1024))} KB)
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-error sm:col-span-2" role="alert">
            {error}
          </p>
        ) : null}

        <p className="text-xs opacity-60 sm:col-span-2">
          Upload a current certificate of insurance (COI). PDF or image, max 8 MB. Updating a
          future expiration clears Suspended status for new load assignments.
        </p>

        <div className="sm:col-span-2">
          <SubmitButton disabled={Boolean(error)} />
        </div>
      </form>
    </div>
  );
}
