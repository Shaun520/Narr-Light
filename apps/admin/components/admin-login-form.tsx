"use client";

import { useActionState } from "react";
import { signInAdmin, type LoginState } from "@/lib/auth/actions";

const initialState: LoginState = {};

export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(signInAdmin, initialState);

  return (
    <form action={formAction}>
      <div className="form-field">
        <label htmlFor="admin-username">账号</label>
        <input
          id="admin-username"
          name="username"
          type="text"
          autoComplete="username"
          placeholder="admin"
          disabled={pending}
          required
        />
      </div>

      <div className="form-field">
        <label htmlFor="admin-password">密码</label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="请输入密码"
          disabled={pending}
          required
        />
      </div>

      {state.error && <p className="login-error">{state.error}</p>}

      <div className="login-actions">
        <button className="admin-btn primary" type="submit" disabled={pending}>
          {pending ? "登录中..." : "登录"}
        </button>
      </div>
    </form>
  );
}
