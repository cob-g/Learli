import type { ReactNode } from "react";
import { SignUpArtwork } from "./sign-up-artwork";
import "./sign-up.css";

export function SignUpLayout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="sign-up-page">
      <div className="sign-up-stage">
        <section className="sign-up-card" aria-labelledby="sign-up-title">
          <p className="sign-up-welcome">Get started</p>
          <h1 id="sign-up-title">{title}</h1>
          <p className="sign-up-lede">
            Find the right tutor for your next step.
          </p>
          {children}
        </section>
        <SignUpArtwork>
          <div className="sign-up-ribbon" />
          <span className="sign-up-dot sign-up-dot-one" />
          <span className="sign-up-dot sign-up-dot-two" />
          <span className="sign-up-dot sign-up-orb" />
          <span className="sign-up-dot sign-up-dot-four" />
          <div className="sign-up-float sign-up-float-left">
            <span className="sign-up-chip">Mathematics</span>
            <div className="sign-up-mini">
              <span className="sign-up-mini-mark" />
              <p>
                Academic core<small>Math · Science · English</small>
              </p>
            </div>
            <span className="sign-up-chip sign-up-chip-selected">English</span>
            <span className="sign-up-chip">College Support</span>
          </div>
          <div className="sign-up-float sign-up-float-right">
            <span className="sign-up-chip">SAT / ACT</span>
            <span className="sign-up-chip sign-up-chip-selected">Science</span>
            <div className="sign-up-mini">
              <span className="sign-up-mini-mark sign-up-mini-mark-navy" />
              <p>
                Academic support<small>Homework help · Study skills</small>
              </p>
            </div>
            <span className="sign-up-chip">Entrance exams</span>
          </div>
        </SignUpArtwork>
      </div>
    </div>
  );
}
