'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Edit, Trash2, Upload, Trophy, Medal, Award } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

interface Reward {
  id: string
  title: string
  description: string
  photo?: string
  winners?: string[]
}

interface LeaderboardEntry {
  id: string
  name: string
  score: number
  rank: number
}

const initialRewards: Reward[] = [
  {
    id: '1',
    title: 'Empleado del Mes',
    description: 'Mejor desempeño general del mes',
    winners: ['Carlos - Noviembre 2024'],
  },
  {
    id: '2',
    title: 'Más Servicios Realizados',
    description: 'Mayor cantidad de cortes en el mes',
    winners: ['Juan - Noviembre 2024'],
  },
]

const leaderboard: LeaderboardEntry[] = [
  { id: '1', name: 'Carlos', score: 156, rank: 1 },
  { id: '2', name: 'Juan', score: 142, rank: 2 },
  { id: '3', name: 'Mateo', score: 128, rank: 3 },
]

export default function RecompensasPage() {
  const [rewards, setRewards] = useState<Reward[]>(initialRewards)
  const [showDialog, setShowDialog] = useState(false)
  const [editingReward, setEditingReward] = useState<Reward | null>(null)

  const [formData, setFormData] = useState<Partial<Reward>>({
    title: '',
    description: '',
  })

  const handleAdd = () => {
    setEditingReward(null)
    setFormData({ title: '', description: '' })
    setShowDialog(true)
  }

  const handleEdit = (reward: Reward) => {
    setEditingReward(reward)
    setFormData(reward)
    setShowDialog(true)
  }

  const handleSave = () => {
    if (editingReward) {
      setRewards(rewards.map((r) => (r.id === editingReward.id ? { ...r, ...formData } : r)))
    } else {
      setRewards([...rewards, { ...formData, id: Date.now().toString() } as Reward])
    }
    setShowDialog(false)
  }

  const handleDelete = (id: string) => {
    setRewards(rewards.filter((r) => r.id !== id))
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-8 w-8 text-yellow-500" />
      case 2:
        return <Medal className="h-8 w-8 text-gray-400" />
      case 3:
        return <Award className="h-8 w-8 text-amber-600" />
      default:
        return null
    }
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold mb-2">Recompensas para empleados</h1>
        <p className="text-muted-foreground">
          Creá incentivos y premiá a tu equipo
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Ranking interno
            </CardTitle>
            <CardDescription>
              Tabla de posiciones visible para todos los empleados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {leaderboard.map((entry) => (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between p-4 rounded-lg ${
                    entry.rank <= 3 ? 'bg-primary/5 border-2 border-primary/20' : 'border'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {getRankIcon(entry.rank) || (
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <span className="font-semibold text-sm">{entry.rank}</span>
                      </div>
                    )}
                    <div>
                      <p className="font-semibold">{entry.name}</p>
                      <p className="text-sm text-muted-foreground">Servicios este mes</p>
                    </div>
                  </div>
                  <Badge variant={entry.rank <= 3 ? 'default' : 'secondary'} className="text-lg px-4 py-1">
                    {entry.score}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Current Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Estadísticas del mes</CardTitle>
            <CardDescription>Desempeño general del equipo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Total de servicios</span>
                  <span className="text-2xl font-bold text-primary">426</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: '85%' }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">85% del objetivo mensual (500)</p>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Facturación del equipo</span>
                  <span className="text-2xl font-bold text-primary">$2.1M</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: '70%' }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">70% del objetivo mensual ($3M)</p>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Calificación promedio</span>
                  <span className="text-2xl font-bold text-primary">4.8</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: '96%' }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">De 5.0 estrellas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rewards Section */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-semibold">Recompensas y premios</h2>
          <p className="text-sm text-muted-foreground">
            Definí las recompensas que querés otorgar
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva recompensa
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {rewards.map((reward) => (
          <Card key={reward.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1">
                  <h4 className="font-semibold text-lg mb-2">{reward.title}</h4>
                  <p className="text-sm text-muted-foreground mb-3">{reward.description}</p>
                  {reward.winners && reward.winners.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Ganadores anteriores:</p>
                      {reward.winners.map((winner, index) => (
                        <Badge key={index} variant="secondary" className="mr-2">
                          {winner}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(reward)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(reward.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              {reward.photo && (
                <div className="aspect-video rounded-lg bg-muted" />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingReward ? 'Editar recompensa' : 'Nueva recompensa'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reward-title">Título de la recompensa *</Label>
              <Input
                id="reward-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ej: Empleado del Mes"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reward-description">Descripción *</Label>
              <Textarea
                id="reward-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe los criterios o logros para obtener esta recompensa"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Foto de la recompensa (opcional)</Label>
              <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Clic para subir una foto</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!formData.title || !formData.description}>
              {editingReward ? 'Guardar cambios' : 'Crear recompensa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
