-- Estado de pre-imposición en MiCorreo por envío.
-- NULL = el pedido todavía no se cargó en MiCorreo (falta hacerlo a mano o reintentar).
-- Aditiva y nullable: los envíos existentes quedan en NULL, que es el estado correcto para ellos.
ALTER TABLE "Shipment" ADD COLUMN "micorreoImportedAt" TIMESTAMP(3);
