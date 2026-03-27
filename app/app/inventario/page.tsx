'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Boxes, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { getStoredAuthSession } from '@/lib/auth';
import { useBranchContext } from '@/hooks/use-branch-context';

type InventoryContext = {
  branch: {
    id: string;
    name: string;
    slug: string;
  };
  settings: {
    useInventory: boolean;
  };
  products: Array<{
    id: string;
    name: string;
    priceCents: number;
    stockQuantity: number;
    trackMinStock: boolean;
    minStockQuantity: number;
    photoUrl: string | null;
    isActive: boolean;
    soldQuantity: number;
    createdAt: string;
    updatedAt: string;
  }>;
};

type InventoryPermissions = {
  canRead: boolean;
  canWrite: boolean;
};

type EditableProduct = {
  id: string;
  name: string;
  priceArs: string;
  stockQuantity: string;
  trackMinStock: boolean;
  minStockQuantity: string;
  photoUrl: string;
  isActive: boolean;
  soldQuantity: number;
};

export default function InventarioPage() {
  const [session] = useState(() => getStoredAuthSession());
  const { loading: loadingBranchContext, tenant, branches, activeBranchId } = useBranchContext();

  const [tenantId, setTenantId] = useState('');
  const [branchId, setBranchId] = useState('');

  const [context, setContext] = useState<InventoryContext | null>(null);
  const [permissions, setPermissions] = useState<InventoryPermissions>({ canRead: false, canWrite: false });
  const [useInventory, setUseInventory] = useState(false);
  const [editableProducts, setEditableProducts] = useState<EditableProduct[]>([]);

  const [newName, setNewName] = useState('');
  const [newPriceArs, setNewPriceArs] = useState('0');
  const [newStockQuantity, setNewStockQuantity] = useState('0');
  const [newTrackMinStock, setNewTrackMinStock] = useState(false);
  const [newMinStockQuantity, setNewMinStockQuantity] = useState('0');
  const [newPhotoUrl, setNewPhotoUrl] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(loadingBranchContext);
    if (!loadingBranchContext) {
      setTenantId(tenant?.tenantId ?? '');
      if (activeBranchId) setBranchId(activeBranchId);
      else if (branches[0]?.id) setBranchId(branches[0].id);
    }
  }, [loadingBranchContext, tenant?.tenantId, activeBranchId, branches]);

  useEffect(() => {
    if (!tenantId || !branchId || !session?.user?.id) return;
    void loadContext(branchId, tenantId);
  }, [tenantId, branchId, session?.user?.id]);

  const lowStockCount = useMemo(
    () =>
      editableProducts.filter(
        (row) => row.trackMinStock && Number(row.stockQuantity || 0) <= Number(row.minStockQuantity || 0),
      ).length,
    [editableProducts],
  );

  async function loadContext(nextBranchId: string, nextTenantId: string) {
    if (!session?.user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/inventario/branches/${encodeURIComponent(nextBranchId)}?userId=${encodeURIComponent(session.user.id)}&tenantId=${encodeURIComponent(nextTenantId)}`,
        { cache: 'no-store' },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? 'No se pudo cargar inventario');

      const ctx = payload?.context as InventoryContext;
      setContext(ctx);
      setPermissions(payload?.permissions ?? { canRead: false, canWrite: false });
      setUseInventory(Boolean(ctx?.settings?.useInventory));
      setEditableProducts(
        (ctx?.products ?? []).map((row) => ({
          id: row.id,
          name: row.name,
          priceArs: centsToArs(row.priceCents),
          stockQuantity: String(row.stockQuantity ?? 0),
          trackMinStock: Boolean(row.trackMinStock),
          minStockQuantity: String(row.minStockQuantity ?? 0),
          photoUrl: row.photoUrl ?? '',
          isActive: Boolean(row.isActive),
          soldQuantity: Number(row.soldQuantity ?? 0),
        })),
      );
    } catch (err: any) {
      setError(err?.message ?? 'Error cargando inventario');
    } finally {
      setLoading(false);
    }
  }

  async function postAction(action: string, body: Record<string, unknown>) {
    if (!session?.user?.id || !tenantId || !branchId) return null;

    const response = await fetch(`/api/inventario/branches/${encodeURIComponent(branchId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: session.user.id,
        tenantId,
        action,
        ...body,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.message ?? 'No se pudo guardar');
    }
    return payload;
  }

  async function handleSaveSettings() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await postAction('update_settings', { useInventory });
      setMessage('Configuración de inventario actualizada.');
      await loadContext(branchId, tenantId);
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo guardar configuración');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateProduct() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await postAction('upsert_product', {
        name: newName,
        priceCents: arsToCents(newPriceArs),
        stockQuantity: Math.max(0, Number(newStockQuantity || 0)),
        trackMinStock: newTrackMinStock,
        minStockQuantity: newTrackMinStock ? Math.max(0, Number(newMinStockQuantity || 0)) : 0,
        photoUrl: newPhotoUrl || null,
        isActive: true,
      });
      setNewName('');
      setNewPriceArs('0');
      setNewStockQuantity('0');
      setNewTrackMinStock(false);
      setNewMinStockQuantity('0');
      setNewPhotoUrl('');
      setMessage('Producto creado en inventario.');
      await loadContext(branchId, tenantId);
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo crear el producto');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveProduct(product: EditableProduct) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await postAction('upsert_product', {
        productId: product.id,
        name: product.name,
        priceCents: arsToCents(product.priceArs),
        stockQuantity: Math.max(0, Number(product.stockQuantity || 0)),
        trackMinStock: product.trackMinStock,
        minStockQuantity: product.trackMinStock ? Math.max(0, Number(product.minStockQuantity || 0)) : 0,
        photoUrl: product.photoUrl || null,
        isActive: product.isActive,
      });
      setMessage('Producto actualizado.');
      await loadContext(branchId, tenantId);
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo guardar el producto');
    } finally {
      setSaving(false);
    }
  }

  async function onNewPhotoSelected(file: File | null) {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setNewPhotoUrl(dataUrl);
  }

  async function onProductPhotoSelected(index: number, file: File | null) {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setEditableProducts((current) =>
      current.map((row, idx) => (idx === index ? { ...row, photoUrl: dataUrl } : row)),
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-10 text-sm text-muted-foreground">Cargando inventario...</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2">Inventario</h1>
          <p className="text-muted-foreground">Productos físicos y stock por sucursal.</p>
        </div>
        <Badge className="gap-2 py-2 px-3">
          <Boxes className="h-4 w-4" />
          {context?.branch?.name ?? 'Sucursal'}
        </Badge>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Configuración de inventario</CardTitle>
          <CardDescription>Si desactivás inventario, los productos no aparecen para cobrar desde calendario.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="font-medium">Usar inventario de productos</p>
              <p className="text-sm text-muted-foreground">Activa/desactiva venta de productos físicos en calendario.</p>
            </div>
            <Switch checked={useInventory} onCheckedChange={setUseInventory} disabled={!permissions.canWrite || saving} />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleSaveSettings} disabled={!permissions.canWrite || saving}>
              <Save className="h-4 w-4 mr-2" />
              Guardar configuración
            </Button>
            {lowStockCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-amber-700 text-sm">
                <AlertTriangle className="h-4 w-4" /> {lowStockCount} producto(s) con alerta de stock.
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agregar producto</CardTitle>
          <CardDescription>Cargá nombre, precio, stock y foto opcional.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Ej: Shampoo profesional" />
          </div>
          <div className="space-y-2">
            <Label>Precio (ARS)</Label>
            <Input value={newPriceArs} onChange={(event) => setNewPriceArs(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Stock actual</Label>
            <Input type="number" min={0} value={newStockQuantity} onChange={(event) => setNewStockQuantity(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Foto (opcional)</Label>
            <Input type="file" accept="image/*" onChange={(event) => void onNewPhotoSelected(event.target.files?.[0] ?? null)} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3 md:col-span-2">
            <div>
              <p className="font-medium">Definir stock mínimo</p>
              <p className="text-sm text-muted-foreground">Activa alerta visual cuando llegue al mínimo.</p>
            </div>
            <Switch checked={newTrackMinStock} onCheckedChange={setNewTrackMinStock} />
          </div>
          {newTrackMinStock ? (
            <div className="space-y-2 md:col-span-2">
              <Label>Stock mínimo</Label>
              <Input type="number" min={0} value={newMinStockQuantity} onChange={(event) => setNewMinStockQuantity(event.target.value)} />
            </div>
          ) : null}
          <div className="md:col-span-2">
            <Button onClick={handleCreateProduct} disabled={!permissions.canWrite || saving}>
              Crear producto
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Productos cargados</CardTitle>
          <CardDescription>Podés editar stock y datos en cualquier momento.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {editableProducts.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">No hay productos cargados.</div>
          ) : null}
          {editableProducts.map((product, index) => {
            const lowStock =
              product.trackMinStock && Number(product.stockQuantity || 0) <= Number(product.minStockQuantity || 0);
            return (
              <div key={product.id} className="rounded-md border p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {product.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.photoUrl} alt={product.name} className="h-12 w-12 rounded-md border object-cover" />
                    ) : (
                      <div className="h-12 w-12 rounded-md border bg-muted flex items-center justify-center text-xs text-muted-foreground">
                        Sin foto
                      </div>
                    )}
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">Vendidos: {product.soldQuantity}</p>
                    </div>
                  </div>
                  <Badge variant={lowStock ? 'destructive' : product.isActive ? 'default' : 'secondary'}>
                    {lowStock ? 'Stock bajo' : product.isActive ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Nombre</Label>
                    <Input
                      value={product.name}
                      onChange={(event) =>
                        setEditableProducts((current) =>
                          current.map((row, idx) => (idx === index ? { ...row, name: event.target.value } : row)),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Precio (ARS)</Label>
                    <Input
                      value={product.priceArs}
                      onChange={(event) =>
                        setEditableProducts((current) =>
                          current.map((row, idx) => (idx === index ? { ...row, priceArs: event.target.value } : row)),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Stock actual</Label>
                    <Input
                      type="number"
                      min={0}
                      value={product.stockQuantity}
                      onChange={(event) =>
                        setEditableProducts((current) =>
                          current.map((row, idx) => (idx === index ? { ...row, stockQuantity: event.target.value } : row)),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Foto (opcional)</Label>
                    <Input type="file" accept="image/*" onChange={(event) => void onProductPhotoSelected(index, event.target.files?.[0] ?? null)} />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <label className="flex items-center justify-between rounded-md border p-3">
                    <span className="text-sm">Definir stock mínimo</span>
                    <Switch
                      checked={product.trackMinStock}
                      onCheckedChange={(checked) =>
                        setEditableProducts((current) =>
                          current.map((row, idx) => (idx === index ? { ...row, trackMinStock: checked } : row)),
                        )
                      }
                    />
                  </label>

                  <label className="flex items-center justify-between rounded-md border p-3">
                    <span className="text-sm">Producto activo</span>
                    <Switch
                      checked={product.isActive}
                      onCheckedChange={(checked) =>
                        setEditableProducts((current) =>
                          current.map((row, idx) => (idx === index ? { ...row, isActive: checked } : row)),
                        )
                      }
                    />
                  </label>
                </div>

                {product.trackMinStock ? (
                  <div className="space-y-2">
                    <Label>Stock mínimo</Label>
                    <Input
                      type="number"
                      min={0}
                      value={product.minStockQuantity}
                      onChange={(event) =>
                        setEditableProducts((current) =>
                          current.map((row, idx) => (idx === index ? { ...row, minStockQuantity: event.target.value } : row)),
                        )
                      }
                    />
                  </div>
                ) : null}

                <Button onClick={() => void handleSaveProduct(product)} disabled={!permissions.canWrite || saving}>
                  Guardar producto
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function arsToCents(raw: string) {
  const normalized = String(raw ?? '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 100);
}

function centsToArs(cents: number) {
  const ars = Number(cents ?? 0) / 100;
  return ars.toFixed(0);
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('No se pudo leer el archivo'));
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}
