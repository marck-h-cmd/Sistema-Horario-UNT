
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FormSection } from '@/components/forms/FormSection';
import { FormField } from '@/components/forms/FormField';
import { FormSelect } from '@/components/forms/FormSelect';

type PDFExportOptions = {
  pageSize: 'A4' | 'Letter' | 'Legal';
  orientation: 'landscape' | 'portrait';
  margin: number;
  printImmediately: boolean;
  format: 'table' | 'grid';
};

type ExcelExportOptions = {
  format: 'table' | 'grid';
};

type ExportOptionsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExportPDF: (options: PDFExportOptions) => void;
  onExportExcel: (options: ExcelExportOptions) => void;
};

export function ExportOptionsModal({
  open,
  onOpenChange,
  onExportPDF,
  onExportExcel,
}: ExportOptionsModalProps) {
  const [pageSize, setPageSize] = useState<'A4' | 'Letter' | 'Legal'>('A4');
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [margin, setMargin] = useState<number>(8);
  const [printImmediately, setPrintImmediately] = useState<boolean>(false);
  const [format, setFormat] = useState<'table' | 'grid'>('grid');

  const handleExportPDF = () => {
    console.log('handleExportPDF, format:', format);
    onExportPDF({
      pageSize,
      orientation,
      margin,
      printImmediately,
      format,
    });
    onOpenChange(false);
  };

  const handleExportExcel = () => {
    console.log('handleExportExcel, format:', format);
    onExportExcel({
      format,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configuración de Exportación</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <FormSection title="Formato de Exportación">
            <FormField label="Tipo de formato" required>
              <FormSelect
                value={format}
                onChange={(e) => setFormat(e.target.value as any)}
              >
                <option value="grid">Grilla</option>
                <option value="table">Tabla</option>
              </FormSelect>
            </FormField>
          </FormSection>

          <FormSection title="Opciones de PDF">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Tamaño de página" required>
                <FormSelect
                  value={pageSize}
                  onChange={(e) => setPageSize(e.target.value as any)}
                >
                  <option value="A4">A4</option>
                  <option value="Letter">Letter</option>
                  <option value="Legal">Legal</option>
                </FormSelect>
              </FormField>

              <FormField label="Orientación" required>
                <FormSelect
                  value={orientation}
                  onChange={(e) => setOrientation(e.target.value as any)}
                >
                  <option value="landscape">Horizontal</option>
                  <option value="portrait">Vertical</option>
                </FormSelect>
              </FormField>
            </div>

            <FormField label="Margen (mm)">
              <input
                type="number"
                value={margin}
                onChange={(e) => setMargin(parseInt(e.target.value, 10))}
                min="0"
                max="50"
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus-visible:ring-slate-300"
              />
            </FormField>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="print-immediately"
                checked={printImmediately}
                onChange={(e) => setPrintImmediately(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="print-immediately" className="text-sm font-medium leading-none">
                Imprimir inmediatamente después de exportar
              </label>
            </div>
          </FormSection>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="outline" onClick={handleExportExcel}>
            Exportar a Excel
          </Button>
          <Button onClick={handleExportPDF}>
            Exportar a PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

