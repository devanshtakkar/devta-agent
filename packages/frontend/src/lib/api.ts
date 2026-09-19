const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3001";

export interface Starter {
  id: string;
  title: string;
  openerLine: string;
  why: string;
  risk: "low" | "medium" | "high";
  nextMove: string;
}

export interface IdeasResponse {
  overview: string;
  starters: Starter[];
}

export interface BranchScenario {
  herResponse: string;
  yourReply: string;
  tip: string;
}

export interface BranchResponse {
  scenarios: BranchScenario[];
  exitLine: string;
}

async function request<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export function fetchIdeas(situation: string, imageDataUrl?: string) {
  return request<IdeasResponse>("/api/coach/ideas", { situation, imageDataUrl });
}

export function fetchBranch(situation: string, starter: Starter, herResponse?: string) {
  return request<BranchResponse>("/api/coach/branch", { situation, starter, herResponse });
}

/** Downscale an image file to a compact JPEG data URL for AI context. */
export function fileToDataUrl(file: File, maxDim = 1024, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}
