/** Copies `text`; false when the browser refuses (no permission, or not a secure page). */
export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);

    return true;
  } catch {
    return false;
  }
}
