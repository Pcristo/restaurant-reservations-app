export async function onRequestPost(context: any) {
  try {
    const body = await context.request.json();
    const { email, name, date, time, guests, restaurantName, resendApiKey, language, logoUrl, restaurantEmail, resendFromEmail, restaurantPhone, bookingNumber } = body;
    const apiKey = resendApiKey || context.env.RESEND_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No API key set, email skipped in debug mode'
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (!email) {
      return new Response(JSON.stringify({ success: false, error: 'Recipient email is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const logoHtml = logoUrl 
      ? `<div style="text-align: center; margin-bottom: 20px;">
          <img src="${logoUrl}" alt="${restaurantName}" style="max-height: 80px; max-width: 200px; object-fit: contain;" />
        </div>`
      : `<div style="text-align: center; margin-bottom: 20px;">
          <span style="font-size: 24px; font-weight: bold; color: #d97706; font-style: italic;">${restaurantName.charAt(0)}</span>
        </div>`;

    const isPt = language === 'pt';
    const subject = isPt 
      ? `Reserva Confirmada - ${restaurantName}` 
      : `Reservation Confirmed - ${restaurantName}`;

    const contactEmail = restaurantEmail || 'info@dinemaster.pro';

    const html = isPt ? `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; background-color: #ffffff;">
        ${logoHtml}
        <h1 style="color: #d97706; text-align: center; margin-top: 0;">Reserva Confirmada</h1>
        <p>Olá ${name},</p>
        <p>A sua mesa em <strong>${restaurantName}</strong> foi reservada com sucesso.</p>
        <div style="background-color: #fffbeb; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Data:</strong> ${date}</p>
          <p style="margin: 5px 0;"><strong>Hora:</strong> ${time}</p>
          <p style="margin: 5px 0;"><strong>Pessoas:</strong> ${guests}</p>
          ${bookingNumber ? `<p style="margin: 5px 0;"><strong>Número de Reserva:</strong> ${bookingNumber}</p>` : ''}
        </div>
        <p>Aguardamos a sua visita!</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #666; text-align: center; line-height: 1.6;">
          <strong>Por favor, não responda a este e-mail.</strong><br><br>
          Para qualquer dúvida ou alteração, por favor contacte-nos diretamente através do e-mail <a href="mailto:${contactEmail}" style="color: #d97706; text-decoration: none; font-weight: bold;">${contactEmail}</a> ou ligue para <strong>${restaurantPhone || ''}</strong>.<br><br>
          Se precisar de cancelar ou modificar a sua reserva, agradecíamos que nos contactasse com pelo menos <strong>24 horas de antecedência</strong>.
        </p>
        <p style="font-size: 11px; color: #999; text-align: center; margin-top: 10px;">
          Este é um e-mail de confirmação automático enviado por ${restaurantName}.
        </p>
      </div>
    ` : `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; background-color: #ffffff;">
        ${logoHtml}
        <h1 style="color: #d97706; text-align: center; margin-top: 0;">Reservation Confirmed</h1>
        <p>Hi ${name},</p>
        <p>Your table at <strong>${restaurantName}</strong> has been successfully booked.</p>
        <div style="background-color: #fffbeb; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Date:</strong> ${date}</p>
          <p style="margin: 5px 0;"><strong>Time:</strong> ${time}</p>
          <p style="margin: 5px 0;"><strong>Guests:</strong> ${guests}</p>
          ${bookingNumber ? `<p style="margin: 5px 0;"><strong>Booking Number:</strong> ${bookingNumber}</p>` : ''}
        </div>
        <p>We look forward to seeing you!</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #666; text-align: center; line-height: 1.6;">
          <strong>Please do not reply to this email.</strong><br><br>
          For any inquiries or changes, please contact us directly at <a href="mailto:${contactEmail}" style="color: #d97706; text-decoration: none; font-weight: bold;">${contactEmail}</a> or call <strong>${restaurantPhone || ''}</strong>.<br><br>
          If you need to cancel or modify your reservation, we would greatly appreciate it if you could contact us at least <strong>24 hours in advance</strong>.
        </p>
        <p style="font-size: 11px; color: #999; text-align: center; margin-top: 10px;">
          This is an automated confirmation email sent by ${restaurantName}.
        </p>
      </div>
    `;

    const rawFromEmail = resendFromEmail || context.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    
    let fromEmail = 'onboarding@resend.dev';
    let targetEmail = email;

    const lowerFrom = rawFromEmail.toLowerCase().trim();
    const isFreeOrOnboarding = 
       lowerFrom === 'onboarding@resend.dev' || 
       lowerFrom.includes('@gmail.com') || 
       lowerFrom.includes('@yahoo.') || 
       lowerFrom.includes('@hotmail.') || 
       lowerFrom.includes('@outlook.') ||
       lowerFrom.includes('@aol.') ||
       lowerFrom.includes('@icloud.');

    if (!isFreeOrOnboarding && rawFromEmail.includes('@')) {
      fromEmail = rawFromEmail;
    } else {
      fromEmail = 'onboarding@resend.dev';
      targetEmail = 'pedro.web.test@gmail.com';
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: targetEmail,
        subject,
        html
      })
    });
    
    const data = await res.json();
    if (!res.ok) {
       return new Response(JSON.stringify({ success: false, error: data }), { status: res.status, headers: { 'Content-Type': 'application/json' } });
    }
    
    return new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
