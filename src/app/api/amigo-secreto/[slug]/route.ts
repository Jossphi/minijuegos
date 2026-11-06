import { handle } from "@/lib/api";
import { getPublicEvent, UserError } from "@/lib/secret-santa";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return handle(async () => {
    const data = await getPublicEvent(slug);
    if (!data) throw new UserError("Evento no encontrado", 404);
    return data;
  });
}
