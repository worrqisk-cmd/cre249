import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NavigationState } from '../navigation-state';
import { CatalogStore } from '../catalog-store';
import { ProductCard } from '../product-card';
import { CONTACT_MESSAGE, waLink } from '../data';
@Component({standalone:true, imports:[RouterLink, ProductCard], templateUrl:'./home-preview.html', styleUrl:'./home-preview.css', changeDetection:ChangeDetectionStrategy.OnPush})
export class HomePreview {
  private readonly navigation = inject(NavigationState);
  private readonly router = inject(Router);
  open(slug: string){this.navigation.open(slug, this.router.url);}
  readonly catalog = inject(CatalogStore);
  readonly variant = inject(ActivatedRoute).snapshot.data['variant'] as string;
  readonly selected = computed(() => ['assorti','kurnik','milka','merengovy-rulet'].flatMap(slug => this.catalog.products().filter(p => p.slug === slug)));
  readonly caramel = computed(() => this.catalog.products().find(p => p.slug === 'slivochno-karamelny'));
  readonly medovik = computed(() => this.catalog.products().find(p => p.slug === 'medovik'));
  readonly whatsapp = computed(() => { const n=this.catalog.settings()?.whatsapp_number; return n ? waLink(n,CONTACT_MESSAGE) : null; });
  constructor(){void this.catalog.load();}
}
