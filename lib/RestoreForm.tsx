'use client';
import { useState } from 'react';
import { restorePurchase } from './entitlement';

// "Already paid? Restore" : read-only Stripe check by purchase email; the email is not stored or logged.
export default function RestoreForm({ onRestored }: { onRestored: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  if (!open) return <p className="meta">Already paid? <button type="button" className="linkish" onClick={() => setOpen(true)}>Restore your purchase</button></p>;
  return (
    <form className="restore" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setMsg('');
      const r = await restorePurchase(email);
      setBusy(false);
      if (r === 'restored') { setMsg('Purchase restored.'); onRestored(); }
      else if (r === 'none') setMsg('No paid purchase found for that email.');
      else if (r === 'bad') setMsg('Enter the email you paid with.');
      else setMsg('Could not check right now. Try again later.');
    }}>
      <label htmlFor="restore-email" className="meta">Email you paid with</label>
      <input id="restore-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '8px 10px', margin: '6px 0', font: 'inherit' }} />
      <button type="submit" className="btn" disabled={busy}>{busy ? 'Checking...' : 'Restore'}</button>
      {msg ? <p className="meta" role="status" aria-live="polite">{msg}</p> : null}
    </form>
  );
}
