import { randomUUID } from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { db } from './db.js';

const habitColors = ['mint', 'coral', 'blue', 'gold'] as const;
const habitPrivacies = ['private', 'friends'] as const;
const habitWindowModes = ['fixed', 'random'] as const;
const habitInstanceStatuses = ['pending', 'done', 'snoozed', 'skipped'] as const;

type HabitColor = (typeof habitColors)[number];
type HabitPrivacy = (typeof habitPrivacies)[number];
type HabitWindowMode = (typeof habitWindowModes)[number];
type HabitInstanceStatus = (typeof habitInstanceStatuses)[number];

type HabitRecord = RowDataPacket & {
  id: string;
  name: string;
  description: string;
  color: HabitColor;
  privacy: HabitPrivacy;
  current_streak: number | null;
  best_streak: number | null;
  days_of_week: string | number[] | null;
  start_time: string | null;
  end_time: string | null;
  mode: HabitWindowMode | null;
};

type InstanceRecord = HabitRecord & {
  instance_id: string;
  habit_id: string;
  due_label: string;
  status: HabitInstanceStatus;
};

type HabitWindowRecord = RowDataPacket & {
  id: string;
  habit_id: string;
  days_of_week: string | number[];
  start_time: string;
  end_time: string | null;
  mode: HabitWindowMode;
};

const daysOfWeekSchema = z.array(z.number().int().min(0).max(6)).min(1).max(7);

export const createHabitSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).default(''),
  color: z.enum(habitColors).default('mint'),
  privacy: z.enum(habitPrivacies).default('private'),
  schedule: z.object({
    daysOfWeek: daysOfWeekSchema.default([0, 1, 2, 3, 4, 5, 6]),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    mode: z.enum(habitWindowModes).default('fixed'),
  }),
});

export type CreateHabitInput = z.infer<typeof createHabitSchema>;

export function serializeHabit(habit: HabitRecord) {
  return {
    id: habit.id,
    name: habit.name,
    description: habit.description,
    color: habit.color,
    streak: habit.current_streak ?? 0,
    bestStreak: habit.best_streak ?? 0,
    privacy: habit.privacy,
    schedule: {
      daysOfWeek: parseDaysOfWeek(habit.days_of_week),
      windowLabel: formatWindowLabel(habit),
      mode: habit.mode ?? 'fixed',
    },
  };
}

export function serializeInstance(instance: InstanceRecord) {
  return {
    id: instance.instance_id,
    habitId: instance.habit_id,
    dueLabel: instance.due_label,
    status: instance.status,
    habit: serializeHabit(instance),
  };
}

export async function listHabits(userId: string) {
  const [rows] = await db.execute<HabitRecord[]>(
    `
      SELECT
        h.id,
        h.name,
        h.description,
        h.color,
        h.privacy,
        s.current AS current_streak,
        s.best AS best_streak,
        hw.days_of_week,
        hw.start_time,
        hw.end_time,
        hw.mode
      FROM habits h
      LEFT JOIN streaks s ON s.habit_id = h.id
      LEFT JOIN habit_windows hw ON hw.habit_id = h.id
      WHERE h.user_id = :userId AND h.is_active = TRUE
      ORDER BY h.created_at ASC
    `,
    { userId }
  );

  return rows;
}

