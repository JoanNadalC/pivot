import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FROM = 'Pivot <notifications@pivotlaracine.com>'

const SUBJECTS: Record<string, string> = {
  reponse_fournisseur:   '📬 Nouvelle réponse fournisseur — Pivot',
  demande_modification:  '🔓 Demande de modification de prix — Pivot',
  visa_moe:              '📋 Visa MOE rendu — Pivot',
  modification_autorisee:'✅ Modification autorisée — Pivot',
  nouvelle_consultation: '📩 Nouvelle consultation reçue — Pivot',
}

serve(async (req) => {
  try {
    const payload = await req.json()
    const notif = payload.record ?? payload
    if (!notif?.user_id || !notif?.message) return new Response('skip', { status: 200 })

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Chercher l'email dans les 3 tables de comptes
    let email: string | null = null
    let nom: string | null = null
    for (const table of ['compte_entrepreneur', 'compte_fournisseur', 'compte_moe']) {
      const { data } = await db.from(table).select('email, nom').eq('id', notif.user_id).maybeSingle()
      if (data?.email) { email = data.email; nom = data.nom; break }
    }
    if (!email) return new Response('no email', { status: 200 })

    const subject = SUBJECTS[notif.type] || 'Notification — Pivot'
    const salutation = nom ? `Bonjour ${nom.split(' ')[0]},` : 'Bonjour,'

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: email,
        subject,
        html: `
          <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;color:#1C3A2A">
            <p style="font-size:1.3rem;font-weight:700;margin-bottom:4px">Pivot<span style="color:#B87333">.</span></p>
            <hr style="border:none;border-top:1px solid #E8E4DC;margin:16px 0 28px">
            <p style="font-size:0.95rem;margin-bottom:8px">${salutation}</p>
            <p style="font-size:1rem;line-height:1.7;margin-bottom:28px">${notif.message}</p>
            <a href="https://pivotlaracine.com" style="display:inline-block;background:#1C3A2A;color:#FAFAF7;padding:12px 28px;border-radius:4px;text-decoration:none;font-weight:600;font-size:0.95rem">
              Ouvrir Pivot →
            </a>
            <p style="font-size:0.72rem;color:#9CA3AF;margin-top:40px;line-height:1.5">
              Pivot · pivotlaracine.com<br>
              Vous recevez cet email car vous avez un compte sur Pivot.
            </p>
          </div>
        `
      })
    })

    return new Response(res.ok ? 'sent' : 'resend error', { status: 200 })
  } catch (e) {
    return new Response(String(e), { status: 200 })
  }
})
