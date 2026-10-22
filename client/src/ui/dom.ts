/** Élément HTML obligatoire de la page : une absence est une erreur de développement. */
export function requireElement<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`élément #${id} introuvable`);
  return element as T;
}

/** Lecture et écriture du stockage local, qui peut être indisponible (navigation privée). */
export function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Sans stockage, le nom sera simplement redemandé à la prochaine visite.
  }
}
