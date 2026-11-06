import { handle } from "@/lib/api";
import { destroyAdminSession } from "@/lib/admin-auth";

export async function POST() {
  return handle(() => destroyAdminSession());
}
