import { describe, it, expect, beforeEach } from 'vitest'
import * as svc from '../../src/modules/task/taskService'

let data: any

beforeEach(() => {
  data = { days: {} }
})

describe('taskService basic flows', () => {
  it('adds a task to a day', () => {
    const t = svc.addTask(data, '2026-02-03', { title: 'hello', category: 'general', priority: 'normal', description: '' })
    expect(t.id).toBeTruthy()
    expect(data.days['2026-02-03'].tasks.length).toBe(1)
  })

  it('updates a task and moves it to a new day when date changes', () => {
    const t = svc.addTask(data, '2026-02-03', { title: 'move me', category: 'general', priority: 'normal', description: '' })
    svc.updateTask(data, '2026-02-03', t.id, { date: '2026-02-05' })
    expect(data.days['2026-02-03'].tasks.find((x: any) => x.id === t.id)).toBeUndefined()
    expect(data.days['2026-02-05'].tasks.find((x: any) => x.id === t.id)).toBeTruthy()
  })

  it('deletes a task', () => {
    const t = svc.addTask(data, '2026-02-03', { title: 'to delete', category: 'general', priority: 'normal', description: '' })
    const removed = svc.deleteTask(data, '2026-02-03', t.id)
    expect(removed).toBeTruthy()
    expect(data.days['2026-02-03'].tasks.find((x: any) => x.id === t.id)).toBeUndefined()
  })
})
