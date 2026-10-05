import { AfterViewInit, ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { animate } from 'animejs';
import { CATEGORIES, CategoryId, PRODUCTS, Product } from './data';
import { NavigationState } from './navigation-state';
import { ProductCard } from './product-card';
import { ProductDialog } from './product-dialog';
@Component({standalone:true, imports:[RouterLink,ProductCard,ProductDialog], templateUrl:'./catalog.html', changeDetection:ChangeDetectionStrategy.OnPush})
export class Catalog implements AfterViewInit {
 private route=inject(ActivatedRoute);
 private router=inject(Router);
 private host=inject<ElementRef<HTMLElement>>(ElementRef);
 private destroy=inject(DestroyRef);
 readonly nav=inject(NavigationState);
 readonly categories=CATEGORIES;
 readonly category=signal<CategoryId>('all');
 readonly slug=signal<string|null>(null);
 readonly dialog=signal<Product|null>(null);
 readonly missing=signal(false);
 readonly state=signal<'ok'|'loading'|'empty'|'error'>('ok');
 readonly indicator=signal({left:0,width:0});
 readonly products=computed(()=>PRODUCTS.filter(p=>!p.hidden&&(this.category()==='all'||p.category===this.category())));
 private sub=this.route.paramMap.subscribe(params=>{
   const c=params.get('category');
   const slug=params.get('slug');
   this.category.set(CATEGORIES.some(x=>x.id===c)?c as CategoryId:this.nav.category() as CategoryId);
   this.slug.set(slug);
   this.dialog.set(slug?PRODUCTS.find(p=>p.slug===slug&&!p.hidden)||null:null);
   this.missing.set(!!slug&&!this.dialog());
 });
 constructor(){this.destroy.onDestroy(()=>this.sub.unsubscribe());}
 ngAfterViewInit(){
   requestAnimationFrame(()=>this.moveIndicator());
   if(this.slug()) {
     document.body.style.overflow='hidden';
     this.destroy.onDestroy(()=>document.body.style.overflow='');
   } else if(this.nav.itemOrigin()) {
     setTimeout(()=>this.nav.restoreFocus(),50);
   }
 }
 choose(c:CategoryId){
   this.nav.category.set(c);
   this.category.set(c);
   requestAnimationFrame(()=>this.moveIndicator());
   void this.router.navigateByUrl(c==='all'?'/catalog':`/catalog/${c}`);
 }
 private moveIndicator(){
   const active=this.host.nativeElement.querySelector<HTMLElement>('.category-list button.active');
   if(active)this.indicator.set({left:active.offsetLeft,width:active.offsetWidth});
 }
 close(){
   if(this.nav.priorUrl()) {this.nav.priorUrl.set(null); history.back();}
   else this.router.navigateByUrl(this.nav.category()==='all'?'/catalog':`/catalog/${this.nav.category()}`);
 }
 retry(){this.state.set('loading');setTimeout(()=>this.state.set('ok'),350);}
}
