// 时间段：今天 / 本周 / 本月 / 全部 按钮和下面的“从…至…”联动；左右箭头往前往后翻。跟安卓版 DateRangeState 一样。
import { reactive } from 'vue'
import type { RangeKind } from '../data/model'
import { addDays, addMonths, dayOfWeek, daysBetween, firstOfMonth, lastOfMonth, maxDate, minDate, rangeOf, today } from '../data/model'

export type Step = 'DAY' | 'WEEK' | 'MONTH' | 'SPAN'
export const PRESETS: RangeKind[] = ['TODAY', 'WEEK', 'MONTH', 'ALL']

export function stepOf(f: string, t: string): Step {
  if (f === t) return 'DAY'
  if (dayOfWeek(f) === 1 && t === addDays(f, 6)) return 'WEEK'
  if (f.endsWith('-01') && t === lastOfMonth(f)) return 'MONTH'
  return 'SPAN'
}

export class DateRange {
  all = false
  fromDay: string
  toDay: string
  step: Step

  constructor(from: string | null, to: string | null) {
    if (!from || !to) {
      const [f, t] = rangeOf('MONTH')
      this.all = true
      this.fromDay = f!
      this.toDay = t!
      this.step = 'MONTH'
    } else {
      this.fromDay = from
      this.toDay = to
      this.step = stepOf(from, to)
    }
  }
  get from() {
    return this.all ? null : this.fromDay
  }
  get to() {
    return this.all ? null : this.toDay
  }
  matched(t = today()): RangeKind | null {
    if (this.all) return 'ALL'
    return PRESETS.find((k) => k !== 'ALL' && rangeOf(k, t)[0] === this.fromDay && rangeOf(k, t)[1] === this.toDay) ?? null
  }
  set(f: string, t: string, st: Step) {
    this.all = false
    this.fromDay = minDate(f, t)
    this.toDay = maxDate(f, t)
    this.step = st
  }
  choose(k: RangeKind, t = today()) {
    if (k === 'ALL') {
      this.all = true
      return
    }
    const [f, to] = rangeOf(k, t)
    this.set(f!, to!, stepOf(f!, to!))
  }
  shift(dir: number) {
    const f = this.fromDay
    const t = this.toDay
    switch (this.step) {
      case 'DAY':
        return this.set(addDays(f, dir), addDays(t, dir), 'DAY')
      case 'WEEK':
        return this.set(addDays(f, 7 * dir), addDays(t, 7 * dir), 'WEEK')
      case 'MONTH': {
        const m = firstOfMonth(addMonths(f, dir))
        return this.set(m, lastOfMonth(m), 'MONTH')
      }
      case 'SPAN': {
        const len = daysBetween(f, t) + 1
        return this.set(addDays(f, dir * len), addDays(t, dir * len), 'SPAN')
      }
    }
  }
}

export const useRange = (from: string | null, to: string | null) => reactive(new DateRange(from, to)) as DateRange
export function useRangeThisMonth() {
  const [f, t] = rangeOf('MONTH')
  return useRange(f, t)
}
