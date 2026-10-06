export async function requestProfile(token, { fields, signal } = {}) {
  if (!token) throw Object.assign(new Error('Please sign in to update your profile.'), { status: 401 });
  const response = await fetch('/api/auth/me', {
    method: fields ? 'PATCH' : 'GET', signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(fields ? { body: JSON.stringify(fields) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success || !data.user) throw Object.assign(new Error(data.message || 'Profile service is unavailable. Please try again.'), { status: response.status });
  return data.user;
}
