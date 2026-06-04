import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mister Abstract – Vacation Scheduler',
  description: 'Employee vacation and time-off management',
}

export default function VacationLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
