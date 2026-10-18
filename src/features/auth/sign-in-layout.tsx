import Link from "next/link";
import type { ReactNode } from "react";
import { SignInCompanion } from "./sign-in-companion";
import "./sign-in.css";

const categories = [
  ["Mathematics", "Science", "English", "College Support"],
  ["SAT / ACT", "Entrance exams", "Homework help", "Study skills"],
] as const;

export function SignInLayout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="sign-in-page">
      <div className="sign-in-layout">
        <section className="sign-in-left" aria-labelledby="sign-in-title">
          <div className="sign-in-form-wrap">
            <div className="sign-in-content">
              <p className="sign-in-welcome">Welcome back</p>
              <h1 id="sign-in-title">{title}</h1>
              {children}
            </div>
          </div>
          <nav className="sign-in-policies" aria-label="Sign-in policies">
            <span>learli</span>
            <Link href="/privacy">Privacy draft</Link>
            <Link href="/terms">Terms draft</Link>
          </nav>
        </section>
        <SignInCompanion>
          <p className="sign-in-companion-label">Tutoring, matched to you</p>
          <p className="sign-in-headline">
            The right tutor makes it <em>click.</em>
          </p>
          <p className="sign-in-description">
            Sign in to pick up where you left off.
          </p>
          <div className="sign-in-band">
            {categories.map((row, rowIndex) => (
              <div className="sign-in-track" key={rowIndex}>
                {[0, 1].map((copy) => (
                  <div className="sign-in-track-group" key={copy}>
                    {[...row, ...row].map((category, index) => (
                      <span
                        className={
                          index % row.length === rowIndex
                            ? "sign-in-chip sign-in-chip-selected"
                            : "sign-in-chip"
                        }
                        key={`${category}-${index}`}
                      >
                        {category}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="sign-in-orb" />
        </SignInCompanion>
      </div>
    </div>
  );
}
