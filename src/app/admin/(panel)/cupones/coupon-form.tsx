"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Ticket, Percent, Target, SlidersHorizontal, CalendarClock, Power, AlertCircle, type LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { CouponFormInput } from "@/lib/admin/coupons/validation";
import { createCouponAction, updateCouponAction } from "@/app/admin/(panel)/cupones/actions";

type CouponType = CouponFormInput["type"];
type CouponScope = CouponFormInput["scope"];

interface Props {
  /** Si viene, el form edita ese cupón; si no, crea uno nuevo. */
  couponId?: string;
  initial?: CouponFormInput;
}

const EMPTY: CouponFormInput = {
  code: "",
  type: "percentage",
  value: "",
  scope: "all",
  scopeId: "",
  minSubtotal: "",
  maxUses: "",
  perCustomerLimit: "",
  validFrom: "",
  validTo: "",
  active: true,
};

const selectClass =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm";

/** Cabecera de sección de formulario: medallón chico + título serif + ayuda opcional. */
function SectionHeader({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="space-y-1">
      <h2 className="flex items-center gap-2.5 font-display text-lg font-semibold text-foreground">
        <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary" aria-hidden>
          <Icon className="size-[18px]" />
        </span>
        {title}
      </h2>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function CouponForm({ couponId, initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<CouponFormInput>(initial ?? EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const set = <K extends keyof CouponFormInput>(key: K, value: CouponFormInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startSaving(async () => {
      const r = couponId
        ? await updateCouponAction(couponId, form)
        : await createCouponAction(form);
      if (r.ok) {
        router.push("/admin/cupones");
        router.refresh();
      } else {
        setError(r.error ?? "No se pudo guardar el cupón.");
      }
    });
  };

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-6">
      {/* Descuento: código + tipo + valor */}
      <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft space-y-4">
        <SectionHeader icon={Ticket} title="El descuento" hint="El código y cuánto ahorra la clienta." />

        <div className="space-y-2">
          <Label htmlFor="code">Código</Label>
          <Input
            id="code"
            value={form.code}
            onChange={(e) => set("code", e.target.value.toUpperCase())}
            placeholder="Ej: GLAM10"
            autoCapitalize="characters"
            className="font-semibold tracking-wide"
          />
          <p className="text-xs text-muted-foreground">Es lo que escribe la clienta al pagar. Solo letras, números y guiones.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="type">Tipo de descuento</Label>
            <select
              id="type"
              value={form.type}
              onChange={(e) => set("type", e.target.value as CouponType)}
              className={selectClass}
            >
              <option value="percentage">Porcentaje (%)</option>
              <option value="fixed">Monto fijo ($)</option>
              <option value="free_shipping">Envío gratis</option>
            </select>
          </div>

          {form.type !== "free_shipping" && (
            <div className="space-y-2">
              <Label htmlFor="value">{form.type === "percentage" ? "Porcentaje (1 a 100)" : "Monto en $"}</Label>
              <Input
                id="value"
                value={form.value}
                onChange={(e) => set("value", e.target.value)}
                inputMode="decimal"
                placeholder={form.type === "percentage" ? "10" : "1500"}
              />
            </div>
          )}
        </div>
      </section>

      {/* Alcance: a qué se aplica */}
      <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft space-y-4">
        <SectionHeader icon={Target} title="A qué se aplica" hint="Podés limitar el descuento a una categoría o a un producto." />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="scope">Aplica a</Label>
            <select
              id="scope"
              value={form.scope}
              onChange={(e) => set("scope", e.target.value as CouponScope)}
              className={selectClass}
            >
              <option value="all">Todo el carrito</option>
              <option value="category">Una categoría</option>
              <option value="product">Un producto</option>
            </select>
          </div>

          {form.scope !== "all" && (
            <div className="space-y-2">
              <Label htmlFor="scopeId">{form.scope === "category" ? "ID de la categoría" : "ID del producto"}</Label>
              <Input
                id="scopeId"
                value={form.scopeId}
                onChange={(e) => set("scopeId", e.target.value)}
                placeholder="Pegá el ID"
              />
            </div>
          )}
        </div>
      </section>

      {/* Condiciones y límites */}
      <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft space-y-4">
        <SectionHeader icon={SlidersHorizontal} title="Condiciones y límites" hint="Todo opcional: dejalos vacíos si no querés poner topes." />

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="minSubtotal">Mínimo de compra ($)</Label>
            <Input id="minSubtotal" value={form.minSubtotal} onChange={(e) => set("minSubtotal", e.target.value)} inputMode="decimal" placeholder="Opcional" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxUses">Máximo de usos</Label>
            <Input id="maxUses" value={form.maxUses} onChange={(e) => set("maxUses", e.target.value)} inputMode="numeric" placeholder="Opcional" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="perCustomerLimit">Usos por clienta</Label>
            <Input id="perCustomerLimit" value={form.perCustomerLimit} onChange={(e) => set("perCustomerLimit", e.target.value)} inputMode="numeric" placeholder="Opcional" />
          </div>
        </div>
      </section>

      {/* Vigencia */}
      <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft space-y-4">
        <SectionHeader icon={CalendarClock} title="Vigencia" hint="Desde y hasta cuándo se puede usar. Dejalos vacíos para que no caduque." />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="validFrom">Válido desde</Label>
            <Input id="validFrom" type="date" value={form.validFrom} onChange={(e) => set("validFrom", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="validTo">Válido hasta</Label>
            <Input id="validTo" type="date" value={form.validTo} onChange={(e) => set("validTo", e.target.value)} />
          </div>
        </div>
      </section>

      {/* Estado */}
      <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft space-y-4">
        <SectionHeader icon={Power} title="Estado" />

        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-surface-alt/40 px-4 py-3">
          <Label htmlFor="active" className="cursor-pointer">
            <span className="block font-medium">Cupón activo</span>
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Si lo desactivás, las clientas no pueden usarlo al pagar.</span>
          </Label>
          <Switch id="active" checked={form.active} onCheckedChange={(c) => set("active", c)} />
        </div>
      </section>

      {error && (
        <p className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-red-700" role="alert">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {couponId ? "Guardar cambios" : "Crear cupón"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/admin/cupones")}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
