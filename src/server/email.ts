import { Resend } from "resend";
import { format, subDays, parseISO, isPast } from "date-fns";
import { toDate, formatInTimeZone } from "date-fns-tz";

export interface EmailOptions {
  email: string;
  name: string;
  date: string;
  time: string;
  guests: number;
  restaurantName: string;
  resendApiKey?: string;
  language?: string;
  logoUrl?: string;
  restaurantEmail?: string;
  resendFromEmail?: string;
  restaurantPhone?: string;
  bookingNumber?: string;
  restaurantAddress?: string;
  timezone?: string;
  table?: string;
  reservationId?: string;
  cancelUrl?: string;
  modifyUrl?: string;
  viewUrl?: string;
}

const getResendClient = (apiKey?: string) => {
  const rawKey = (apiKey || process.env.RESEND_API_KEY || '').trim();
  if (
    !rawKey ||
    rawKey === 'undefined' ||
    rawKey === 'null' ||
    rawKey === 'your-resend-api-key' ||
    rawKey === 'MY_RESEND_API_KEY'
  ) {
    return null;
  }
  return new Resend(rawKey);
};

const getFromEmail = (rawFromEmail?: string, restaurantName?: string) => {
  const fromEnv = (rawFromEmail || process.env.RESEND_FROM_EMAIL || '').trim();
  const name = (restaurantName || 'Restaurante').replace(/[<>]/g, '').trim();

  if (fromEnv) {
    if (fromEnv.includes('<') && fromEnv.includes('>')) {
      return fromEnv;
    }
    if (fromEnv.includes('@')) {
      return `${name} <${fromEnv}>`;
    }
  }

  return `${name} <onboarding@resend.dev>`;
};

const getTargetEmail = (email: string) => {
  return (email || '').trim();
};

// Generates Schema.org JSON-LD for FoodEstablishmentReservation
const generateSchemaMarkup = (opts: EmailOptions, status: 'ReservationConfirmed' | 'ReservationCancelled') => {
  // We need to construct a proper ISO8601 startTime
  // Assuming date is YYYY-MM-DD and time is HH:mm
  const timezone = opts.timezone || 'UTC';
  let startTime = `${opts.date}T${opts.time}:00`;
  try {
     const dateObj = toDate(`${opts.date}T${opts.time}:00`, { timeZone: timezone });
     startTime = dateObj.toISOString();
  } catch (e) {
     // fallback
  }

  const schema = {
    "@context": "http://schema.org",
    "@type": "FoodEstablishmentReservation",
    "reservationNumber": opts.bookingNumber || opts.reservationId || "N/A",
    "reservationStatus": `http://schema.org/${status}`,
    "underName": {
      "@type": "Person",
      "name": opts.name
    },
    "reservationFor": {
      "@type": "FoodEstablishment",
      "name": opts.restaurantName,
      "address": {
        "@type": "PostalAddress",
        "streetAddress": opts.restaurantAddress || "N/A"
      },
      "telephone": opts.restaurantPhone || ""
    },
    "startTime": startTime,
    "partySize": opts.guests
  };
  
  if (opts.viewUrl) {
    (schema as any).modifyReservationUrl = opts.viewUrl;
  }
  
  return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
};

