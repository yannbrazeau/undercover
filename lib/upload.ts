// Envoi de fichier par morceaux relayés par le serveur — partagé entre les
// écrans qui attachent un document (Ajouter, signature d'un devis).

export const CHUNK_SIZE = 3 * 1024 * 1024; // 3 Mo, multiple de 256 Kio (exigé par Google)
export const MAX_FILE_BYTES = 50 * 1024 * 1024; // garde-fou, pas une vraie limite technique

/** Lecture de réponse tolérante : si ce n'est pas du JSON (erreur d'hôte…), on renvoie le texte. */
export async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 200) || `Erreur ${res.status}` };
  }
}

/**
 * Envoie le fichier par morceaux via notre propre serveur (jamais directement à
 * Google depuis le navigateur, qui refuse cet envoi cross-site). Chaque morceau
 * passe sous la limite de l'hébergeur, donc la taille totale n'est plus un problème.
 */
export async function uploadViaChunks(
  sessionUri: string,
  file: File,
): Promise<{ id?: string; webViewLink?: string } | null> {
  const total = file.size;
  let start = 0;

  while (start < total) {
    const end = Math.min(start + CHUNK_SIZE, total);
    const chunk = file.slice(start, end);

    const res = await fetch("/api/upload-chunk", {
      method: "PUT",
      headers: {
        "x-session-uri": sessionUri,
        "x-content-range": `bytes ${start}-${end - 1}/${total}`,
      },
      body: chunk,
    });

    if (res.status === 308) {
      const range = res.headers.get("range"); // "bytes=0-3145727"
      const m = range ? /bytes=\d+-(\d+)/.exec(range) : null;
      start = m ? parseInt(m[1], 10) + 1 : end;
      continue;
    }
    if (res.ok) {
      return res.json().catch(() => null);
    }

    const errJson = await res.json().catch(() => ({}) as Record<string, unknown>);
    throw new Error(String(errJson.error) || `L'envoi du fichier a échoué (${res.status}).`);
  }
  return null;
}

/** Ouvre une session, envoie le fichier, renvoie le lien Drive du document créé. */
export async function envoyerDocument(lotUuid: string, file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) throw new Error("Fichier trop volumineux.");

  const init = await fetch("/api/upload-init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lotUuid,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
    }),
  });
  const initJson = await readJson(init);
  if (!init.ok) throw new Error(String(initJson.error) || "L'envoi du fichier n'a pas pu démarrer.");

  const result = await uploadViaChunks(String(initJson.sessionUri), file);
  return result?.webViewLink || (result?.id ? `https://drive.google.com/file/d/${result.id}/view` : "");
}
