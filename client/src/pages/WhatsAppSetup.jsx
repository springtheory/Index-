import React from 'react';

export default function WhatsAppSetup() {
  return (
    <div>
      <div className="page-header">
        <h1>WhatsApp Integration</h1>
        <p>Manage your inventory via WhatsApp messages</p>
      </div>

      <div className="card" style={{ maxWidth: 640, marginBottom: 24 }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: 16 }}>How it works</h3>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 20 }}>
          Once set up, you can text your Index inventory via WhatsApp. Search for items, add new ones,
          move things around, and check what's in any bin &mdash; all from your phone without opening the app.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          <div style={{ padding: '12px 16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Search</div>
            <div style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>"Where's my drill?"</div>
          </div>
          <div style={{ padding: '12px 16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Add</div>
            <div style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>"I put a new hammer in Bin 5 in the garage"</div>
          </div>
          <div style={{ padding: '12px 16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Move</div>
            <div style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>"I moved the Christmas lights to the attic"</div>
          </div>
          <div style={{ padding: '12px 16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Remove</div>
            <div style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>"Remove the duct tape, I used it all"</div>
          </div>
          <div style={{ padding: '12px 16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>List</div>
            <div style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>"What's in Bin 1?"</div>
          </div>
          <div style={{ padding: '12px 16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Status</div>
            <div style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>"How much stuff do I have?"</div>
          </div>
        </div>

        <h3 style={{ fontSize: '1.05rem', marginBottom: 16 }}>Setup Instructions</h3>
        <ol style={{ color: 'var(--text-secondary)', lineHeight: 2, paddingLeft: 20, fontSize: '0.9rem' }}>
          <li>Create a <a href="https://www.twilio.com/try-twilio" target="_blank" rel="noreferrer">Twilio account</a> (free tier works)</li>
          <li>Activate the <strong>Twilio Sandbox for WhatsApp</strong> in your Twilio console</li>
          <li>Follow the Twilio sandbox instructions to connect your WhatsApp (send the join code)</li>
          <li>Copy your Twilio credentials to the <code>.env</code> file:
            <div style={{
              background: 'var(--bg-primary)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              marginTop: 8,
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              color: 'var(--accent)',
              lineHeight: 1.6,
            }}>
              TWILIO_ACCOUNT_SID=ACxxxxx<br />
              TWILIO_AUTH_TOKEN=xxxxx<br />
              TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
            </div>
          </li>
          <li>In Twilio, set the webhook URL for incoming messages to:<br />
            <code style={{ color: 'var(--accent)' }}>https://your-server.com/api/whatsapp/webhook</code>
          </li>
          <li>Restart the server and send "help" to your Twilio WhatsApp number</li>
        </ol>
      </div>

      <div className="card" style={{ maxWidth: 640, background: 'var(--accent-dim)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
        <h3 style={{ fontSize: '0.95rem', color: 'var(--accent)', marginBottom: 8 }}>Production Deployment</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.7 }}>
          For production use, apply for a Twilio WhatsApp Business number. This gives you a dedicated number
          that anyone can message without joining a sandbox. You can also set up multiple phone numbers
          for family members &mdash; they all connect to the same inventory.
        </p>
      </div>
    </div>
  );
}
