/**
 * Saves a picture or file from its address as a real download. The browser's own download link only works for
 * files on our own address; ours live in storage on another one, where it would just open the file in a tab.
 * When the file can't be fetched here, it is opened in a new tab as a fallback and the browser's own save works from there.
 */
export async function downloadFile(url: string, baseName: string): Promise<void> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`download failed (${res.status})`);
    const blob = await res.blob();
    const ext = (blob.type.split("/")[1] || url.split("?")[0].split(".").pop() || "png").replace("jpeg", "jpg").replace(/[^a-z0-9]/gi, "");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${baseName}.${ext}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}
