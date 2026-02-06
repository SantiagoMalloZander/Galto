'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Edit, Trash2, Copy, Shield } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'semi-admin' | 'empleado'
  permissions?: string[]
}

const initialUsers: User[] = [
  { id: '1', name: 'Admin Demo', email: 'admin@galto.com', role: 'admin' },
  { id: '2', name: 'Carlos Manager', email: 'carlos@galto.com', role: 'semi-admin', permissions: ['calendario', 'dashboard'] },
  { id: '3', name: 'Juan Empleado', email: 'juan@galto.com', role: 'empleado' },
]

const modules = [
  { id: 'reservas', name: 'Página de reservas' },
  { id: 'calendario', name: 'Calendario' },
  { id: 'cuentas', name: 'Centro de cuentas' },
  { id: 'lead-finder', name: 'Lead Finder' },
  { id: 'dashboard', name: 'Dashboard' },
  { id: 'puntos', name: 'Puntos de clientes' },
  { id: 'recompensas', name: 'Recompensas' },
  { id: 'contenido', name: 'Panel de contenido' },
]

export default function CuentasPage() {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [showDialog, setShowDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [inviteLink, setInviteLink] = useState('')

  const [formData, setFormData] = useState<Partial<User>>({
    name: '',
    email: '',
    role: 'empleado',
    permissions: [],
  })

  const handleAdd = () => {
    setEditingUser(null)
    setFormData({ name: '', email: '', role: 'empleado', permissions: [] })
    setShowDialog(true)
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setFormData(user)
    setShowDialog(true)
  }

  const handleSave = () => {
    if (editingUser) {
      setUsers(users.map((u) => (u.id === editingUser.id ? { ...u, ...formData } : u)))
    } else {
      setUsers([...users, { ...formData, id: Date.now().toString() } as User])
    }
    setShowDialog(false)
  }

  const handleDelete = (id: string) => {
    setUsers(users.filter((u) => u.id !== id))
  }

  const generateInviteLink = () => {
    setInviteLink(`https://galto.app/invite/${Math.random().toString(36).substring(7)}`)
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge variant="default">Admin</Badge>
      case 'semi-admin':
        return <Badge variant="secondary">Semi-admin</Badge>
      case 'empleado':
        return <Badge variant="outline">Empleado</Badge>
    }
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold mb-2">Centro de cuentas</h1>
        <p className="text-muted-foreground">
          Administrá usuarios, roles y permisos
        </p>
      </div>

      {/* Invite Link Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Invitar usuarios
          </CardTitle>
          <CardDescription>
            Generá un link de invitación para agregar nuevos miembros al equipo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {inviteLink ? (
            <div className="flex gap-2">
              <Input value={inviteLink} readOnly className="font-mono text-sm" />
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(inviteLink)
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button onClick={generateInviteLink}>
              Generar link de invitación
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Users List */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Usuarios</h2>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Agregar usuario
        </Button>
      </div>

      <div className="grid gap-4">
        {users.map((user) => (
          <Card key={user.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-primary">
                      {user.name.split(' ').map((n) => n[0]).join('')}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{user.name}</h4>
                      {getRoleBadge(user.role)}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{user.email}</p>
                    {user.role === 'semi-admin' && user.permissions && (
                      <div className="flex flex-wrap gap-1">
                        {user.permissions.map((perm) => (
                          <Badge key={perm} variant="outline" className="text-xs">
                            {modules.find((m) => m.id === perm)?.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(user)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(user.id)}
                    disabled={user.role === 'admin'}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Editar usuario' : 'Agregar nuevo usuario'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="user-name">Nombre completo *</Label>
              <Input
                id="user-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Juan Pérez"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-email">Email *</Label>
              <Input
                id="user-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="juan@ejemplo.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-role">Rol *</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value as User['role'] })}
              >
                <SelectTrigger id="user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin (acceso completo)</SelectItem>
                  <SelectItem value="semi-admin">Semi-admin (acceso limitado)</SelectItem>
                  <SelectItem value="empleado">Empleado (solo su calendario)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.role === 'semi-admin' && (
              <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                <Label>Permisos de acceso</Label>
                <div className="grid grid-cols-2 gap-3">
                  {modules.map((module) => (
                    <label key={module.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.permissions?.includes(module.id)}
                        onChange={(e) => {
                          const current = formData.permissions || []
                          if (e.target.checked) {
                            setFormData({ ...formData, permissions: [...current, module.id] })
                          } else {
                            setFormData({ ...formData, permissions: current.filter((p) => p !== module.id) })
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{module.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!formData.name || !formData.email}>
              {editingUser ? 'Guardar cambios' : 'Agregar usuario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
