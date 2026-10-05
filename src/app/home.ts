import { AfterViewInit, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { animate } from 'animejs';
import { DEFAULT_DELIVERY, PHOTOS, waLink, webpSet } from './data';
import { CatalogStore } from './catalog-store';
import { ProductCard } from './product-card';
@Component({standalone:true, imports:[RouterLink,ProductCard], templateUrl:'./home.html', changeDetection:ChangeDetectionStrategy.OnPush})
export class Home implements AfterViewInit {
 private host = inject<ElementRef<HTMLElement>>(ElementRef);
 private destroy = inject(DestroyRef);
 readonly catalog=inject(CatalogStore);
 private animations: ReturnType<typeof animate>[] = [];
 readonly photos=PHOTOS;
 readonly webpSet=webpSet;
 readonly products=this.catalog.featured;
 readonly whatsapp=computed(()=>this.catalog.settings()?.whatsapp_number ? waLink(this.catalog.settings()!.whatsapp_number!) : null);
 readonly delivery=computed(()=>this.catalog.settings()?.delivery_text || DEFAULT_DELIVERY);
 constructor(){void this.catalog.load();}
 ngAfterViewInit() {
   const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
   if (!reduced && !sessionStorage.getItem('milana-intro')) {
     sessionStorage.setItem('milana-intro','1');
     const title=this.host.nativeElement.querySelector('.hero h1');
     const photo=this.host.nativeElement.querySelector('.hero-photo');
     if(title) this.animations.push(animate(title,{opacity:[0,1],translateY:[15,0],duration:550,ease:'out(3)'}));
     if(photo) this.animations.push(animate(photo,{opacity:[0,1],scale:[1.04,1],duration:800,ease:'out(3)'}));
   }
   this.destroy.onDestroy(()=>this.animations.forEach(animation=>animation.cancel()));
   if(reduced || typeof IntersectionObserver === 'undefined') return;
   const io=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){
     const children=entry.target.querySelectorAll<HTMLElement>('[data-reveal-child]');
     const targets=children.length?[...children]:[entry.target as HTMLElement];
     targets.forEach((el,i)=>this.animations.push(animate(el,{opacity:[0,1],translateY:[16,0],duration:420,delay:i*70,ease:'out(3)'})));
     io.unobserve(entry.target);
   }}},{threshold:.08,rootMargin:'0px 0px -5% 0px'});
   this.host.nativeElement.querySelectorAll('[data-reveal]').forEach(el=>io.observe(el));
   this.destroy.onDestroy(()=>io.disconnect());
 }
}
