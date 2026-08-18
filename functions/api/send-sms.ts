export async function onRequestPost(context: any) {
  try {
    const body = await context.request.json();
    const { phoneNumber, code, restaurantName, twilioAccountSid, twilioAuthToken, twilioPhoneNumber } = body;

    if (!phoneNumber || !code) {
      return new Response(JSON.stringify({ success: false, error: 'Phone number and code are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const accountSid = twilioAccountSid || context.env.TWILIO_ACCOUNT_SID;
    const authToken = twilioAuthToken || context.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = twilioPhoneNumber || context.env.TWILIO_PHONE_NUMBER;
    const restName = restaurantName || 'DineMaster';
    
    const bodyText = `[${restName}] O seu codigo de verificacao e: ${code}. Valido por 10 minutos. / Your verification code is: ${code}. Valid for 10 minutes.`;

    if (!accountSid || !authToken || !twilioPhone) {
      // No Twilio configuration: fallback to simulated mode
      console.log(`[SMS SIMULATION] To: ${phoneNumber} | Message: ${bodyText}`);
      return new Response(JSON.stringify({
        success: true,
        simulated: true,
        message: 'Twilio credentials not configured. SMS code logged to console in simulation mode.'
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const formData = new URLSearchParams();
    formData.append('To', phoneNumber);
    formData.append('From', twilioPhone);
    formData.append('Body', bodyText);
    
    const res = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData
    });
    
    const data = await res.json();
    if (!res.ok) {
       return new Response(JSON.stringify({ success: false, error: data }), { status: res.status, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      success: true,
      simulated: false,
      sid: data.sid
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error('Error sending SMS via Twilio:', err);
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
