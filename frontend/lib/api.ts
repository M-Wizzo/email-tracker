export async function api(path: string, init: RequestInit = {}) {
  const base = process.env.NEXT_PUBLIC_API_BASE!;
  const key  = process.env.NEXT_PUBLIC_API_KEY!;
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { ...(init.headers||{}), "x-api-key": key }
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function post(path: string, body: any) {
  const base = process.env.NEXT_PUBLIC_API_BASE!;
  const key  = process.env.NEXT_PUBLIC_API_KEY!;
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
    },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}
