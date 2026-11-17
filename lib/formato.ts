// Quita acentos y mayúsculas para que "centrifuga" encuentre "Centrífuga"
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function cantidadTexto(n: number): string {
  return new Intl.NumberFormat("es-MX", { maximumFractionDigits: 3 }).format(n);
}
