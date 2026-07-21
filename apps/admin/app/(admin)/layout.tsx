import { AdminShell } from "@/components/admin-shell";
import { requireAdmin } from "@/lib/auth/admin";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireAdmin();

  return <AdminShell>{children}</AdminShell>;
}
