export interface LocalCartItem {
  productId: number;
  variantId: number;
  quantity: number;
  selectedColor?: string;
}

export interface ProductColorOption {
  label: string;
  shortLabel: string;
  swatch: string;
  border: string;
  variantId?: number;
}

export function getCartItemKey(
  item: Pick<LocalCartItem, 'productId' | 'variantId' | 'selectedColor'>
): string {
  return `${Number(item.productId)}::${Number(item.variantId)}::${String(
    item.selectedColor || ''
  )
    .trim()
    .toLowerCase()}`;
}

export function isPenOrWritingProduct(product: any): boolean {
  if (!product) return false;
  const cat = `${product.categorySlug || ''} ${product.categoryName || ''}`.toLowerCase();
  const text = `${product.name || ''} ${product.sku || ''} ${
    product.illustrationType || ''
  }`.toLowerCase();
  if (
    cat.includes('pen') ||
    cat.includes('writing') ||
    cat.includes('marker') ||
    cat.includes('highlighter')
  ) {
    if (text.includes('graphite pencil') && !text.includes('pen')) return false;
    return true;
  }
  return (
    /\b(pen|pens|roller|ballpoint|gel pen|fountain|marker|highlighter|fineliner|refill)\b/i.test(
      text
    ) && !text.includes('pencil tin')
  );
}

export function getColorSwatchStyle(colorText: string): { swatch: string; border: string } {
  const lower = (colorText || '').toLowerCase();
  if (
    lower.includes('assorted') ||
    lower.includes('multi') ||
    lower.includes('shades') ||
    (lower.includes('blue') && lower.includes('black'))
  ) {
    return {
      swatch: 'conic-gradient(#1D4ED8 0deg 120deg, #1F1C18 120deg 240deg, #B44C2E 240deg 360deg)',
      border: '#B44C2E',
    };
  }
  if (lower.includes('navy')) return { swatch: '#1E3A8A', border: '#1E3A8A' };
  if (lower.includes('blue') || lower.includes('turquoise')) {
    return { swatch: '#1D4ED8', border: '#1D4ED8' };
  }
  if (lower.includes('black') && lower.includes('gold')) {
    return {
      swatch: 'linear-gradient(135deg, #1F1C18 55%, #C67D3B 45%)',
      border: '#8C341B',
    };
  }
  if (lower.includes('black')) return { swatch: '#1F1C18', border: '#1F1C18' };
  if (lower.includes('red') || lower.includes('crimson') || lower.includes('burgundy')) {
    return { swatch: '#B44C2E', border: '#8C341B' };
  }
  if (lower.includes('green') || lower.includes('emerald')) {
    return { swatch: '#15803D', border: '#15803D' };
  }
  if (lower.includes('grey') || lower.includes('gray') || lower.includes('slate')) {
    return { swatch: '#5C5349', border: '#5C5349' };
  }
  if (lower.includes('violet') || lower.includes('purple')) {
    return { swatch: '#7C3AED', border: '#7C3AED' };
  }
  if (lower.includes('pink') || lower.includes('magenta')) {
    return { swatch: '#DB2777', border: '#DB2777' };
  }
  return { swatch: '#1D4ED8', border: '#1D4ED8' };
}

export function getProductColorOptions(product: any): ProductColorOption[] {
  if (!product) return [];
  const variants: any[] = Array.isArray(product.variants) ? product.variants : [];

  if (isPenOrWritingProduct(product)) {
    const standardPenColors = [
      { label: 'Blue Ink', shortLabel: 'Blue', keyword: 'blue' },
      { label: 'Black Ink', shortLabel: 'Black', keyword: 'black' },
      { label: 'Red Ink', shortLabel: 'Red', keyword: 'red' },
      { label: 'Green Ink', shortLabel: 'Green', keyword: 'green' },
      { label: 'Assorted (Multi-Colour)', shortLabel: 'Assorted', keyword: 'assorted' },
    ];

    return standardPenColors.map((sc) => {
      const style = getColorSwatchStyle(sc.label);
      const matchedVariant = variants.find((v) => {
        const vText = `${v.variantName || ''} ${v.attributeValue || ''}`.toLowerCase();
        if (sc.keyword === 'assorted') {
          return vText.includes('assorted') || (vText.includes('blue') && vText.includes('black'));
        }
        return (
          vText.includes(sc.keyword) &&
          !vText.includes('assorted') &&
          !(sc.keyword !== 'black' && vText.includes('+') && vText.includes('black'))
        );
      });
      return {
        label: sc.label,
        shortLabel: sc.shortLabel,
        swatch: style.swatch,
        border: style.border,
        variantId: matchedVariant?.id,
      };
    });
  }

  const colorVariants = variants.filter((v) => {
    const attr = String(v.attributeType || '').toLowerCase();
    const name = String(v.variantName || '').toLowerCase();
    return (
      attr.includes('colour') ||
      attr.includes('color') ||
      attr.includes('finish') ||
      /\b(blue|black|red|green|navy|grey|slate|gold)\b/i.test(name)
    );
  });

  if (colorVariants.length > 0) {
    return colorVariants.map((v) => {
      const cleanLabel = v.attributeValue || v.variantName;
      const style = getColorSwatchStyle(cleanLabel);
      return {
        label: cleanLabel,
        shortLabel: cleanLabel,
        swatch: style.swatch,
        border: style.border,
        variantId: v.id,
      };
    });
  }

  return [];
}

/** Smart filter matchers for Indian stationery buyers */
export function matchesRulingFilter(product: any, ruling: string): boolean {
  if (!ruling || ruling === 'ALL') return true;
  const text = `${product.name || ''} ${product.description || ''} ${product.shortDescription || ''} ${
    Array.isArray(product.variants)
      ? product.variants.map((v: any) => v.variantName || '').join(' ')
      : ''
  }`.toLowerCase();
  if (ruling === 'SINGLE_RULED') return text.includes('single') || text.includes('ruled');
  if (ruling === 'UNRULED') return text.includes('unruled') || text.includes('plain') || text.includes('sketch');
  if (ruling === 'SPIRAL') return text.includes('spiral');
  if (ruling === 'HARDBOUND') return text.includes('hardbound') || text.includes('register');
  return true;
}

export function matchesTipOrGradeFilter(product: any, tip: string): boolean {
  if (!tip || tip === 'ALL') return true;
  const text = `${product.name || ''} ${product.description || ''} ${product.shortDescription || ''} ${
    Array.isArray(product.variants)
      ? product.variants.map((v: any) => v.variantName || '').join(' ')
      : ''
  }`.toLowerCase();
  if (tip === '0.5mm') return text.includes('0.5') || text.includes('needle');
  if (tip === '0.7mm') return text.includes('0.7') || text.includes('0.6') || text.includes('liquid');
  if (tip === 'HIGHLIGHTER') return text.includes('highlighter') || text.includes('chisel') || text.includes('marker');
  if (tip === 'ART_SHADES') return text.includes('shades') || text.includes('pencil') || text.includes('brush');
  return true;
}

export function matchesPriceRangeFilter(product: any, range: string): boolean {
  if (!range || range === 'ALL') return true;
  const priceRupees = Math.round(Number(product.sellingPricePaise || 0) / 100);
  if (range === 'UNDER_150') return priceRupees <= 150;
  if (range === '150_299') return priceRupees >= 150 && priceRupees <= 299;
  if (range === '300_599') return priceRupees >= 300 && priceRupees <= 599;
  if (range === '600_PLUS') return priceRupees >= 600;
  return true;
}
