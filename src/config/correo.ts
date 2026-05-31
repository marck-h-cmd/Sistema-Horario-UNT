export const CorreoConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD || process.env.SMTP_PASS,
  },
  from: {
    name: process.env.SMTP_FROM_NAME || 'Sistema de Horarios UNT',
    email: process.env.SMTP_FROM_EMAIL || 'notificaciones@unitru.edu.pe',
    full: process.env.SMTP_FROM || `"${process.env.SMTP_FROM_NAME || 'Sistema de Horarios UNT'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`
  },
};