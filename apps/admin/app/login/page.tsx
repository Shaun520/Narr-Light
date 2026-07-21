import { AdminLoginForm } from "@/components/admin-login-form";

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <h1 id="login-title">叙光 Admin</h1>
        <p>使用固定管理员账号登录后台。</p>

        <AdminLoginForm />
      </section>
    </main>
  );
}
