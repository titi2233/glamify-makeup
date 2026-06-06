import type { Metadata } from "next";
import Link from "next/link";
import { Prose } from "@/components/legal/prose";

export const metadata: Metadata = {
  title: "Nosotras",
  description: "Glam accesible, no humo. Conocé la propuesta de Glamify Makeup.",
};

export default function NosotrasPage() {
  return (
    <Prose>
      <h1>Nosotras</h1>
      <p>
        Glamify Makeup nació para acercar maquillaje y accesorios lindos, en tendencia y a un precio real. Creemos en
        el <strong>glam accesible, no humo</strong>: productos que te hacen sentir bien, sin promesas exageradas ni
        precios inflados.
      </p>

      <h2>Qué nos mueve</h2>
      <p>
        Elegimos cada producto pensando en chicas reales: que rinda, que se vea lindo y que esté a tu alcance.
        Empezamos vendiendo por redes y ferias, y hoy tenemos nuestra tienda online con envíos a todo el país.
      </p>

      <h2>Nuestro compromiso</h2>
      <ul>
        <li>Stock real y precios claros, sin letra chica.</li>
        <li>Atención cercana por WhatsApp y redes.</li>
        <li>Envíos a todo el país y devoluciones simples.</li>
      </ul>

      <p>
        [COMPLETAR: sumá acá tu historia personal, dónde estás ubicada y qué te diferencia.] ¿Querés ver lo que
        tenemos? Pasá por la <Link href="/tienda">tienda</Link> o escribinos por{" "}
        <Link href="/contacto">contacto</Link>.
      </p>
    </Prose>
  );
}
