import { ReactNode } from 'react';

interface CardProps {
  id?: string;
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}

export function Card({ id, title, description, children, action }: CardProps) {
  return (
    <section id={id} className="rounded-2xl border border-white/5 bg-surface/80 p-6 shadow-card">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          {description && <p className="text-sm text-white/60">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}
