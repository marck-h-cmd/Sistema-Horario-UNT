'use client';

import { Download, ExternalLink, Printer } from 'lucide-react';
import { Boton } from '@/components/ui/Boton';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
} from '@/components/ui/Modal';
import { useEffect, useRef } from 'react';

interface VisorPDFProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string | null;
  title?: string;
  filename?: string;
}

export function VisorPDF({ isOpen, onClose, pdfUrl, title = 'Previsualización de PDF', filename = 'horario.pdf' }: VisorPDFProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    return () => {
      if (pdfUrl && !isOpen) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl, isOpen]);

  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.print();
    }
  };

  const handleDownload = () => {
    if (!pdfUrl) return;
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenExternally = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
  };

  return (
    <Modal open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ModalContent className="max-w-5xl p-0 overflow-hidden flex flex-col h-[85vh]">
        <ModalHeader className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-row items-center justify-between space-y-0 relative">
          <ModalTitle className="text-base truncate max-w-[40%] font-semibold text-slate-800 dark:text-slate-100">{title}</ModalTitle>
          <div className="flex items-center gap-2 pr-6">
            <Boton variant="primary" size="sm" onClick={handleDownload} className="h-8 bg-blue-600 hover:bg-blue-700 text-white font-medium">
              <Download className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Descargar PDF</span>
            </Boton>
            <Boton variant="outline" size="sm" onClick={handlePrint} className="h-8">
              <Printer className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Imprimir</span>
            </Boton>
            <Boton variant="outline" size="sm" onClick={handleOpenExternally} className="h-8">
              <ExternalLink className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Pestaña nueva</span>
            </Boton>
          </div>
        </ModalHeader>
        
        <div className="flex-1 w-full bg-slate-100 dark:bg-slate-800 relative">
          {pdfUrl ? (
            <iframe 
              ref={iframeRef}
              src={pdfUrl} 
              className="absolute inset-0 w-full h-full border-0"
              title="Visor PDF"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500 text-sm">
              Cargando documento...
            </div>
          )}
        </div>
      </ModalContent>
    </Modal>
  );
}
