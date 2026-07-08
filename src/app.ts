import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { pingDatabase } from './db.js';
import { checkInInstance, createHabit, createHabitSchema, createTodayInstances, listHabits, serializeHabit, serializeInstance } from './habits.js';
import { asyncRoute, errorHandler, HttpError } from './http.js';
import { getRequestUser } from './users.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({
    credentials: true,
    origin: (origin, callback) => {
      if (!origin || config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new HttpError(403, 'Origin not allowed by CORS'));
    },
  }));
  app.use(express.json());

  app.get('/', (_request, response) => {
    response.json({
      name: 'habitio-api',
      status: 'ok',
      endpoints: ['/health', '/health/db', '/habits', '/instances/today'],
    });
  });

  app.get('/health', (_request, response) => {
    response.json({
      status: 'ok',
      env: config.nodeEnv,
      uptime: Math.round(process.uptime()),
    });
  });

  app.get('/health/db', asyncRoute(async (_request, response) => {
    await pingDatabase();
    response.json({ status: 'ok' });
  }));

  app.get('/habits', asyncRoute(async (request, response) => {
    const user = await getRequestUser(request);
    const habits = await listHabits(user.id);

    response.json({ data: habits.map(serializeHabit) });
  }));

  app.post('/habits', asyncRoute(async (request, response) => {
    const user = await getRequestUser(request);
    const input = createHabitSchema.parse(request.body);
    const habit = await createHabit(user.id, input);

    response.status(201).json({ data: serializeHabit(habit) });
  }));

  app.get('/instances/today', asyncRoute(async (request, response) => {
    const user = await getRequestUser(request);
    const instances = await createTodayInstances(user.id);

    response.json({ data: instances.map(serializeInstance) });
  }));

  app.post('/instances/:id/checkin', asyncRoute(async (request, response) => {
    const user = await getRequestUser(request);
    const instanceId = request.params.id;

    if (typeof instanceId !== 'string') {
      throw new HttpError(400, 'Invalid habit instance id');
    }

    const instance = await checkInInstance(instanceId, user.id);

    if (!instance) {
      throw new HttpError(404, 'Habit instance not found');
    }

    response.json({ data: serializeInstance(instance) });
  }));

  app.use(errorHandler);

  return app;
}
