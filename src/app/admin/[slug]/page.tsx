import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { adminGetEvent } from "@/lib/secret-santa";
import { Footer, TopBar } from "@/components/ui";
import EventManager from "@/components/admin/EventManager";

export const dynamic = "force-dynamic";

export default async function AdminEventPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!(await isAdmin())) redirect("/admin");
  const { slug } = await params;
  const data = await adminGetEvent(slug);
  if (!data) notFound();
  return (
    <>
      <TopBar back="/admin" backLabel="Panel" />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6"><EventManager event={data.event} teams={data.teams} /></main>
      <Footer />
    </>
  );
}
