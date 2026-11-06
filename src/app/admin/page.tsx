import { isAdmin } from "@/lib/admin-auth";
import { adminListEvents } from "@/lib/secret-santa";
import { Footer, TopBar } from "@/components/ui";
import AdminLogin from "@/components/admin/AdminLogin";
import AdminHome from "@/components/admin/AdminHome";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return (
      <>
        <TopBar back="/" backLabel="Juegos" />
        <main className="mx-auto w-full max-w-md px-4 py-16"><AdminLogin /></main>
      </>
    );
  }
  const events = await adminListEvents();
  return (
    <>
      <TopBar back="/" backLabel="Juegos" />
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6"><AdminHome events={events} /></main>
      <Footer />
    </>
  );
}
