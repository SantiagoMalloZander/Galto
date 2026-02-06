'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, ExternalLink, Trophy, TrendingUp } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface ContentPost {
  id: string
  employee: string
  title: string
  link: string
  views: number
  platform: 'instagram' | 'tiktok'
  date: string
}

interface Bounty {
  id: string
  title: string
  prize: string
  deadline: string
  photo?: string
}

const samplePosts: ContentPost[] = [
  { id: '1', employee: 'Carlos', title: 'Corte fade degradado', link: 'https://instagram.com/p/abc', views: 2450, platform: 'instagram', date: '2024-12-01' },
  { id: '2', employee: 'Juan', title: 'Tutorial barba clásica', link: 'https://tiktok.com/@user/video', views: 1890, platform: 'tiktok', date: '2024-12-02' },
  { id: '3', employee: 'Carlos', title: 'Transformación completa', link: 'https://instagram.com/p/def', views: 3120, platform: 'instagram', date: '2024-12-03' },
  { id: '4', employee: 'Mateo', title: 'Corte de temporada', link: 'https://instagram.com/p/ghi', views: 1560, platform: 'instagram', date: '2024-12-04' },
]

const sampleBounties: Bounty[] = [
  {
    id: '1',
    title: 'Video más viral de diciembre',
    prize: '$10.000 + Día libre',
    deadline: '31 de Diciembre',
  },
  {
    id: '2',
    title: 'Mejor tutorial educativo',
    prize: '$5.000',
    deadline: '15 de Diciembre',
  },
]

export default function ContenidoPage() {
  const [posts, setPosts] = useState<ContentPost[]>(samplePosts)
  const [bounties, setBounties] = useState<Bounty[]>(sampleBounties)
  const [showPostDialog, setShowPostDialog] = useState(false)
  const [showBountyDialog, setShowBountyDialog] = useState(false)

  const [postFormData, setPostFormData] = useState({
    title: '',
    link: '',
    views: 0,
    platform: 'instagram' as const,
  })

  const [bountyFormData, setBountyFormData] = useState({
    title: '',
    prize: '',
    deadline: '',
  })

  const handleAddPost = () => {
    setPosts([
      ...posts,
      {
        ...postFormData,
        id: Date.now().toString(),
        employee: 'Current User',
        date: new Date().toISOString().split('T')[0],
      },
    ])
    setShowPostDialog(false)
    setPostFormData({ title: '', link: '', views: 0, platform: 'instagram' })
  }

  const handleAddBounty = () => {
    setBounties([
      ...bounties,
      {
        ...bountyFormData,
        id: Date.now().toString(),
      },
    ])
    setShowBountyDialog(false)
    setBountyFormData({ title: '', prize: '', deadline: '' })
  }

  // Calculate leaderboard
  const employeeViews = posts.reduce((acc, post) => {
    acc[post.employee] = (acc[post.employee] || 0) + post.views
    return acc
  }, {} as Record<string, number>)

  const leaderboard = Object.entries(employeeViews)
    .map(([name, views]) => ({ name, views }))
    .sort((a, b) => b.views - a.views)

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold mb-2">Panel de contenido</h1>
        <p className="text-muted-foreground">
          Seguí el contenido creado por empleados y gestioná competencias internas
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        {/* Leaderboard */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Ranking de vistas
            </CardTitle>
            <CardDescription>Este mes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {leaderboard.map((entry, index) => (
                <div
                  key={entry.name}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={index === 0 ? 'default' : 'secondary'} className="h-8 w-8 rounded-full flex items-center justify-center p-0">
                      {index + 1}
                    </Badge>
                    <span className="font-medium">{entry.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{entry.views.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">vistas</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Estadísticas generales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-lg bg-primary/5">
                <p className="text-3xl font-bold text-primary">{posts.length}</p>
                <p className="text-sm text-muted-foreground mt-1">Posts totales</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-primary/5">
                <p className="text-3xl font-bold text-primary">
                  {posts.reduce((sum, p) => sum + p.views, 0).toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground mt-1">Vistas totales</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-primary/5">
                <p className="text-3xl font-bold text-primary">
                  {Math.round(posts.reduce((sum, p) => sum + p.views, 0) / posts.length).toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground mt-1">Vistas promedio</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-primary/5">
                <p className="text-3xl font-bold text-primary">
                  {new Set(posts.map((p) => p.employee)).size}
                </p>
                <p className="text-sm text-muted-foreground mt-1">Empleados activos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="posts" className="space-y-6">
        <TabsList>
          <TabsTrigger value="posts">Contenido publicado</TabsTrigger>
          <TabsTrigger value="bounties">Competencias y premios</TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowPostDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Agregar contenido
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {posts.map((post) => (
              <Card key={post.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {post.platform === 'instagram' ? 'Instagram' : 'TikTok'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{post.employee}</span>
                      </div>
                      <h4 className="font-semibold mb-1">{post.title}</h4>
                      <p className="text-xs text-muted-foreground">
                        {new Date(post.date).toLocaleDateString('es-AR')}
                      </p>
                    </div>
                    <a
                      href={post.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t">
                    <span className="text-sm text-muted-foreground">Vistas</span>
                    <Badge variant="secondary" className="text-base px-3">
                      {post.views.toLocaleString()}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="bounties" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowBountyDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva competencia
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {bounties.map((bounty) => (
              <Card key={bounty.id} className="border-2 border-primary/20">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Trophy className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg mb-2">{bounty.title}</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Premio:</span>
                          <Badge className="font-semibold">{bounty.prize}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Cierra:</span>
                          <span className="text-sm font-medium">{bounty.deadline}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Post Dialog */}
      <Dialog open={showPostDialog} onOpenChange={setShowPostDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar contenido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="post-title">Título *</Label>
              <Input
                id="post-title"
                value={postFormData.title}
                onChange={(e) => setPostFormData({ ...postFormData, title: e.target.value })}
                placeholder="Ej: Tutorial de corte fade"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="post-link">Link del contenido *</Label>
              <Input
                id="post-link"
                value={postFormData.link}
                onChange={(e) => setPostFormData({ ...postFormData, link: e.target.value })}
                placeholder="https://instagram.com/p/..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="post-views">Cantidad de vistas</Label>
              <Input
                id="post-views"
                type="number"
                value={postFormData.views}
                onChange={(e) => setPostFormData({ ...postFormData, views: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPostDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddPost} disabled={!postFormData.title || !postFormData.link}>
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Bounty Dialog */}
      <Dialog open={showBountyDialog} onOpenChange={setShowBountyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva competencia</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bounty-title">Título *</Label>
              <Input
                id="bounty-title"
                value={bountyFormData.title}
                onChange={(e) => setBountyFormData({ ...bountyFormData, title: e.target.value })}
                placeholder="Ej: Video más viral del mes"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bounty-prize">Premio *</Label>
              <Input
                id="bounty-prize"
                value={bountyFormData.prize}
                onChange={(e) => setBountyFormData({ ...bountyFormData, prize: e.target.value })}
                placeholder="Ej: $10.000 + Día libre"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bounty-deadline">Fecha límite</Label>
              <Input
                id="bounty-deadline"
                value={bountyFormData.deadline}
                onChange={(e) => setBountyFormData({ ...bountyFormData, deadline: e.target.value })}
                placeholder="Ej: 31 de Diciembre"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBountyDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddBounty} disabled={!bountyFormData.title || !bountyFormData.prize}>
              Crear competencia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
