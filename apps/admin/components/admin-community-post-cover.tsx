"use client";

import { useState } from "react";

/** 社区帖子封面缩略图：点击放大查看（轻量灯箱）。 */
export function AdminCommunityPostCover({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        aria-label={`放大查看封面：${alt}`}
        onClick={() => setOpen(true)}
        style={{ padding: 0, border: 0, background: "transparent", cursor: "zoom-in", display: "block" }}
        type="button"
      >
        <img
          alt={alt}
          src={src}
          style={{ width: 44, height: 60, objectFit: "cover", borderRadius: 4, display: "block" }}
        />
      </button>
      {open ? (
        <div
          onClick={() => setOpen(false)}
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            background: "rgba(15, 10, 8, 0.82)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "zoom-out",
            padding: 24,
          }}
        >
          <img
            alt={alt}
            src={src}
            style={{
              maxWidth: "90vw",
              maxHeight: "90vh",
              objectFit: "contain",
              borderRadius: 8,
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.5)",
            }}
          />
        </div>
      ) : null}
    </>
  );
}
