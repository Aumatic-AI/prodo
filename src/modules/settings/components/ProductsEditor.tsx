"use client";

import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { UnsavedChangesBar } from "@/components/ui/UnsavedChangesBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { useProfile, useSaveProfile } from "../hooks/useProfile";
import { Plus, Trash2 } from "lucide-react";
import type { Product } from "@/core/profile";

export function ProductsEditor() {
  const { data: profile, isLoading, error, refetch } = useProfile();
  const saveMutation = useSaveProfile();

  const [products, setProducts] = useState<Product[]>([]);

  const saved = useMemo<Product[]>(() => profile?.products || [], [profile]);

  useEffect(() => {
    if (profile) setProducts(saved.length ? saved : []);
  }, [profile, saved]);

  const hasChanges = JSON.stringify(products) !== JSON.stringify(saved);

  function addProduct() {
    setProducts((prev) => [...prev, { name: "", description: "" }]);
  }

  function removeProduct(index: number) {
    setProducts((prev) => prev.filter((_, i) => i !== index));
  }

  function updateProduct(index: number, field: keyof Product, value: string) {
    setProducts((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }

  function discard() {
    setProducts(saved);
  }

  async function save() {
    const fd = new FormData();
    fd.set("products", JSON.stringify(products.filter((p) => p.name.trim())));
    await saveMutation.mutateAsync(fd);
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-1/2" />
      </div>
    );
  }

  if (error) return <ErrorState message="Failed to load products" onRetry={() => refetch()} />;

  return (
    <>
      <div className="divide-y divide-[var(--color-border-subtle)]">
        {products.map((product, i) => (
          <div key={i} className="flex items-start gap-3 py-4 first:pt-0">
            <div className="flex-1 space-y-3">
              <div>
                <label htmlFor={`product-name-${i}`} className="block text-sm font-medium mb-1">
                  Name
                </label>
                <Input
                  id={`product-name-${i}`}
                  placeholder="Product name"
                  value={product.name}
                  onChange={(e) => updateProduct(i, "name", e.target.value)}
                />
              </div>
              <div>
                <label htmlFor={`product-desc-${i}`} className="block text-sm text-muted mb-1">
                  Description
                </label>
                <Textarea
                  id={`product-desc-${i}`}
                  placeholder="Short description (optional)"
                  rows={2}
                  className="min-h-0"
                  value={product.description || ""}
                  onChange={(e) => updateProduct(i, "description", e.target.value)}
                />
              </div>
            </div>
            <button
              onClick={() => removeProduct(i)}
              className="mt-7 p-1.5 text-muted hover:text-danger transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        <Button variant="ghost" size="sm" onClick={addProduct}>
          <Plus className="w-4 h-4" />
          Add product
        </Button>
      </div>

      <UnsavedChangesBar
        show={hasChanges}
        loading={saveMutation.isPending}
        onSave={save}
        onDiscard={discard}
      />
    </>
  );
}
