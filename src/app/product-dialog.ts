import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, input, output, signal } from '@angular/core';
import { animate } from 'animejs';
import { ASSORTI_FILLINGS, buildMessage, formatPrice, Product, waLink, webpSet } from './data';
import { NavigationState } from './navigation-state';
@Component({selector:'app-product-dialog', standalone:true, templateUrl:'./product-dialog.html', changeDetection:ChangeDetectionStrategy.OnPush})
export class ProductDialog implements AfterViewInit {
 readonly product=input<Product|null>(null);
 readonly missing=input(false);
 readonly closeRequested=output<void>();
 readonly variant=signal<string|null>(null);
 readonly composing=signal(false);
 readonly message=signal('');
 readonly copied=signal(false);
 readonly fillings=ASSORTI_FILLINGS;
 readonly price=formatPrice;
 readonly webpSet=webpSet;
 private host=inject<ElementRef<HTMLElement>>(ElementRef);
 private destroy=inject(DestroyRef);
 private nav=inject(NavigationState);
 private closing=false;
 private flyingImage: HTMLImageElement | null=null;
 private animations: ReturnType<typeof animate>[]=[];
 private previous=document.activeElement as HTMLElement|null;
 private onKey=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();this.requestClose();}
   if(event.key==='Tab'){
     const items=[...this.host.nativeElement.querySelectorAll<HTMLElement>('button,a[href],textarea')].filter(x=>!x.hasAttribute('disabled'));
     if(!items.length)return;
     if(event.shiftKey&&document.activeElement===items[0]){event.preventDefault();items.at(-1)?.focus();}
     else if(!event.shiftKey&&document.activeElement===items.at(-1)){event.preventDefault();items[0].focus();}
   }
 };
 ngAfterViewInit(){
   document.body.style.overflow='hidden';
   document.querySelector('header')?.setAttribute('inert','');
   document.querySelector('.contacts')?.setAttribute('inert','');
   document.addEventListener('keydown',this.onKey);
   this.host.nativeElement.querySelector<HTMLButtonElement>('.dialog-close')?.focus();
   if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
     const panel=this.host.nativeElement.querySelector('.dialog-panel');
     if(panel) this.animations.push(animate(panel,{opacity:[0,1],translateY:[18,0],duration:360,ease:'out(3)'}));
     const origin=this.nav.flight;
     const target=this.host.nativeElement.querySelector<HTMLImageElement>('.dialog-photo img');
     if(origin && target){
       const end=target.getBoundingClientRect();
       const image=new Image(); image.src=origin.src; image.alt='';
       Object.assign(image.style,{position:'fixed',zIndex:'100',left:`${origin.rect.left}px`,top:`${origin.rect.top}px`,width:`${origin.rect.width}px`,height:`${origin.rect.height}px`,objectFit:'cover',borderRadius:'14px',pointerEvents:'none'});
       document.body.append(image);this.flyingImage=image;target.style.visibility='hidden';
       this.animations.push(animate(image,{left:end.left,top:end.top,width:end.width,height:end.height,duration:420,ease:'out(3)',onComplete:()=>{image.remove();this.flyingImage=null;target.style.visibility='';}}));
     }
   }
   this.destroy.onDestroy(()=>{document.removeEventListener('keydown',this.onKey);document.body.style.overflow='';document.querySelector('header')?.removeAttribute('inert');document.querySelector('.contacts')?.removeAttribute('inert');this.animations.forEach(animation=>animation.cancel());this.flyingImage?.remove();const target=this.host.nativeElement.querySelector<HTMLImageElement>('.dialog-photo img');if(target)target.style.visibility='';});
 }
 requestClose(){
   if(this.closing)return;
   this.closing=true;
   const done=()=>this.closeRequested.emit();
   if(matchMedia('(prefers-reduced-motion: reduce)').matches){done();return;}
   const panel=this.host.nativeElement.querySelector('.dialog-panel');
   const origin=this.nav.flight;
   const target=this.host.nativeElement.querySelector<HTMLImageElement>('.dialog-photo img');
   if(origin && target){
     this.animations.forEach(animation=>animation.cancel());
     this.flyingImage?.remove();
     const start=target.getBoundingClientRect();
     const image=new Image();image.src=origin.src;image.alt='';
     Object.assign(image.style,{position:'fixed',zIndex:'100',left:`${start.left}px`,top:`${start.top}px`,width:`${start.width}px`,height:`${start.height}px`,objectFit:'cover',borderRadius:'14px',pointerEvents:'none'});
     document.body.append(image);this.flyingImage=image;target.style.visibility='hidden';
     this.animations.push(animate(image,{left:origin.rect.left,top:origin.rect.top,width:origin.rect.width,height:origin.rect.height,duration:280,ease:'inOut(2)',onComplete:()=>{image.remove();this.flyingImage=null;done();}}));
     if(panel)this.animations.push(animate(panel,{opacity:[1,0],duration:240,ease:'in(2)'}));
   } else if(panel)this.animations.push(animate(panel,{opacity:[1,0],translateY:[0,12],duration:220,ease:'in(2)',onComplete:done}));
   else done();
 }
 compose(){const p=this.product();if(!p)return;this.message.set(buildMessage(p,this.variant()||undefined));this.composing.set(true);setTimeout(()=>this.host.nativeElement.querySelector('textarea')?.focus(),0);}
 select(v:string){this.variant.set(this.variant()===v?null:v);if(this.composing()){const p=this.product();if(p)this.message.set(buildMessage(p,this.variant()||undefined));}}
 link(){return waLink(this.message());}
 async copy(){try{await navigator.clipboard.writeText(this.message());this.copied.set(true);setTimeout(()=>this.copied.set(false),1800);}catch{this.host.nativeElement.querySelector('textarea')?.select();}}
}
