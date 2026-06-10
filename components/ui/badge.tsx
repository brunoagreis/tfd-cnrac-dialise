import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function normalizeBadgeText(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
}

function getBadgeText(children: React.ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children)
  }

  if (Array.isArray(children)) {
    return children.map(getBadgeText).join(' ')
  }

  return ''
}

function getJudicialBadgeTone(children: React.ReactNode) {
  const label = normalizeBadgeText(getBadgeText(children))

  if (!label) return ''

  if (
    label.includes('bloqueio') ||
    label.includes('sequestro') ||
    label.includes('devolvida') ||
    label.includes('devolvido')
  ) {
    return 'border-red-200 bg-red-100 text-red-800 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200'
  }

  if (label.includes('obito') || label === 'obito') {
    return 'border-zinc-300 bg-zinc-200 text-zinc-950 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100'
  }

  if (label.includes('arquivado') || label.includes('encerramento') || label.includes('encerrado')) {
    return 'border-slate-300 bg-slate-200 text-slate-900 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
  }

  if (label.includes('falta do paciente') || label.includes('falta paciente')) {
    return 'border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200'
  }

  if (
    label.includes('cumprimento') ||
    label.includes('cumprido') ||
    label.includes('resolvido') ||
    label.includes('resolvida')
  ) {
    return 'border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200'
  }

  if (label.includes('solicitacao de inclusao') || label.includes('inclusao solicitada')) {
    return 'border-orange-200 bg-orange-100 text-orange-800 hover:bg-orange-100 dark:border-orange-900/40 dark:bg-orange-950/40 dark:text-orange-200'
  }

  if (label.includes('agendamento') && !label.includes('envio')) {
    return 'border-violet-200 bg-violet-100 text-violet-800 hover:bg-violet-100 dark:border-violet-900/40 dark:bg-violet-950/40 dark:text-violet-200'
  }

  if (label.includes('envio') && label.includes('agendamento')) {
    return 'border-yellow-200 bg-yellow-100 text-yellow-900 hover:bg-yellow-100 dark:border-yellow-900/40 dark:bg-yellow-950/40 dark:text-yellow-200'
  }

  if (label.includes('descumprimento')) {
    return 'border-sky-200 bg-sky-100 text-sky-800 hover:bg-sky-100 dark:border-sky-900/40 dark:bg-sky-950/40 dark:text-sky-200'
  }

  if (label.includes('reiteracao') || label.includes('monitoramento')) {
    return 'border-blue-200 bg-blue-100 text-blue-800 hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-200'
  }

  if (label.includes('pendente') || label.includes('atribuido') || label.includes('atribuída')) {
    return 'border-stone-200 bg-stone-100 text-stone-800 hover:bg-stone-100 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-200'
  }

  return ''
}

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, children, ...props }: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant }), getJudicialBadgeTone(children), className)}
      {...props}
    >
      {children}
    </div>
  )
}

export { Badge, badgeVariants }
