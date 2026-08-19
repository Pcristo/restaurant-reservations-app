import {
  EmailOptions,
  buildConfirmationEmail,
  buildReminderEmail,
  buildCancellationEmail,
  buildUpdateEmail,
  buildTestEmail
} from '../../functions/lib/emailTemplates';
import { sendEmailViaResend } from '../../functions/lib/resend';

export type { EmailOptions };

export const sendReservationConfirmation = async (opts: EmailOptions) => {
  const { subject, html } = buildConfirmationEmail(opts);
  return sendEmailViaResend({
    to: opts.email,
    subject,
    html,
    apiKey: opts.resendApiKey,
    fromEmail: opts.resendFromEmail,
    restaurantName: opts.restaurantName
  }, process.env);
};

export const sendReservationReminder = async (opts: EmailOptions) => {
  const { subject, html } = buildReminderEmail(opts);
  return sendEmailViaResend({
    to: opts.email,
    subject,
    html,
    apiKey: opts.resendApiKey,
    fromEmail: opts.resendFromEmail,
    restaurantName: opts.restaurantName
  }, process.env);
};

export const sendReservationCancellation = async (opts: EmailOptions) => {
  const { subject, html } = buildCancellationEmail(opts);
  return sendEmailViaResend({
    to: opts.email,
    subject,
    html,
    apiKey: opts.resendApiKey,
    fromEmail: opts.resendFromEmail,
    restaurantName: opts.restaurantName
  }, process.env);
};

export const sendReservationUpdate = async (opts: EmailOptions) => {
  const { subject, html } = buildUpdateEmail(opts);
  return sendEmailViaResend({
    to: opts.email,
    subject,
    html,
    apiKey: opts.resendApiKey,
    fromEmail: opts.resendFromEmail,
    restaurantName: opts.restaurantName
  }, process.env);
};

export const sendTestEmail = async (opts: {
  email: string;
  resendApiKey?: string;
  resendFromEmail?: string;
  restaurantName?: string;
  logoUrl?: string;
  language?: string;
}) => {
  const { subject, html } = buildTestEmail(opts);
  return sendEmailViaResend({
    to: opts.email,
    subject,
    html,
    apiKey: opts.resendApiKey,
    fromEmail: opts.resendFromEmail,
    restaurantName: opts.restaurantName
  }, process.env);
};
