"use client";

import { useEffect, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/client";

export type Rol = "alumno" | "docente" | "tecnico" | "admin";

export type Perfil = {
  id: string;
  nombre: string;
  matricula: string;
  rol: Rol;
  clase_id: string | null;
};

// Devuelve el cliente de Supabase, el perfil de quien tiene sesión y si es personal (profesor/técnico/admin)
export function usePerfil() {
  const [supabase] = useState(() => crearClienteNavegador());
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vigente = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (vigente) setCargando(false);
        return;
      }
      const { data } = await supabase
        .from("perfiles")
        .select("id, nombre, matricula, rol, clase_id")
        .eq("id", user.id)
        .single();
      if (vigente) {
        setPerfil((data as Perfil | null) ?? null);
        setCargando(false);
      }
    })();
    return () => {
      vigente = false;
    };
  }, [supabase]);

  const esPersonal = perfil ? perfil.rol !== "alumno" : false;
  return { supabase, perfil, cargando, esPersonal };
}