const getBaseHtml = (opts: EmailOptions, title: string, content: string, status: 'ReservationConfirmed' | 'ReservationCancelled') => {
  const logoHtml = opts.logoUrl
    ? `<div style="text-align: center; margin-bottom: 20px;">
         <img src="${opts.logoUrl}" alt="${opts.restaurantName}" style="max-height: 80px; max-width: 200px; object-fit: contain;" />
       </div>`
    : `<div style="text-align: center; margin-bottom: 20px;">
         <span style="font-size: 24px; font-weight: bold; color: #d97706; font-style: italic;">${opts.restaurantName.charAt(0)}</span>
       </div>`;

  const contactEmail = opts.restaurantEmail || 'rnortada@sapo.pt';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      ${generateSchemaMarkup(opts, status)}
    </head>
    <body>
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; background-color: #ffffff;">
        ${logoHtml}
        <h1 style="color: #d97706; text-align: center; margin-top: 0;">${title}</h1>
        ${content}
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #666; text-align: center; line-height: 1.6;">
          <strong>${opts.language === 'pt' ? 'Por favor, não responda a este email.' : 'Please do not reply to this email.'}</strong><br><br>
          ${opts.language === 'pt' 
            ? `Para quaisquer questões ou alterações, por favor contacte-nos diretamente através de <a href="mailto:${contactEmail}" style="color: #d97706; text-decoration: none; font-weight: bold;">${contactEmail}</a> ou ligue <strong>${opts.restaurantPhone || '+351 21 929 1516'}</strong>.`
            : `For any inquiries or changes, please contact us directly at <a href="mailto:${contactEmail}" style="color: #d97706; text-decoration: none; font-weight: bold;">${contactEmail}</a> or call <strong>${opts.restaurantPhone || '+351 21 929 1516'}</strong>.`}<br><br>
        </p>
        <p style="font-size: 11px; color: #999; text-align: center; margin-top: 10px;">
          ${opts.language === 'pt' ? 'Este é um email automatizado enviado pela Nortada.' : 'This is an automated email sent by Nortada.'}
        </p>
      </div>
    </body>
    </html>
  `;
};

export const sendReservationConfirmation = async (opts: EmailOptions) => {
  const resend = getResendClient(opts.resendApiKey);
  if (!resend) return { success: true, message: 'No API key set, email skipped in debug mode' };

  const isPt = opts.language === 'pt';
  const title = isPt ? 'Reserva Confirmada' : 'Reservation Confirmed';
  
  let buttonsHtml = '';
  if (opts.viewUrl) {
    buttonsHtml += `<a href="${opts.viewUrl}" style="display: inline-block; padding: 10px 20px; margin: 5px; background-color: #d97706; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">${isPt ? 'Ver Reserva' : 'View Reservation'}</a>`;
  }

  const content = `
    <p>${isPt ? 'Olá' : 'Hi'} ${opts.name},</p>
    <p>${isPt ? 'A sua mesa em' : 'Your table at'} <strong>${opts.restaurantName}</strong> ${isPt ? 'foi reservada com sucesso.' : 'has been successfully booked.'}</p>
    <div style="background-color: #fffbeb; padding: 20px; border-radius: 10px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>${isPt ? 'Data' : 'Date'}:</strong> ${opts.date}</p>
      <p style="margin: 5px 0;"><strong>${isPt ? 'Hora' : 'Time'}:</strong> ${opts.time}</p>
      <p style="margin: 5px 0;"><strong>${isPt ? 'Pessoas' : 'Guests'}:</strong> ${opts.guests}</p>
      ${opts.table ? `<p style="margin: 5px 0;"><strong>${isPt ? 'Mesa' : 'Table'}:</strong> ${opts.table}</p>` : ''}
      ${opts.bookingNumber ? `<p style="margin: 5px 0;"><strong>${isPt ? 'Número de Reserva' : 'Reservation'}:</strong> #${opts.bookingNumber}</p>` : ''}
    </div>
    ${buttonsHtml ? `<div style="text-align: center; margin-top: 20px;">${buttonsHtml}</div>` : ''}
    <p>${isPt ? 'Aguardamos a sua visita!' : 'We look forward to seeing you!'}</p>
  `;

  const html = getBaseHtml(opts, title, content, 'ReservationConfirmed');
  const fromEmail = getFromEmail(opts.resendFromEmail, opts.restaurantName);
  const toEmail = getTargetEmail(opts.email);

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `${title} - ${opts.restaurantName}`,
      html,
    });
    
    if (error) {
      const errMsg = error.message || (error as any).name || 'Failed to send confirmation email';
      const isAuthError = (error as any).name === 'validation_error' || errMsg.toLowerCase().includes('api key') || (error as any).statusCode === 401;
      if (isAuthError) {
        console.warn(`[Email Service] Confirmation email skipped (API key not authorized or invalid: ${errMsg})`);
      } else {
        console.error('[Email Service] Confirmation email error:', errMsg);
      }
      return { success: false, error: errMsg, isAuthError };
    }
    return { success: true, messageId: data?.id };
  } catch (err: any) {
    const errMsg = err?.message || (typeof err === 'string' ? err : 'Unknown confirmation email error');
    const isAuthError = err?.name === 'validation_error' || errMsg.toLowerCase().includes('api key') || err?.statusCode === 401;
    if (isAuthError) {
      console.warn(`[Email Service] Confirmation email skipped (API key not authorized or invalid: ${errMsg})`);
    } else {
      console.error('[Email Service] Unexpected confirmation error:', errMsg);
    }
    return { success: false, error: errMsg, isAuthError };
  }
};

const isTodayReservation = (opts: EmailOptions): boolean => {
  const timezone = opts.timezone || 'Europe/Lisbon';
  const todayStr = formatInTimeZone(new Date(), timezone, 'yyyy-MM-dd');
  
  if (!opts.date) return false;
  
  let resDateStr = opts.date.trim().split('T')[0];
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(resDateStr)) {
    return resDateStr === todayStr;
  }
  
  try {
    const parsed = new Date(opts.date);
    if (!isNaN(parsed.getTime())) {
      const formatted = formatInTimeZone(parsed, timezone, 'yyyy-MM-dd');
      return formatted === todayStr;
    }
  } catch (e) {
    // fallback
  }
  return false;
};

export const sendReservationReminder = async (opts: EmailOptions) => {
  const resend = getResendClient(opts.resendApiKey);
  if (!resend) return { success: true, message: 'No API key set, email skipped in debug mode' };

  const isPt = opts.language === 'pt';
  const isToday = isTodayReservation(opts);

  const title = isPt
    ? (isToday ? 'A sua reserva é hoje' : 'A sua reserva é amanhã')
    : (isToday ? 'Your reservation is today' : 'Your reservation is tomorrow');

  const dayWord = isPt
    ? (isToday ? 'hoje' : 'amanhã')
    : (isToday ? 'today' : 'tomorrow');
  
  let buttonsHtml = '';
  if (opts.viewUrl) {
    buttonsHtml += `<a href="${opts.viewUrl}" style="display: inline-block; padding: 10px 20px; margin: 5px; background-color: #d97706; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">${isPt ? 'Ver Reserva' : 'View Reservation'}</a>`;
  }
  if (opts.cancelUrl) {
    buttonsHtml += `<a href="${opts.cancelUrl}" style="display: inline-block; padding: 10px 20px; margin: 5px; background-color: #ef4444; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">${isPt ? 'Cancelar' : 'Cancel Reservation'}</a>`;
  }

  const content = `
    <p>${isPt ? 'Olá' : 'Hi'} ${opts.name},</p>
    <p>${isPt ? 'Este é um lembrete da sua reserva em' : 'This is a reminder that you have a reservation at'} <strong>${opts.restaurantName}</strong> ${dayWord}.</p>
    <div style="background-color: #fffbeb; padding: 20px; border-radius: 10px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>${isPt ? 'Data' : 'Date'}:</strong> ${opts.date}</p>
      <p style="margin: 5px 0;"><strong>${isPt ? 'Hora' : 'Time'}:</strong> ${opts.time}</p>
      <p style="margin: 5px 0;"><strong>${isPt ? 'Pessoas' : 'Guests'}:</strong> ${opts.guests}</p>
      ${opts.bookingNumber ? `<p style="margin: 5px 0;"><strong>${isPt ? 'Número de Reserva' : 'Reservation'}:</strong> #${opts.bookingNumber}</p>` : ''}
    </div>
    ${buttonsHtml ? `<div style="text-align: center; margin-top: 20px;">${buttonsHtml}</div>` : ''}
    <p>${isPt ? 'Aguardamos a sua visita!' : 'We look forward to seeing you!'}</p>
  `;

  const html = getBaseHtml(opts, title, content, 'ReservationConfirmed');
  const fromEmail = getFromEmail(opts.resendFromEmail, opts.restaurantName);
  const toEmail = getTargetEmail(opts.email);
  
  // Calculate schedule time (1 day before)
  const timezone = opts.timezone || 'UTC';
  const resDate = toDate(`${opts.date}T${opts.time}:00`, { timeZone: timezone });
  let scheduledAt: string | undefined;
  
  const reminderTime = subDays(resDate, 1);
  if (!isPast(reminderTime)) {
    // scheduled_at
  }

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `${title} - ${opts.restaurantName}`,
      html,
    });
    
    if (error) {
      const errMsg = error.message || (error as any).name || 'Failed to send reminder email';
      const isAuthError = (error as any).name === 'validation_error' || errMsg.toLowerCase().includes('api key') || (error as any).statusCode === 401;
      if (isAuthError) {
        console.warn(`[Email Service] Reminder email skipped (API key not authorized or invalid: ${errMsg})`);
      } else {
        console.error('[Email Service] Reminder email error:', errMsg);
      }
      return { success: false, error: errMsg, isAuthError };
    }
    return { success: true, messageId: data?.id };
  } catch (err: any) {
    const errMsg = err?.message || (typeof err === 'string' ? err : 'Unknown reminder email error');
    const isAuthError = err?.name === 'validation_error' || errMsg.toLowerCase().includes('api key') || err?.statusCode === 401;
    if (isAuthError) {
      console.warn(`[Email Service] Reminder email skipped (API key not authorized or invalid: ${errMsg})`);
    } else {
      console.error('[Email Service] Unexpected reminder error:', errMsg);
    }
    return { success: false, error: errMsg, isAuthError };
  }
};

export const sendReservationCancellation = async (opts: EmailOptions) => {
  const resend = getResendClient(opts.resendApiKey);
  if (!resend) return { success: true, message: 'No API key set, email skipped in debug mode' };

  const isPt = opts.language === 'pt';
  const title = isPt ? 'Reserva Cancelada' : 'Reservation Cancelled';
  
  const content = `
    <p>${isPt ? 'Olá' : 'Hi'} ${opts.name},</p>
    <p>${isPt ? 'A sua reserva em' : 'Your reservation at'} <strong>${opts.restaurantName}</strong> ${isPt ? 'foi cancelada' : 'has been cancelled'}.</p>
    <div style="background-color: #fef2f2; padding: 20px; border-radius: 10px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>${isPt ? 'Data' : 'Date'}:</strong> ${opts.date}</p>
      <p style="margin: 5px 0;"><strong>${isPt ? 'Hora' : 'Time'}:</strong> ${opts.time}</p>
      <p style="margin: 5px 0;"><strong>${isPt ? 'Pessoas' : 'Guests'}:</strong> ${opts.guests}</p>
    </div>
  `;

  const html = getBaseHtml(opts, title, content, 'ReservationCancelled');
  const fromEmail = getFromEmail(opts.resendFromEmail, opts.restaurantName);
  const toEmail = getTargetEmail(opts.email);

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `${title} - ${opts.restaurantName}`,
      html,
    });
    
    if (error) {
      const errMsg = error.message || (error as any).name || 'Failed to send cancellation email';
      const isAuthError = (error as any).name === 'validation_error' || errMsg.toLowerCase().includes('api key') || (error as any).statusCode === 401;
      if (isAuthError) {
        console.warn(`[Email Service] Cancellation email skipped (API key not authorized or invalid: ${errMsg})`);
      } else {
        console.error('[Email Service] Cancellation email error:', errMsg);
      }
      return { success: false, error: errMsg, isAuthError };
    }
    return { success: true, messageId: data?.id };
  } catch (err: any) {
    const errMsg = err?.message || (typeof err === 'string' ? err : 'Unknown cancellation email error');
    const isAuthError = err?.name === 'validation_error' || errMsg.toLowerCase().includes('api key') || err?.statusCode === 401;
    if (isAuthError) {
      console.warn(`[Email Service] Cancellation email skipped (API key not authorized or invalid: ${errMsg})`);
    } else {
      console.error('[Email Service] Unexpected cancellation error:', errMsg);
    }
    return { success: false, error: errMsg, isAuthError };
  }
};

export const sendReservationUpdate = async (opts: EmailOptions) => {
  const resend = getResendClient(opts.resendApiKey);
  if (!resend) return { success: true, message: 'No API key set, email skipped in debug mode' };

  const isPt = opts.language === 'pt';
  const title = isPt ? 'Reserva Atualizada' : 'Reservation Updated';
  
  let buttonsHtml = '';
  if (opts.viewUrl) {
    buttonsHtml += `<a href="${opts.viewUrl}" style="display: inline-block; padding: 10px 20px; margin: 5px; background-color: #d97706; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">${isPt ? 'Ver Reserva' : 'View Reservation'}</a>`;
  }

  const content = `
    <p>${isPt ? 'Olá' : 'Hi'} ${opts.name},</p>
    <p>${isPt ? 'A sua reserva em' : 'Your reservation at'} <strong>${opts.restaurantName}</strong> ${isPt ? 'foi atualizada com os seguintes detalhes:' : 'has been updated with the following details:'}</p>
    <div style="background-color: #fffbeb; padding: 20px; border-radius: 10px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>${isPt ? 'Data' : 'Date'}:</strong> ${opts.date}</p>
      <p style="margin: 5px 0;"><strong>${isPt ? 'Hora' : 'Time'}:</strong> ${opts.time}</p>
      <p style="margin: 5px 0;"><strong>${isPt ? 'Pessoas' : 'Guests'}:</strong> ${opts.guests}</p>
      ${opts.bookingNumber ? `<p style="margin: 5px 0;"><strong>${isPt ? 'Número de Reserva' : 'Reservation'}:</strong> #${opts.bookingNumber}</p>` : ''}
    </div>
    ${buttonsHtml ? `<div style="text-align: center; margin-top: 20px;">${buttonsHtml}</div>` : ''}
  `;

  const html = getBaseHtml(opts, title, content, 'ReservationConfirmed');
  const fromEmail = getFromEmail(opts.resendFromEmail, opts.restaurantName);
  const toEmail = getTargetEmail(opts.email);

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `${title} - ${opts.restaurantName}`,
      html,
    });
    
    if (error) {
      const errMsg = error.message || (error as any).name || 'Failed to send update email';
      const isAuthError = (error as any).name === 'validation_error' || errMsg.toLowerCase().includes('api key') || (error as any).statusCode === 401;
      if (isAuthError) {
        console.warn(`[Email Service] Update email skipped (API key not authorized or invalid: ${errMsg})`);
      } else {
        console.error('[Email Service] Update email error:', errMsg);
      }
      return { success: false, error: errMsg, isAuthError };
    }
    return { success: true, messageId: data?.id };
  } catch (err: any) {
    const errMsg = err?.message || (typeof err === 'string' ? err : 'Unknown update email error');
    const isAuthError = err?.name === 'validation_error' || errMsg.toLowerCase().includes('api key') || err?.statusCode === 401;
    if (isAuthError) {
      console.warn(`[Email Service] Update email skipped (API key not authorized or invalid: ${errMsg})`);
    } else {
      console.error('[Email Service] Unexpected update error:', errMsg);
    }
    return { success: false, error: errMsg, isAuthError };
  }
};

export const sendTestEmail = async (opts: {
  email: string;
  resendApiKey?: string;
  resendFromEmail?: string;
  restaurantName?: string;
  language?: string;
}) => {
  const resend = getResendClient(opts.resendApiKey);
  if (!resend) {
    return { success: false, error: 'Resend API key is missing or not configured.' };
  }
  const isPt = opts.language === 'pt';
  const name = opts.restaurantName || 'Nortada';
  const title = isPt ? 'Email de Teste' : 'Test Email';
  const fromEmail = getFromEmail(opts.resendFromEmail, name);
  const toEmail = getTargetEmail(opts.email);

  if (!toEmail) {
    return { success: false, error: 'Recipient email address is required.' };
  }

  const content = `
    <p>${isPt ? 'Olá!' : 'Hello!'}</p>
    <p>${isPt ? `Este é um email de teste enviado pelo sistema de reservas do <strong>${name}</strong>.` : `This is a test email sent from the <strong>${name}</strong> reservation management system.`}</p>
    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 8px; margin: 20px 0; color: #166534;">
      <strong>✓ ${isPt ? 'Configuração Resend Validada com Sucesso!' : 'Resend Configuration Successfully Validated!'}</strong>
      <p style="margin: 5px 0 0 0; font-size: 13px;">${isPt ? 'O seu serviço de envio de emails está operacional e pronto para enviar confirmações, lembretes e cancelamentos.' : 'Your email delivery service is operational and ready to send confirmations, reminders, and cancellations.'}</p>
    </div>
  `;

  const html = getBaseHtml({
    email: toEmail,
    name: 'Admin',
    date: new Date().toISOString().split('T')[0],
    time: '12:00',
    guests: 2,
    restaurantName: name,
    language: opts.language,
  } as any, title, content, 'ReservationConfirmed');

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: `${title} - ${name}`,
      html,
    });

    if (error) {
      const errMsg = error.message || (error as any).name || 'Failed to send test email';
      return { success: false, error: errMsg };
    }
    return { success: true, messageId: data?.id };
  } catch (err: any) {
    const errMsg = err?.message || (typeof err === 'string' ? err : 'Unknown error');
    return { success: false, error: errMsg };
  }
};
