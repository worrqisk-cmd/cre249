import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { animate } from 'animejs';
import { PHOTOS, PRODUCTS, waLink } from './data';
import { ProductCard } from './product-card';
@Component({standalone:true, imports:[RouterLink,ProductCard], templateUrl:'./home.html', changeDetection:ChangeDetectionStrategy.OnPush})
export class Home implements AfterViewInit {
 private host = inject<ElementRef<HTMLElement>>(ElementRef);
 private destroy = inject(DestroyRef);
 private animations: ReturnType<typeof animate>[] = [];
 readonly photos=PHOTOS;
 readonly products=PRODUCTS.filter(p=>p.featured&&!p.hidden).slice(0,8);
 readonly whatsapp=waLink();
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
