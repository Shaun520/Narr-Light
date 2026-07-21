"use client";

import { useFormStatus } from "react-dom";
import { toggleUserBanStatus } from "@/app/(admin)/users/actions";

export function AdminUserBanAction({
  userId,
  isBanned,
  returnTo,
}: {
  userId: string;
  isBanned: boolean;
  returnTo: string;
}) {
  const label = isBanned ? "启用" : "封禁";
  const nextIsBanned = !isBanned;
  const confirmMessage = isBanned
    ? "确认启用该用户？启用后该用户将恢复正常状态。"
    : "确认封禁该用户？封禁后后台会将其标记为已封禁。";

  return (
    <form
      action={toggleUserBanStatus}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      <input name="userId" type="hidden" value={userId} />
      <input name="nextIsBanned" type="hidden" value={String(nextIsBanned)} />
      <input name="returnTo" type="hidden" value={returnTo} />
      <SubmitButton danger={!isBanned}>{label}</SubmitButton>
    </form>
  );
}

function SubmitButton({ children, danger }: { children: string; danger: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button className={`link-btn${danger ? " danger" : ""}`} disabled={pending} type="submit">
      {pending ? "处理中" : children}
    </button>
  );
}
