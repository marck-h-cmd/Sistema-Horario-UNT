import puppeteer from 'puppeteer';
import fs from 'fs';
import { AppError } from '@/services/auth/AuthService';
import {
  envolverDocumentoHTML,
  generarEncabezadoHTML,
  generarTablaHTML,
} from './reporte-estilos';

export interface ReporteConfig {
  titulo: string;
  orientacion?: 'portrait' | 'landscape';
  formato?: 'A4' | 'Letter' | 'Legal';
  margenes?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  numeracionPaginas?: boolean;
}

export class GeneradorPDF {
  private browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  async inicializar() {
    if (!this.browser) {
      const execPath = process.env.PUPPETEER_EXECUTABLE_PATH;
      const validExecPath = execPath && fs.existsSync(execPath) ? execPath : undefined;

      const systemBrowsers = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      ];
      const fallbackPath = systemBrowsers.find(p => fs.existsSync(p));

      try {
        this.browser = await puppeteer.launch({
          headless: process.env.PUPPETEER_HEADLESS !== 'false',
          ...(validExecPath ? { executablePath: validExecPath } : {}),
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });
      } catch (err) {
        console.warn('Fallo al iniciar Puppeteer por defecto, intentando navegador del sistema:', err);
        if (fallbackPath) {
          this.browser = await puppeteer.launch({
            headless: process.env.PUPPETEER_HEADLESS !== 'false',
            executablePath: fallbackPath,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
          });
        } else {
          throw err;
        }
      }
    }
    return this.browser;
  }

  async cerrar() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async generarPDF(html: string, config: ReporteConfig): Promise<Buffer> {
    try {
      const browser = await this.inicializar();
      const page = await browser.newPage();

      await page.setViewport({
        width: config.orientacion === 'landscape' ? 1120 : 800,
        height: config.orientacion === 'landscape' ? 800 : 1120,
        deviceScaleFactor: 1,
      });

      await page.setContent(html, {
        waitUntil: 'domcontentloaded',
      });

      await page.addStyleTag({
        content: `
          @page {
            size: ${config.formato || 'A4'} ${config.orientacion || 'portrait'};
          }
          @media print {
            .no-print { display: none !important; }
          }
        `,
      });

      const mostrarPie = config.numeracionPaginas !== false;
      const pdf = await page.pdf({
        format: config.formato || 'A4',
        landscape: config.orientacion === 'landscape',
        printBackground: true,
        displayHeaderFooter: mostrarPie,
        headerTemplate: '<div></div>',
        footerTemplate: mostrarPie
          ? `<div style="width:100%;font-size:8px;color:#94a3b8;padding:0 15mm;display:flex;justify-content:space-between;font-family:Segoe UI,Arial,sans-serif;">
              <span>UNT — Escuela de Ingeniería de Sistemas</span>
              <span>Pág. <span class="pageNumber"></span> / <span class="totalPages"></span></span>
            </div>`
          : '<div></div>',
        margin: {
          top: config.margenes?.top || '18mm',
          right: config.margenes?.right || '12mm',
          bottom: mostrarPie ? '22mm' : config.margenes?.bottom || '18mm',
          left: config.margenes?.left || '12mm',
        },
      });

      await page.close();
      return Buffer.from(pdf);
    } catch (error) {
      console.error('Error generando PDF:', error);
      throw new AppError('Error al generar el PDF', 500, 'PDF_GENERATION_ERROR');
    }
  }

  /** Documento completo con estilos UNT unificados */
  generarDocumento(
    titulo: string,
    contenido: string,
    opciones?: { periodo?: string; subtitulo?: string }
  ): string {
    return envolverDocumentoHTML(titulo, contenido, opciones);
  }

  /** @deprecated Usar generarDocumento + generarTabla */
  generarEncabezado(titulo: string, periodo?: string): string {
    return generarEncabezadoHTML(titulo, periodo);
  }

  generarPiePagina(): string {
    return '';
  }

  generarTabla(headers: string[], filas: string[][]): string {
    return generarTablaHTML(headers, filas);
  }

  generarTablaEscapada(headers: string[], filas: string[][]): string {
    return generarTablaHTML(headers, filas);
  }
}
