import { body, handle, str } from "@/lib/api";
import { isAdmin } from "@/lib/admin-auth";
import * as S from "@/lib/secret-santa";
import type { DrawMode } from "@/lib/draw";

/** Un único endpoint para las acciones del panel de administración. */
export async function POST(req: Request) {
  const b = await body(req);
  return handle(async () => {
    if (!(await isAdmin())) throw new S.UserError("No autorizado", 401);
    const a = (b.args ?? {}) as Record<string, unknown>;
    switch (str(b.action)) {
      case "createEvent":
        return S.adminCreateEvent({
          name: str(a.name), slug: str(a.slug), budget: str(a.budget),
          exchange_date: str(a.exchange_date), message: str(a.message),
        });
      case "updateEvent":
        return S.adminUpdateEvent(str(a.id), a as Parameters<typeof S.adminUpdateEvent>[1]);
      case "deleteEvent":
        return S.adminDeleteEvent(str(a.id));
      case "createTeam":
        return S.adminCreateTeam(str(a.eventId), {
          name: str(a.name), color: str(a.color), draw_mode: str(a.draw_mode) as DrawMode,
        });
      case "updateTeam":
        return S.adminUpdateTeam(str(a.teamId), a as Parameters<typeof S.adminUpdateTeam>[1]);
      case "deleteTeam":
        return S.adminDeleteTeam(str(a.teamId));
      case "addParticipants":
        return S.adminAddParticipants(str(a.teamId), Array.isArray(a.names) ? a.names.map(String) : str(a.names).split(/\r?\n|,/));
      case "removeParticipant":
        return S.adminRemoveParticipant(str(a.participantId));
      case "resetParticipant":
        return S.adminResetParticipant(str(a.participantId));
      case "unlockParticipant":
        return S.adminUnlockParticipant(str(a.participantId));
      case "addExclusion":
        return S.adminAddExclusion(str(a.teamId), str(a.a), str(a.b));
      case "removeExclusion":
        return S.adminRemoveExclusion(str(a.teamId), str(a.a), str(a.b));
      case "resetEventDraws":
        return S.adminResetEventDraws(str(a.eventId));
      case "resetTeamDraw":
        return S.adminResetTeamDraw(str(a.teamId));
      default:
        throw new S.UserError("Acción desconocida");
    }
  });
}
