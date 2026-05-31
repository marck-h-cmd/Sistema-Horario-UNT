import axios from 'axios';
import { ServicioNotificacionBase, DatosNotificacion } from './ServicioNotificacionBase';
import { CanalNotificacion } from '@prisma/client';

export class ServicioTelegram extends ServicioNotificacionBase {
  protected canal: CanalNotificacion = 'TELEGRAM';
  private botToken: string;
  private apiUrl: string;

  constructor() {
    super();
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.apiUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  async enviar(datos: DatosNotificacion): Promise<boolean> {
    let notificacionId = '';
    try {
      const notificacion = await this.crearNotificacion(datos);
      notificacionId = notificacion.id;

      // Obtener chat ID de Telegram del usuario
      const chatId = await this.obtenerChatIdUsuario(datos.usuarioId);
      if (!chatId) {
        await this.registrarEnvio(notificacionId, false, 'Usuario sin Telegram registrado');
        return false;
      }

      // Enviar mensaje con formato HTML
      const response = await axios.post(`${this.apiUrl}/sendMessage`, {
        chat_id: chatId,
        text: this.formatearMensajeHTML(datos),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });

      const exito = response.data?.ok === true;
      await this.registrarEnvio(notificacionId, exito);

      return exito;
    } catch (error: any) {
      console.error('Error enviando Telegram:', error);
      if (notificacionId) {
        await this.registrarEnvio(notificacionId, false, error.message);
      }
      return false;
    }
  }

  async verificarConexion(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.apiUrl}/getMe`);
      return response.data?.ok === true;
    } catch {
      return false;
    }
  }

  async configurarWebhook(webhookUrl: string): Promise<boolean> {
    try {
      const response = await axios.post(`${this.apiUrl}/setWebhook`, {
        url: webhookUrl,
      });
      return response.data?.ok === true;
    } catch (error) {
      console.error('Error configurando webhook:', error);
      return false;
    }
  }

  async obtenerInfoWebhook(): Promise<any> {
    try {
      const response = await axios.get(`${this.apiUrl}/getWebhookInfo`);
      return response.data?.result;
    } catch (error) {
      console.error('Error obteniendo info webhook:', error);
      return null;
    }
  }

  async enviarConTeclado(
    chatId: string,
    texto: string,
    opciones: string[][]
  ): Promise<boolean> {
    try {
      const response = await axios.post(`${this.apiUrl}/sendMessage`, {
        chat_id: chatId,
        text: texto,
        parse_mode: 'HTML',
        reply_markup: {
          keyboard: opciones.map(fila => fila.map(texto => ({ text: texto }))),
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });

      return response.data?.ok === true;
    } catch (error) {
      console.error('Error enviando mensaje con teclado:', error);
      return false;
    }
  }

  async obtenerFotoPerfil(chatId: string): Promise<string | null> {
    try {
      const response = await axios.get(`${this.apiUrl}/getUserProfilePhotos`, {
        params: { user_id: chatId, limit: 1 },
      });

      const photos = response.data?.result?.photos;
      if (photos && photos.length > 0) {
        const fileId = photos[0][0].file_id;
        const fileResponse = await axios.get(`${this.apiUrl}/getFile`, {
          params: { file_id: fileId },
        });
        const filePath = fileResponse.data?.result?.file_path;
        return `https://api.telegram.org/file/bot${this.botToken}/${filePath}`;
      }
      return null;
    } catch {
      return null;
    }
  }

  private async obtenerChatIdUsuario(usuarioId: string): Promise<string | null> {
    const docente = await prisma.docente.findFirst({
      where: { usuarioId },
      select: { telegramId: true, verificadoTelegram: true },
    });

    return docente?.verificadoTelegram ? docente.telegramId : null;
  }

  private formatearMensajeHTML(datos: DatosNotificacion): string {
    let mensaje = `<b>📋 ${datos.titulo}</b>\n\n`;
    mensaje += datos.mensaje;
    
    if (datos.metadata?.detalle) {
      mensaje += `\n\n📌 <i>${datos.metadata.detalle}</i>`;
    }

    if (datos.metadata?.enlace) {
      mensaje += `\n\n🔗 <a href="${datos.metadata.enlace}">Ver más detalles</a>`;
    }

    mensaje += '\n\n───────────────\n';
    mensaje += '🏫 <b>Escuela de Ingeniería de Sistemas - UNT</b>\n';
    mensaje += '📅 Sistema de Gestión de Horarios';

    return mensaje;
  }
}

import { prisma } from '@/lib/prisma';