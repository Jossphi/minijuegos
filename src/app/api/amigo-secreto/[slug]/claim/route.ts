import { body, handle, str } from "@/lib/api";
import { drawForParticipant } from "@/lib/secret-santa";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await body(req);
  return handle(() => drawForParticipant(slug, str(b.participantId), str(b.pin), str(b.wishlist)));
}
