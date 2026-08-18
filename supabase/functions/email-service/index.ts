import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailRequest {
  template: 'welcome' | 'verify-email' | 'reset-password' | 'subscription-confirmation' | 'payment-receipt' | 'trial-ending' | 'contact-form';
  to: string;
  data: Record<string, string>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { template, to, data } = await req.json() as EmailRequest;

    if (!template || !to) {
      return new Response(JSON.stringify({ error: "Missing template or recipient" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { subject, html } = renderTemplate(template, data);

    // Send email via the configured email provider.
    // Falls back to a no-op (logging) when EMAIL_API_KEY is not set.
    const emailApiKey = Deno.env.get("EMAIL_API_KEY");
    const fromEmail = Deno.env.get("EMAIL_FROM") || "noreply@tayar.ai";
    const fromName = Deno.env.get("EMAIL_FROM_NAME") || "Tayar Intelligence";

    if (emailApiKey) {
      // Using a generic transactional email API (e.g. Resend, SendGrid, Postmark)
      const providerResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${emailApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: [to],
          subject,
          html,
        }),
      });

      if (!providerResponse.ok) {
        const errBody = await providerResponse.text();
        return new Response(JSON.stringify({ error: `Email provider error: ${errBody}` }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Development mode: log the email
      console.log(`[EMAIL] To: ${to} | Subject: ${subject}`);
      console.log(`[EMAIL] HTML length: ${html.length}`);
    }

    return new Response(JSON.stringify({ success: true, message: "Email queued" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function renderTemplate(template: string, data: Record<string, string>): { subject: string; html: string } {
  const templates: Record<string, { subject: string; html: (d: Record<string, string>) => string }> = {
    welcome: {
      subject: "Welcome to Tayar Intelligence Tools!",
      html: (d) => emailShell(`
        <h1 style="font-size:28px;font-weight:700;color:#fff;margin:0 0 16px;">Welcome to Tayar Intelligence, ${d.name || 'there'}!</h1>
        <p style="font-size:16px;color:#a0a0b8;line-height:1.6;margin:0 0 24px;">We are thrilled to have you on board. Tayar Intelligence Tools is your AI-powered workspace for creating CVs, writing content, translating documents, and much more.</p>
        <p style="font-size:16px;color:#a0a0b8;line-height:1.6;margin:0 0 24px;">Here is what you can do right now:</p>
        <ul style="color:#a0a0b8;font-size:15px;line-height:1.8;margin:0 0 24px;padding-left:20px;">
          <li>Build an ATS-friendly resume with the CV Builder</li>
          <li>Write cover letters, articles, and emails with AI Writer</li>
          <li>Translate documents into 100+ languages</li>
          <li>Analyze and summarize any document with Document AI</li>
        </ul>
        <a href="${d.appUrl || 'https://tayar.ai'}" style="display:inline-block;background:#8b5cf6;color:#fff;font-weight:600;padding:12px 32px;border-radius:12px;text-decoration:none;font-size:15px;">Get Started</a>
      `),
    },
    'verify-email': {
      subject: "Verify your email address",
      html: (d) => emailShell(`
        <h1 style="font-size:24px;font-weight:700;color:#fff;margin:0 0 16px;">Verify Your Email</h1>
        <p style="font-size:16px;color:#a0a0b8;line-height:1.6;margin:0 0 24px;">Hi ${d.name || 'there'}, please confirm your email address to secure your account.</p>
        <a href="${d.link || '#'}" style="display:inline-block;background:#8b5cf6;color:#fff;font-weight:600;padding:12px 32px;border-radius:12px;text-decoration:none;font-size:15px;">Verify Email</a>
        <p style="font-size:13px;color:#666;margin:24px 0 0;">Or copy this link: ${d.link || ''}</p>
      `),
    },
    'reset-password': {
      subject: "Reset your password",
      html: (d) => emailShell(`
        <h1 style="font-size:24px;font-weight:700;color:#fff;margin:0 0 16px;">Password Reset Request</h1>
        <p style="font-size:16px;color:#a0a0b8;line-height:1.6;margin:0 0 24px;">Hi ${d.name || 'there'}, we received a request to reset your password. Click the button below to set a new one.</p>
        <a href="${d.link || '#'}" style="display:inline-block;background:#8b5cf6;color:#fff;font-weight:600;padding:12px 32px;border-radius:12px;text-decoration:none;font-size:15px;">Reset Password</a>
        <p style="font-size:13px;color:#666;margin:24px 0 0;">If you did not request this, you can safely ignore this email.</p>
      `),
    },
    'subscription-confirmation': {
      subject: "Subscription Confirmed — Welcome to Pro!",
      html: (d) => emailShell(`
        <h1 style="font-size:24px;font-weight:700;color:#fff;margin:0 0 16px;">You are now on the ${d.plan || 'Pro'} Plan!</h1>
        <p style="font-size:16px;color:#a0a0b8;line-height:1.6;margin:0 0 24px;">Thank you for upgrading! You now have access to all 50+ AI tools, unlimited documents, and priority support.</p>
        <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:16px;margin:0 0 24px;">
          <p style="margin:0;color:#a0a0b8;font-size:14px;">Plan: <span style="color:#fff;font-weight:600;">${d.plan || 'Pro'}</span></p>
          <p style="margin:4px 0 0;color:#a0a0b8;font-size:14px;">Amount: <span style="color:#fff;font-weight:600;">${d.amount || ''}</span></p>
          <p style="margin:4px 0 0;color:#a0a0b8;font-size:14px;">Next billing: <span style="color:#fff;font-weight:600;">${d.nextBilling || ''}</span></p>
        </div>
        <a href="${d.appUrl || 'https://tayar.ai'}" style="display:inline-block;background:#8b5cf6;color:#fff;font-weight:600;padding:12px 32px;border-radius:12px;text-decoration:none;font-size:15px;">Start Using Pro</a>
      `),
    },
    'payment-receipt': {
      subject: `Payment Receipt — ${'$'}${'{amount}'}`,
      html: (d) => emailShell(`
        <h1 style="font-size:24px;font-weight:700;color:#fff;margin:0 0 16px;">Payment Receipt</h1>
        <p style="font-size:16px;color:#a0a0b8;line-height:1.6;margin:0 0 24px;">Thank you for your payment. Here is your receipt:</p>
        <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:20px;margin:0 0 24px;">
          <p style="margin:0 0 8px;color:#a0a0b8;font-size:14px;">Amount: <span style="color:#fff;font-weight:700;font-size:18px;">${d.amount || ''}</span></p>
          <p style="margin:0 0 8px;color:#a0a0b8;font-size:14px;">Date: <span style="color:#fff;">${d.date || ''}</span></p>
          <p style="margin:0 0 8px;color:#a0a0b8;font-size:14px;">Transaction ID: <span style="color:#fff;font-family:monospace;">${d.transactionId || ''}</span></p>
          <p style="margin:0;color:#a0a0b8;font-size:14px;">Plan: <span style="color:#fff;">${d.plan || ''}</span></p>
        </div>
        <p style="font-size:13px;color:#666;margin:0;">A copy of this receipt has been saved to your account.</p>
      `),
    },
    'trial-ending': {
      subject: "Your Pro trial ends soon",
      html: (d) => emailShell(`
        <h1 style="font-size:24px;font-weight:700;color:#fff;margin:0 0 16px;">Your Trial Ends in ${d.daysLeft || '3'} Days</h1>
        <p style="font-size:16px;color:#a0a0b8;line-height:1.6;margin:0 0 24px;">Hi ${d.name || 'there'}, your Pro trial is ending soon. Do not lose access to your AI tools, unlimited documents, and priority support.</p>
        <a href="${d.appUrl || 'https://tayar.ai'}#subscription" style="display:inline-block;background:#8b5cf6;color:#fff;font-weight:600;padding:12px 32px;border-radius:12px;text-decoration:none;font-size:15px;">Upgrade Now</a>
        <p style="font-size:13px;color:#666;margin:24px 0 0;">You will not be charged automatically. Upgrade anytime to keep your Pro features.</p>
      `),
    },
    'contact-form': {
      subject: `New Contact Form Message from ${'$'}${'{name}'}`,
      html: (d) => emailShell(`
        <h1 style="font-size:22px;font-weight:700;color:#fff;margin:0 0 16px;">New Contact Form Submission</h1>
        <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:16px;margin:0 0 24px;">
          <p style="margin:0 0 8px;color:#a0a0b8;font-size:14px;">From: <span style="color:#fff;font-weight:600;">${d.name || ''}</span></p>
          <p style="margin:0 0 8px;color:#a0a0b8;font-size:14px;">Email: <span style="color:#fff;">${d.email || ''}</span></p>
          ${d.subject ? `<p style="margin:0 0 8px;color:#a0a0b8;font-size:14px;">Subject: <span style="color:#fff;">${d.subject}</span></p>` : ''}
        </div>
        <p style="font-size:16px;color:#a0a0b8;line-height:1.6;margin:0 0 16px;">Message:</p>
        <div style="background:rgba(255,255,255,0.03);border-radius:12px;padding:16px;color:#a0a0b8;font-size:15px;line-height:1.6;">${d.message || ''}</div>
      `),
    },
  };

  const t = templates[template];
  if (!t) {
    return { subject: "Tayar Intelligence", html: emailShell(`<p style="color:#a0a0b8;">Unknown template</p>`) };
  }
  return { subject: t.subject, html: t.html(data) };
}

function emailShell(content: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#06060f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
      <div style="text-align:center;margin-bottom:32px;">
        <div style="display:inline-block;width:40px;height:40px;background:#8b5cf6;border-radius:12px;line-height:40px;text-align:center;color:#fff;font-weight:700;font-size:18px;">T</div>
        <p style="color:#fff;font-weight:700;font-size:16px;margin:8px 0 0;">Tayar Intelligence Tools</p>
      </div>
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:32px;">
        ${content}
      </div>
      <p style="text-align:center;color:#555;font-size:13px;margin:32px 0 0;">© ${new Date().getFullYear()} Tayar Intelligence. All rights reserved.</p>
      <p style="text-align:center;color:#444;font-size:12px;margin:8px 0 0;">You are receiving this email because you have an account at Tayar Intelligence Tools.</p>
    </div>
  </body></html>`;
}
