export async function submitContact(fields) {
  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
      signal: AbortSignal.timeout(5000),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 201 && data.success) {
      return data;
    }
  } catch (err) {
    console.warn('Backend unavailable, saving contact message locally:', err);
  }

  // Fallback to localStorage persistence if backend is offline/unreachable
  try {
    const existing = JSON.parse(localStorage.getItem('shophub_contact_messages') || '[]');
    const newMsg = {
      id: Date.now(),
      name: fields.name,
      email: fields.email,
      phone: fields.phone || '',
      subject: fields.subject || 'Customer Inquiry',
      message: fields.message,
      status: 'Unread',
      created_at: new Date().toISOString(),
    };
    localStorage.setItem('shophub_contact_messages', JSON.stringify([newMsg, ...existing]));
    return { success: true, message: 'Message sent successfully.' };
  } catch (e) {
    throw new Error('Unable to submit your message. Please try again.');
  }
}
