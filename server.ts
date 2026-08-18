import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Resend } from "resend";
import dotenv from "dotenv";
import { sendReservationConfirmation, sendReservationReminder, sendReservationCancellation, sendReservationUpdate } from "./src/server/email";
import { startCronJobs } from "./src/server/cron";
import { initializeApp as initAdminApp, getApps as getAdminApps } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';



dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON bodies
  app.use(express.json());

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // API route for sending Twilio SMS
  app.post('/api/send-sms', async (req, res) => {
    try {
      const { phoneNumber, code, restaurantName, twilioAccountSid, twilioAuthToken, twilioPhoneNumber } = req.body;
      
      const accountSid = twilioAccountSid || process.env.TWILIO_ACCOUNT_SID;
      const authToken = twilioAuthToken || process.env.TWILIO_AUTH_TOKEN;
      const twilioPhone = twilioPhoneNumber || process.env.TWILIO_PHONE_NUMBER;
      
      if (!accountSid || !authToken || !twilioPhone) {
        return res.json({
          success: true,
          simulated: true,
          message: 'Twilio credentials not configured'
        });
      }

      const restName = restaurantName || 'DineMaster';
      const bodyText = `[${restName}] O seu codigo de verificacao e: ${code}. Valido por 10 minutos. / Your verification code is: ${code}. Valid for 10 minutes.`;
      
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const formData = new URLSearchParams();
      formData.append('To', phoneNumber);
      formData.append('From', twilioPhone);
      formData.append('Body', bodyText);
      
      const twilioRes = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      });
      
      const data = await twilioRes.json();
      if (!twilioRes.ok) {
        return res.status(twilioRes.status).json({ success: false, error: data });
      }
      
      return res.json({ success: true, simulated: false, sid: data.sid });
    } catch (err: any) {
      console.error('Error sending SMS:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // API route for sending Resend Confirmation
  

  app.post('/api/email/confirmation', async (req, res) => {
    try {
      const result = await sendReservationConfirmation(req.body);
      res.json(result);
    } catch(e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/email/reminder', async (req, res) => {
    try {
      const result = await sendReservationReminder(req.body);
      res.json(result);
    } catch(e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/email/cancellation', async (req, res) => {
    try {
      const result = await sendReservationCancellation(req.body);
      res.json(result);
    } catch(e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post('/api/email/update', async (req, res) => {
    try {
      const result = await sendReservationUpdate(req.body);
      res.json(result);
    } catch(e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // API route to change any user's password locally without sending reset email
  
  
  app.post('/api/admin/delete-user-by-email', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, error: 'Missing email' });
      }

      const adminApp = getAdminApps().length === 0 
        ? initAdminApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'ai-studio-applet-webapp-d8b8b' })
        : getAdminApps()[0];

      const auth = getAdminAuth(adminApp);
      const db = getAdminFirestore(adminApp);

      try {
        const user = await auth.getUserByEmail(email);
        if (user) {
          // Verify it's an orphan! It should NOT exist in `users` collection as an active role
          const usersSnap = await db.collection('users').where('email', '==', email).get();
          if (!usersSnap.empty) {
             return res.status(403).json({ success: false, error: 'User is not an orphan, cannot delete.' });
          }
          
          // Verify it's not a registered customer
          const custSnap = await db.collection('customers').where('email', '==', email).where('isRegistered', '==', true).get();
          if (!custSnap.empty) {
             return res.status(403).json({ success: false, error: 'Customer is registered, cannot delete.' });
          }
          
          await auth.deleteUser(user.uid);
        }
      } catch (e: any) {
        if (e.code !== 'auth/user-not-found') {
          throw e;
        }
      }
      return res.json({ success: true });
    } catch (err: any) {
      console.error('Error deleting user by email via admin SDK:', err);
      return res.status(500).json({ success: false, error: err.message || 'Failed to delete user' });
    }
  });

  app.post('/api/admin/delete-user', async (req, res) => {
    try {
      const { uid, email } = req.body;
      if (!uid && !email) {
        return res.status(400).json({ success: false, error: 'Missing uid or email' });
      }

      const adminApp = getAdminApps().length === 0 
        ? initAdminApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'ai-studio-applet-webapp-d8b8b' })
        : getAdminApps()[0];

      const auth = getAdminAuth(adminApp);
      let targetUid = uid;

      // If no valid UID was provided, try to look up the user by email
      if ((!targetUid || targetUid.length < 10) && email) {
        try {
          const userRecord = await auth.getUserByEmail(email);
          targetUid = userRecord.uid;
        } catch (e: any) {
          if (e.code === 'auth/user-not-found') {
            return res.json({ success: true, message: 'User not found in Auth by email, skipping' });
          }
          throw e;
        }
      }

      if (targetUid && targetUid.length >= 10) {
        await auth.deleteUser(targetUid);
      }
      
      return res.json({ success: true });
    } catch (err: any) {
      console.error('Error deleting user via admin SDK:', err);
      if (err.code === 'auth/user-not-found') {
        return res.json({ success: true });
      }
      return res.status(500).json({ success: false, error: err.message || 'Failed to delete user' });
    }
  });

  app.post('/api/admin/update-password', async (req, res) => {
    try {
      const { uid, newPassword } = req.body;
      if (!uid || !newPassword) {
        return res.status(400).json({ success: false, error: 'Missing uid or newPassword' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
      }

      const adminApp = getAdminApps().length === 0 
        ? initAdminApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'ai-studio-applet-webapp-d8b8b' })
        : getAdminApps()[0];

      await getAdminAuth(adminApp).updateUser(uid, { password: newPassword });
      return res.json({ success: true });
    } catch (err: any) {
      console.error('Error updating user password via admin SDK:', err);
      return res.status(500).json({ success: false, error: err.message || 'Failed to update user password' });
    }
  });
  
  // Start cron jobs
  startCronJobs();

// Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Important: Use * for Express v4 to handle SPA routing properly
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
