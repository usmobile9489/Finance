import { HebrewCalendar, flags, type CalOptions } from '@hebcal/core'

export interface JewishHoliday {
  date: string // YYYY-MM-DD
  name: string
  hebrew: string
  isYomTov: boolean // work-prohibited holiday
}

export function getJewishHolidays(year: number): JewishHoliday[] {
  const options: CalOptions = {
    year,
    isHebrewYear: false,
    sedrot: false,
    omer: false,
    il: false, // diaspora (2-day holidays)
    candlelighting: false,
    noHolidays: false,
  }

  const events = HebrewCalendar.calendar(options)
  const holidays: JewishHoliday[] = []

  for (const ev of events) {
    const mask = ev.getFlags()
    const isYomTov = !!(mask & (flags.YOM_TOV_ENDS | flags.CHAG))
    const name = ev.render('en')
    const hd = ev.getDate()
    const greg = hd.greg()
    const dateStr = greg.toISOString().split('T')[0]

    holidays.push({
      date: dateStr,
      name,
      hebrew: ev.renderBrief('he'),
      isYomTov,
    })
  }

  return holidays
}

export function getHolidaysForRange(startYear: number, endYear: number): JewishHoliday[] {
  const all: JewishHoliday[] = []
  for (let y = startYear; y <= endYear; y++) {
    all.push(...getJewishHolidays(y))
  }
  return all
}

export function isJewishHoliday(dateStr: string, holidays: JewishHoliday[]): JewishHoliday | null {
  return holidays.find(h => h.date === dateStr) ?? null
}

export function isYomTov(dateStr: string, holidays: JewishHoliday[]): boolean {
  const h = isJewishHoliday(dateStr, holidays)
  return h?.isYomTov ?? false
}

export function countWorkingDays(
  startDate: Date,
  endDate: Date,
  holidays: JewishHoliday[],
  hoursPerDay: number = 8
): { days: number; hours: number } {
  let days = 0
  const cur = new Date(startDate)
  cur.setHours(0, 0, 0, 0)
  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)

  while (cur <= end) {
    const dow = cur.getDay()
    const dateStr = cur.toISOString().split('T')[0]
    const isWeekend = dow === 0 || dow === 6
    const isHoliday = isYomTov(dateStr, holidays)
    if (!isWeekend && !isHoliday) {
      days++
    }
    cur.setDate(cur.getDate() + 1)
  }

  return { days, hours: days * hoursPerDay }
}
