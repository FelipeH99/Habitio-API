import type { Request } from 'express';
import { db } from './db.js';

const DEFAULT_DEV_USER_ID = 'dev-user';

export async function getRequestUser(request: Request) {
  const requestedUserId = request.header('x-user-id') ?? DEFAULT_DEV_USER_ID;

  await db.execute(
    `
      INSERT INTO users (id, email)
      VALUES (:id, :email)
      ON DUPLICATE KEY UPDATE id = id
    `,
    {
      id: requestedUserId,
      email: `${requestedUserId}@habitio.local`,
    }
  );

  await db.execute(
    `
      INSERT INTO profiles (id, user_id, display_name)
      VALUES (:id, :userId, :displayName)
      ON DUPLICATE KEY UPDATE id = id
    `,
    {
      id: `${requestedUserId}-profile`,
      userId: requestedUserId,
      displayName: 'Habitio Dev',
    }
  );

  return { id: requestedUserId };
}
