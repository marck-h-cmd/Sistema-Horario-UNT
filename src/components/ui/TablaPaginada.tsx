'use client';

import * as React from 'react';
import {
  TablaDatos,
  TablaHeader,
  TablaBody,
  TablaHead,
  TablaRow,
  TablaCell,
} from './TablaDatos';
import { Boton } from './Boton';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utilidades';

interface ColumnaDatos<T> {
  clave: string;
  titulo: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface TablaPaginadaProps<T> {
  datos: T[];
  columnas: ColumnaDatos<T>[];
  paginaActual: number;
  totalPaginas: number;
  onCambioPagina: (pagina: number) => void;
  cargando?: boolean;
  mensajeVacio?: string;
  className?: string;
}

export function TablaPaginada<T extends Record<string, any>>({
  datos,
  columnas,
  paginaActual,
  totalPaginas,
  onCambioPagina,
  cargando = false,
  mensajeVacio = 'No hay datos para mostrar',
  className,
}: TablaPaginadaProps<T>) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="rounded-xl border border-slate-200/50 dark:border-slate-800/80 overflow-hidden shadow-sm">
        <TablaDatos>
          <TablaHeader>
            <TablaRow>
              {columnas.map((columna) => (
                <TablaHead key={columna.clave} className={columna.className}>
                  {columna.titulo}
                </TablaHead>
              ))}
            </TablaRow>
          </TablaHeader>
          <TablaBody>
            {cargando ? (
              <TablaRow>
                <TablaCell colSpan={columnas.length} className="h-24 text-center">
                  Cargando...
                </TablaCell>
              </TablaRow>
            ) : datos.length === 0 ? (
              <TablaRow>
                <TablaCell colSpan={columnas.length} className="h-24 text-center">
                  {mensajeVacio}
                </TablaCell>
              </TablaRow>
            ) : (
              datos.map((item, index) => (
                <TablaRow key={index}>
                  {columnas.map((columna) => (
                    <TablaCell key={columna.clave} className={columna.className}>
                      {columna.render ? columna.render(item) : item[columna.clave]}
                    </TablaCell>
                  ))}
                </TablaRow>
              ))
            )}
          </TablaBody>
        </TablaDatos>
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Página {paginaActual} de {totalPaginas}
          </div>
          <div className="flex gap-2">
            <Boton
              variant="outline"
              size="icon"
              onClick={() => onCambioPagina(1)}
              disabled={paginaActual === 1 || cargando}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Boton>
            <Boton
              variant="outline"
              size="icon"
              onClick={() => onCambioPagina(paginaActual - 1)}
              disabled={paginaActual === 1 || cargando}
            >
              <ChevronLeft className="h-4 w-4" />
            </Boton>
            <Boton
              variant="outline"
              size="icon"
              onClick={() => onCambioPagina(paginaActual + 1)}
              disabled={paginaActual === totalPaginas || cargando}
            >
              <ChevronRight className="h-4 w-4" />
            </Boton>
            <Boton
              variant="outline"
              size="icon"
              onClick={() => onCambioPagina(totalPaginas)}
              disabled={paginaActual === totalPaginas || cargando}
            >
              <ChevronsRight className="h-4 w-4" />
            </Boton>
          </div>
        </div>
      )}
    </div>
  );
}