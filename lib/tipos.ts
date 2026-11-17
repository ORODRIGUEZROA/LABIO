export type Categoria = "reactivo" | "consumible" | "material" | "otro";

export const ETIQUETA_CATEGORIA: Record<Categoria, string> = {
  reactivo: "Reactivo",
  consumible: "Consumible",
  material: "Material",
  otro: "Otro",
};

export type Articulo = {
  id: string;
  nombre: string;
  categoria: Categoria;
  unidad: string;
  stock: number;
  stock_minimo: number;
  ubicacion: string | null;
  notas: string | null;
  activo: boolean;
};

// Lo que ve un alumno: sin cantidades exactas
export type ArticuloCatalogo = {
  id: string;
  nombre: string;
  categoria: Categoria;
  unidad: string;
  ubicacion: string | null;
  disponible: boolean;
};

export type EstadoEquipo = "disponible" | "mantenimiento" | "fuera_de_servicio";

export const ETIQUETA_ESTADO_EQUIPO: Record<EstadoEquipo, string> = {
  disponible: "Disponible",
  mantenimiento: "En mantenimiento",
  fuera_de_servicio: "Fuera de servicio",
};

export type Equipo = {
  id: string;
  nombre: string;
  marca: string | null;
  modelo: string | null;
  ubicacion: string | null;
  estado: EstadoEquipo;
  activo: boolean;
};

export type EstadoReporte = "abierto" | "en_revision" | "cerrado";

export const ETIQUETA_ESTADO_REPORTE: Record<EstadoReporte, string> = {
  abierto: "Abierto",
  en_revision: "En revisión",
  cerrado: "Cerrado",
};

export const ETIQUETA_ROL: Record<string, string> = {
  alumno: "Alumno",
  docente: "Profesor",
  tecnico: "Técnico",
  admin: "Administrador",
};
