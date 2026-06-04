export interface FlatCategory {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  order: number;
  image?: string | null;
  active?: boolean;
}

export interface CategoryNode {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  order: number;
  image?: string | null;
  children: CategoryNode[];
}

/** Construye el árbol (máx 2 niveles) desde la lista plana; excluye inactivas; ordena por `order` y nombre (es). */
export function buildCategoryTree(categories: FlatCategory[]): CategoryNode[] {
  const usable = categories.filter((c) => c.active !== false);
  const byId = new Map<string, CategoryNode>();
  for (const c of usable) {
    byId.set(c.id, {
      id: c.id,
      slug: c.slug,
      name: c.name,
      parentId: c.parentId,
      order: c.order,
      image: c.image ?? null,
      children: [],
    });
  }
  const roots: CategoryNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sortRec = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "es"));
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

export interface ResolvedCategory {
  category: CategoryNode;
  subcategory?: CategoryNode;
  /** Ids cuyos productos pertenecen a la vista (categoría padre incluye descendientes). */
  categoryIds: string[];
}

export function findCategoryByPath(
  tree: CategoryNode[],
  categorySlug: string,
  subcategorySlug?: string,
): ResolvedCategory | null {
  const category = tree.find((c) => c.slug === categorySlug);
  if (!category) return null;
  if (subcategorySlug) {
    const subcategory = category.children.find((c) => c.slug === subcategorySlug);
    if (!subcategory) return null;
    return { category, subcategory, categoryIds: [subcategory.id] };
  }
  return { category, categoryIds: [category.id, ...category.children.map((c) => c.id)] };
}

export interface Crumb {
  label: string;
  href: string;
  current: boolean;
}

export function buildBreadcrumbs(input: {
  category?: CategoryNode | null;
  subcategory?: CategoryNode | null;
  product?: { name: string; slug: string } | null;
}): Crumb[] {
  const crumbs: Crumb[] = [
    { label: "Inicio", href: "/", current: false },
    { label: "Tienda", href: "/tienda", current: false },
  ];
  if (input.category) {
    crumbs.push({ label: input.category.name, href: `/tienda/${input.category.slug}`, current: false });
    if (input.subcategory) {
      crumbs.push({
        label: input.subcategory.name,
        href: `/tienda/${input.category.slug}/${input.subcategory.slug}`,
        current: false,
      });
    }
  }
  if (input.product) {
    crumbs.push({ label: input.product.name, href: `/producto/${input.product.slug}`, current: true });
  } else if (crumbs.length > 0) {
    crumbs[crumbs.length - 1].current = true;
  }
  return crumbs;
}
