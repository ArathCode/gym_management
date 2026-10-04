## Rediseño Frontend — Módulo de Miembros

Quiero comenzar el rediseño visual del frontend del sistema de gestión de Moicano Boxing Club.

Antes de realizar cambios:

1. Lee y respeta `AGENTS.md` para comprender:
   - arquitectura del proyecto,
   - módulos existentes,
   - reglas de negocio,
   - responsabilidades del frontend y backend.

2. Lee y utiliza la skill de diseño disponible para Moicano Boxing Club:
   - identidad visual,
   - paleta de colores,
   - tipografía,
   - espaciados,
   - botones,
   - cards,
   - inputs,
   - estados,
   - iconografía,
   - principios de accesibilidad.

3. Inspecciona primero la implementación actual del frontend.
   No reemplaces funcionalidades existentes ni cambies contratos con la API sin necesidad.

---

# Objetivo

Rediseñar primero la sección **Miembros**, tomando como referencia visual el mockup proporcionado.

Quiero mantener todas las funcionalidades actuales, pero transformar la interfaz en una experiencia más moderna, limpia y consistente con la identidad de Moicano Boxing Club.

El estilo debe ser:

- minimalista,
- moderno,
- profesional,
- limpio,
- deportivo de manera discreta,
- predominio de blanco y gris claro,
- negro para jerarquía,
- rojo Moicano como color de énfasis.

Evita sobrecargar la interfaz.

---

# 1. Barra de navegación

Rediseña la navegación principal siguiendo el concepto visual de una barra tipo **Liquid Glass de iOS**, como se muestra en la referencia.

Debe sentirse como una cápsula flotante de navegación.

Características visuales:

- forma completamente redondeada tipo pill/capsule,
- apariencia translúcida tipo vidrio,
- backdrop blur,
- borde blanco/gris muy sutil,
- sombra suave,
- ligero brillo interior,
- sensación de profundidad sin exagerarla.

No debe parecer una navbar HTML tradicional.

Debe mantenerse elegante y ligera.

---

## Items principales

Mostrar únicamente los módulos más utilizados directamente en la barra:

- Inicio
- Miembros
- Pagos
- Accesos
- Punto de venta
- Reportes
- Más

Cada elemento debe tener:

- icono,
- texto,
- buen espaciado,
- estados hover,
- estado seleccionado.

Utiliza la librería de iconos ya existente en el proyecto. Si no existe una, preferir `lucide-react`.

---

## Estado activo

En la pantalla actual:

```text
Miembros