import type { SupabaseClient } from "@supabase/supabase-js";
import { ETIQUETA_CATEGORIA, ETIQUETA_ESTADO_EQUIPO, type Articulo, type Equipo } from "@/lib/tipos";
import { cantidadTexto } from "@/lib/formato";

// Consulta el inventario actual y descarga un PDF (se genera en el navegador)
export async function descargarPdfInventario(supabase: SupabaseClient, generadoPor: string) {
  const [{ data: arts, error: e1 }, { data: eqs, error: e2 }] = await Promise.all([
    supabase.from("articulos").select("*").eq("activo", true).order("categoria").order("nombre"),
    supabase.from("equipos").select("*").eq("activo", true).order("nombre"),
  ]);
  if (e1 || e2) throw new Error("No se pudo leer el inventario.");

  const articulos = (arts ?? []) as Articulo[];
  const equipos = (eqs ?? []) as Equipo[];

  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const ahora = new Date();

  doc.setFontSize(16);
  doc.text("Inventario del Laboratorio de Bioquímica", 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(
    `Generado el ${ahora.toLocaleString("es-MX")} por ${generadoPor}`,
    14,
    22
  );
  doc.setTextColor(0);

  doc.setFontSize(12);
  doc.text(`Materiales y reactivos (${articulos.length})`, 14, 31);

  autoTable(doc, {
    startY: 34,
    head: [["Nombre", "Categoría", "Existencia", "Mínimo", "Ubicación", "Alerta"]],
    body: articulos.map((a) => [
      a.nombre,
      ETIQUETA_CATEGORIA[a.categoria],
      `${cantidadTexto(a.stock)} ${a.unidad}`,
      `${cantidadTexto(a.stock_minimo)} ${a.unidad}`,
      a.ubicacion ?? "",
      a.stock === 0 ? "AGOTADO" : a.stock <= a.stock_minimo ? "BAJO" : "",
    ]),
    styles: { fontSize: 8.5, cellPadding: 1.8 },
    headStyles: { fillColor: [4, 120, 87] },
    didParseCell: (datos) => {
      if (datos.section === "body" && datos.column.index === 5 && datos.cell.raw) {
        datos.cell.styles.textColor = [185, 28, 28];
        datos.cell.styles.fontStyle = "bold";
      }
    },
  });

  const yFinal = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  doc.setFontSize(12);
  doc.text(`Equipos (${equipos.length})`, 14, yFinal + 10);

  autoTable(doc, {
    startY: yFinal + 13,
    head: [["Nombre", "Marca", "Modelo", "Ubicación", "Estado"]],
    body: equipos.map((e) => [
      e.nombre,
      e.marca ?? "",
      e.modelo ?? "",
      e.ubicacion ?? "",
      ETIQUETA_ESTADO_EQUIPO[e.estado],
    ]),
    styles: { fontSize: 8.5, cellPadding: 1.8 },
    headStyles: { fillColor: [4, 120, 87] },
  });

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Página ${i} de ${total}`, 196, 272, { align: "right" });
  }

  const fecha = ahora.toISOString().slice(0, 10);
  doc.save(`inventario-laboratorio-${fecha}.pdf`);
}
