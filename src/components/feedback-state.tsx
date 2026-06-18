import Link from "next/link";
import type { ReactNode } from "react";

export function FeedbackState({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="feedback-state">
      <div className="feedback-mark" aria-hidden="true">V</div>
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
      {action ? <div className="feedback-actions">{action}</div> : null}
    </section>
  );
}

export function BackToCalendarAction() {
  return <Link className="button button-primary" href="/">Volver al calendario</Link>;
}
