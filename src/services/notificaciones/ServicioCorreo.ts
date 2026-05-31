import nodemailer from 'nodemailer';
import { ServicioNotificacionBase, DatosNotificacion } from './ServicioNotificacionBase';
import { CanalNotificacion } from '@prisma/client';

export class ServicioCorreo extends ServicioNotificacionBase {
  protected canal: CanalNotificacion = 'CORREO';
  private transporter: nodemailer.Transporter;

  constructor() {
    super();
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD || process.env.SMTP_PASS,
      },
    });
  }

  async enviar(datos: DatosNotificacion): Promise<boolean> {
    try {
      const notificacion = await this.crearNotificacion(datos);

      const usuario = await this.obtenerEmailUsuario(datos.usuarioId);
      if (!usuario) return false;

      // Para pruebas locales: configura SMTP_USER y SMTP_PASS en .env.local
      // Usar App Password de Gmail (no la contraseña normal):
      // Google Account → Seguridad → Verificación en 2 pasos → Contraseñas de aplicación
      const fromSender = process.env.SMTP_FROM || `"${process.env.SMTP_FROM_NAME || 'Sistema de Horarios UNT'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`;

      await this.transporter.sendMail({
        from: fromSender,
        to: usuario,
        subject: datos.titulo,
        html: this.generarHTML(datos),
      });

      await this.registrarEnvio(notificacion.id, true);
      return true;
    } catch (error: any) {
      console.error('Error enviando correo:', error);
      await this.registrarEnvio('', false, error.message);
      return false;
    }
  }

  async verificarConexion(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }

  private async obtenerEmailUsuario(usuarioId: string): Promise<string | null> {
    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { email: true },
    });
    return usuario?.email || null;
  }

  private generarHTML(datos: DatosNotificacion): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1a365d; color: white; padding: 20px; text-align: center; }
          .content { background: #f9f9f9; padding: 20px; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Sistema de Gestión de Horarios - UNT</h2>
          </div>
          <div class="content">
            <h3>${datos.titulo}</h3>
            <p>${datos.mensaje}</p>
            ${datos.metadata?.detalle ? `<p><strong>Detalle:</strong> ${datos.metadata.detalle}</p>` : ''}
          </div>
          <div class="footer">
            <p>Escuela de Ingeniería de Sistemas - UNT</p>
            <p>Este es un mensaje automático, por favor no responda.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

// Importación al final para evitar dependencia circular
import { prisma } from '@/lib/prisma';