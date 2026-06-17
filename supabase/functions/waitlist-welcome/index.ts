import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_KEY = Deno.env.get('RESEND_API_KEY')!
const ADMIN_EMAIL = 'jncoutier@gmail.com'

const ROLE_LABELS: Record<string, string> = {
  entrepreneur: 'paysagiste',
  fournisseur:  'fournisseur / pépiniériste',
  moe:          'maître d\'œuvre',
}

serve(async (req) => {
  try {
    const payload = await req.json()
    const { prenom, email, role } = payload.record ?? payload
    if (!email) return new Response('skip', { status: 200 })

    const roleLabel = ROLE_LABELS[role] || role || 'utilisateur'
    const prenomAffiche = prenom || 'là'

    // Email de confirmation à l'inscrit
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Pivot <bonjour@pivotlaracine.com>',
        to: email,
        subject: 'Votre place est réservée — Pivot',
        html: `
          <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;color:#1C3A2A">
            <p style="font-size:1.3rem;font-weight:700;margin-bottom:4px">Pivot<span style="color:#B87333">.</span></p>
            <hr style="border:none;border-top:1px solid #E8E4DC;margin:16px 0 28px">
            <p style="font-size:1rem;margin-bottom:12px">Bonjour ${prenom || ''},</p>
            <p style="font-size:1rem;line-height:1.7;margin-bottom:16px">
              Votre place est réservée en tant que <strong>${roleLabel}</strong>.
            </p>
            <p style="font-size:1rem;line-height:1.7;margin-bottom:28px">
              Pivot ouvre dans quelques semaines. Vous serez parmi les premiers contactés avec un accès anticipé et un tarif fondateur.
            </p>
            <p style="font-size:0.95rem;line-height:1.7;color:#6B7280;margin-bottom:40px">
              En attendant, n'hésitez pas à partager Pivot autour de vous — chaque paysagiste, pépiniériste ou maître d'œuvre que vous invitez renforce la communauté qui va s'en servir.
            </p>
            <a href="https://pivotlaracine.com" style="display:inline-block;background:#1C3A2A;color:#FAFAF7;padding:12px 28px;border-radius:4px;text-decoration:none;font-weight:600;font-size:0.95rem">
              Voir pivotlaracine.com →
            </a>
            <p style="font-size:0.72rem;color:#9CA3AF;margin-top:40px;line-height:1.5">
              Pivot · pivotlaracine.com<br>
              Conçu par un paysagiste, pour des paysagistes.
            </p>
          </div>
        `
      })
    })

    // Notification admin
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Pivot <bonjour@pivotlaracine.com>',
        to: ADMIN_EMAIL,
        subject: `🎉 Nouvelle inscription waitlist — ${prenom || email} (${roleLabel})`,
        html: `<p>Nouvelle inscription :<br><strong>${prenom || '—'}</strong> · ${email} · ${roleLabel}</p>`
      })
    })

    return new Response('sent', { status: 200 })
  } catch (e) {
    return new Response(String(e), { status: 200 })
  }
})
