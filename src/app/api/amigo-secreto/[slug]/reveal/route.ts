import { body, handle, str } from "@/lib/api";
import { reveal } from "@/lib/secret-santa";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await body(req);
  return handle(() => reveal(slug, str(b.participantId), str(b.pin)));
}
