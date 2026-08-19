export interface SendSmsPayload {
  phoneNumber: string;
  code: string;
  restaurantName?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioPhoneNumber?: string;
}

export async function sendSmsViaTwilio(payload: SendSmsPayload, env: Record<string, any> = {}): Promise<{ success: boolean; sid?: string; error?: string; status?: number; simulated?: boolean }> {
  const { phoneNumber, code, restaurantName } = payload;

  if (!phoneNumber || !code) {
    return {
      success: false,
      error: 'Phone number and verification code are required.',
      status: 400
    };
  }

  const accountSid = (payload.twilioAccountSid || env.TWILIO_ACCOUNT_SID || '').trim();
  const authToken = (payload.twilioAuthToken || env.TWILIO_AUTH_TOKEN || '').trim();
  const twilioPhone = (payload.twilioPhoneNumber || env.TWILIO_PHONE_NUMBER || '').trim();

  if (!accountSid || !authToken || !twilioPhone) {
    return {
      success: false,
      error: 'Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER) are not configured in Cloudflare environment.',
      status: 400
    };
  }

  const restName = restaurantName || 'DineMaster';
  const bodyText = `[${restName}] O seu codigo de verificacao e: ${code}. Valido por 10 minutos. / Your verification code is: ${code}. Valid for 10 minutes.`;

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const formData = new URLSearchParams();
  formData.append('To', phoneNumber);
  formData.append('From', twilioPhone);
  formData.append('Body', bodyText);

  try {
    // Create base64 auth header safely in edge environment
    const authHeader = typeof btoa === 'function' 
      ? btoa(`${accountSid}:${authToken}`)
      : Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const res = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });

    const data: any = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg = data?.message || data?.error_message || `Twilio API returned error code ${data?.code || res.status}`;
      return {
        success: false,
        error: errMsg,
        status: res.status
      };
    }

    return {
      success: true,
      sid: data?.sid,
      simulated: false,
      status: 200
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error communicating with Twilio API',
      status: 500
    };
  }
}
