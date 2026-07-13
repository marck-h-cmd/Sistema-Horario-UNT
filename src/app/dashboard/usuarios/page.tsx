'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, ShieldAlert, Plus, Pencil, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, type Column } from '@/components/data/DataTable';
import { SearchBar } from '@/components/data/SearchBar';
import { ErrorAlert } from '@/components/feedback/ErrorAlert';
import { PageHeader } from '@/components/layout/PageHeader';
import { apiGet, apiPost, apiPut, apiDelete, ApiClientError } from '@/lib/api-client';
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
  const [selectedRolTab, setSelectedRolTab] = useState<string>('TODOS');
  const [departamentos, setDepartamentos] = useState<DepartamentoRow[]>([]);

  // Modales
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UsuarioRow | null>(null);

  // Formularios
  const [roleForm, setRoleForm] = useState<{
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

  const [createForm, setCreateForm] = useState<{
    nombre: string;
    apellidos: string;
    email: string;
    rol: Rol;
    activo: boolean;
    docenteData: {
      codigo: string;
      dni: string;
      categoria: string;
      dedicacion: string;
      departamentoId: string;
    };
  }>({
    nombre: '',
    apellidos: '',
    email: '',
    rol: Rol.DOCENTE,
    activo: true,
    docenteData: {
      codigo: '',
      dni: '',
      categoria: CategoriaDocente.AUXILIAR,
      dedicacion: DedicacionDocente.TIEMPO_COMPLETO_40H,
      departamentoId: '',
    }
  });

  const [editForm, setEditForm] = useState({
    nombre: '',
    apellidos: '',
    email: '',
    activo: true,
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

  // Manejadores de Modales
  const openRoleModal = (user: UsuarioRow) => {
    setSelectedUser(user);
    setRoleForm({
      rol: user.rol,
      docenteData: {
        codigo: user.docente?.codigo || '',
        dni: user.docente?.dni || '',
        categoria: user.docente?.categoria || CategoriaDocente.AUXILIAR,
        dedicacion: user.docente?.dedicacion || DedicacionDocente.TIEMPO_COMPLETO_40H,
        departamentoId: user.docente?.departamentoId ? String(user.docente.departamentoId) : '',
      }
    });
    setRoleDialogOpen(true);
  };

  const openCreateModal = () => {
    setCreateForm({
      nombre: '',
      apellidos: '',
      email: '',
      rol: Rol.DOCENTE,
      activo: true,
      docenteData: {
        codigo: '',
        dni: '',
        categoria: CategoriaDocente.AUXILIAR,
        dedicacion: DedicacionDocente.TIEMPO_COMPLETO_40H,
        departamentoId: '',
      }
    });
    setCreateDialogOpen(true);
  };

  const openEditModal = (user: UsuarioRow) => {
    setSelectedUser(user);
    setEditForm({
      nombre: user.nombre,
      apellidos: user.apellidos,
      email: user.email,
      activo: user.activo,
    });
    setEditDialogOpen(true);
  };

  const openDeleteModal = (user: UsuarioRow) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  // Peticiones
  const handleSaveRole = async () => {
    if (!selectedUser) return;
    if (roleForm.rol === Rol.DOCENTE) {
      if (!roleForm.docenteData.dni || !roleForm.docenteData.codigo || !roleForm.docenteData.departamentoId) {
        toast.error('Complete los datos requeridos del docente (DNI, Código, Departamento)');
        return;
      }
    }

    setSaving(true);
    try {
      await apiPut(`/api/usuarios/${selectedUser.id}/rol`, {
        rol: roleForm.rol,
        docenteData: roleForm.rol === Rol.DOCENTE ? roleForm.docenteData : undefined
      });
      toast.success('Rol actualizado correctamente');
      setRoleDialogOpen(false);
      loadData();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : 'Error al actualizar el rol');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateUser = async () => {
    if (!createForm.nombre.trim() || !createForm.apellidos.trim() || !createForm.email.trim()) {
      toast.error('Complete los datos requeridos del usuario');
      return;
    }

    if (createForm.rol === Rol.DOCENTE) {
      if (!createForm.docenteData.dni || !createForm.docenteData.codigo || !createForm.docenteData.departamentoId) {
        toast.error('Complete los datos requeridos del docente');
        return;
      }
    }

    setSaving(true);
    try {
      await apiPost('/api/usuarios', {
        nombre: createForm.nombre.trim(),
        apellidos: createForm.apellidos.trim(),
        email: createForm.email.trim().toLowerCase(),
        rol: createForm.rol,
        activo: createForm.activo,
        docenteData: createForm.rol === Rol.DOCENTE ? createForm.docenteData : undefined
      });
      toast.success('Usuario registrado con éxito. Contraseña por defecto: unt123456');
      setCreateDialogOpen(false);
      loadData();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : 'Error al registrar el usuario');
    } finally {
      setSaving(false);
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;
    if (!editForm.nombre.trim() || !editForm.apellidos.trim() || !editForm.email.trim()) {
      toast.error('Complete los campos requeridos');
      return;
    }

    setSaving(true);
    try {
      await apiPut(`/api/usuarios/${selectedUser.id}`, {
        nombre: editForm.nombre.trim(),
        apellidos: editForm.apellidos.trim(),
        email: editForm.email.trim().toLowerCase(),
        activo: editForm.activo
      });
      toast.success('Usuario actualizado correctamente');
      setEditDialogOpen(false);
      loadData();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : 'Error al actualizar usuario');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      await apiDelete(`/api/usuarios/${selectedUser.id}`);
      toast.success('Usuario eliminado permanentemente');
      setDeleteDialogOpen(false);
      loadData();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : 'No se pudo eliminar el usuario');
    } finally {
      setSaving(false);
    }
  };

  const toggleUserActive = async (user: UsuarioRow) => {
    try {
      await apiPut(`/api/usuarios/${user.id}`, {
        activo: !user.activo
      });
      toast.success(`Usuario ${!user.activo ? 'activado' : 'desactivado'} correctamente`);
      loadData();
    } catch (e) {
      toast.error('No se pudo cambiar el estado del usuario');
    }
  };

  // Filtrado y Búsqueda
  const filteredUsers = useMemo(() => {
    let result = usuarios;
    if (selectedRolTab !== 'TODOS') {
      result = result.filter(u => u.rol === selectedRolTab);
    }
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(u => 
        u.nombre.toLowerCase().includes(s) || 
        u.apellidos.toLowerCase().includes(s) || 
        u.email.toLowerCase().includes(s)
      );
    }
    return result;
  }, [usuarios, selectedRolTab, search]);

  const columns: Column<UsuarioRow>[] = [
    {
      key: 'nombre',
      header: 'Nombre Completo',
      cell: (r) => <div className="font-semibold text-slate-800 dark:text-slate-200">{`${r.apellidos}, ${r.nombre}`}</div>
    },
    {
      key: 'email',
      header: 'Correo Electrónico',
      cell: (r) => <div className="text-slate-500 dark:text-slate-400 text-sm font-mono">{r.email}</div>
    },
    {
      key: 'rol',
      header: 'Rol',
      cell: (r) => (
        <Badge variant={r.rol === Rol.ADMINISTRADOR ? 'default' : 'outline'}>
          {Formateadores.rolUsuario(r.rol)}
        </Badge>
      )
    },
    {
      key: 'estado',
      header: 'Estado',
      cell: (r) => (
        <button
          onClick={() => toggleUserActive(r)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-colors ${
            r.activo 
              ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20' 
              : 'bg-slate-500/10 text-slate-500 hover:bg-slate-500/20'
          }`}
          title="Haga clic para cambiar el estado de acceso"
        >
          {r.activo ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          {r.activo ? 'Activo' : 'Suspendido'}
        </button>
      )
    },
    {
      key: 'acciones',
      header: 'Acciones',
      className: 'text-right',
      cell: (r) => (
        <div className="flex justify-end gap-2">
          <Button variant="edit" size="sm" onClick={() => openEditModal(r)} title="Editar datos básicos">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="warning" size="sm" onClick={() => openRoleModal(r)} title="Gestionar Rol y Docente">
            <ShieldAlert className="h-3.5 w-3.5" />
          </Button>
          <Button variant="danger" size="sm" onClick={() => openDeleteModal(r)} title="Eliminar usuario">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
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
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Gestión de Usuarios"
        description="Registra nuevos usuarios, administra sus roles de acceso, y edita o suspende sus cuentas."
        actions={
          <Button onClick={openCreateModal} className="btn-primary bg-unt-blue hover:bg-unt-blue/90 gap-2">
            <Plus className="h-4 w-4" /> Registrar Usuario
          </Button>
        }
      />

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200/80 dark:border-slate-700 overflow-hidden">
        {/* Pestañas de Roles */}
        <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20 overflow-x-auto">
          {['TODOS', ...Object.values(Rol)].map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedRolTab(tab)}
              className={`px-5 py-4 text-xs font-bold tracking-wider uppercase border-b-2 transition-all whitespace-nowrap ${
                selectedRolTab === tab
                  ? 'border-unt-blue text-unt-blue bg-white dark:bg-slate-800'
                  : 'border-transparent text-slate-550 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {tab === 'TODOS' ? 'Todos' : Formateadores.rolUsuario(tab as Rol)}
            </button>
          ))}
        </div>

        <div className="p-5">
          <div className="max-w-md mb-6">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Buscar por nombre o correo..."
            />
          </div>

          {error && <ErrorAlert message={error} className="mb-4" onRetry={loadData} />}

          <div className="rounded-xl border border-slate-200/80 dark:border-slate-700/80 overflow-hidden">
            <DataTable
              columns={columns}
              data={filteredUsers}
              loading={loading}
              keyExtractor={(r) => r.id}
              emptyTitle="No se encontraron usuarios"
            />
          </div>
        </div>
      </div>

      {/* 1. Modal: Cambiar Rol */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Gestionar Rol de Usuario</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedUser && (
              <div className="mb-2 p-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-lg">
                <p className="font-bold text-slate-800 dark:text-slate-200">{selectedUser.nombre} {selectedUser.apellidos}</p>
                <p className="text-xs font-mono text-slate-500 dark:text-slate-400">{selectedUser.email}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="role-select">Rol de Sistema</Label>
              <select
                id="role-select"
                value={roleForm.rol}
                onChange={(e) => setRoleForm(f => ({ ...f, rol: e.target.value as Rol }))}
                className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-sm"
              >
                {Object.values(Rol).map(rol => (
                  <option key={rol} value={rol}>{Formateadores.rolUsuario(rol)}</option>
                ))}
              </select>
            </div>

            {roleForm.rol === Rol.DOCENTE && (
              <div className="mt-4 p-4 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4 bg-slate-50 dark:bg-slate-900/40">
                <h4 className="font-bold text-xs text-slate-650 dark:text-slate-350 uppercase tracking-wider mb-2">
                  Datos Obligatorios del Docente
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="role-dni">DNI *</Label>
                    <Input 
                      id="role-dni" 
                      maxLength={8}
                      value={roleForm.docenteData.dni} 
                      onChange={e => setRoleForm(f => ({ ...f, docenteData: { ...f.docenteData, dni: e.target.value } }))} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role-codigo">Código Docente *</Label>
                    <Input 
                      id="role-codigo" 
                      value={roleForm.docenteData.codigo} 
                      onChange={e => setRoleForm(f => ({ ...f, docenteData: { ...f.docenteData, codigo: e.target.value } }))} 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role-departamento">Departamento Académico *</Label>
                  <select
                    id="role-departamento"
                    value={roleForm.docenteData.departamentoId}
                    onChange={(e) => setRoleForm(f => ({ ...f, docenteData: { ...f.docenteData, departamentoId: e.target.value } }))}
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
                    <Label htmlFor="role-categoria">Categoría</Label>
                    <select
                      id="role-categoria"
                      value={roleForm.docenteData.categoria}
                      onChange={(e) => setRoleForm(f => ({ ...f, docenteData: { ...f.docenteData, categoria: e.target.value } }))}
                      className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-sm"
                    >
                      {Object.values(CategoriaDocente).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="role-dedicacion">Dedicación</Label>
                    <select
                      id="role-dedicacion"
                      value={roleForm.docenteData.dedicacion}
                      onChange={(e) => setRoleForm(f => ({ ...f, docenteData: { ...f.docenteData, dedicacion: e.target.value } }))}
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
            <Button variant="secondary" onClick={() => setRoleDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-unt-blue hover:bg-unt-blue/90 font-bold" onClick={handleSaveRole} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar Rol'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. Modal: Registrar Usuario */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Nuevo Usuario</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-nombre">Nombre *</Label>
                <Input
                  id="create-nombre"
                  placeholder="Ej. Juan"
                  value={createForm.nombre}
                  onChange={e => setCreateForm(f => ({ ...f, nombre: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-apellidos">Apellidos *</Label>
                <Input
                  id="create-apellidos"
                  placeholder="Ej. Pérez"
                  value={createForm.apellidos}
                  onChange={e => setCreateForm(f => ({ ...f, apellidos: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-email">Correo Electrónico *</Label>
              <Input
                id="create-email"
                type="email"
                placeholder="usuario@unitru.edu.pe"
                value={createForm.email}
                onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-rol">Rol del Sistema</Label>
                <select
                  id="create-rol"
                  value={createForm.rol}
                  onChange={(e) => setCreateForm(f => ({ ...f, rol: e.target.value as Rol }))}
                  className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-sm"
                >
                  {Object.values(Rol).map(rol => (
                    <option key={rol} value={rol}>{Formateadores.rolUsuario(rol)}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-activo">Estado Inicial</Label>
                <select
                  id="create-activo"
                  value={createForm.activo ? 'true' : 'false'}
                  onChange={(e) => setCreateForm(f => ({ ...f, activo: e.target.value === 'true' }))}
                  className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-sm"
                >
                  <option value="true">Activo</option>
                  <option value="false">Suspendido</option>
                </select>
              </div>
            </div>

            {createForm.rol === Rol.DOCENTE && (
              <div className="mt-4 p-4 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4 bg-slate-50 dark:bg-slate-900/40">
                <h4 className="font-bold text-xs text-slate-650 dark:text-slate-350 uppercase tracking-wider mb-2">
                  Datos del Docente
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="create-docente-dni">DNI *</Label>
                    <Input
                      id="create-docente-dni"
                      maxLength={8}
                      placeholder="8 dígitos"
                      value={createForm.docenteData.dni}
                      onChange={e => setCreateForm(f => ({ ...f, docenteData: { ...f.docenteData, dni: e.target.value } }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-docente-codigo">Código Docente *</Label>
                    <Input
                      id="create-docente-codigo"
                      placeholder="Código oficial"
                      value={createForm.docenteData.codigo}
                      onChange={e => setCreateForm(f => ({ ...f, docenteData: { ...f.docenteData, codigo: e.target.value } }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="create-docente-departamento">Departamento Académico *</Label>
                  <select
                    id="create-docente-departamento"
                    value={createForm.docenteData.departamentoId}
                    onChange={(e) => setCreateForm(f => ({ ...f, docenteData: { ...f.docenteData, departamentoId: e.target.value } }))}
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
                    <Label htmlFor="create-docente-categoria">Categoría</Label>
                    <select
                      id="create-docente-categoria"
                      value={createForm.docenteData.categoria}
                      onChange={(e) => setCreateForm(f => ({ ...f, docenteData: { ...f.docenteData, categoria: e.target.value } }))}
                      className="w-full h-10 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-sm"
                    >
                      {Object.values(CategoriaDocente).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="create-docente-dedicacion">Dedicación</Label>
                    <select
                      id="create-docente-dedicacion"
                      value={createForm.docenteData.dedicacion}
                      onChange={(e) => setCreateForm(f => ({ ...f, docenteData: { ...f.docenteData, dedicacion: e.target.value } }))}
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
            <Button variant="secondary" onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-unt-blue hover:bg-unt-blue/90 font-bold" onClick={handleCreateUser} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. Modal: Editar Datos Básicos */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Editar Datos de Usuario</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-nombre">Nombre *</Label>
              <Input
                id="edit-nombre"
                value={editForm.nombre}
                onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-apellidos">Apellidos *</Label>
              <Input
                id="edit-apellidos"
                value={editForm.apellidos}
                onChange={e => setEditForm(f => ({ ...f, apellidos: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Correo Electrónico *</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>

            <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-905 border dark:border-slate-700/60 rounded-xl mt-4">
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Estado de acceso</p>
                <p className="text-[10px] text-slate-450 dark:text-slate-400">Permite o suspende el acceso al sistema</p>
              </div>
              <input
                type="checkbox"
                checked={editForm.activo}
                onChange={e => setEditForm(f => ({ ...f, activo: e.target.checked }))}
                className="h-5 w-5 accent-unt-blue cursor-pointer rounded"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-unt-blue hover:bg-unt-blue/90 font-bold" onClick={handleEditUser} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. Modal: Confirmar Eliminación */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Eliminar Usuario</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-slate-600 dark:text-slate-350">
              ¿Está completamente seguro de eliminar al usuario <strong>{selectedUser?.nombre} {selectedUser?.apellidos}</strong>?
            </p>
            <p className="text-xs text-rose-500 dark:text-rose-400/90 mt-3 font-semibold">
              ⚠️ Esta acción no se puede deshacer. Si el usuario es docente, se eliminará también su perfil y sus registros asociados (en caso no tengan restricciones de clave foránea).
            </p>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-red-650 hover:bg-red-700 text-white font-bold" onClick={handleDeleteUser} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
