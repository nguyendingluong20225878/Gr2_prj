import Link from 'next/link';
import { BarChart3, FileText, Lightbulb } from 'lucide-react';

type ProposalFlowStep = 'recommendation' | 'explanation' | 'scenario';

type ProposalFlowNavProps = {
  proposalId: string;
  activeStep: ProposalFlowStep;
};

const STEPS: Array<{
  key: ProposalFlowStep;
  label: string;
  href: (proposalId: string) => string;
  icon: typeof Lightbulb;
}> = [
  {
    key: 'recommendation',
    label: 'Khuyến nghị',
    href: (proposalId) => `/proposal/${proposalId}`,
    icon: Lightbulb,
  },
  {
    key: 'explanation',
    label: 'Giải thích',
    href: (proposalId) => `/proposal/${proposalId}/explanation`,
    icon: FileText,
  },
  {
    key: 'scenario',
    label: 'Kịch bản & Trade Demo',
    href: (proposalId) => `/proposal/${proposalId}/scenario`,
    icon: BarChart3,
  },
];

export function ProposalFlowNav({ activeStep, proposalId }: ProposalFlowNavProps) {
  return (
    <nav aria-label="Proposal flow" className="glass-card overflow-x-auto rounded-xl border border-white/5 bg-black/20 p-2">
      <ol className="flex min-w-max items-center gap-2">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const active = step.key === activeStep;

          return (
            <li key={step.key} className="flex items-center gap-2">
              <Link
                href={step.href(proposalId)}
                aria-current={active ? 'step' : undefined}
                className={[
                  'inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
                  active
                    ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.12)]'
                    : 'border-white/5 bg-white/[0.03] text-slate-400 hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-100',
                ].join(' ')}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{step.label}</span>
              </Link>
              {index < STEPS.length - 1 ? <span className="h-px w-5 bg-white/10" aria-hidden="true" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
