import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true});
try {
 for(const width of [360,390,1440]){
  const page=await browser.newPage({viewport:{width,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const variant of ['a','b','c']){
   await page.goto(`http://127.0.0.1:8450/#/design/${variant}`);
   await page.locator('.design-preview app-product-card').first().waitFor();
   await page.waitForFunction(()=>[...document.querySelectorAll('.design-preview img')].every(img=>img.complete&&img.naturalWidth>0));
   assert.equal(await page.locator('h1').count(),1);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${variant} overflow at ${width}`);
   assert.ok(await page.locator('.design-preview a[href="#/catalog"]').count());
   assert.equal(await page.locator('[data-product-slug="pechenochny"]').count(),0);
   await page.locator('.design-preview app-product-card a').first().click();
   await page.getByRole('dialog').waitFor();
   await page.keyboard.press('Escape');
   await page.waitForURL(`**/#/design/${variant}`);
   await page.reload();
   await page.locator('.design-preview').waitFor();
  }
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('Three designs passed at 360/390/1440: photos, no overflow, product dialog and return, refresh. No media capture.');
} finally{await browser.close();}
