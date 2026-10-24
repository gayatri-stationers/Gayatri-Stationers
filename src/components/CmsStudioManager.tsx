import React, { useState, useEffect } from 'react';
import {
  FolderTree,
  Building2,
  Compass,
  LayoutTemplate,
  Image as ImageIcon,
  FileText,
  Palette,
  Package,
  Plus,
  Edit3,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  CheckCircle2,
  AlertCircle,
  Globe,
  Smartphone,
  Monitor,
  Sparkles,
  History,
  Save,
  ExternalLink,
} from 'lucide-react';
import { uploadImageToSupabaseStorage } from '../lib/supabase-storage.ts';

export type CmsSubTab =
  | 'categories'
  | 'brands'
  | 'navigation'
  | 'homepage'
  | 'banners'
  | 'pages'
  | 'bundles'
  | 'appearance';

interface CmsStudioManagerProps {
  activeSubTab: CmsSubTab;
  setActiveSubTab: (tab: CmsSubTab) => void;
  bootstrap: any;
  adminData: any;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
  onRefresh: () => Promise<void>;
  notify: (msg: string, type?: 'success' | 'error') => void;
  onPreviewStorefront?: (target?: { view?: string; categorySlug?: string; brandSlug?: string; pageSlug?: string }) => void;
}

export const CmsStudioManager: React.FC<CmsStudioManagerProps> = ({
  activeSubTab,
  setActiveSubTab,
  bootstrap,
  adminData,
  fetchWithAuth,
  onRefresh,
  notify,
  onPreviewStorefront,
}) => {
  const categories: any[] = adminData?.categories || bootstrap?.categories || [];
  const brands: any[] = adminData?.brands || bootstrap?.brands || [];
  const navItems: any[] = adminData?.navigationItems || bootstrap?.navigationItems || [];
  const homepageSections: any[] = adminData?.homepageSections || bootstrap?.homepageSections || [];
  const banners: any[] = adminData?.banners || bootstrap?.banners || [];
  const pages: any[] = adminData?.pages || bootstrap?.pages || [];
  const bundles: any[] = adminData?.bundles || bootstrap?.bundles || [];
  const revisions: any[] = adminData?.revisions || bootstrap?.revisions || [];
  const products: any[] = bootstrap?.products || [];

  // 1. Category Form State
  const [catForm, setCatForm] = useState({
    id: undefined as number | undefined,
    name: '',
    slug: '',
    description: '',
    imageUrl: '',
    iconName: 'FolderOpen',
    parentId: '' as string | number,
    sortOrder: categories.length + 1,
    showInNav: true,
    showOnHomepage: true,
    showInFooter: true,
    seoTitle: '',
    seoDescription: '',
    status: 'PUBLISHED',
  });
  const [uploadingCatImg, setUploadingCatImg] = useState(false);
  const [catGalleryUrls, setCatGalleryUrls] = useState<string[]>([]);
  const [brandGalleryUrls, setBrandGalleryUrls] = useState<string[]>([]);
  const [bannerGalleryUrls, setBannerGalleryUrls] = useState<string[]>([]);

  // 2. Brand Form State
  const [localBrands, setLocalBrands] = useState<any[]>(() => {
    try {
      const storedRaw = localStorage.getItem('gs_fallback_brands_v1');
      const stored = storedRaw ? JSON.parse(storedRaw) : [];
      const mergedMap = new Map<string, any>();
      for (const b of [...(Array.isArray(brands) ? brands : []), ...(Array.isArray(stored) ? stored : [])]) {
        if (!b || !b.name) continue;
        const key = String(b.slug || b.name).toLowerCase();
        mergedMap.set(key, b);
      }
      return Array.from(mergedMap.values());
    } catch {
      return Array.isArray(brands) ? brands : [];
    }
  });

  useEffect(() => {
    try {
      const storedRaw = localStorage.getItem('gs_fallback_brands_v1');
      const stored = storedRaw ? JSON.parse(storedRaw) : [];
      const mergedMap = new Map<string, any>();
      for (const b of [...(Array.isArray(brands) ? brands : []), ...(Array.isArray(stored) ? stored : [])]) {
        if (!b || !b.name) continue;
        const key = String(b.slug || b.name).toLowerCase();
        mergedMap.set(key, b);
      }
      setLocalBrands(Array.from(mergedMap.values()));
    } catch {
      if (Array.isArray(brands) && brands.length > 0) {
        setLocalBrands(brands);
      }
    }
  }, [brands]);

  const [brandForm, setBrandForm] = useState({
    id: undefined as number | undefined,
    name: '',
    slug: '',
    description: '',
    logoUrl: '',
    bannerUrl: '',
    isFeatured: true,
    showInNav: true,
    sortOrder: brands.length + 1,
    seoTitle: '',
    seoDescription: '',
    status: 'PUBLISHED',
  });
  const [uploadingBrandLogo, setUploadingBrandLogo] = useState(false);

  // 3. Navigation Form State
  const [navForm, setNavForm] = useState({
    id: undefined as number | undefined,
    label: '',
    linkType: 'CATEGORY',
    targetValue: '',
    highlightBadge: '',
    sortOrder: navItems.length + 1,
    showOnDesktop: true,
    showOnMobile: true,
    openInNewTab: false,
    status: 'PUBLISHED',
  });
  const [navPreviewDevice, setNavPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  // 4. Homepage Section Form State
  const [sectionForm, setSectionForm] = useState({
    id: undefined as number | undefined,
    sectionType: 'PRODUCT_CAROUSEL',
    title: '',
    subtitle: '',
    badgeText: '',
    ctaText: 'Explore Collection',
    ctaLink: 'catalogue',
    sourceType: 'CATEGORY',
    sourceCategoryId: '' as string | number,
    sourceBrandId: '' as string | number,
    productIds: [] as number[],
    maxItems: 8,
    layoutStyle: 'GRID_4',
    sortOrder: homepageSections.length + 1,
    status: 'PUBLISHED',
  });

  // 5. Banner Form State
  const [bannerForm, setBannerForm] = useState({
    id: undefined as number | undefined,
    placement: 'HERO_MAIN',
    title: '',
    subtitle: '',
    badgeText: 'FESTIVE & ACADEMIC ESSENTIALS',
    ctaText: 'Shop Catalogue',
    ctaLink: 'catalogue',
    secondaryCtaText: 'School Combo Kits',
    secondaryCtaLink: 'bundles',
    desktopImageUrl: '',
    backgroundColor: '#141413',
    textColor: '#FAF7F2',
    accentColor: '#D9381E',
    textAlignment: 'LEFT',
    startAt: '',
    endAt: '',
    sortOrder: banners.length + 1,
    status: 'PUBLISHED',
  });
  const [uploadingBannerImg, setUploadingBannerImg] = useState(false);

  // 6. CMS Page Form State
  const [pageForm, setPageForm] = useState({
    id: undefined as number | undefined,
    title: '',
    slug: '',
    pageType: 'INFO',
    summary: '',
    contentMarkdown: '',
    seoTitle: '',
    seoDescription: '',
    showInFooter: true,
    showInHeader: false,
    status: 'PUBLISHED',
  });
  const [previewPageMode, setPreviewPageMode] = useState(false);

  // 7. Combo Bundle Form State
  const [bundleForm, setBundleForm] = useState({
    id: undefined as number | undefined,
    name: '',
    slug: '',
    description: '',
    targetGroup: 'Classes 5 to 8',
    bundlePriceRupees: '499',
    savingsRupees: '95',
    itemsText: 'Classmate Long Registers x 4\nGeometry Box x 1\nBlue Gel Pens Pack x 1',
    isActive: true,
  });

  // 8. Theme & Appearance State
  const existingTheme = (bootstrap?.settings?.theme_config || {}) as Record<string, any>;
  const existingFooter = (bootstrap?.settings?.footer_config || {}) as Record<string, any>;

  const [themeForm, setThemeForm] = useState({
    storeName: existingTheme.storeName || bootstrap?.settings?.store_profile?.name || 'Gayatri Stationers',
    tagline: existingTheme.tagline || 'Est. Retail & Institutional Stationery Counter · Kanpur',
    logoUrl: existingTheme.logoUrl || '',
    primaryColor: existingTheme.primaryColor || '#D9381E',
    secondaryColor: existingTheme.secondaryColor || '#141413',
    backgroundColor: existingTheme.backgroundColor || '#FAF7F2',
    surfaceColor: existingTheme.surfaceColor || '#FFFFFF',
    cardRadius: existingTheme.cardRadius || 'none',
    announcementEnabled: existingTheme.announcementEnabled !== undefined ? Boolean(existingTheme.announcementEnabled) : true,
    announcementText:
      existingTheme.announcementText ||
      bootstrap?.settings?.promo_banner?.text ||
      'SAME-DAY STORE PICKUP IN KANPUR (READY IN 2 HRS) · FREE HOME DELIVERY ON ALL ORDERS',
    announcementBgColor: existingTheme.announcementBgColor || '#141413',
    announcementTextColor: existingTheme.announcementTextColor || '#FAF7F2',
  });

  const [footerForm, setFooterForm] = useState({
    brandSummary:
      existingFooter.brandSummary ||
      'Authentic retail & institutional stationery supplier in Kanpur, Uttar Pradesh. Serving students, artists, schools, and corporate offices with verified GST billing.',
    copyrightText:
      existingFooter.copyrightText ||
      `© ${new Date().getFullYear()} Gayatri Stationers. All rights reserved.`,
    showCategoriesColumn:
      existingFooter.showCategoriesColumn !== undefined ? Boolean(existingFooter.showCategoriesColumn) : true,
    showPagesColumn:
      existingFooter.showPagesColumn !== undefined ? Boolean(existingFooter.showPagesColumn) : true,
    showContactColumn:
      existingFooter.showContactColumn !== undefined ? Boolean(existingFooter.showContactColumn) : true,
    whatsappUrl: existingFooter.whatsappUrl || '',
    instagramUrl: existingFooter.instagramUrl || '',
  });

  const [saving, setSaving] = useState(false);
  const [showLiveBuilderCanvas, setShowLiveBuilderCanvas] = useState(true);
  const [builderViewport, setBuilderViewport] = useState<'desktop' | 'mobile'>('desktop');

  // Handlers
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catForm.name.trim()) {
      notify('Category name is required.', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/admin/categories/save', {
        method: 'POST',
        body: JSON.stringify({
          ...catForm,
          parentId: catForm.parentId ? Number(catForm.parentId) : null,
          sortOrder: Number(catForm.sortOrder) || 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save category');
      notify(`Category "${data.category.name}" saved & published to storefront.`);
      setCatForm({
        id: undefined,
        name: '',
        slug: '',
        description: '',
        imageUrl: '',
        iconName: 'FolderOpen',
        parentId: '',
        sortOrder: categories.length + 2,
        showInNav: true,
        showOnHomepage: true,
        showInFooter: true,
        seoTitle: '',
        seoDescription: '',
        status: 'PUBLISHED',
      });
      await onRefresh();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOrArchiveCategory = async (id: number, name: string) => {
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/admin/categories/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      notify(
        data.action === 'ARCHIVED'
          ? `Category "${name}" has products/subcategories and was safely archived.`
          : `Category "${name}" removed.`
      );
      await onRefresh();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveCategoryOrder = async (cat: any, direction: 'up' | 'down') => {
    const delta = direction === 'up' ? -1 : 1;
    const nextOrder = Math.max(1, (cat.sortOrder || 1) + delta);
    try {
      await fetchWithAuth('/api/admin/categories/save', {
        method: 'POST',
        body: JSON.stringify({
          ...cat,
          sortOrder: nextOrder,
        }),
      });
      await onRefresh();
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleSaveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = brandForm.name.trim();
    if (!cleanName) {
      notify('Company / Brand name is required.', 'error');
      return;
    }
    setSaving(true);
    try {
      const cleanSlug =
        (brandForm.slug || cleanName)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') || `brand-${Date.now().toString().slice(-4)}`;

      const res = await fetchWithAuth('/api/admin/brands/save', {
        method: 'POST',
        body: JSON.stringify({
          ...brandForm,
          name: cleanName,
          slug: cleanSlug,
          sortOrder: Number(brandForm.sortOrder) || localBrands.length + 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save brand');

      const savedBrand = data.brand || {
        id: brandForm.id || Date.now(),
        name: cleanName,
        slug: cleanSlug,
        description: brandForm.description || `Authorized ${cleanName} stationery products`,
        logoUrl: brandForm.logoUrl || '',
        bannerUrl: brandForm.bannerUrl || '',
        isFeatured: brandForm.isFeatured,
        showInNav: brandForm.showInNav,
        sortOrder: Number(brandForm.sortOrder) || localBrands.length + 1,
        status: brandForm.status || 'PUBLISHED',
        isActive: (brandForm.status || 'PUBLISHED') === 'PUBLISHED',
      };

      setLocalBrands((prev) => {
        const idx = prev.findIndex(
          (b) =>
            Number(b.id) === Number(savedBrand.id) ||
            String(b.slug || '').toLowerCase() === String(savedBrand.slug || '').toLowerCase() ||
            String(b.name || '').toLowerCase() === String(savedBrand.name || '').toLowerCase()
        );
        const updated = idx >= 0 ? prev.map((b, i) => (i === idx ? { ...b, ...savedBrand } : b)) : [...prev, savedBrand];
        try {
          localStorage.setItem('gs_fallback_brands_v1', JSON.stringify(updated));
        } catch {
          // Ignore storage error
        }
        return updated;
      });

      notify(`Company / Brand "${savedBrand.name}" saved and published to storefront!`);
      setBrandForm({
        id: undefined,
        name: '',
        slug: '',
        description: '',
        logoUrl: '',
        bannerUrl: '',
        isFeatured: true,
        showInNav: true,
        sortOrder: localBrands.length + 2,
        seoTitle: '',
        seoDescription: '',
        status: 'PUBLISHED',
      });
      await onRefresh();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOrArchiveBrand = async (id: number, name: string) => {
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/admin/brands/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');

      setLocalBrands((prev) => {
        const updated =
          data.action === 'ARCHIVED'
            ? prev.map((b) => (Number(b.id) === Number(id) ? { ...b, status: 'ARCHIVED', isActive: false } : b))
            : prev.filter((b) => Number(b.id) !== Number(id));
        try {
          localStorage.setItem('gs_fallback_brands_v1', JSON.stringify(updated));
        } catch {
          // Ignore
        }
        return updated;
      });

      notify(
        data.action === 'ARCHIVED'
          ? `Brand "${name}" has linked products and was safely archived.`
          : `Brand "${name}" deleted.`
      );
      await onRefresh();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNav = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!navForm.label.trim()) {
      notify('Navigation label is required.', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/admin/navigation/save', {
        method: 'POST',
        body: JSON.stringify({
          ...navForm,
          sortOrder: Number(navForm.sortOrder) || 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save navigation item');
      notify(`Navigation item "${data.navigationItem.label}" saved.`);
      setNavForm({
        id: undefined,
        label: '',
        linkType: 'CATEGORY',
        targetValue: '',
        highlightBadge: '',
        sortOrder: navItems.length + 2,
        showOnDesktop: true,
        showOnMobile: true,
        openInNewTab: false,
        status: 'PUBLISHED',
      });
      await onRefresh();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNav = async (id: number) => {
    try {
      await fetchWithAuth(`/api/admin/navigation/${id}`, { method: 'DELETE' });
      notify('Navigation item removed.');
      await onRefresh();
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleMoveNavOrder = async (item: any, direction: 'up' | 'down') => {
    const delta = direction === 'up' ? -1 : 1;
    await fetchWithAuth('/api/admin/navigation/save', {
      method: 'POST',
      body: JSON.stringify({
        ...item,
        sortOrder: Math.max(1, (item.sortOrder || 1) + delta),
      }),
    });
    await onRefresh();
  };

  const handleSaveSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectionForm.title.trim()) {
      notify('Section title is required.', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/admin/homepage-sections/save', {
        method: 'POST',
        body: JSON.stringify({
          ...sectionForm,
          sourceCategoryId: sectionForm.sourceCategoryId ? Number(sectionForm.sourceCategoryId) : null,
          sourceBrandId: sectionForm.sourceBrandId ? Number(sectionForm.sourceBrandId) : null,
          maxItems: Number(sectionForm.maxItems) || 8,
          sortOrder: Number(sectionForm.sortOrder) || 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save section');
      notify(`Homepage section "${data.homepageSection.title}" saved.`);
      setSectionForm({
        id: undefined,
        sectionType: 'PRODUCT_CAROUSEL',
        title: '',
        subtitle: '',
        badgeText: '',
        ctaText: 'Explore Collection',
        ctaLink: 'catalogue',
        sourceType: 'CATEGORY',
        sourceCategoryId: '',
        sourceBrandId: '',
        productIds: [],
        maxItems: 8,
        layoutStyle: 'GRID_4',
        sortOrder: homepageSections.length + 2,
        status: 'PUBLISHED',
      });
      await onRefresh();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveSectionOrder = async (sec: any, direction: 'up' | 'down') => {
    const delta = direction === 'up' ? -1 : 1;
    await fetchWithAuth('/api/admin/homepage-sections/save', {
      method: 'POST',
      body: JSON.stringify({
        ...sec,
        sortOrder: Math.max(1, (sec.sortOrder || 1) + delta),
      }),
    });
    await onRefresh();
  };

  const handleToggleSectionStatus = async (sec: any) => {
    const nextStatus = sec.status === 'PUBLISHED' ? 'HIDDEN' : 'PUBLISHED';
    await fetchWithAuth('/api/admin/homepage-sections/save', {
      method: 'POST',
      body: JSON.stringify({
        ...sec,
        status: nextStatus,
        isActive: nextStatus === 'PUBLISHED',
      }),
    });
    notify(`Section "${sec.title}" ${nextStatus === 'PUBLISHED' ? 'published' : 'hidden'}.`);
    await onRefresh();
  };

  const handleDeleteSection = async (id: number) => {
    await fetchWithAuth(`/api/admin/homepage-sections/${id}`, { method: 'DELETE' });
    notify('Homepage section deleted.');
    await onRefresh();
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bannerForm.title.trim()) {
      notify('Banner headline is required.', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/admin/banners/save', {
        method: 'POST',
        body: JSON.stringify({
          ...bannerForm,
          sortOrder: Number(bannerForm.sortOrder) || 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save banner');
      notify(`Banner "${data.banner.title}" saved.`);
      setBannerForm({
        id: undefined,
        placement: 'HERO_MAIN',
        title: '',
        subtitle: '',
        badgeText: 'LIMITED OFFER',
        ctaText: 'Shop Now',
        ctaLink: 'catalogue',
        secondaryCtaText: '',
        secondaryCtaLink: '',
        desktopImageUrl: '',
        backgroundColor: '#141413',
        textColor: '#FAF7F2',
        accentColor: '#D9381E',
        textAlignment: 'LEFT',
        startAt: '',
        endAt: '',
        sortOrder: banners.length + 2,
        status: 'PUBLISHED',
      });
      await onRefresh();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBanner = async (id: number) => {
    await fetchWithAuth(`/api/admin/banners/${id}`, { method: 'DELETE' });
    notify('Banner removed.');
    await onRefresh();
  };

  const handleSavePage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pageForm.title.trim()) {
      notify('Page title is required.', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/admin/pages/save', {
        method: 'POST',
        body: JSON.stringify(pageForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save page');
      notify(`Page "${data.page.title}" saved.`);
      setPageForm({
        id: undefined,
        title: '',
        slug: '',
        pageType: 'INFO',
        summary: '',
        contentMarkdown: '',
        seoTitle: '',
        seoDescription: '',
        showInFooter: true,
        showInHeader: false,
        status: 'PUBLISHED',
      });
      await onRefresh();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePage = async (id: number) => {
    await fetchWithAuth(`/api/admin/pages/${id}`, { method: 'DELETE' });
    notify('Page deleted.');
    await onRefresh();
  };

  const handleSaveBundle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bundleForm.name.trim()) {
      notify('Combo kit name is required.', 'error');
      return;
    }
    setSaving(true);
    try {
      const itemsSummary = bundleForm.itemsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const match = line.match(/^(.*?)\s*[x×]\s*(\d+)$/i);
          if (match) {
            return { productName: match[1].trim(), quantity: Number(match[2]) || 1 };
          }
          return { productName: line, quantity: 1 };
        });

      const res = await fetchWithAuth('/api/admin/bundles/save', {
        method: 'POST',
        body: JSON.stringify({
          id: bundleForm.id,
          name: bundleForm.name,
          slug: bundleForm.slug,
          description: bundleForm.description,
          targetGroup: bundleForm.targetGroup,
          bundlePricePaise: Math.round((Number(bundleForm.bundlePriceRupees) || 0) * 100),
          savingsPaise: Math.round((Number(bundleForm.savingsRupees) || 0) * 100),
          itemsSummary,
          isActive: bundleForm.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save combo bundle');
      notify(`Combo Bundle "${data.bundle.name}" saved.`);
      setBundleForm({
        id: undefined,
        name: '',
        slug: '',
        description: '',
        targetGroup: 'Classes 5 to 8',
        bundlePriceRupees: '499',
        savingsRupees: '95',
        itemsText: 'Classmate Long Registers x 4\nGeometry Box x 1',
        isActive: true,
      });
      await onRefresh();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveThemeAndFooter = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetchWithAuth('/api/admin/settings/save', {
        method: 'POST',
        body: JSON.stringify({
          key: 'theme_config',
          valueJson: themeForm,
        }),
      });
      await fetchWithAuth('/api/admin/settings/save', {
        method: 'POST',
        body: JSON.stringify({
          key: 'footer_config',
          valueJson: footerForm,
        }),
      });
      await fetchWithAuth('/api/admin/settings/save', {
        method: 'POST',
        body: JSON.stringify({
          key: 'promo_banner',
          valueJson: {
            enabled: themeForm.announcementEnabled,
            text: themeForm.announcementText,
          },
        }),
      });
      notify('Store visual appearance, announcement bar & footer published.');
      await onRefresh();
    } catch (err: any) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const cmsNavButtons: Array<{ id: CmsSubTab; label: string; count?: number; icon: React.ReactNode }> = [
    { id: 'categories', label: 'Categories & Subcategories', count: categories.length, icon: <FolderTree className="w-4 h-4" /> },
    { id: 'brands', label: 'Companies & Brands', count: brands.length, icon: <Building2 className="w-4 h-4" /> },
    { id: 'navigation', label: 'Navigation Builder', count: navItems.length, icon: <Compass className="w-4 h-4" /> },
    { id: 'homepage', label: 'Homepage Sections', count: homepageSections.length, icon: <LayoutTemplate className="w-4 h-4" /> },
    { id: 'banners', label: 'Hero & Promo Banners', count: banners.length, icon: <ImageIcon className="w-4 h-4" /> },
    { id: 'pages', label: 'Pages & Policies', count: pages.length, icon: <FileText className="w-4 h-4" /> },
    { id: 'bundles', label: 'School & Office Combos', count: bundles.length, icon: <Package className="w-4 h-4" /> },
    { id: 'appearance', label: 'Theme & Branding', icon: <Palette className="w-4 h-4" /> },
  ];

  // Validate Navigation Destination Helper
  const validateNavDestination = (linkType: string, targetValue: string) => {
    if (linkType === 'CATEGORY') {
      const exists = categories.some((c) => c.slug === targetValue && c.isActive);
      return exists ? { valid: true, note: 'Active Category' } : { valid: false, note: 'Category slug not found or hidden' };
    }
    if (linkType === 'BRAND') {
      const exists = brands.some((b) => b.slug === targetValue && b.isActive);
      return exists ? { valid: true, note: 'Active Brand' } : { valid: false, note: 'Brand slug not found or hidden' };
    }
    if (linkType === 'PAGE') {
      const exists = pages.some((p) => p.slug === targetValue && p.isActive);
      return exists ? { valid: true, note: 'Published Page' } : { valid: false, note: 'Page slug not found or draft' };
    }
    return { valid: true, note: 'Built-in Route' };
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation bar for Store CMS & Website Builder */}
      <div className="bg-white border border-[#141413] p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#E5E0D8]">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#D9381E] font-bold">
              WEBSITE BUILDER &amp; LIVE STOREFRONT STUDIO
            </span>
            <h3 className="text-lg font-bold tracking-tight">
              Customize &amp; Preview Every Section of Gayatri Stationers in Real Time
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setShowLiveBuilderCanvas((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 border text-xs font-bold transition-colors cursor-pointer ${
                showLiveBuilderCanvas
                  ? 'bg-[#141413] text-white border-[#141413]'
                  : 'bg-[#FAF7F2] text-[#141413] border-[#141413]'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{showLiveBuilderCanvas ? 'Hide Live Website Preview' : 'Show Live Website Preview'}</span>
            </button>
            {onPreviewStorefront && (
              <button
                type="button"
                onClick={() => onPreviewStorefront({ view: 'home' })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#D9381E] text-white border border-[#141413] text-xs font-bold hover:bg-[#141413] transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open Full Storefront
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {cmsNavButtons.map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => setActiveSubTab(btn.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold border transition-colors cursor-pointer ${
                activeSubTab === btn.id
                  ? 'bg-[#141413] text-[#FAF7F2] border-[#141413]'
                  : 'bg-[#FAF7F2] text-[#141413] border-[#D6D1C7] hover:border-[#141413]'
              }`}
            >
              {btn.icon}
              <span>{btn.label}</span>
              {btn.count !== undefined && (
                <span
                  className={`px-1.5 py-0.2 text-[10px] font-mono ${
                    activeSubTab === btn.id ? 'bg-[#D9381E] text-white' : 'bg-[#E5E0D8] text-[#141413]'
                  }`}
                >
                  {btn.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* INTERACTIVE LIVE WEBSITE BUILDER CANVAS PREVIEW (Updates as you edit any tab!) */}
      {showLiveBuilderCanvas && (() => {
        const activeHeroBanner =
          bannerForm.title.trim()
            ? bannerForm
            : banners.find((b) => b.placement === 'HERO_MAIN' && b.status !== 'HIDDEN') ||
              banners[0] || {
                badgeText: 'FESTIVE & ACADEMIC ESSENTIALS',
                title: 'Premium Stationery, Art Supplies & Exam Kits',
                subtitle: '₹0 Counter Pickup in Kanpur or Pan-India Shiprocket Doorstep Delivery.',
                ctaText: 'Shop Catalogue',
                secondaryCtaText: 'School Combo Kits',
                backgroundColor: '#141413',
                textColor: '#FAF7F2',
                accentColor: '#D9381E',
                desktopImageUrl: '',
              };

        const previewNavList = [
          ...navItems.filter((n) => n.isActive !== false),
          ...(navForm.label.trim() && !navForm.id
            ? [
                {
                  id: 'draft-nav',
                  label: navForm.label,
                  highlightBadge: navForm.highlightBadge || 'DRAFT',
                  showOnDesktop: navForm.showOnDesktop,
                  showOnMobile: navForm.showOnMobile,
                  isDraft: true,
                },
              ]
            : []),
        ];

        const previewCategories = [
          ...(catForm.name.trim() && !catForm.id
            ? [
                {
                  id: 'draft-cat',
                  name: catForm.name,
                  description: catForm.description || 'Live draft category preview',
                  imageUrl: catForm.imageUrl,
                  isDraft: true,
                },
              ]
            : []),
          ...categories.filter((c) => c.showOnHomepage !== false && c.isActive !== false),
        ].slice(0, 4);

        const previewSections = [
          ...(sectionForm.title.trim() && !sectionForm.id
            ? [
                {
                  id: 'draft-sec',
                  title: sectionForm.title,
                  subtitle: sectionForm.subtitle || 'Live draft section preview',
                  badgeText: sectionForm.badgeText || 'LIVE DRAFT',
                  sectionType: sectionForm.sectionType,
                  isDraft: true,
                },
              ]
            : []),
          ...homepageSections.filter((s) => s.status === 'PUBLISHED' && s.isActive !== false),
        ].slice(0, 3);

        return (
          <div className="bg-white border-2 border-[#141413] shadow-sm overflow-hidden">
            {/* Browser Top Chrome Bar */}
            <div className="px-4 py-2.5 bg-[#141413] text-[#FAF7F2] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D9381E]" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="ml-2 text-[11px] font-mono uppercase tracking-wider text-amber-300 font-bold">
                  LIVE INTERACTIVE STOREFRONT PREVIEW ({builderViewport.toUpperCase()})
                </span>
                <span className="hidden md:inline text-[11px] text-stone-400">
                  — Click any block below to jump to its editor
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setBuilderViewport('desktop')}
                  className={`px-2.5 py-1 text-[11px] font-mono font-bold border flex items-center gap-1 cursor-pointer ${
                    builderViewport === 'desktop'
                      ? 'bg-[#D9381E] text-white border-[#D9381E]'
                      : 'bg-white/10 text-stone-300 border-white/20 hover:text-white'
                  }`}
                >
                  <Monitor className="w-3 h-3" /> Desktop
                </button>
                <button
                  type="button"
                  onClick={() => setBuilderViewport('mobile')}
                  className={`px-2.5 py-1 text-[11px] font-mono font-bold border flex items-center gap-1 cursor-pointer ${
                    builderViewport === 'mobile'
                      ? 'bg-[#D9381E] text-white border-[#D9381E]'
                      : 'bg-white/10 text-stone-300 border-white/20 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3 h-3" /> Mobile
                </button>
              </div>
            </div>

            {/* Viewport Container */}
            <div className="p-3 sm:p-5 bg-stone-200/70 flex justify-center">
              <div
                className={`w-full transition-all border border-[#141413] shadow-md overflow-hidden ${
                  builderViewport === 'mobile' ? 'max-w-[375px]' : 'max-w-full'
                }`}
                style={{ backgroundColor: themeForm.backgroundColor || '#FAF7F2' }}
              >
                {/* 1. Announcement Bar Preview */}
                {themeForm.announcementEnabled && (
                  <div
                    onClick={() => setActiveSubTab('appearance')}
                    title="Click to edit Announcement Bar in Theme & Branding"
                    className="px-3 py-1.5 text-center text-[10px] font-mono uppercase tracking-wider font-bold cursor-pointer hover:opacity-90 transition-opacity"
                    style={{
                      backgroundColor: themeForm.announcementBgColor || '#141413',
                      color: themeForm.announcementTextColor || '#FAF7F2',
                    }}
                  >
                    {themeForm.announcementText}
                  </div>
                )}

                {/* 2. Store Header & Navigation Preview */}
                <div
                  onClick={() => setActiveSubTab('navigation')}
                  title="Click to edit Store Header & Navigation"
                  className="px-4 py-3 bg-white border-b border-[#E5E0D8] cursor-pointer hover:bg-stone-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div
                        className="font-bold text-sm sm:text-base tracking-tight"
                        style={{ color: themeForm.secondaryColor || '#141413' }}
                      >
                        {themeForm.storeName || 'Gayatri Stationers'}
                      </div>
                      <div className="text-[10px] text-[#57534E] line-clamp-1">
                        {themeForm.tagline}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="px-2 py-0.5 text-[10px] font-mono text-white font-bold"
                        style={{ backgroundColor: themeForm.primaryColor || '#D9381E' }}
                      >
                        Header &amp; Nav Preview
                      </span>
                    </div>
                  </div>

                  {/* Navigation pills */}
                  <div className="mt-2.5 pt-2 border-t border-[#E5E0D8] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {previewNavList.map((item: any) => (
                      <span
                        key={item.id}
                        className={`px-2 py-0.5 text-[10px] font-bold whitespace-nowrap inline-flex items-center gap-1 border ${
                          item.isDraft
                            ? 'bg-amber-50 border-[#D9381E] text-[#D9381E]'
                            : 'bg-[#FAF7F2] border-[#D6D1C7] text-[#141413]'
                        }`}
                      >
                        <span>{item.label}</span>
                        {item.highlightBadge && (
                          <span
                            className="px-1 text-[8px] font-mono text-white"
                            style={{ backgroundColor: themeForm.primaryColor || '#D9381E' }}
                          >
                            {item.highlightBadge}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 3. Hero Banner Preview */}
                <div
                  onClick={() => setActiveSubTab('banners')}
                  title="Click to edit Hero Banner"
                  className="p-4 sm:p-6 border-b border-[#141413] cursor-pointer relative overflow-hidden group"
                  style={{
                    backgroundColor: activeHeroBanner.backgroundColor || '#141413',
                    color: activeHeroBanner.textColor || '#FAF7F2',
                  }}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                    <div className={activeHeroBanner.desktopImageUrl ? 'sm:col-span-8 space-y-2' : 'sm:col-span-12 space-y-2'}>
                      <span
                        className="inline-block text-[9px] font-mono uppercase px-2 py-0.5 font-bold"
                        style={{
                          backgroundColor: activeHeroBanner.accentColor || '#D9381E',
                          color: '#FFFFFF',
                        }}
                      >
                        {activeHeroBanner.badgeText || 'HERO BANNER'}
                      </span>
                      <h4 className="text-base sm:text-xl font-bold tracking-tight leading-snug">
                        {activeHeroBanner.title}
                      </h4>
                      <p className="text-xs opacity-85 line-clamp-2 max-w-xl">
                        {activeHeroBanner.subtitle}
                      </p>
                      <div className="pt-1 flex flex-wrap items-center gap-2">
                        <span
                          className="px-3 py-1 text-[11px] font-bold"
                          style={{
                            backgroundColor: activeHeroBanner.accentColor || '#D9381E',
                            color: '#FFFFFF',
                          }}
                        >
                          {activeHeroBanner.ctaText || 'Shop Now'} →
                        </span>
                        {activeHeroBanner.secondaryCtaText && (
                          <span className="px-3 py-1 text-[11px] font-bold border border-current opacity-90">
                            {activeHeroBanner.secondaryCtaText}
                          </span>
                        )}
                      </div>
                    </div>
                    {activeHeroBanner.desktopImageUrl && (
                      <div className="sm:col-span-4 flex justify-end">
                        <img
                          src={activeHeroBanner.desktopImageUrl}
                          alt={activeHeroBanner.title}
                          className="w-full max-h-28 object-cover border border-white/20"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. Categories Grid Preview */}
                <div
                  onClick={() => setActiveSubTab('categories')}
                  title="Click to edit Categories"
                  className="p-4 border-b border-[#E5E0D8] cursor-pointer hover:bg-white/60 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#57534E] font-bold">
                      SHOP BY CATEGORY ({categories.length})
                    </span>
                    <span className="text-[10px] font-mono text-[#D9381E] font-bold">
                      Edit Categories →
                    </span>
                  </div>
                  <div
                    className={`grid gap-2 ${
                      builderViewport === 'mobile' ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'
                    }`}
                  >
                    {previewCategories.map((c: any) => (
                      <div
                        key={c.id}
                        className={`p-2.5 bg-white border flex items-center gap-2 ${
                          c.isDraft ? 'border-[#D9381E] bg-amber-50/40' : 'border-[#D6D1C7]'
                        }`}
                      >
                        {c.imageUrl ? (
                          <img
                            src={c.imageUrl}
                            alt={c.name}
                            className="w-8 h-8 object-cover border border-[#E5E0D8] shrink-0"
                          />
                        ) : (
                          <div
                            className="w-8 h-8 flex items-center justify-center text-[10px] font-mono font-bold text-white shrink-0"
                            style={{ backgroundColor: themeForm.secondaryColor || '#141413' }}
                          >
                            {String(c.name || 'CA').slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#141413] truncate">{c.name}</div>
                          <div className="text-[10px] text-[#57534E] truncate">
                            {c.isDraft ? 'Unsaved Draft' : `${c.productCount ?? 0} items`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 5. Homepage Sections Preview */}
                <div
                  onClick={() => setActiveSubTab('homepage')}
                  title="Click to edit Homepage Sections"
                  className="p-4 border-b border-[#E5E0D8] cursor-pointer hover:bg-white/60 transition-colors space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#57534E] font-bold">
                      HOMEPAGE SECTIONS ({homepageSections.length})
                    </span>
                    <span className="text-[10px] font-mono text-[#D9381E] font-bold">
                      Edit Sections →
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {previewSections.map((sec: any) => (
                      <div
                        key={sec.id}
                        className={`p-2.5 bg-white border ${
                          sec.isDraft ? 'border-[#D9381E] bg-amber-50/40' : 'border-[#D6D1C7]'
                        }`}
                      >
                        <div className="text-[9px] font-mono uppercase text-[#D9381E] font-bold">
                          {sec.badgeText || sec.sectionType}
                        </div>
                        <div className="text-xs font-bold text-[#141413] truncate">{sec.title}</div>
                        <div className="text-[10px] text-[#57534E] truncate">
                          {sec.subtitle || 'Active homepage block'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 6. Store Footer Preview */}
                <div
                  onClick={() => setActiveSubTab('appearance')}
                  title="Click to edit Footer & Branding"
                  className="px-4 py-3 text-xs cursor-pointer"
                  style={{
                    backgroundColor: themeForm.secondaryColor || '#141413',
                    color: '#FAF7F2',
                  }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="max-w-md">
                      <div className="font-bold text-xs">{themeForm.storeName}</div>
                      <p className="text-[10px] opacity-75 line-clamp-1 mt-0.5">
                        {footerForm.brandSummary}
                      </p>
                    </div>
                    <div className="text-[10px] font-mono opacity-70">
                      {footerForm.copyrightText}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 1. CATEGORIES & SUBCATEGORIES MANAGER */}
      {activeSubTab === 'categories' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleSaveCategory}
            className="lg:col-span-5 bg-white border border-[#141413] p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#D9381E] font-bold">
                  CATEGORY & SUBCATEGORY EDITOR
                </span>
                <h4 className="text-base font-bold">
                  {catForm.id ? `Edit Category #${catForm.id}` : 'Create New Category / Subcategory'}
                </h4>
              </div>
              {catForm.id && (
                <button
                  type="button"
                  onClick={() =>
                    setCatForm({
                      id: undefined,
                      name: '',
                      slug: '',
                      description: '',
                      imageUrl: '',
                      iconName: 'FolderOpen',
                      parentId: '',
                      sortOrder: categories.length + 1,
                      showInNav: true,
                      showOnHomepage: true,
                      showInFooter: true,
                      seoTitle: '',
                      seoDescription: '',
                      status: 'PUBLISHED',
                    })
                  }
                  className="text-xs underline text-[#57534E]"
                >
                  Reset Form
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono uppercase text-[#57534E] mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DIY & Crafts or Geometry Boxes"
                  value={catForm.name}
                  onChange={(e) =>
                    setCatForm({
                      ...catForm,
                      name: e.target.value,
                      slug:
                        catForm.id
                          ? catForm.slug
                          : e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9]+/g, '-')
                              .replace(/(^-|-$)/g, ''),
                    })
                  }
                  className="w-full px-3 py-2 border border-[#141413] text-sm bg-[#FAF7F2]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase text-[#57534E] mb-1">
                  URL Slug
                </label>
                <input
                  type="text"
                  placeholder="diy-and-crafts"
                  value={catForm.slug}
                  onChange={(e) => setCatForm({ ...catForm, slug: e.target.value })}
                  className="w-full px-3 py-2 border border-[#D6D1C7] text-sm font-mono bg-[#FAF7F2]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono uppercase text-[#57534E] mb-1">
                  Hierarchy Level (Parent Category)
                </label>
                <select
                  value={catForm.parentId}
                  onChange={(e) => setCatForm({ ...catForm, parentId: e.target.value })}
                  className="w-full px-3 py-2 border border-[#141413] text-sm bg-[#FAF7F2]"
                >
                  <option value="">Top-Level Category (Main)</option>
                  {categories
                    .filter((c) => !c.parentId && c.id !== catForm.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        Subcategory of: {c.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-mono uppercase text-[#57534E] mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={catForm.sortOrder}
                    onChange={(e) => setCatForm({ ...catForm, sortOrder: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-[#D6D1C7] text-sm font-mono bg-[#FAF7F2]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono uppercase text-[#57534E] mb-1">
                    Status
                  </label>
                  <select
                    value={catForm.status}
                    onChange={(e) => setCatForm({ ...catForm, status: e.target.value })}
                    className="w-full px-2 py-2 border border-[#141413] text-xs font-bold bg-[#FAF7F2]"
                  >
                    <option value="PUBLISHED">PUBLISHED</option>
                    <option value="DRAFT">DRAFT</option>
                    <option value="HIDDEN">HIDDEN</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-[#57534E] mb-1">
                Category Description
              </label>
              <textarea
                rows={2}
                placeholder="Describe what stationery, craft, or school supplies belong here..."
                value={catForm.description}
                onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                className="w-full px-3 py-2 border border-[#D6D1C7] text-sm bg-[#FAF7F2]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-[#57534E] mb-1">
                Category Image(s) (Upload Single or Multiple Photos / Paste URL)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://... or upload image(s)"
                  value={catForm.imageUrl}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCatForm({ ...catForm, imageUrl: val });
                    if (val.trim()) {
                      setCatGalleryUrls((prev) => Array.from(new Set([val.trim(), ...prev])));
                    }
                  }}
                  className="flex-1 px-3 py-2 border border-[#D6D1C7] text-xs bg-[#FAF7F2]"
                />
                <label className="px-3 py-2 bg-[#141413] text-white text-xs font-bold cursor-pointer hover:bg-[#D9381E] transition-colors shrink-0">
                  {uploadingCatImg ? 'Uploading...' : 'Upload Photo(s)'}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []) as File[];
                      if (files.length === 0) return;
                      setUploadingCatImg(true);
                      try {
                        const uploaded: string[] = [];
                        for (const file of files) {
                          const res = await uploadImageToSupabaseStorage(file, {
                            productSku: `CAT-${catForm.slug || 'IMG'}`,
                          });
                          uploaded.push(res.downloadUrl);
                        }
                        if (uploaded.length > 0) {
                          setCatForm((prev) => ({
                            ...prev,
                            imageUrl: prev.imageUrl || uploaded[0],
                          }));
                          setCatGalleryUrls((prev) =>
                            Array.from(new Set([...uploaded, ...prev]))
                          );
                          notify(
                            uploaded.length > 1
                              ? `Uploaded ${uploaded.length} category photos. Click any thumbnail to set primary.`
                              : 'Category image uploaded.'
                          );
                        }
                      } catch (err: any) {
                        notify(err.message || 'Upload failed', 'error');
                      } finally {
                        setUploadingCatImg(false);
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
              </div>
              {catGalleryUrls.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-2">
                  {catGalleryUrls.map((url, idx) => (
                    <div
                      key={`${url}-${idx}`}
                      className={`relative w-12 h-10 border overflow-hidden cursor-pointer ${
                        catForm.imageUrl === url
                          ? 'border-2 border-[#D9381E]'
                          : 'border-[#D6D1C7]'
                      }`}
                    >
                      <img
                        src={url}
                        alt={`Category photo ${idx + 1}`}
                        className="w-full h-full object-cover"
                        onClick={() => setCatForm((prev) => ({ ...prev, imageUrl: url }))}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setCatGalleryUrls((prev) => prev.filter((item) => item !== url))
                        }
                        className="absolute top-0 right-0 bg-red-600 text-white text-[9px] w-3.5 h-3.5 flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Placement Checkboxes */}
            <div className="p-3 bg-[#FAF7F2] border border-[#E5E0D8] space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#57534E] font-bold">
                WHERE SHOULD THIS CATEGORY APPEAR?
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs font-medium">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={catForm.showInNav}
                    onChange={(e) => setCatForm({ ...catForm, showInNav: e.target.checked })}
                  />
                  <span>Header Nav</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={catForm.showOnHomepage}
                    onChange={(e) => setCatForm({ ...catForm, showOnHomepage: e.target.checked })}
                  />
                  <span>Homepage Grid</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={catForm.showInFooter}
                    onChange={(e) => setCatForm({ ...catForm, showInFooter: e.target.checked })}
                  />
                  <span>Store Footer</span>
                </label>
              </div>
            </div>

            {/* SEO Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#57534E] mb-1">
                  SEO Meta Title
                </label>
                <input
                  type="text"
                  placeholder="Buy DIY & Crafts Online | Gayatri Stationers"
                  value={catForm.seoTitle}
                  onChange={(e) => setCatForm({ ...catForm, seoTitle: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-[#D6D1C7] text-xs bg-[#FAF7F2]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#57534E] mb-1">
                  SEO Meta Description
                </label>
                <input
                  type="text"
                  placeholder="Origami paper, glue guns, acrylic kits..."
                  value={catForm.seoDescription}
                  onChange={(e) => setCatForm({ ...catForm, seoDescription: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-[#D6D1C7] text-xs bg-[#FAF7F2]"
                />
              </div>
            </div>

            {/* Live Card Preview */}
            <div className="p-3 border border-dashed border-[#141413] bg-[#FAF7F2] space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase text-[#57534E]">
                <span>LIVE CATEGORY CARD &amp; MENU PREVIEW</span>
                <span className="text-[#D9381E] font-bold">/{catForm.slug || 'category-slug'}</span>
              </div>
              <div className="flex items-center justify-between bg-white border border-[#141413] p-3 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {catForm.imageUrl ? (
                    <img
                      src={catForm.imageUrl}
                      alt={catForm.name || 'Category preview'}
                      className="w-12 h-12 object-cover border border-[#D6D1C7] shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-[#141413] text-[#FAF7F2] flex items-center justify-center font-mono text-xs font-bold shrink-0">
                      {(catForm.name || 'CA').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className="text-[10px] font-mono uppercase text-[#D9381E] font-bold">
                      {catForm.status}
                    </span>
                    <div className="font-bold text-sm truncate">{catForm.name || 'Category Title'}</div>
                    <div className="text-xs text-[#57534E] line-clamp-1">
                      {catForm.description || 'Category description preview...'}
                    </div>
                  </div>
                </div>
                <span className="text-xs font-mono underline font-bold shrink-0">Explore →</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 bg-[#D9381E] text-white font-bold text-xs uppercase tracking-wider hover:bg-[#141413] transition-colors cursor-pointer"
            >
              {saving
                ? 'Saving Category...'
                : catForm.id
                ? 'Update & Publish Category'
                : 'Create & Publish Category'}
            </button>
          </form>

          {/* Categories Directory Table */}
          <div className="lg:col-span-7 bg-white border border-[#141413] p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#57534E]">
                  LIVE STOREFRONT HIERARCHY
                </span>
                <h4 className="text-base font-bold">
                  All Categories & Subcategories ({categories.length})
                </h4>
              </div>
            </div>

            <div className="divide-y divide-[#E5E0D8] max-h-[640px] overflow-y-auto">
              {categories.map((c) => {
                const parentCat = categories.find((p) => p.id === c.parentId);
                return (
                  <div
                    key={c.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF7F2] px-2 transition-colors"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded">
                          #{c.sortOrder || 1}
                        </span>
                        {parentCat && (
                          <span className="text-xs font-mono text-[#57534E]">
                            {parentCat.name} →
                          </span>
                        )}
                        <span className="font-bold text-sm text-[#141413]">{c.name}</span>
                        <span className="text-[11px] font-mono text-[#57534E]">/{c.slug}</span>
                        <span
                          className={`text-[10px] font-mono uppercase px-1.5 py-0.5 font-bold ${
                            c.status === 'PUBLISHED' && c.isActive
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {c.status || (c.isActive ? 'PUBLISHED' : 'HIDDEN')}
                        </span>
                      </div>
                      <p className="text-xs text-[#57534E] line-clamp-1">{c.description}</p>
                      <div className="flex flex-wrap gap-2 text-[10px] font-mono text-[#57534E]">
                        <span>{c.productCount ?? 0} Products</span>
                        {c.showInNav && <span className="text-[#141413] font-bold">· In Header Nav</span>}
                        {c.showOnHomepage && <span className="text-[#141413] font-bold">· On Homepage</span>}
                        {c.showInFooter && <span>· In Footer</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        title="Move Up"
                        onClick={() => handleMoveCategoryOrder(c, 'up')}
                        className="p-1.5 border border-[#D6D1C7] hover:border-[#141413] bg-white"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Move Down"
                        onClick={() => handleMoveCategoryOrder(c, 'down')}
                        className="p-1.5 border border-[#D6D1C7] hover:border-[#141413] bg-white"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      {onPreviewStorefront && (
                        <button
                          type="button"
                          title="View on Storefront"
                          onClick={() => onPreviewStorefront({ view: 'catalogue', categorySlug: c.slug })}
                          className="p-1.5 border border-[#D6D1C7] hover:border-[#141413] bg-white text-xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setCatForm({
                            id: c.id,
                            name: c.name || '',
                            slug: c.slug || '',
                            description: c.description || '',
                            imageUrl: c.imageUrl || '',
                            iconName: c.iconName || 'FolderOpen',
                            parentId: c.parentId || '',
                            sortOrder: c.sortOrder || 1,
                            showInNav: c.showInNav !== false,
                            showOnHomepage: c.showOnHomepage !== false,
                            showInFooter: c.showInFooter !== false,
                            seoTitle: c.seoTitle || '',
                            seoDescription: c.seoDescription || '',
                            status: c.status || (c.isActive ? 'PUBLISHED' : 'HIDDEN'),
                          })
                        }
                        className="px-2.5 py-1 border border-[#141413] text-xs font-bold bg-[#FAF7F2] hover:bg-[#141413] hover:text-white"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteOrArchiveCategory(c.id, c.name)}
                        className="p-1.5 border border-red-300 text-red-700 hover:bg-red-50"
                        title="Delete or Safe-Archive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 2. COMPANIES & BRANDS MANAGER */}
      {activeSubTab === 'brands' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleSaveBrand}
            className="lg:col-span-5 bg-white border border-[#141413] p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#D9381E] font-bold">
                  STATIONERY COMPANY / BRAND MANAGER
                </span>
                <h4 className="text-base font-bold">
                  {brandForm.id ? `Edit Brand #${brandForm.id}` : 'Add New Company / Brand'}
                </h4>
              </div>
              {brandForm.id && (
                <button
                  type="button"
                  onClick={() =>
                    setBrandForm({
                      id: undefined,
                      name: '',
                      slug: '',
                      description: '',
                      logoUrl: '',
                      bannerUrl: '',
                      isFeatured: true,
                      showInNav: true,
                      sortOrder: brands.length + 1,
                      seoTitle: '',
                      seoDescription: '',
                      status: 'PUBLISHED',
                    })
                  }
                  className="text-xs underline text-[#57534E]"
                >
                  Reset
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono uppercase text-[#57534E] mb-1">
                  Company / Brand Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Faber-Castell, Classmate, Parker"
                  value={brandForm.name}
                  onChange={(e) =>
                    setBrandForm({
                      ...brandForm,
                      name: e.target.value,
                      slug:
                        brandForm.id
                          ? brandForm.slug
                          : e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9]+/g, '-')
                              .replace(/(^-|-$)/g, ''),
                    })
                  }
                  className="w-full px-3 py-2 border border-[#141413] text-sm bg-[#FAF7F2]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase text-[#57534E] mb-1">
                  Brand Slug
                </label>
                <input
                  type="text"
                  value={brandForm.slug}
                  onChange={(e) => setBrandForm({ ...brandForm, slug: e.target.value })}
                  className="w-full px-3 py-2 border border-[#D6D1C7] text-sm font-mono bg-[#FAF7F2]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-[#57534E] mb-1">
                Brand Description / Authorised Line
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Official fine-art pencils, markers, and geometry instruments..."
                value={brandForm.description}
                onChange={(e) => setBrandForm({ ...brandForm, description: e.target.value })}
                className="w-full px-3 py-2 border border-[#D6D1C7] text-sm bg-[#FAF7F2]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-[#57534E] mb-1">
                Brand Logo & Photos (Upload Single or Multiple Photos / Paste URL)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Paste logo URL or upload..."
                  value={brandForm.logoUrl}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBrandForm({ ...brandForm, logoUrl: val });
                    if (val.trim()) {
                      setBrandGalleryUrls((prev) => Array.from(new Set([val.trim(), ...prev])));
                    }
                  }}
                  className="flex-1 px-3 py-2 border border-[#D6D1C7] text-xs bg-[#FAF7F2]"
                />
                <label className="px-3 py-2 bg-[#141413] text-white text-xs font-bold cursor-pointer hover:bg-[#D9381E] transition-colors">
                  {uploadingBrandLogo ? 'Uploading...' : 'Upload Photo(s)'}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []) as File[];
                      if (files.length === 0) return;
                      setUploadingBrandLogo(true);
                      try {
                        const uploaded: string[] = [];
                        for (const file of files) {
                          const res = await uploadImageToSupabaseStorage(file, {
                            productSku: `BRAND-${brandForm.slug || 'LOGO'}`,
                          });
                          uploaded.push(res.downloadUrl);
                        }
                        if (uploaded.length > 0) {
                          setBrandForm((prev) => ({
                            ...prev,
                            logoUrl: prev.logoUrl || uploaded[0],
                            bannerUrl: uploaded[1] || prev.bannerUrl,
                          }));
                          setBrandGalleryUrls((prev) =>
                            Array.from(new Set([...uploaded, ...prev]))
                          );
                          notify(
                            uploaded.length > 1
                              ? `Uploaded ${uploaded.length} brand photos.`
                              : 'Brand logo uploaded.'
                          );
                        }
                      } catch (err: any) {
                        notify(err.message || 'Upload failed', 'error');
                      } finally {
                        setUploadingBrandLogo(false);
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
              </div>
              {brandGalleryUrls.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-2">
                  {brandGalleryUrls.map((url, idx) => (
                    <div
                      key={`${url}-${idx}`}
                      className={`relative w-12 h-10 border overflow-hidden cursor-pointer bg-white ${
                        brandForm.logoUrl === url
                          ? 'border-2 border-[#D9381E]'
                          : 'border-[#D6D1C7]'
                      }`}
                    >
                      <img
                        src={url}
                        alt={`Brand photo ${idx + 1}`}
                        className="w-full h-full object-contain"
                        onClick={() => setBrandForm((prev) => ({ ...prev, logoUrl: url }))}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setBrandGalleryUrls((prev) => prev.filter((item) => item !== url))
                        }
                        className="absolute top-0 right-0 bg-red-600 text-white text-[9px] w-3.5 h-3.5 flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#57534E] mb-1">
                  Sort Order
                </label>
                <input
                  type="number"
                  value={brandForm.sortOrder}
                  onChange={(e) => setBrandForm({ ...brandForm, sortOrder: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 border border-[#D6D1C7] text-xs font-mono bg-[#FAF7F2]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#57534E] mb-1">
                  Status
                </label>
                <select
                  value={brandForm.status}
                  onChange={(e) => setBrandForm({ ...brandForm, status: e.target.value })}
                  className="w-full px-2 py-1.5 border border-[#141413] text-xs font-bold bg-[#FAF7F2]"
                >
                  <option value="PUBLISHED">PUBLISHED</option>
                  <option value="HIDDEN">HIDDEN</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </div>
              <div className="flex flex-col justify-end gap-1 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={brandForm.isFeatured}
                    onChange={(e) => setBrandForm({ ...brandForm, isFeatured: e.target.checked })}
                  />
                  <span>Featured on Home</span>
                </label>
              </div>
            </div>

            {/* Live Brand Showcase Preview */}
            <div className="p-3 border border-dashed border-[#141413] bg-[#FAF7F2] space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase text-[#57534E]">
                <span>LIVE BRAND SHOWCASE CARD PREVIEW</span>
                <span className="text-[#D9381E] font-bold">
                  {brandForm.isFeatured ? '★ Featured Brand' : 'Catalogue Brand'}
                </span>
              </div>
              <div className="p-3 bg-white border border-[#141413] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {brandForm.logoUrl ? (
                    <img
                      src={brandForm.logoUrl}
                      alt={brandForm.name || 'Brand Logo'}
                      className="w-11 h-11 object-contain bg-white border border-[#D6D1C7] p-1 shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 bg-[#141413] text-[#FAF7F2] flex items-center justify-center font-bold text-xs font-mono shrink-0">
                      {(brandForm.name || 'BR').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-[#141413] truncate">
                      {brandForm.name || 'Stationery Brand Name'}
                    </div>
                    <div className="text-xs text-[#57534E] line-clamp-1">
                      {brandForm.description || 'Authorized retail & institutional stationery line'}
                    </div>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-[#FAF7F2] border border-[#141413] text-[10px] font-mono font-bold shrink-0">
                  Shop Brand →
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 bg-[#D9381E] text-white font-bold text-xs uppercase tracking-wider hover:bg-[#141413] transition-colors cursor-pointer"
            >
              {saving
                ? 'Saving Brand...'
                : brandForm.id
                ? 'Update Company / Brand'
                : 'Add Company / Brand'}
            </button>
          </form>

          <div className="lg:col-span-7 bg-white border border-[#141413] p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#57534E]">
                  REGISTERED STATIONERY COMPANIES
                </span>
                <h4 className="text-base font-bold">Companies & Brands ({localBrands.length})</h4>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[640px] overflow-y-auto">
              {localBrands.map((b) => {
                const matchingBrandProductsCount = products.filter(
                  (p) =>
                    p.isActive !== false &&
                    (p.brandSlug === b.slug ||
                      String(p.brandName || '').toLowerCase() === String(b.name || '').toLowerCase())
                ).length;
                return (
                  <div
                    key={b.id}
                    className="p-3.5 border border-[#D6D1C7] bg-[#FAF7F2] flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        {b.logoUrl ? (
                          <img
                            src={b.logoUrl}
                            alt={b.name}
                            className="w-10 h-10 object-contain bg-white border border-[#D6D1C7] p-1"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-[#141413] text-[#FAF7F2] flex items-center justify-center font-bold text-xs font-mono">
                            {b.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-sm text-[#141413]">{b.name}</div>
                          <div className="text-[10px] font-mono text-[#57534E]">
                            {matchingBrandProductsCount || b.productCount || 0} Products · #{b.sortOrder || 1}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-mono uppercase px-1.5 py-0.5 font-bold ${
                          b.status === 'PUBLISHED' && b.isActive
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-stone-200 text-stone-700'
                        }`}
                      >
                        {b.status || 'PUBLISHED'}
                      </span>
                    </div>

                    <p className="text-xs text-[#57534E] line-clamp-2">
                      {b.description || `Official ${b.name} stationery products`}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-[#E5E0D8] flex-wrap gap-2">
                      {onPreviewStorefront ? (
                        <button
                          type="button"
                          onClick={() => onPreviewStorefront({ view: 'catalogue', brandSlug: b.slug })}
                          className="text-[11px] font-mono font-bold text-[#D9381E] hover:underline cursor-pointer"
                        >
                          See All {b.name} Products ({matchingBrandProductsCount || b.productCount || 0}) →
                        </button>
                      ) : (
                        <span className="text-[10px] font-mono text-[#D9381E] font-bold">
                          {b.isFeatured ? '★ Featured on Homepage' : 'Standard Listing'}
                        </span>
                      )}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setBrandForm({
                              id: b.id,
                              name: b.name || '',
                              slug: b.slug || '',
                              description: b.description || '',
                              logoUrl: b.logoUrl || '',
                              bannerUrl: b.bannerUrl || '',
                              isFeatured: b.isFeatured !== false,
                              showInNav: b.showInNav !== false,
                              sortOrder: b.sortOrder || 1,
                              seoTitle: b.seoTitle || '',
                              seoDescription: b.seoDescription || '',
                              status: b.status || 'PUBLISHED',
                            })
                          }
                          className="px-2.5 py-1 border border-[#141413] bg-white text-xs font-bold hover:bg-[#141413] hover:text-white"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteOrArchiveBrand(b.id, b.name)}
                          className="p-1 text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3. DYNAMIC NAVIGATION BUILDER */}
      {activeSubTab === 'navigation' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleSaveNav}
            className="lg:col-span-5 bg-white border border-[#141413] p-5 space-y-4"
          >
            <div className="border-b border-[#E5E0D8] pb-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#D9381E] font-bold">
                HEADER & MOBILE MENU BUILDER
              </span>
              <h4 className="text-base font-bold">
                {navForm.id ? 'Edit Navigation Item' : 'Add Navigation Link (e.g. DIY & More)'}
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono uppercase text-[#57534E] mb-1">
                  Visible Menu Label *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DIY & Crafts or Best Sellers"
                  value={navForm.label}
                  onChange={(e) => setNavForm({ ...navForm, label: e.target.value })}
                  className="w-full px-3 py-2 border border-[#141413] text-sm bg-[#FAF7F2]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase text-[#57534E] mb-1">
                  Destination Type
                </label>
                <select
                  value={navForm.linkType}
                  onChange={(e) => {
                    const nextType = e.target.value;
                    let defaultTarget = '';
                    if (nextType === 'CATEGORY') defaultTarget = categories[0]?.slug || '';
                    if (nextType === 'BRAND') defaultTarget = brands[0]?.slug || '';
                    if (nextType === 'COLLECTION') defaultTarget = 'BESTSELLERS';
                    if (nextType === 'BUNDLES') defaultTarget = 'bundles';
                    if (nextType === 'BULK_ORDER') defaultTarget = 'bulk';
                    if (nextType === 'PAGE') defaultTarget = pages[0]?.slug || '';
                    setNavForm({ ...navForm, linkType: nextType, targetValue: defaultTarget });
                  }}
                  className="w-full px-3 py-2 border border-[#141413] text-sm bg-[#FAF7F2]"
                >
                  <option value="CATEGORY">Category Page</option>
                  <option value="BRAND">Brand / Company Filter</option>
                  <option value="COLLECTION">Special Collection (New / Bestsellers)</option>
                  <option value="BUNDLES">School & Office Combos</option>
                  <option value="BULK_ORDER">Institutional Bulk Order Form</option>
                  <option value="PAGE">Informational / Policy Page</option>
                  <option value="EXTERNAL">Custom / External URL</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-[#57534E] mb-1">
                Destination Target
              </label>
              {navForm.linkType === 'CATEGORY' ? (
                <select
                  value={navForm.targetValue}
                  onChange={(e) => setNavForm({ ...navForm, targetValue: e.target.value })}
                  className="w-full px-3 py-2 border border-[#141413] text-sm bg-[#FAF7F2]"
                >
                  <option value="">Select Category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.name} (/{c.slug})
                    </option>
                  ))}
                </select>
              ) : navForm.linkType === 'BRAND' ? (
                <select
                  value={navForm.targetValue}
                  onChange={(e) => setNavForm({ ...navForm, targetValue: e.target.value })}
                  className="w-full px-3 py-2 border border-[#141413] text-sm bg-[#FAF7F2]"
                >
                  <option value="">Select Company / Brand...</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.slug}>
                      {b.name} (/{b.slug})
                    </option>
                  ))}
                </select>
              ) : navForm.linkType === 'COLLECTION' ? (
                <select
                  value={navForm.targetValue}
                  onChange={(e) => setNavForm({ ...navForm, targetValue: e.target.value })}
                  className="w-full px-3 py-2 border border-[#141413] text-sm bg-[#FAF7F2]"
                >
                  <option value="ALL">All Products Catalogue</option>
                  <option value="BESTSELLERS">Bestsellers Collection</option>
                  <option value="NEW_ARRIVALS">New Arrivals Collection</option>
                  <option value="FEATURED">Featured Deals</option>
                  <option value="UNDER_99">Budget Finds Under ₹99</option>
                </select>
              ) : navForm.linkType === 'PAGE' ? (
                <select
                  value={navForm.targetValue}
                  onChange={(e) => setNavForm({ ...navForm, targetValue: e.target.value })}
                  className="w-full px-3 py-2 border border-[#141413] text-sm bg-[#FAF7F2]"
                >
                  <option value="">Select Informational Page...</option>
                  {pages.map((p) => (
                    <option key={p.id} value={p.slug}>
                      {p.title} (/{p.slug})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Target identifier or https:// URL"
                  value={navForm.targetValue}
                  onChange={(e) => setNavForm({ ...navForm, targetValue: e.target.value })}
                  className="w-full px-3 py-2 border border-[#D6D1C7] text-sm font-mono bg-[#FAF7F2]"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono uppercase text-[#57534E] mb-1">
                  Highlight Badge (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. NEW or HOT"
                  value={navForm.highlightBadge}
                  onChange={(e) => setNavForm({ ...navForm, highlightBadge: e.target.value })}
                  className="w-full px-3 py-2 border border-[#D6D1C7] text-xs font-mono bg-[#FAF7F2]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase text-[#57534E] mb-1">
                  Display Order
                </label>
                <input
                  type="number"
                  value={navForm.sortOrder}
                  onChange={(e) => setNavForm({ ...navForm, sortOrder: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-[#D6D1C7] text-xs font-mono bg-[#FAF7F2]"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 p-3 bg-[#FAF7F2] border border-[#E5E0D8] text-xs font-medium">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={navForm.showOnDesktop}
                  onChange={(e) => setNavForm({ ...navForm, showOnDesktop: e.target.checked })}
                />
                <span>Show on Desktop Bar</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={navForm.showOnMobile}
                  onChange={(e) => setNavForm({ ...navForm, showOnMobile: e.target.checked })}
                />
                <span>Show in Mobile Drawer</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 bg-[#D9381E] text-white font-bold text-xs uppercase tracking-wider hover:bg-[#141413] transition-colors cursor-pointer"
            >
              {saving ? 'Saving Menu Item...' : navForm.id ? 'Update Menu Item' : 'Add to Navigation'}
            </button>
          </form>

          <div className="lg:col-span-7 space-y-4">
            {/* Live Navigation Preview Box */}
            <div className="bg-white border border-[#141413] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#D9381E] font-bold">
                  LIVE NAVIGATION PREVIEW ({navPreviewDevice.toUpperCase()})
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setNavPreviewDevice('desktop')}
                    className={`px-2.5 py-1 text-xs font-bold border flex items-center gap-1 ${
                      navPreviewDevice === 'desktop'
                        ? 'bg-[#141413] text-white border-[#141413]'
                        : 'bg-[#FAF7F2] border-[#D6D1C7]'
                    }`}
                  >
                    <Monitor className="w-3 h-3" /> Desktop
                  </button>
                  <button
                    type="button"
                    onClick={() => setNavPreviewDevice('mobile')}
                    className={`px-2.5 py-1 text-xs font-bold border flex items-center gap-1 ${
                      navPreviewDevice === 'mobile'
                        ? 'bg-[#141413] text-white border-[#141413]'
                        : 'bg-[#FAF7F2] border-[#D6D1C7]'
                    }`}
                  >
                    <Smartphone className="w-3 h-3" /> Mobile
                  </button>
                </div>
              </div>

              {navPreviewDevice === 'desktop' ? (
                <div className="p-3 bg-[#FAF7F2] border border-[#141413] flex items-center gap-2 overflow-x-auto">
                  {navItems
                    .filter((i) => i.isActive && i.showOnDesktop)
                    .map((item) => (
                      <span
                        key={item.id}
                        className="px-2.5 py-1 bg-white border border-[#D6D1C7] text-xs font-bold whitespace-nowrap inline-flex items-center gap-1"
                      >
                        {item.label}
                        {item.highlightBadge && (
                          <span className="px-1 py-0.2 bg-[#D9381E] text-white text-[9px] font-mono">
                            {item.highlightBadge}
                          </span>
                        )}
                      </span>
                    ))}
                </div>
              ) : (
                <div className="p-3 bg-[#FAF7F2] border border-[#141413] max-w-xs space-y-1">
                  {navItems
                    .filter((i) => i.isActive && i.showOnMobile)
                    .map((item) => (
                      <div
                        key={item.id}
                        className="px-3 py-1.5 bg-white border border-[#E5E0D8] text-xs font-bold flex items-center justify-between"
                      >
                        <span>{item.label}</span>
                        {item.highlightBadge && (
                          <span className="px-1.5 py-0.5 bg-[#D9381E] text-white text-[9px] font-mono">
                            {item.highlightBadge}
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Saved Navigation Items List */}
            <div className="bg-white border border-[#141413] p-5 space-y-3">
              <h4 className="text-base font-bold border-b border-[#E5E0D8] pb-2">
                Configured Menu Links ({navItems.length})
              </h4>
              <div className="divide-y divide-[#E5E0D8]">
                {navItems.map((item) => {
                  const check = validateNavDestination(item.linkType, item.targetValue);
                  return (
                    <div
                      key={item.id}
                      className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-[#57534E]">#{item.sortOrder}</span>
                          <span className="font-bold text-sm">{item.label}</span>
                          {item.highlightBadge && (
                            <span className="px-1.5 py-0.5 bg-[#D9381E] text-white text-[10px] font-mono font-bold">
                              {item.highlightBadge}
                            </span>
                          )}
                          <span className="text-[11px] font-mono px-1.5 py-0.5 bg-slate-100 rounded">
                            {item.linkType} → {item.targetValue || 'default'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-mono mt-0.5">
                          {check.valid ? (
                            <span className="text-emerald-700 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> {check.note}
                            </span>
                          ) : (
                            <span className="text-amber-700 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> {check.note}
                            </span>
                          )}
                          <span>· Desktop: {item.showOnDesktop ? 'Yes' : 'No'}</span>
                          <span>· Mobile: {item.showOnMobile ? 'Yes' : 'No'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveNavOrder(item, 'up')}
                          className="p-1.5 border border-[#D6D1C7] hover:border-[#141413]"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveNavOrder(item, 'down')}
                          className="p-1.5 border border-[#D6D1C7] hover:border-[#141413]"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setNavForm({
                              id: item.id,
                              label: item.label,
                              linkType: item.linkType,
                              targetValue: item.targetValue || '',
                              highlightBadge: item.highlightBadge || '',
                              sortOrder: item.sortOrder || 1,
                              showOnDesktop: item.showOnDesktop !== false,
                              showOnMobile: item.showOnMobile !== false,
                              openInNewTab: Boolean(item.openInNewTab),
                              status: item.status || 'PUBLISHED',
                            })
                          }
                          className="px-2.5 py-1 border border-[#141413] text-xs font-bold bg-[#FAF7F2]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteNav(item.id)}
                          className="p-1.5 text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. HOMEPAGE SECTION BUILDER */}
      {activeSubTab === 'homepage' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleSaveSection}
            className="lg:col-span-5 bg-white border border-[#141413] p-5 space-y-4"
          >
            <div className="border-b border-[#E5E0D8] pb-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#D9381E] font-bold">
                HOMEPAGE SECTION BUILDER
              </span>
              <h4 className="text-base font-bold">
                {sectionForm.id ? 'Edit Homepage Section' : 'Add Custom Homepage Section'}
              </h4>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-[#57534E] mb-1">
                Section Type
              </label>
              <select
                value={sectionForm.sectionType}
                onChange={(e) => setSectionForm({ ...sectionForm, sectionType: e.target.value })}
                className="w-full px-3 py-2 border border-[#141413] text-sm bg-[#FAF7F2]"
              >
                <option value="PRODUCT_CAROUSEL">Product Showcase Grid (Category / Brand / Tag)</option>
                <option value="CATEGORY_GRID">Shop by Category Grid</option>
                <option value="BRAND_SHOWCASE">Featured Stationery Companies / Brands Strip</option>
                <option value="COMBO_BUNDLES">School & Office Combo Bundles</option>
                <option value="BUDGET_CORNER">Shop by Budget & Active Coupons</option>
                <option value="FULFILMENT_STRIP">Store Pickup vs Home Delivery Strip</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono uppercase text-[#57534E] mb-1">
                  Section Heading *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DIY & Craft Supplies Spotlight"
                  value={sectionForm.title}
                  onChange={(e) => setSectionForm({ ...sectionForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-[#141413] text-sm bg-[#FAF7F2]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase text-[#57534E] mb-1">
                  Eyebrow Badge Text
                </label>
                <input
                  type="text"
                  placeholder="e.g. CREATIVE STUDIO"
                  value={sectionForm.badgeText}
                  onChange={(e) => setSectionForm({ ...sectionForm, badgeText: e.target.value })}
                  className="w-full px-3 py-2 border border-[#D6D1C7] text-xs font-mono bg-[#FAF7F2]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-[#57534E] mb-1">
                Section Subtitle
              </label>
              <input
                type="text"
                placeholder="Short editorial description shown below the heading..."
                value={sectionForm.subtitle}
                onChange={(e) => setSectionForm({ ...sectionForm, subtitle: e.target.value })}
                className="w-full px-3 py-2 border border-[#D6D1C7] text-sm bg-[#FAF7F2]"
              />
            </div>

            {sectionForm.sectionType === 'PRODUCT_CAROUSEL' && (
              <div className="p-3 bg-[#FAF7F2] border border-[#E5E0D8] space-y-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-[#57534E] mb-1">
                    Product Source Filter
                  </label>
                  <select
                    value={sectionForm.sourceType}
                    onChange={(e) => setSectionForm({ ...sectionForm, sourceType: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-[#141413] text-xs bg-white"
                  >
                    <option value="BESTSELLERS">Bestsellers Flag</option>
                    <option value="NEW_ARRIVALS">New Arrivals Flag</option>
                    <option value="FEATURED">Featured Products Flag</option>
                    <option value="CATEGORY">Specific Category (e.g. DIY & Crafts)</option>
                    <option value="BRAND">Specific Company / Brand</option>
                  </select>
                </div>

                {sectionForm.sourceType === 'CATEGORY' && (
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[#57534E] mb-1">
                      Select Target Category
                    </label>
                    <select
                      value={sectionForm.sourceCategoryId}
                      onChange={(e) =>
                        setSectionForm({ ...sectionForm, sourceCategoryId: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 border border-[#141413] text-xs bg-white"
                    >
                      <option value="">Choose Category...</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {sectionForm.sourceType === 'BRAND' && (
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-[#57534E] mb-1">
                      Select Target Company / Brand
                    </label>
                    <select
                      value={sectionForm.sourceBrandId}
                      onChange={(e) =>
                        setSectionForm({ ...sectionForm, sourceBrandId: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 border border-[#141413] text-xs bg-white"
                    >
                      <option value="">Choose Brand...</option>
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#57534E] mb-1">
                  Max Items
                </label>
                <input
                  type="number"
                  min={2}
                  max={24}
                  value={sectionForm.maxItems}
                  onChange={(e) => setSectionForm({ ...sectionForm, maxItems: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 border border-[#D6D1C7] text-xs font-mono bg-[#FAF7F2]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#57534E] mb-1">
                  Sort Order
                </label>
                <input
                  type="number"
                  value={sectionForm.sortOrder}
                  onChange={(e) => setSectionForm({ ...sectionForm, sortOrder: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 border border-[#D6D1C7] text-xs font-mono bg-[#FAF7F2]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#57534E] mb-1">
                  Status
                </label>
                <select
                  value={sectionForm.status}
                  onChange={(e) => setSectionForm({ ...sectionForm, status: e.target.value })}
                  className="w-full px-2 py-1.5 border border-[#141413] text-xs font-bold bg-[#FAF7F2]"
                >
                  <option value="PUBLISHED">PUBLISHED</option>
                  <option value="HIDDEN">HIDDEN</option>
                </select>
              </div>
            </div>

            {/* Live Homepage Section Visual Preview */}
            {(() => {
              const matchedPreviewProducts = products
                .filter((p) => {
                  if (p.isActive === false) return false;
                  if (sectionForm.sourceType === 'CATEGORY' && sectionForm.sourceCategoryId) {
                    return Number(p.categoryId) === Number(sectionForm.sourceCategoryId);
                  }
                  if (sectionForm.sourceType === 'BRAND' && sectionForm.sourceBrandId) {
                    return Number(p.brandId) === Number(sectionForm.sourceBrandId);
                  }
                  if (sectionForm.sourceType === 'BESTSELLERS') return Boolean(p.isBestseller);
                  if (sectionForm.sourceType === 'NEW_ARRIVALS') return Boolean(p.isNewArrival);
                  return true;
                })
                .slice(0, Math.min(4, Number(sectionForm.maxItems) || 4));

              return (
                <div className="p-3.5 border border-dashed border-[#141413] bg-[#FAF7F2] space-y-2.5">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase text-[#57534E]">
                    <span>LIVE HOMEPAGE SECTION PREVIEW</span>
                    <span className="text-[#D9381E] font-bold">{sectionForm.sectionType}</span>
                  </div>
                  <div className="p-3 bg-white border border-[#141413] space-y-2.5">
                    <div className="flex items-start justify-between gap-2 border-b border-[#E5E0D8] pb-2">
                      <div>
                        {sectionForm.badgeText && (
                          <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 bg-[#D9381E] text-white font-bold">
                            {sectionForm.badgeText}
                          </span>
                        )}
                        <h5 className="font-bold text-sm text-[#141413] mt-0.5">
                          {sectionForm.title || 'Section Title Preview'}
                        </h5>
                        <p className="text-[11px] text-[#57534E]">
                          {sectionForm.subtitle || 'Editorial subtitle for this homepage block...'}
                        </p>
                      </div>
                      <span className="text-[10px] font-mono underline font-bold shrink-0">
                        {sectionForm.ctaText || 'Explore'} →
                      </span>
                    </div>

                    {sectionForm.sectionType === 'PRODUCT_CAROUSEL' && (
                      <div className="grid grid-cols-2 gap-2">
                        {matchedPreviewProducts.length === 0 ? (
                          <div className="col-span-2 text-[11px] text-[#57534E] py-2">
                            Matching catalogue products will appear in a {sectionForm.maxItems}-item grid.
                          </div>
                        ) : (
                          matchedPreviewProducts.map((prod) => (
                            <div
                              key={prod.id}
                              className="p-2 bg-[#FAF7F2] border border-[#E5E0D8] flex items-center gap-2"
                            >
                              {prod.imageUrl ? (
                                <img
                                  src={prod.imageUrl}
                                  alt={prod.name}
                                  className="w-8 h-8 object-cover border border-[#D6D1C7] bg-white shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 bg-[#141413] text-white text-[9px] font-mono flex items-center justify-center shrink-0">
                                  SKU
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="text-[11px] font-bold truncate">{prod.name}</div>
                                <div className="text-[10px] font-mono text-[#D9381E] font-bold">
                                  ₹{Math.round(Number(prod.sellingPricePaise || 0) / 100)}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {sectionForm.sectionType === 'CATEGORY_GRID' && (
                      <div className="grid grid-cols-2 gap-1.5">
                        {categories.slice(0, 4).map((c) => (
                          <div
                            key={c.id}
                            className="px-2 py-1.5 bg-[#FAF7F2] border border-[#E5E0D8] text-[11px] font-bold truncate"
                          >
                            {c.name}
                          </div>
                        ))}
                      </div>
                    )}

                    {sectionForm.sectionType === 'BRAND_SHOWCASE' && (
                      <div className="flex flex-wrap gap-1.5">
                        {localBrands.slice(0, 5).map((b) => (
                          <span
                            key={b.id}
                            className="px-2 py-1 bg-[#FAF7F2] border border-[#D6D1C7] text-[10px] font-mono font-bold"
                          >
                            {b.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 bg-[#D9381E] text-white font-bold text-xs uppercase tracking-wider hover:bg-[#141413] transition-colors cursor-pointer"
            >
              {saving ? 'Saving Section...' : sectionForm.id ? 'Update Section' : 'Add Homepage Section'}
            </button>
          </form>

          <div className="lg:col-span-7 bg-white border border-[#141413] p-5 space-y-4">
            <div className="border-b border-[#E5E0D8] pb-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#57534E]">
                HOMEPAGE RENDER SEQUENCE
              </span>
              <h4 className="text-base font-bold">
                Active & Scheduled Homepage Sections ({homepageSections.length})
              </h4>
            </div>

            <div className="divide-y divide-[#E5E0D8]">
              {homepageSections.map((sec) => (
                <div
                  key={sec.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded">
                        #{sec.sortOrder}
                      </span>
                      <span className="font-bold text-sm">{sec.title}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 bg-stone-100 border border-stone-300">
                        {sec.sectionType}
                      </span>
                      <span
                        className={`text-[10px] font-mono uppercase px-1.5 py-0.5 font-bold ${
                          sec.status === 'PUBLISHED' && sec.isActive
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-stone-200 text-stone-700'
                        }`}
                      >
                        {sec.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#57534E]">{sec.subtitle}</p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMoveSectionOrder(sec, 'up')}
                      className="p-1.5 border border-[#D6D1C7] hover:border-[#141413]"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveSectionOrder(sec, 'down')}
                      className="p-1.5 border border-[#D6D1C7] hover:border-[#141413]"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleSectionStatus(sec)}
                      className="px-2 py-1 border border-[#D6D1C7] text-xs font-mono hover:border-[#141413]"
                    >
                      {sec.status === 'PUBLISHED' ? 'Hide' : 'Publish'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSectionForm({
                          id: sec.id,
                          sectionType: sec.sectionType,
                          title: sec.title,
                          subtitle: sec.subtitle || '',
                          badgeText: sec.badgeText || '',
                          ctaText: sec.ctaText || 'Explore',
                          ctaLink: sec.ctaLink || 'catalogue',
                          sourceType: sec.sourceType || 'AUTOMATIC',
                          sourceCategoryId: sec.sourceCategoryId || '',
                          sourceBrandId: sec.sourceBrandId || '',
                          productIds: sec.productIds || [],
                          maxItems: sec.maxItems || 8,
                          layoutStyle: sec.layoutStyle || 'GRID_4',
                          sortOrder: sec.sortOrder || 1,
                          status: sec.status || 'PUBLISHED',
                        })
                      }
                      className="px-2.5 py-1 border border-[#141413] text-xs font-bold bg-[#FAF7F2]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSection(sec.id)}
                      className="p-1.5 text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. HERO & PROMO BANNERS MANAGER */}
      {activeSubTab === 'banners' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleSaveBanner}
            className="lg:col-span-5 bg-white border border-[#141413] p-5 space-y-4"
          >
            <div className="border-b border-[#E5E0D8] pb-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#D9381E] font-bold">
                HERO & CAMPAIGN BANNER STUDIO
              </span>
              <h4 className="text-base font-bold">
                {bannerForm.id ? 'Edit Promotional Banner' : 'Create Hero / Campaign Banner'}
              </h4>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-[#57534E] mb-1">
                Banner Headline *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Back to School & Fine Art Supply Festival"
                value={bannerForm.title}
                onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })}
                className="w-full px-3 py-2 border border-[#141413] text-sm bg-[#FAF7F2]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-[#57534E] mb-1">
                Subtitle / Offer Details
              </label>
              <textarea
                rows={2}
                placeholder="Explain the discount, pickup speed, or featured stationery brands..."
                value={bannerForm.subtitle}
                onChange={(e) => setBannerForm({ ...bannerForm, subtitle: e.target.value })}
                className="w-full px-3 py-2 border border-[#D6D1C7] text-sm bg-[#FAF7F2]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#57534E] mb-1">
                  Eyebrow Badge
                </label>
                <input
                  type="text"
                  value={bannerForm.badgeText}
                  onChange={(e) => setBannerForm({ ...bannerForm, badgeText: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-[#D6D1C7] text-xs font-mono bg-[#FAF7F2]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#57534E] mb-1">
                  Placement
                </label>
                <select
                  value={bannerForm.placement}
                  onChange={(e) => setBannerForm({ ...bannerForm, placement: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-[#141413] text-xs font-bold bg-[#FAF7F2]"
                >
                  <option value="HERO_MAIN">Main Homepage Hero</option>
                  <option value="MID_PAGE_STRIP">Mid-Page Promo Strip</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#57534E] mb-1">
                  Primary Button Label
                </label>
                <input
                  type="text"
                  value={bannerForm.ctaText}
                  onChange={(e) => setBannerForm({ ...bannerForm, ctaText: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-[#D6D1C7] text-xs bg-[#FAF7F2]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#57534E] mb-1">
                  Primary Target (Slug / View)
                </label>
                <input
                  type="text"
                  placeholder="catalogue or category:diy-and-crafts"
                  value={bannerForm.ctaLink}
                  onChange={(e) => setBannerForm({ ...bannerForm, ctaLink: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-[#D6D1C7] text-xs font-mono bg-[#FAF7F2]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase text-[#57534E] mb-1">
                Banner Image(s) (Upload Single or Multiple Photos / Paste URL)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://... or upload banner graphic(s)"
                  value={bannerForm.desktopImageUrl}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBannerForm({ ...bannerForm, desktopImageUrl: val });
                    if (val.trim()) {
                      setBannerGalleryUrls((prev) => Array.from(new Set([val.trim(), ...prev])));
                    }
                  }}
                  className="flex-1 px-2.5 py-1.5 border border-[#D6D1C7] text-xs bg-[#FAF7F2]"
                />
                <label className="px-3 py-1.5 bg-[#141413] text-white text-xs font-bold cursor-pointer">
                  {uploadingBannerImg ? 'Uploading...' : 'Upload Photo(s)'}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []) as File[];
                      if (files.length === 0) return;
                      setUploadingBannerImg(true);
                      try {
                        const uploaded: string[] = [];
                        for (const file of files) {
                          const res = await uploadImageToSupabaseStorage(file, {
                            productSku: 'BANNER-HERO',
                          });
                          uploaded.push(res.downloadUrl);
                        }
                        if (uploaded.length > 0) {
                          setBannerForm((prev) => ({
                            ...prev,
                            desktopImageUrl: prev.desktopImageUrl || uploaded[0],
                          }));
                          setBannerGalleryUrls((prev) =>
                            Array.from(new Set([...uploaded, ...prev]))
                          );
                          notify(
                            uploaded.length > 1
                              ? `Uploaded ${uploaded.length} banner photos. Click any thumbnail to switch active banner graphic.`
                              : 'Banner image uploaded.'
                          );
                        }
                      } catch (err: any) {
                        notify(err.message || 'Upload failed', 'error');
                      } finally {
                        setUploadingBannerImg(false);
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
              </div>
              {bannerGalleryUrls.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-2">
                  {bannerGalleryUrls.map((url, idx) => (
                    <div
                      key={`${url}-${idx}`}
                      className={`relative w-14 h-10 border overflow-hidden cursor-pointer ${
                        bannerForm.desktopImageUrl === url
                          ? 'border-2 border-[#D9381E]'
                          : 'border-[#D6D1C7]'
                      }`}
                    >
                      <img
                        src={url}
                        alt={`Banner graphic ${idx + 1}`}
                        className="w-full h-full object-cover"
                        onClick={() =>
                          setBannerForm((prev) => ({ ...prev, desktopImageUrl: url }))
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setBannerGalleryUrls((prev) => prev.filter((item) => item !== url))
                        }
                        className="absolute top-0 right-0 bg-red-600 text-white text-[9px] w-3.5 h-3.5 flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#57534E] mb-1">
                  Background
                </label>
                <input
                  type="color"
                  value={bannerForm.backgroundColor}
                  onChange={(e) => setBannerForm({ ...bannerForm, backgroundColor: e.target.value })}
                  className="w-full h-8 border border-[#141413] cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#57534E] mb-1">
                  Text Color
                </label>
                <input
                  type="color"
                  value={bannerForm.textColor}
                  onChange={(e) => setBannerForm({ ...bannerForm, textColor: e.target.value })}
                  className="w-full h-8 border border-[#141413] cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#57534E] mb-1">
                  Accent Button
                </label>
                <input
                  type="color"
                  value={bannerForm.accentColor}
                  onChange={(e) => setBannerForm({ ...bannerForm, accentColor: e.target.value })}
                  className="w-full h-8 border border-[#141413] cursor-pointer"
                />
              </div>
            </div>

            {/* Live Banner Preview Inside Form */}
            <div className="p-3 border border-dashed border-[#141413] bg-[#FAF7F2] space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase text-[#57534E]">
                <span>LIVE BANNER PREVIEW ({bannerForm.placement})</span>
                <span className="font-bold text-[#D9381E]">Real-Time Colors &amp; Copy</span>
              </div>
              <div
                className="p-4 border border-[#141413] space-y-2 transition-colors"
                style={{
                  backgroundColor: bannerForm.backgroundColor || '#141413',
                  color: bannerForm.textColor || '#FAF7F2',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-[9px] font-mono uppercase px-2 py-0.5 font-bold"
                    style={{ backgroundColor: bannerForm.accentColor || '#D9381E', color: '#FFFFFF' }}
                  >
                    {bannerForm.badgeText || 'PROMO BANNER'}
                  </span>
                  <span className="text-[10px] font-mono opacity-75">{bannerForm.status}</span>
                </div>
                <h5 className="text-base font-bold tracking-tight">
                  {bannerForm.title || 'Your Banner Headline Will Appear Here'}
                </h5>
                <p className="text-xs opacity-85 line-clamp-2">
                  {bannerForm.subtitle || 'Subtitle and promotional offer details preview...'}
                </p>
                {bannerForm.desktopImageUrl && (
                  <img
                    src={bannerForm.desktopImageUrl}
                    alt="Banner preview"
                    className="w-full h-24 object-cover border border-white/20 my-1.5"
                  />
                )}
                <div className="pt-1 flex items-center gap-2">
                  <span
                    className="px-3 py-1 text-[11px] font-bold"
                    style={{ backgroundColor: bannerForm.accentColor || '#D9381E', color: '#FFFFFF' }}
                  >
                    {bannerForm.ctaText || 'Shop Now'} →
                  </span>
                  {bannerForm.secondaryCtaText && (
                    <span className="px-2.5 py-1 text-[11px] font-bold border border-current">
                      {bannerForm.secondaryCtaText}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 bg-[#D9381E] text-white font-bold text-xs uppercase tracking-wider hover:bg-[#141413] transition-colors cursor-pointer"
            >
              {saving ? 'Saving Banner...' : bannerForm.id ? 'Update Banner' : 'Publish Banner'}
            </button>
          </form>

          <div className="lg:col-span-7 space-y-4">
            {banners.map((b) => (
              <div
                key={b.id}
                className="border border-[#141413] p-5 flex flex-col justify-between gap-4"
                style={{ backgroundColor: b.backgroundColor || '#141413', color: b.textColor || '#FAF7F2' }}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[10px] font-mono uppercase px-2 py-0.5 font-bold"
                      style={{ backgroundColor: b.accentColor || '#D9381E', color: '#FFFFFF' }}
                    >
                      {b.badgeText || b.placement}
                    </span>
                    <span className="text-xs font-mono opacity-80">
                      {b.status} · Sort #{b.sortOrder}
                    </span>
                  </div>
                  <h4 className="text-xl font-bold tracking-tight">{b.title}</h4>
                  <p className="text-xs opacity-85 max-w-xl">{b.subtitle}</p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/20">
                  <div className="flex items-center gap-2">
                    <span
                      className="px-3 py-1 text-xs font-bold"
                      style={{ backgroundColor: b.accentColor || '#D9381E', color: '#FFFFFF' }}
                    >
                      {b.ctaText} → {b.ctaLink}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setBannerForm({
                          id: b.id,
                          placement: b.placement || 'HERO_MAIN',
                          title: b.title || '',
                          subtitle: b.subtitle || '',
                          badgeText: b.badgeText || '',
                          ctaText: b.ctaText || 'Shop Now',
                          ctaLink: b.ctaLink || 'catalogue',
                          secondaryCtaText: b.secondaryCtaText || '',
                          secondaryCtaLink: b.secondaryCtaLink || '',
                          desktopImageUrl: b.desktopImageUrl || '',
                          backgroundColor: b.backgroundColor || '#141413',
                          textColor: b.textColor || '#FAF7F2',
                          accentColor: b.accentColor || '#D9381E',
                          textAlignment: b.textAlignment || 'LEFT',
                          startAt: b.startAt || '',
                          endAt: b.endAt || '',
                          sortOrder: b.sortOrder || 1,
                          status: b.status || 'PUBLISHED',
                        })
                      }
                      className="px-3 py-1 bg-white text-[#141413] text-xs font-bold"
                    >
                      Edit Banner
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBanner(b.id)}
                      className="px-2.5 py-1 bg-red-700 text-white text-xs font-bold"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. INFORMATIONAL & POLICY PAGES MANAGER */}
      {activeSubTab === 'pages' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleSavePage}
            className="lg:col-span-6 bg-white border border-[#141413] p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#E5E0D8] pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#D9381E] font-bold">
                  STORE INFORMATION & POLICY PAGES
                </span>
                <h4 className="text-base font-bold">
                  {pageForm.id ? `Edit Page: ${pageForm.title}` : 'Create New Informational / Policy Page'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPageMode(!previewPageMode)}
                className="px-2.5 py-1 border border-[#141413] text-xs font-bold bg-[#FAF7F2]"
              >
                {previewPageMode ? 'Edit Content' : 'Preview Page'}
              </button>
            </div>

            {previewPageMode ? (
              <div className="p-4 bg-[#FAF7F2] border border-[#141413] space-y-3 min-h-[280px]">
                <div className="text-[10px] font-mono uppercase text-[#D9381E] font-bold">
                  /{pageForm.slug || 'page-slug'} · {pageForm.pageType}
                </div>
                <h2 className="text-xl font-bold">{pageForm.title || 'Untitled Page'}</h2>
                {pageForm.summary && (
                  <p className="text-xs text-[#57534E] italic border-l-2 border-[#D9381E] pl-2.5">
                    {pageForm.summary}
                  </p>
                )}
                <div className="text-sm whitespace-pre-line leading-relaxed text-[#141413]">
                  {pageForm.contentMarkdown || 'No content entered yet.'}
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-[#57534E] mb-1">
                      Page Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Store Pickup Guide or Return Policy"
                      value={pageForm.title}
                      onChange={(e) =>
                        setPageForm({
                          ...pageForm,
                          title: e.target.value,
                          slug:
                            pageForm.id
                              ? pageForm.slug
                              : e.target.value
                                  .toLowerCase()
                                  .replace(/[^a-z0-9]+/g, '-')
                                  .replace(/(^-|-$)/g, ''),
                        })
                      }
                      className="w-full px-3 py-2 border border-[#141413] text-sm bg-[#FAF7F2]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-[#57534E] mb-1">
                      URL Slug
                    </label>
                    <input
                      type="text"
                      value={pageForm.slug}
                      onChange={(e) => setPageForm({ ...pageForm, slug: e.target.value })}
                      className="w-full px-3 py-2 border border-[#D6D1C7] text-sm font-mono bg-[#FAF7F2]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-[#57534E] mb-1">
                    Short Summary Banner
                  </label>
                  <input
                    type="text"
                    placeholder="1-line summary shown at the top of the page..."
                    value={pageForm.summary}
                    onChange={(e) => setPageForm({ ...pageForm, summary: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D6D1C7] text-sm bg-[#FAF7F2]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-[#57534E] mb-1">
                    Page Body Content (Supports Headings, Bullet Lists & Paragraphs) *
                  </label>
                  <textarea
                    rows={8}
                    required
                    placeholder="Write policy rules, FAQs, or store information..."
                    value={pageForm.contentMarkdown}
                    onChange={(e) => setPageForm({ ...pageForm, contentMarkdown: e.target.value })}
                    className="w-full px-3 py-2 border border-[#141413] text-sm font-mono bg-[#FAF7F2]"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 items-center">
                  <select
                    value={pageForm.status}
                    onChange={(e) => setPageForm({ ...pageForm, status: e.target.value })}
                    className="px-2.5 py-2 border border-[#141413] text-xs font-bold bg-[#FAF7F2]"
                  >
                    <option value="PUBLISHED">PUBLISHED</option>
                    <option value="DRAFT">DRAFT</option>
                  </select>
                  <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pageForm.showInFooter}
                      onChange={(e) => setPageForm({ ...pageForm, showInFooter: e.target.checked })}
                    />
                    <span>Show in Footer</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pageForm.showInHeader}
                      onChange={(e) => setPageForm({ ...pageForm, showInHeader: e.target.checked })}
                    />
                    <span>Show in Header</span>
                  </label>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 bg-[#D9381E] text-white font-bold text-xs uppercase tracking-wider hover:bg-[#141413] transition-colors cursor-pointer"
            >
              {saving ? 'Saving Page...' : pageForm.id ? 'Update & Publish Page' : 'Publish Page'}
            </button>
          </form>

          <div className="lg:col-span-6 bg-white border border-[#141413] p-5 space-y-3">
            <h4 className="text-base font-bold border-b border-[#E5E0D8] pb-2">
              Published Informational & Policy Pages ({pages.length})
            </h4>
            <div className="divide-y divide-[#E5E0D8]">
              {pages.map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{p.title}</span>
                      <span className="text-xs font-mono text-[#57534E]">/{p.slug}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 bg-emerald-100 text-emerald-900 font-bold">
                        {p.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#57534E] line-clamp-1 mt-0.5">{p.summary}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {onPreviewStorefront && (
                      <button
                        type="button"
                        onClick={() => onPreviewStorefront({ view: 'page', pageSlug: p.slug })}
                        className="px-2 py-1 border border-[#D6D1C7] text-xs hover:border-[#141413]"
                      >
                        Read
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setPageForm({
                          id: p.id,
                          title: p.title,
                          slug: p.slug,
                          pageType: p.pageType || 'INFO',
                          summary: p.summary || '',
                          contentMarkdown: p.contentMarkdown || '',
                          seoTitle: p.seoTitle || '',
                          seoDescription: p.seoDescription || '',
                          showInFooter: p.showInFooter !== false,
                          showInHeader: Boolean(p.showInHeader),
                          status: p.status || 'PUBLISHED',
                        })
                      }
                      className="px-2.5 py-1 border border-[#141413] text-xs font-bold bg-[#FAF7F2]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePage(p.id)}
                      className="p-1 text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 7. SCHOOL & OFFICE COMBO BUNDLES MANAGER */}
      {activeSubTab === 'bundles' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleSaveBundle}
            className="lg:col-span-5 bg-white border border-[#141413] p-5 space-y-4"
          >
            <div className="border-b border-[#E5E0D8] pb-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#D9381E] font-bold">
                COMBO KITS & SCHOOL BUNDLES
              </span>
              <h4 className="text-base font-bold">
                {bundleForm.id ? 'Edit Combo Bundle' : 'Create New Stationery Combo Kit'}
              </h4>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-[#57534E] mb-1">
                Bundle Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. DIY Art & Origami Starter Kit"
                value={bundleForm.name}
                onChange={(e) => setBundleForm({ ...bundleForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-[#141413] text-sm bg-[#FAF7F2]"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#57534E] mb-1">
                  Target Group
                </label>
                <input
                  type="text"
                  value={bundleForm.targetGroup}
                  onChange={(e) => setBundleForm({ ...bundleForm, targetGroup: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-[#D6D1C7] text-xs bg-[#FAF7F2]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#57534E] mb-1">
                  Bundle Price (₹)
                </label>
                <input
                  type="number"
                  required
                  value={bundleForm.bundlePriceRupees}
                  onChange={(e) => setBundleForm({ ...bundleForm, bundlePriceRupees: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-[#141413] text-xs font-mono bg-[#FAF7F2]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#57534E] mb-1">
                  You Save (₹)
                </label>
                <input
                  type="number"
                  value={bundleForm.savingsRupees}
                  onChange={(e) => setBundleForm({ ...bundleForm, savingsRupees: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-[#D6D1C7] text-xs font-mono bg-[#FAF7F2]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-[#57534E] mb-1">
                Description
              </label>
              <textarea
                rows={2}
                value={bundleForm.description}
                onChange={(e) => setBundleForm({ ...bundleForm, description: e.target.value })}
                className="w-full px-3 py-2 border border-[#D6D1C7] text-sm bg-[#FAF7F2]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-[#57534E] mb-1">
                Included Items (One per line, e.g. "A4 Sketchbook x 2")
              </label>
              <textarea
                rows={4}
                value={bundleForm.itemsText}
                onChange={(e) => setBundleForm({ ...bundleForm, itemsText: e.target.value })}
                className="w-full px-3 py-2 border border-[#141413] text-xs font-mono bg-[#FAF7F2]"
              />
            </div>

            {/* Live Combo Kit Card Preview */}
            <div className="p-3 border border-dashed border-[#141413] bg-[#FAF7F2] space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase text-[#57534E]">
                <span>LIVE COMBO BUNDLE CARD PREVIEW</span>
                <span className="text-emerald-800 font-bold">
                  SAVE ₹{bundleForm.savingsRupees || '0'}
                </span>
              </div>
              <div className="p-3.5 bg-white border border-[#141413] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 bg-[#FAF7F2] border border-[#D6D1C7] text-[10px] font-mono font-bold">
                    {bundleForm.targetGroup || 'All Students'}
                  </span>
                  <span className="font-mono text-sm font-bold text-[#D9381E]">
                    ₹{bundleForm.bundlePriceRupees || '0'}
                  </span>
                </div>
                <div className="font-bold text-sm text-[#141413]">
                  {bundleForm.name || 'Combo Bundle Title'}
                </div>
                {bundleForm.description && (
                  <p className="text-xs text-[#57534E] line-clamp-2">{bundleForm.description}</p>
                )}
                <ul className="text-[11px] font-mono text-[#141413] space-y-0.5 pt-1 border-t border-[#E5E0D8]">
                  {bundleForm.itemsText
                    .split('\n')
                    .map((l) => l.trim())
                    .filter(Boolean)
                    .slice(0, 5)
                    .map((line, i) => (
                      <li key={i}>✓ {line}</li>
                    ))}
                </ul>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 bg-[#D9381E] text-white font-bold text-xs uppercase tracking-wider hover:bg-[#141413] transition-colors cursor-pointer"
            >
              {saving ? 'Saving Bundle...' : bundleForm.id ? 'Update Combo Bundle' : 'Publish Combo Bundle'}
            </button>
          </form>

          <div className="lg:col-span-7 bg-white border border-[#141413] p-5 space-y-3">
            <h4 className="text-base font-bold border-b border-[#E5E0D8] pb-2">
              Active Combo Kits ({bundles.length})
            </h4>
            <div className="divide-y divide-[#E5E0D8]">
              {bundles.map((b) => (
                <div key={b.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-sm">{b.name}</div>
                    <div className="text-xs text-[#57534E]">
                      {b.targetGroup} · ₹{Math.round(b.bundlePricePaise / 100)} (Save ₹
                      {Math.round(b.savingsPaise / 100)})
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setBundleForm({
                        id: b.id,
                        name: b.name,
                        slug: b.slug,
                        description: b.description,
                        targetGroup: b.targetGroup,
                        bundlePriceRupees: String(Math.round(b.bundlePricePaise / 100)),
                        savingsRupees: String(Math.round(b.savingsPaise / 100)),
                        itemsText: (b.itemsSummary || [])
                          .map((i: any) => `${i.productName} x ${i.quantity}`)
                          .join('\n'),
                        isActive: b.isActive !== false,
                      })
                    }
                    className="px-3 py-1 border border-[#141413] text-xs font-bold bg-[#FAF7F2]"
                  >
                    Edit Kit
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 8. THEME, BRANDING, FOOTER & REVISION HISTORY */}
      {activeSubTab === 'appearance' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleSaveThemeAndFooter}
            className="lg:col-span-7 bg-white border border-[#141413] p-5 space-y-5"
          >
            <div className="border-b border-[#E5E0D8] pb-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#D9381E] font-bold">
                BRANDING, ANNOUNCEMENT BAR & VISUAL THEME
              </span>
              <h4 className="text-base font-bold">
                Store Identity, Color Palette & Footer Configuration
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono uppercase text-[#57534E] mb-1">
                  Store Display Name
                </label>
                <input
                  type="text"
                  value={themeForm.storeName}
                  onChange={(e) => setThemeForm({ ...themeForm, storeName: e.target.value })}
                  className="w-full px-3 py-2 border border-[#141413] text-sm bg-[#FAF7F2]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase text-[#57534E] mb-1">
                  Header Tagline
                </label>
                <input
                  type="text"
                  value={themeForm.tagline}
                  onChange={(e) => setThemeForm({ ...themeForm, tagline: e.target.value })}
                  className="w-full px-3 py-2 border border-[#D6D1C7] text-sm bg-[#FAF7F2]"
                />
              </div>
            </div>

            {/* Announcement Bar */}
            <div className="p-3.5 bg-[#FAF7F2] border border-[#141413] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase font-mono">
                  Top Promotional Announcement Bar
                </span>
                <label className="flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={themeForm.announcementEnabled}
                    onChange={(e) =>
                      setThemeForm({ ...themeForm, announcementEnabled: e.target.checked })
                    }
                  />
                  <span>Show Announcement Bar</span>
                </label>
              </div>
              <input
                type="text"
                value={themeForm.announcementText}
                onChange={(e) => setThemeForm({ ...themeForm, announcementText: e.target.value })}
                className="w-full px-3 py-2 border border-[#D6D1C7] text-xs font-mono bg-white"
              />
            </div>

            {/* Guardrailed Color Tokens */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#57534E] mb-1">
                  Primary Brand Accent
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={themeForm.primaryColor}
                    onChange={(e) => setThemeForm({ ...themeForm, primaryColor: e.target.value })}
                    className="w-10 h-9 border border-[#141413]"
                  />
                  <span className="text-xs font-mono">{themeForm.primaryColor}</span>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#57534E] mb-1">
                  Ink / Header Tone
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={themeForm.secondaryColor}
                    onChange={(e) => setThemeForm({ ...themeForm, secondaryColor: e.target.value })}
                    className="w-10 h-9 border border-[#141413]"
                  />
                  <span className="text-xs font-mono">{themeForm.secondaryColor}</span>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase text-[#57534E] mb-1">
                  Warm Paper Canvas
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={themeForm.backgroundColor}
                    onChange={(e) => setThemeForm({ ...themeForm, backgroundColor: e.target.value })}
                    className="w-10 h-9 border border-[#141413]"
                  />
                  <span className="text-xs font-mono">{themeForm.backgroundColor}</span>
                </div>
              </div>
            </div>

            {/* Footer Configuration */}
            <div className="space-y-3 pt-2 border-t border-[#E5E0D8]">
              <div className="text-xs font-bold uppercase font-mono">Footer Content & Columns</div>
              <div>
                <label className="block text-[11px] font-mono uppercase text-[#57534E] mb-1">
                  Footer Brand Summary
                </label>
                <textarea
                  rows={2}
                  value={footerForm.brandSummary}
                  onChange={(e) => setFooterForm({ ...footerForm, brandSummary: e.target.value })}
                  className="w-full px-3 py-2 border border-[#D6D1C7] text-xs bg-[#FAF7F2]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase text-[#57534E] mb-1">
                  Copyright Notice
                </label>
                <input
                  type="text"
                  value={footerForm.copyrightText}
                  onChange={(e) => setFooterForm({ ...footerForm, copyrightText: e.target.value })}
                  className="w-full px-3 py-2 border border-[#D6D1C7] text-xs bg-[#FAF7F2]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 bg-[#D9381E] text-white font-bold text-xs uppercase tracking-wider hover:bg-[#141413] transition-colors cursor-pointer"
            >
              {saving ? 'Publishing Appearance...' : 'Save & Publish Theme & Footer'}
            </button>
          </form>

          {/* Live Theme & Footer Swatch Preview + CMS Revision History Log */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-white border border-[#141413] p-5 space-y-3">
              <div className="border-b border-[#E5E0D8] pb-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#D9381E] font-bold">
                  LIVE THEME &amp; BRANDING PREVIEW
                </span>
                <h4 className="text-base font-bold">Real-Time Store Swatch</h4>
              </div>

              <div
                className="border border-[#141413] overflow-hidden"
                style={{ backgroundColor: themeForm.backgroundColor || '#FAF7F2' }}
              >
                {themeForm.announcementEnabled && (
                  <div
                    className="px-3 py-1 text-[9px] font-mono uppercase text-center font-bold"
                    style={{
                      backgroundColor: themeForm.announcementBgColor || '#141413',
                      color: themeForm.announcementTextColor || '#FAF7F2',
                    }}
                  >
                    {themeForm.announcementText}
                  </div>
                )}
                <div className="p-3 bg-white border-b border-[#E5E0D8] flex items-center justify-between">
                  <div>
                    <div
                      className="font-bold text-sm"
                      style={{ color: themeForm.secondaryColor || '#141413' }}
                    >
                      {themeForm.storeName}
                    </div>
                    <div className="text-[10px] text-[#57534E]">{themeForm.tagline}</div>
                  </div>
                  <span
                    className="px-2.5 py-1 text-[10px] font-bold text-white"
                    style={{ backgroundColor: themeForm.primaryColor || '#D9381E' }}
                  >
                    Primary CTA
                  </span>
                </div>
                <div className="p-3">
                  <div className="p-2.5 bg-white border border-[#D6D1C7] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-[#141413]">Sample Product Card</div>
                      <div className="text-[10px] text-[#57534E]">Warm paper canvas surface</div>
                    </div>
                    <span
                      className="px-2 py-1 text-[10px] font-mono font-bold text-white"
                      style={{ backgroundColor: themeForm.primaryColor || '#D9381E' }}
                    >
                      + Add ₹120
                    </span>
                  </div>
                </div>
                <div
                  className="p-3 text-[10px] space-y-1"
                  style={{
                    backgroundColor: themeForm.secondaryColor || '#141413',
                    color: '#FAF7F2',
                  }}
                >
                  <div className="font-bold">{themeForm.storeName}</div>
                  <div className="opacity-80 line-clamp-2">{footerForm.brandSummary}</div>
                  <div className="opacity-60 font-mono pt-1">{footerForm.copyrightText}</div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-[#141413] p-5 space-y-3">
              <div className="flex items-center gap-2 border-b border-[#E5E0D8] pb-3">
                <History className="w-4 h-4 text-[#D9381E]" />
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#57534E]">
                    AUDIT &amp; PUBLICATION TRAIL
                  </span>
                  <h4 className="text-base font-bold">Recent CMS Changes</h4>
                </div>
              </div>
              <div className="divide-y divide-[#E5E0D8] max-h-[320px] overflow-y-auto">
              {revisions.length === 0 ? (
                <div className="py-6 text-xs text-[#57534E] text-center">
                  All category, brand, banner, and page edits will be logged here.
                </div>
              ) : (
                revisions.map((rev: any) => (
                  <div key={rev.id} className="py-2.5 text-xs space-y-0.5">
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="font-bold text-[#141413]">
                        {rev.entityType} #{rev.entityId} · {rev.action}
                      </span>
                      <span className="text-[#57534E]">
                        {new Date(rev.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#57534E]">By {rev.actorEmail}</div>
                  </div>
                ))
              )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
