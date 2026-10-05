import { AfterViewInit, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, input, output, signal } from '@angular/core';
import { animate } from 'animejs';
import { buildMessage, formatPrice, Product, waLink, webpSet } from './data';
import { CatalogStore } from './catalog-store';
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
 readonly selectedPhoto=signal(0);
 readonly photoReady=signal(false);
 readonly currentPhoto=computed(()=>this.product()?.photos[this.selectedPhoto()]||'');
 readonly currentFocus=computed(()=>this.product()?.photoFocus[this.selectedPhoto()]||{desktop:'50% 50%',mobile:'50% 50%'});
 private catalog=inject(CatalogStore);
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
     const backdrop=this.host.nativeElement.querySelector<HTMLElement>('.dialog-backdrop');
     const panel=this.host.nativeElement.querySelector<HTMLElement>('.dialog-panel');
     const content=this.host.nativeElement.querySelector<HTMLElement>('.dialog-content, .dialog-missing');
     const closeButton=this.host.nativeElement.querySelector<HTMLElement>('.dialog-close');
     const origin=this.nav.flight;
     const target=this.host.nativeElement.querySelector<HTMLImageElement>('.dialog-photo img');
     if(backdrop)this.animations.push(animate(backdrop,{opacity:[0,1],duration:360,ease:'out(2)'}));
     // Keep the image's destination fixed while the panel and its content emerge.
     if(panel)this.animations.push(animate(panel,{opacity:[0,1],duration:340,ease:'out(2)'}));
     if(content)this.animations.push(animate(content,{opacity:[0,1],translateX:[10,0],duration:340,delay:70,ease:'out(2)'}));
     if(closeButton)this.animations.push(animate(closeButton,{opacity:[0,1],duration:280,delay:100,ease:'out(2)'}));
     if(origin && target){
       const end=target.getBoundingClientRect();
       const image=new Image(); image.src=origin.src; image.alt='';
       Object.assign(image.style,{position:'fixed',zIndex:'100',left:`${origin.rect.left}px`,top:`${origin.rect.top}px`,width:`${origin.rect.width}px`,height:`${origin.rect.height}px`,objectFit:'cover',objectPosition:getComputedStyle(target).objectPosition,borderRadius:'14px',pointerEvents:'none'});
       document.body.append(image);this.flyingImage=image;target.style.visibility='hidden';
       this.animations.push(animate(image,{left:end.left,top:end.top,width:end.width,height:end.height,duration:410,ease:'out(2)',onComplete:()=>{void this.finishOpen(target,image);}}));
     } else this.photoReady.set(true);
   } else this.photoReady.set(true);
   this.destroy.onDestroy(()=>{document.removeEventListener('keydown',this.onKey);document.body.style.overflow='';document.querySelector('header')?.removeAttribute('inert');document.querySelector('.contacts')?.removeAttribute('inert');this.animations.forEach(animation=>animation.cancel());this.flyingImage?.remove();const target=this.host.nativeElement.querySelector<HTMLImageElement>('.dialog-photo img');if(target)target.style.visibility='';});
 }
 private async finishOpen(target:HTMLImageElement,image:HTMLImageElement){
   // Let the selected responsive source decode before exposing it under the copy.
   try { await target.decode(); } catch { /* A failed source still needs the normal image fallback. */ }
   if(this.closing || this.destroy.destroyed || this.flyingImage!==image)return;
   target.style.visibility='';
   requestAnimationFrame(()=>{
     if(this.closing || this.destroy.destroyed || this.flyingImage!==image)return;
     image.remove();this.flyingImage=null;
     this.photoReady.set(true);
   });
 }
 requestClose(){
   if(this.closing)return;
   this.closing=true;
   const done=()=>this.closeRequested.emit();
   if(matchMedia('(prefers-reduced-motion: reduce)').matches){done();return;}
   const backdrop=this.host.nativeElement.querySelector<HTMLElement>('.dialog-backdrop');
   const panel=this.host.nativeElement.querySelector<HTMLElement>('.dialog-panel');
   const content=this.host.nativeElement.querySelector<HTMLElement>('.dialog-content, .dialog-missing');
   const closeButton=this.host.nativeElement.querySelector<HTMLElement>('.dialog-close');
   const origin=this.nav.flight;
   const target=this.host.nativeElement.querySelector<HTMLImageElement>('.dialog-photo img');
   const activeCopy=this.flyingImage;
   const start=(activeCopy || target)?.getBoundingClientRect();
   const source=activeCopy?.src || target?.currentSrc || origin?.src;
   const position=activeCopy || target ? getComputedStyle(activeCopy || target!).objectPosition : '50% 50%';
   this.animations.forEach(animation=>animation.cancel());
   this.animations=[];
   if(content)this.animations.push(animate(content,{opacity:0,translateX:8,duration:230,ease:'in(2)'}));
   if(closeButton)this.animations.push(animate(closeButton,{opacity:0,duration:180,ease:'in(2)'}));
   if(panel && origin && target)this.animations.push(animate(panel,{opacity:0,duration:310,ease:'inOut(2)'}));
   if(backdrop)this.animations.push(animate(backdrop,{opacity:0,duration:330,ease:'inOut(2)'}));
   if(origin && target){
     const image=new Image();image.src=source || origin.src;image.alt='';
     Object.assign(image.style,{position:'fixed',zIndex:'100',left:`${start!.left}px`,top:`${start!.top}px`,width:`${start!.width}px`,height:`${start!.height}px`,objectFit:'cover',objectPosition:position,borderRadius:'14px',pointerEvents:'none'});
     document.body.append(image);this.flyingImage=image;target.style.visibility='hidden';
     activeCopy?.remove();
     this.animations.push(animate(image,{left:origin.rect.left,top:origin.rect.top,width:origin.rect.width,height:origin.rect.height,duration:330,ease:'inOut(2)',onComplete:()=>{image.remove();this.flyingImage=null;done();}}));
   } else if(panel)this.animations.push(animate(panel,{opacity:0,duration:310,ease:'inOut(2)',onComplete:done}));
   else done();
 }
 compose(){const p=this.product();if(!p)return;this.message.set(buildMessage(p,this.variant()||undefined));this.composing.set(true);setTimeout(()=>this.host.nativeElement.querySelector('textarea')?.focus(),0);}
 select(v:string){this.variant.set(this.variant()===v?null:v);if(this.composing()){const p=this.product();if(p)this.message.set(buildMessage(p,this.variant()||undefined));}}
 selectPhoto(index:number){if(this.photoReady())this.selectedPhoto.set(index);}
 link(){const number=this.catalog.settings()?.whatsapp_number;return number?waLink(number,this.message()):null;}
 async copy(){try{await navigator.clipboard.writeText(this.message());this.copied.set(true);setTimeout(()=>this.copied.set(false),1800);}catch{this.host.nativeElement.querySelector('textarea')?.select();}}
}