export async function createHabit(userId: string, input: CreateHabitInput) {
  const connection = await db.getConnection();
  const habitId = randomUUID();

  try {
    await connection.beginTransaction();

    await connection.execute(
      `
        INSERT INTO habits (id, user_id, name, description, color, privacy)
        VALUES (:id, :userId, :name, :description, :color, :privacy)
      `,
      {
        id: habitId,
        userId,
        name: input.name,
        description: input.description,
        color: input.color,
        privacy: input.privacy,
      }
    );

    await connection.execute(
      `
        INSERT INTO habit_windows (id, habit_id, days_of_week, start_time, end_time, mode)
        VALUES (:id, :habitId, :daysOfWeek, :startTime, :endTime, :mode)
      `,
      {
        id: randomUUID(),
        habitId,
        daysOfWeek: JSON.stringify(input.schedule.daysOfWeek),
        startTime: input.schedule.startTime,
        endTime: input.schedule.endTime ?? null,
        mode: input.schedule.mode,
      }
    );

    await connection.execute(
      `
        INSERT INTO streaks (id, habit_id)
        VALUES (:id, :habitId)
      `,
      { id: randomUUID(), habitId }
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const habit = await getHabitById(habitId, userId);

  if (!habit) {
    throw new Error('Created habit could not be loaded');
  }

  return habit;
}

export async function createTodayInstances(userId: string, now = new Date()) {
  const start = startOfDay(now);
  const end = addDays(start, 1);
  const dayOfWeek = now.getDay();
  const habits = await listHabits(userId);

  for (const habit of habits) {
    if (!parseDaysOfWeek(habit.days_of_week).includes(dayOfWeek) || !habit.start_time) {
      continue;
    }

    await db.execute<ResultSetHeader>(
      `
        INSERT IGNORE INTO habit_instances (id, habit_id, scheduled_at, due_label)
        VALUES (:id, :habitId, :scheduledAt, :dueLabel)
      `,
      {
        id: randomUUID(),
        habitId: habit.id,
        scheduledAt: toMySqlDateTime(start),
        dueLabel: formatDueLabel({
          start_time: habit.start_time,
          end_time: habit.end_time,
          mode: habit.mode ?? 'fixed',
        }),
      }
    );
  }

  return listTodayInstances(userId, start, end);
}

export async function checkInInstance(instanceId: string, userId: string) {
  const instance = await getInstanceById(instanceId, userId);

  if (!instance) {
    return null;
  }

  const wasAlreadyDone = instance.status === 'done';
  const checkedAt = new Date();
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute(
      `
        UPDATE habit_instances
        SET status = 'done', checked_at = :checkedAt
        WHERE id = :instanceId
      `,
      {
        checkedAt: toMySqlDateTime(checkedAt),
        instanceId,
      }
    );

    if (!wasAlreadyDone) {
      await connection.execute(
        `
          INSERT INTO streaks (id, habit_id, current, best, last_done_at)
          VALUES (:id, :habitId, 1, 1, :checkedAt)
          ON DUPLICATE KEY UPDATE
            current = current + 1,
            best = GREATEST(best, current + 1),
            last_done_at = VALUES(last_done_at)
        `,
        {
          id: randomUUID(),
          habitId: instance.habit_id,
          checkedAt: toMySqlDateTime(checkedAt),
        }
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return getInstanceById(instanceId, userId);
}

async function getHabitById(habitId: string, userId: string) {
  const [rows] = await db.execute<HabitRecord[]>(
    `
      SELECT
        h.id,
        h.name,
        h.description,
        h.color,
        h.privacy,
        s.current AS current_streak,
        s.best AS best_streak,
        hw.days_of_week,
        hw.start_time,
        hw.end_time,
        hw.mode
      FROM habits h
      LEFT JOIN streaks s ON s.habit_id = h.id
      LEFT JOIN habit_windows hw ON hw.habit_id = h.id
      WHERE h.id = :habitId AND h.user_id = :userId
      LIMIT 1
    `,
    { habitId, userId }
  );

  return rows[0] ?? null;
}

async function listTodayInstances(userId: string, start: Date, end: Date) {
  const [rows] = await db.execute<InstanceRecord[]>(
    `
      SELECT
        hi.id AS instance_id,
        hi.habit_id,
        hi.due_label,
        hi.status,
        h.id,
        h.name,
        h.description,
        h.color,
        h.privacy,
        s.current AS current_streak,
        s.best AS best_streak,
        hw.days_of_week,
        hw.start_time,
        hw.end_time,
        hw.mode
      FROM habit_instances hi
      INNER JOIN habits h ON h.id = hi.habit_id
      LEFT JOIN streaks s ON s.habit_id = h.id
      LEFT JOIN habit_windows hw ON hw.habit_id = h.id
      WHERE h.user_id = :userId
        AND hi.scheduled_at >= :start
        AND hi.scheduled_at < :end
      ORDER BY hi.scheduled_at ASC
    `,
    {
      userId,
      start: toMySqlDateTime(start),
      end: toMySqlDateTime(end),
    }
  );

  return rows;
}

async function getInstanceById(instanceId: string, userId: string) {
  const [rows] = await db.execute<InstanceRecord[]>(
    `
      SELECT
        hi.id AS instance_id,
        hi.habit_id,
        hi.due_label,
        hi.status,
        h.id,
        h.name,
        h.description,
        h.color,
        h.privacy,
        s.current AS current_streak,
        s.best AS best_streak,
        hw.days_of_week,
        hw.start_time,
        hw.end_time,
        hw.mode
      FROM habit_instances hi
      INNER JOIN habits h ON h.id = hi.habit_id
      LEFT JOIN streaks s ON s.habit_id = h.id
      LEFT JOIN habit_windows hw ON hw.habit_id = h.id
      WHERE hi.id = :instanceId AND h.user_id = :userId
      LIMIT 1
    `,
    { instanceId, userId }
  );

  return rows[0] ?? null;
}

function parseDaysOfWeek(value: unknown) {
  if (Array.isArray(value)) {
    const result = daysOfWeekSchema.safeParse(value);
    return result.success ? result.data : [];
  }

  if (typeof value === 'string') {
    try {
      const result = daysOfWeekSchema.safeParse(JSON.parse(value));
      return result.success ? result.data : [];
    } catch {
      return [];
    }
  }

  return [];
}

function formatWindowLabel(window: Pick<HabitRecord, 'start_time' | 'end_time'>) {
  if (!window.start_time) {
    return '';
  }

  return window.end_time ? `${window.start_time} - ${window.end_time}` : window.start_time;
}

function formatDueLabel(window: Pick<HabitWindowRecord, 'start_time' | 'end_time' | 'mode'>) {
  if (window.mode === 'random' && window.end_time) {
    return `Sugerido ${window.start_time} - ${window.end_time}`;
  }

  return window.end_time ? `Antes de ${window.end_time}` : window.start_time;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toMySqlDateTime(date: Date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}
