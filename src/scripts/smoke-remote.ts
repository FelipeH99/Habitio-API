const apiUrl = process.env.API_URL?.replace(/\/$/, '');
const userId = process.env.HABITIO_USER_ID ?? `smoke-${Date.now()}`;

if (!apiUrl) {
  console.error('Missing API_URL. Example: API_URL=https://your-api.example.com npm run smoke:remote');
  process.exit(1);
}

type Envelope<T> = {
  data: T;
};

type HabitInstance = {
  id: string;
  status: string;
};

async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-user-id': userId,
      ...init?.headers,
    },
  });
  const text = await response.text();
  const body = text ? (JSON.parse(text) as T) : undefined;

  if (!response.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${path} failed: ${response.status} ${text}`);
  }

  return body as T;
}

async function main() {
  const health = await request<{ status: string }>('/health');
  console.log(`health: ${health.status}`);

  const dbHealth = await request<{ status: string }>('/health/db');
  console.log(`database: ${dbHealth.status}`);

  const created = await request<Envelope<{ id: string }>>('/habits', {
    method: 'POST',
    body: JSON.stringify({
      name: `Smoke habit ${new Date().toISOString()}`,
      description: 'Remote deploy smoke test',
      color: 'mint',
      privacy: 'private',
      schedule: {
        daysOfWeek: [new Date().getDay()],
        startTime: '09:00',
        endTime: '11:00',
        mode: 'fixed',
      },
    }),
  });
  console.log(`created habit: ${created.data.id}`);

  const habits = await request<Envelope<Array<{ id: string }>>>('/habits');
  console.log(`habits: ${habits.data.length}`);

  const instances = await request<Envelope<HabitInstance[]>>('/instances/today');
  console.log(`today instances: ${instances.data.length}`);

  const instance = instances.data.find((item) => item.status !== 'done');

  if (instance) {
    const checked = await request<Envelope<HabitInstance>>(`/instances/${instance.id}/checkin`, {
      method: 'POST',
    });
    console.log(`checkin: ${checked.data.status}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
