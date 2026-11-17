import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";

// Supabase redirige aquí cuando el alumno abre el enlace de su correo.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const codigo = searchParams.get("code");

  if (codigo) {
    const supabase = await crearClienteServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (!error) return NextResponse.redirect(`${origin}/inicio`);
  }

  return NextResponse.redirect(`${origin}/login?error=enlace`);
}
