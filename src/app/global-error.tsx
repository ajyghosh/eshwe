"use client";

import Link from "next/link";
import Image from "next/image";

type GlobalErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalErrorPage({ reset }: GlobalErrorPageProps) {
  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          margin: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 20px",
          background:
            "radial-gradient(circle at top, rgba(255,245,222,0.55), transparent 28%), linear-gradient(180deg, #fbf4e8 0%, #f7efe2 100%)",
          color: "#3f4738",
          fontFamily: "Georgia, 'Times New Roman', serif"
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "780px",
            border: "1px solid #dfd2c1",
            borderRadius: "30px",
            background: "rgba(255, 251, 243, 0.96)",
            boxShadow: "0 28px 70px rgba(94, 104, 79, 0.12)",
            padding: "40px 32px",
            textAlign: "center"
          }}
        >
          <Image
            src="/eshwelogo-transparent.png"
            alt="eshwe"
            width={96}
            height={96}
            style={{ width: "84px", height: "auto", margin: "0 auto 16px auto", display: "block" }}
          />
          <p
            style={{
              margin: 0,
              fontFamily: "system-ui, sans-serif",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.24em",
              color: "#7d876f"
            }}
          >
            WEBSITE TEMPORARILY UNAVAILABLE
          </p>
          <h1 style={{ margin: "16px 0 0", fontSize: "clamp(2.2rem, 4vw, 3.4rem)", lineHeight: 1.04 }}>
            We could not load the page correctly.
          </h1>
          <p
            style={{
              margin: "18px auto 0",
              maxWidth: "560px",
              fontFamily: "system-ui, sans-serif",
              fontSize: "16px",
              lineHeight: 1.8,
              color: "#667056"
            }}
          >
            Something failed before the site could finish loading. Please retry once. If it still does not work,
            return to the home page and continue from there.
          </p>

          <div
            style={{
              marginTop: "28px",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "12px"
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "48px",
                padding: "0 22px",
                borderRadius: "999px",
                border: "none",
                background: "#5e684f",
                color: "#fbf4e8",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                cursor: "pointer"
              }}
            >
              Reload
            </button>
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "48px",
                padding: "0 22px",
                borderRadius: "999px",
                border: "1px solid #d6ccb9",
                background: "transparent",
                color: "#5e684f",
                textDecoration: "none",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase"
              }}
            >
              Go Home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
