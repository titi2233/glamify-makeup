"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { track } from "@/lib/analytics/track";
import { formatARS, round2 } from "@/lib/money";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CartSummary } from "@/components/cart/cart-summary";
import { AR_PROVINCES } from "@/lib/ar-provinces";
import { quoteShippingAction, createCheckoutAction } from "@/app/(storefront)/actions";

interface ItemView { id: string; name: string; variantName: string | null; qty: number; unitPrice: number }
interface Props {
  subtotal: number;
  discount: number;
  couponCode: string | null;
  couponFreeShipping: boolean;
  items: ItemView[];
  defaultName?: string;
  defaultEmail?: string;
}

type Method = "domicilio" | "sucursal";

export function CheckoutForm({ subtotal, discount, couponFreeShipping, items, defaultName = "", defaultEmail = "" }: Props) {
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<Method>("domicilio");
  const [province, setProvince] = useState("Buenos Aires");
  const [cp, setCp] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [floorApt, setFloorApt] = useState("");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");

  const [shipping, setShipping] = useState<{ cost: number; free: boolean } | null>(null);
  const [quoting, startQuote] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const shippingCost = couponFreeShipping ? 0 : shipping?.free ? 0 : shipping?.cost ?? null;
  const total = round2(subtotal - discount + (shippingCost ?? 0));

  useEffect(() => {
    track("begin_checkout", { subtotal, items: items.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const quote = () => {
    if (!/^\d{4}$/.test(cp)) { setShipping(null); return; }
    startQuote(async () => {
      const r = await quoteShippingAction({ cp, province, method });
      if (r.ok) setShipping({ cost: r.cost ?? 0, free: Boolean(r.free) });
      else setShipping(null);
    });
  };

  const validate = (): string | null => {
    if (!name.trim()) return "Ingresá tu nombre.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return "Email inválido.";
    if (!phone.trim()) return "Ingresá un teléfono.";
    if (!/^\d{4}$/.test(cp)) return "Código postal inválido (4 dígitos).";
    if (method === "domicilio" && (!street.trim() || !number.trim())) return "Completá calle y número.";
    if (shippingCost == null) return "Calculá el envío con tu código postal.";
    return null;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (v) { setError(v); return; }
    setError(null);
    startSubmit(async () => {
      const r = await createCheckoutAction({
        contactName: name, contactEmail: email, contactPhone: phone,
        shippingMethod: method,
        address: { cp, province, street, number, floorApt, city, notes },
      });
      if (r.ok && r.initPoint) window.location.href = r.initPoint;
      else setError(r.error ?? "No se pudo iniciar el pago.");
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <fieldset className="space-y-3">
          <legend className="mb-1 font-display text-lg">Contacto</legend>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre y apellido" autoComplete="name" aria-label="Nombre" />
          <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" placeholder="Email" autoComplete="email" aria-label="Email" />
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" placeholder="Teléfono" autoComplete="tel" aria-label="Teléfono" />
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="mb-1 font-display text-lg">Entrega</legend>
          <RadioGroup value={method} onValueChange={(v) => { setMethod(v as Method); setShipping(null); }} className="grid grid-cols-2 gap-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border p-3 text-sm has-[:checked]:border-primary">
              <RadioGroupItem value="domicilio" /> Envío a domicilio
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border p-3 text-sm has-[:checked]:border-primary">
              <RadioGroupItem value="sucursal" /> Sucursal de Correo
            </label>
          </RadioGroup>

          <div className="grid grid-cols-2 gap-3">
            <select value={province} onChange={(e) => { setProvince(e.target.value); setShipping(null); }} aria-label="Provincia" className="h-11 rounded-xl border border-border bg-background px-3 text-sm">
              {AR_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <div className="flex gap-2">
              <Input value={cp} onChange={(e) => { setCp(e.target.value.replace(/\D/g, "").slice(0, 4)); setShipping(null); }} onBlur={quote} inputMode="numeric" placeholder="CP" aria-label="Código postal" />
              <Button type="button" variant="outline" onClick={quote} disabled={quoting || cp.length !== 4}>
                {quoting ? <Loader2 className="size-4 animate-spin" /> : "Calcular"}
              </Button>
            </div>
          </div>

          {method === "domicilio" && (
            <div className="grid grid-cols-2 gap-3">
              <Input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Calle" autoComplete="address-line1" aria-label="Calle" />
              <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Número" aria-label="Número" />
              <Input value={floorApt} onChange={(e) => setFloorApt(e.target.value)} placeholder="Piso / Depto (opcional)" aria-label="Piso/Depto" />
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Localidad" autoComplete="address-level2" aria-label="Localidad" />
            </div>
          )}
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas para la entrega (opcional)" aria-label="Notas" />
          {shipping && <p className="text-sm text-muted-foreground">Envío: {shipping.free ? "Gratis 🎉" : formatARS(shippingCost ?? 0)}</p>}
        </fieldset>
      </div>

      <aside className="space-y-4 rounded-2xl border border-border p-5 lg:sticky lg:top-20 lg:self-start">
        <h2 className="font-display text-lg">Resumen</h2>
        <ul className="space-y-1 text-sm">
          {items.map((it) => (
            <li key={it.id} className="flex justify-between gap-2">
              <span className="text-muted-foreground">{it.name}{it.variantName ? ` — ${it.variantName}` : ""} × {it.qty}</span>
              <span className="tabular-nums">{formatARS(it.unitPrice * it.qty)}</span>
            </li>
          ))}
        </ul>
        <Separator />
        <CartSummary subtotal={subtotal} discount={discount} shippingCost={shippingCost} total={total} freeShipping={couponFreeShipping || shipping?.free} />
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
          Continuar compra
        </Button>
        <p className="text-center text-xs text-muted-foreground">Pago seguro procesado por Mercado Pago.</p>
      </aside>
    </form>
  );
}
