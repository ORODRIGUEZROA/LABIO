# Etapa 2: Prácticas, bitácora, reportes e inventario (modo alumno y modo profesor)

## 1. Supabase

1. **SQL Editor → New query** → pega todo `supabase/02_inventario_practicas.sql` → **Run**.
   - Corre primero `01_usuarios.sql` si aún no lo habías hecho (ya lo hiciste).
   - Al final trae material y equipos de ejemplo. Edítalos o bórralos después desde la app (pantalla Inventario).
2. Verifica en **Table Editor** que existan: `articulos`, `equipos`, `practicas`, `practica_items`, `bitacora_equipos`, `reportes`, `movimientos_inventario`.
3. Verifica en **Storage** que exista el bucket privado `evidencias`.

## 2. Tu proyecto

```powershell
cd C:\dev\lab-bioquimica
npm install jspdf jspdf-autotable
```

Copia del zip a tu proyecto (combinar carpetas, reemplazar archivos si pregunta):

| Del zip | Qué hace |
|---|---|
| `app\` | Pantallas nuevas. Reemplaza `app\page.tsx` y `app\inicio\page.tsx` |
| `lib\` | Funciones y estilos (se suman a tu carpeta `lib`, junto a `supabase`) |
| `components\` | Va en la raíz del proyecto (carpeta nueva) |
| `supabase\` | Respaldo del SQL |

No toques `middleware.ts`, `.env.local`, `login`, `registro` ni `auth`.

## 3. Convertir a un usuario en profesor

Todos los registros nacen como `alumno`. Para tu cuenta (en el SQL Editor):

```sql
update public.perfiles set rol = 'docente' where correo = 'TU-CORREO@ejemplo.com';
```

Roles con acceso a inventario y PDF: `docente`, `tecnico` y `admin`.
Después de cambiar el rol, recarga la página de la app.

## 4. Prueba recomendada

Necesitas dos cuentas: una de alumno y una de profesor.

**Alumno**
1. Práctica → + Nueva → busca "ácido" → Agregar → escribe la cantidad → Registrar.
2. Bitácora → + Registrar → equipo, uso, condiciones inicial y final → Guardar.
3. Reportar → equipo en mal estado → describe → toma foto → Enviar.
4. Entra a `/inventario` escribiendo la dirección: debe decir que es solo para profesores.

**Profesor**
1. Inventario → verifica que la existencia del reactivo bajó.
2. ± Movimiento → registra una entrada; Editar → cambia un dato; + Nuevo → crea un material.
3. Pestaña Equipos → crea o edita un equipo.
4. Botón PDF → se descarga el inventario actual.
5. Reportes → ver la foto y cambiar el estado (Abierto, En revisión, Cerrado).
6. Práctica, Bitácora y Reportes muestran los registros de todos, con nombre y matrícula.

## 5. Cómo funciona (resumen)

- **Práctica:** el alumno elige materiales con buscador (tolera acentos). Reactivos aceptan decimales (2.5 ml); puntas, tubos y similares, solo enteros. Al registrar, el sistema descuenta el stock en una sola operación; si algo no alcanza, no se guarda nada.
- **Alumnos no ven cantidades del inventario**, solo si hay o está agotado.
- **Existencia:** nadie la modifica a mano. Solo cambia por prácticas o por movimientos del profesor (entrada, salida, ajuste de conteo físico), y cada cambio queda en `movimientos_inventario`.
- **Bitácora:** fecha y hora automáticas. No se puede editar ni borrar.
- **Reportes:** la foto se reduce en el celular antes de subirse. Es obligatoria para "equipo en mal estado". Solo el dueño y el personal pueden verla.
- **Roles:** se aplican en la base de datos, no solo en la pantalla.

## 6. Si algo falla

| Síntoma | Causa probable |
|---|---|
| El catálogo de práctica sale vacío | No corriste el SQL 02, o no hay artículos activos |
| `permission denied for table ...` | Falta correr el bloque de permisos del SQL 02 completo |
| Error al subir foto | El bucket `evidencias` no existe; corre el SQL 02 de nuevo |
| El profesor no ve el botón de Inventario | Su rol sigue como `alumno`; revisa el paso 3 y recarga |
| Aviso de que `middleware` está obsoleto | Es normal en Next.js 16; la app funciona igual |
