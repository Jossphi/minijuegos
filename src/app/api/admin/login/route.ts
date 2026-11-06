import { body, handle, str } from "@/lib/api";
import { checkAdminPassword, createAdminSession } from "@/lib/admin-auth";
import { UserError } from "@/lib/secret-santa";

export async function POST(req: Request) {
  const b = await body(req);
  return handle(async () => {
    await new Promise((r) => setTimeout(r, 400)); // frena intentos por fuerza bruta
    if (!checkAdminPassword(str(b.password))) throw new UserError("Contraseña incorrecta", 401);
    await createAdminSession();
  });
}
