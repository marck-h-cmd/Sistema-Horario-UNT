'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, type Column } from '@/components/data/DataTable';
import { SearchBar } from '@/components/data/SearchBar';
import { ErrorAlert } from '@/components/feedback/ErrorAlert';
import { PageHeader } from '@/components/layout/PageHeader';
import { apiGet, apiPut, ApiClientError } from '@/lib/api-client';
import { Formateadores } from '@/lib/formateadores';
import { useRequireAuth } from '@/contexts/AuthContext';
import { Rol, CategoriaDocente, DedicacionDocente } from '@prisma/client';
import { toast } from 'sonner';

interface DocenteInfo {
  id: string;
  codigo: string;
  categoria: string;
  dedicacion: string;
  dni: string;
  departamentoId: number;
}

interface UsuarioRow {
  id: string;
  email: string;
  nombre: string;
  apellidos: string;
  rol: Rol;
  activo: boolean;
  docente?: DocenteInfo | null;
}

interface DepartamentoRow {
  id: number;
  nombre: string;
}

export default function UsuariosPage() {
  const { loading: authLoading } = useRequireAuth([Rol.ADMINISTRADOR]);

  const [usuarios, setUsuarios] = useState<UsuarioRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [search, setSearch] = useState('');
  const [departamentos, setDepartamentos] = useState<DepartamentoRow[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UsuarioRow | null>(null);

  const [form, setForm] = useState<{
    rol: Rol;
    docenteData: {
      codigo: string;
      dni: string;
      categoria: string;
      dedicacion: string;
      departamentoId: string;
    };
  }>({
    rol: Rol.DOCENTE,
    docenteData: {
      codigo: '',
      dni: '',
      categoria: CategoriaDocente.AUXILIAR,
      dedicacion: DedicacionDocente.TIEMPO_COMPLETO_40H,
      departamentoId: '',
    }
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [userRes, deptRes] = await Promise.all([
        apiGet<UsuarioRow[]>('/api/usuarios'),
        apiGet<DepartamentoRow[]>('/api/departamentos').catch(() => ({ data: [] }))
      ]);
      if (userRes?.data) setUsuarios(userRes.data);
      if (deptRes?.data) setDepartamentos(deptRes.data);
    } catch (e: any) {
      setError(e.message || 'Error cargando usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      loadData();
    }
  }, [authLoading]);

  const openRoleModal = (user: UsuarioRow) => {
    setSelectedUser(user);
    setForm({
      rol: user.rol,
      docenteData: {
        codigo: user.docente?.codigo || '',
        dni: user.docente?.dni || '',
        categoria: user.docente?.categoria || CategoriaDocente.AUXILIAR,
        dedicacion: user.docente?.dedicacion || DedicacionDocente.TIEMPO_COMPLETO_40H,
        departamentoId: user.docente?.departamentoId ? String(user.docente.departamentoId) : '',
      }
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    
    // Validación manual rápida
    if (form.rol === Rol.DOCENTE) {
      if (!form.docenteData.dni || !form.docenteData.codigo || !form.docenteData.departamentoId) {
        toast.error('Complete los datos requeridos del docente (DNI, Código, Departamento)');
        return;
      }
    }

    setSaving(true);
    try {
      await apiPut(`/api/usuarios/${selectedUser.id}/rol`, {
        rol: form.rol,
        docenteData: form.rol === Rol.DOCENTE ? form.docenteData : undefined
      });
      toast.success('Rol actualizado correctamente');
      setDialogOpen(false);
      loadData();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : 'Error al actualizar el rol');
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!search) return usuarios;
    const s = search.toLowerCase();
    return usuarios.filter(u => 
      u.nombre.toLowerCase().includes(s) || 
      u.apellidos.toLowerCase().includes(s) || 
      u.email.toLowerCase().includes(s)
    );
  }, [usuarios, search]);

  const columns: Column<UsuarioRow>[] = [
    {
      key: 'nombre',
      header: 'Nombre Completo',
      cell: (r) => <div className="font-medium">{`${r.apellidos}, ${r.nombre}`}</div>
    },
    {
      key: 'email',
      header: 'Correo Electrónico',
      cell: (r) => <div className="text-slate-500 text-sm">{r.email}</div>
    },
    {
      key: 'rol',
      header: 'Rol',
      cell: (r) => (
        <Badge variant={r.rol === Rol.ADMINISTRADOR ? 'primary' : 'outline'}>
          {Formateadores.rolUsuario(r.rol)}
        </Badge>
      )
    },
    {
      key: 'estado',
      header: 'Estado',
      cell: (r) => (
        <Badge variant={r.activo ? 'success' : 'secondary'}>
          {r.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      )
    },
    {
      key: 'acciones',
      header: '',
      className: 'text-right',
      cell: (r) => (
        <Button variant="outline" size="sm" onClick={() => openRoleModal(r)}>
          <ShieldAlert className="h-4 w-4 mr-1 text-slate-500" />
          Cambiar Rol
        </Button>
      )
    }
  ];

  if (authLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-unt-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestión de Usuarios"
        description="Administre los accesos, roles y datos de perfil de docentes del sistema."
      />

      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="max-w-md mb-6">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Buscar por nombre o correo..."
          />
        </div>

        {error && <ErrorAlert message={error} className="mb-4" onRetry={loadData} />}

        <div className="rounded-md border border-slate-200 dark:border-slate-800 overflow-hidden">
          <DataTable
            columns={columns}
            data={filteredUsers}
            loading={loading}
            keyExtractor={(r) => r.id}
            emptyTitle="No se encontraron usuarios"
          />
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Cambiar Rol de Usuario</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedUser && (
              <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <p className="font-semibold text-slate-800 dark:text-slate-200">{selectedUser.nombre} {selectedUser.apellidos}</p>
                <p className="text-sm text-slate-500">{selectedUser.email}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="rol">Rol de Sistema</Label>
              <select
                id="rol"
                value={form.rol}
                onChange={(e) => setForm(f => ({ ...f, rol: e.target.value as Rol }))}
                className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-sm"
              >
                {Object.values(Rol).map(rol => (
                  <option key={rol} value={rol}>{Formateadores.rolUsuario(rol)}</option>
                ))}
              </select>
            </div>

            {form.rol === Rol.DOCENTE && (
              <div className="mt-4 p-4 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4 bg-slate-50 dark:bg-slate-900/50">
                <h4 className="font-semibold text-sm text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-2">
                  Datos de Perfil Docente
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dni">DNI *</Label>
                    <Input 
                      id="dni" 
                      maxLength={8}
                      value={form.docenteData.dni} 
                      onChange={e => setForm(f => ({ ...f, docenteData: { ...f.docenteData, dni: e.target.value } }))} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="codigo">Código *</Label>
                    <Input 
                      id="codigo" 
                      value={form.docenteData.codigo} 
                      onChange={e => setForm(f => ({ ...f, docenteData: { ...f.docenteData, codigo: e.target.value } }))} 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="departamento">Departamento Académico *</Label>
                  <select
                    id="departamento"
                    value={form.docenteData.departamentoId}
                    onChange={(e) => setForm(f => ({ ...f, docenteData: { ...f.docenteData, departamentoId: e.target.value } }))}
                    className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-sm"
                  >
                    <option value="">Seleccione...</option>
                    {departamentos.map(d => (
                      <option key={d.id} value={d.id}>{d.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="categoria">Categoría</Label>
                    <select
                      id="categoria"
                      value={form.docenteData.categoria}
                      onChange={(e) => setForm(f => ({ ...f, docenteData: { ...f.docenteData, categoria: e.target.value } }))}
                      className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-sm"
                    >
                      {Object.values(CategoriaDocente).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="dedicacion">Dedicación</Label>
                    <select
                      id="dedicacion"
                      value={form.docenteData.dedicacion}
                      onChange={(e) => setForm(f => ({ ...f, docenteData: { ...f.docenteData, dedicacion: e.target.value } }))}
                      className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-sm"
                    >
                      {Object.values(DedicacionDocente).map(d => (
                        <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-unt-blue hover:bg-unt-blue/90" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
