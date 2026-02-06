'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Branch {
  id: string
  name: string
}

interface AddBranchDialogProps {
  branches: Branch[]
  onAdd: (branch: Branch) => void
  onCancel: () => void
}

export function AddBranchDialog({ branches, onAdd, onCancel }: AddBranchDialogProps) {
  const [name, setName] = useState('')
  const [importFrom, setImportFrom] = useState<string>('')

  const handleSubmit = () => {
    if (name) {
      onAdd({
        id: Date.now().toString(),
        name,
      })
    }
  }

  return (
    <div className="space-y-6 py-4">
      <div className="space-y-2">
        <Label htmlFor="branch-name">Nombre de la sucursal</Label>
        <Input
          id="branch-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Sucursal Palermo"
        />
      </div>

      {branches.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="import-from">Importar servicios desde otra sucursal (opcional)</Label>
          <Select value={importFrom} onValueChange={setImportFrom}>
            <SelectTrigger id="import-from">
              <SelectValue placeholder="Seleccioná una sucursal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No importar</SelectItem>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Los servicios se copiarán a la nueva sucursal
          </p>
        </div>
      )}

      <div className="flex gap-2 justify-end pt-4">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={!name}>
          Crear sucursal
        </Button>
      </div>
    </div>
  )
}
