import { expect,test } from '@playwright/test';

const widths=[{width:1280,height:900},{width:768,height:900},{width:390,height:844}];

test('M14 navigation, responsive content, focus and honest marketplace states',async({page})=>{
  await page.setViewportSize({width:1280,height:900});
  await page.goto('/');
  await page.screenshot({path:'test-results/m14-home-desktop.png',fullPage:true,
    animations:'disabled'});
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>new Promise<void>((resolve)=>requestAnimationFrame(()=>resolve())));
  await page.screenshot({path:'test-results/m14-home-mobile.png',fullPage:true,
    animations:'disabled'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false);
  await page.goto('/sign-in');
  await expect(page.getByRole('tablist',{name:'Account access'})).toBeVisible();
  await page.screenshot({path:'test-results/m14-auth-mobile.png',fullPage:true,
    animations:'disabled'});
  for(const viewport of widths){
    await page.setViewportSize(viewport);
    await page.goto('/discover');
    await expect(page.getByRole('searchbox',{name:'Search capabilities'})).toBeVisible();
    await expect(page.locator('.market-card').first()).toBeVisible();
    if(viewport.width===1280){
      const audit=await page.evaluate(()=>{
        const fields=[...document.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>(
          'input:not([type=hidden]),select,textarea')];
        const unlabeled=fields.filter((field)=>!field.labels?.length&&
          !field.getAttribute('aria-label')&&!field.getAttribute('aria-labelledby'))
          .map((field)=>field.outerHTML.slice(0,100));
        const colors=['.market-card-seller','.market-card-description'].map((selector)=>{
          const item=document.querySelector(selector)!;
          const c=(value:string)=>value.match(/[\d.]+/g)!.slice(0,3).map(Number).map((channel)=>{
            const x=channel/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});
          const a=c(getComputedStyle(item).color),b=c(getComputedStyle(item).backgroundColor==='rgba(0, 0, 0, 0)'?
            getComputedStyle(item.closest('.market-card')!).backgroundColor:getComputedStyle(item).backgroundColor);
          const luminance=(parts:number[])=>parts[0]!*.2126+parts[1]!*.7152+parts[2]!*.0722;
          const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
        });
        return {unlabeled,colors};
      });
      expect(audit.unlabeled).toEqual([]);
      for(const ratio of audit.colors)expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
    expect(overflow,`Discover overflows at ${viewport.width}px`).toBe(false);
    if(viewport.width===1280)await page.screenshot({path:'test-results/m14-discover-desktop.png',
      fullPage:true,animations:'disabled'});
    if(viewport.width===390){
      await page.screenshot({path:'test-results/m14-discover-mobile.png',fullPage:true,
        animations:'disabled'});
      const menu=page.locator('.mobile-nav summary');
      await expect(menu).toBeVisible();
      await menu.focus();
      await expect(menu).toBeFocused();
      await menu.press('Enter');
      const nav=page.getByRole('navigation',{name:'Mobile navigation'});
      await expect(nav.getByRole('link',{name:'Discover'})).toBeVisible();
      await expect(nav.getByRole('link',{name:'Categories'})).toBeVisible();
      await expect(nav.getByRole('link',{name:'Sign in'})).toBeVisible();
      const height=await menu.evaluate((element)=>element.getBoundingClientRect().height);
      expect(height).toBeGreaterThanOrEqual(44);
      await page.screenshot({path:'test-results/m14-navigation-mobile.png',fullPage:false,
        animations:'disabled'});
      await menu.press('Enter');
      await page.locator('.market-card h3').first().evaluate((node)=>{
        node.textContent='Comprehensive international research and evidence synthesis for very-long-project-identifiers-with-no-spaces';
      });
      await page.locator('.market-card-description').first().evaluate((node)=>{
        node.textContent='A detailed service description with several constraints, file types, expected outputs and delivery terms that must remain readable when it wraps across multiple lines on a small screen.';
      });
      expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false);
      await page.screenshot({path:'test-results/m14-long-content-mobile.png',fullPage:true,
        animations:'disabled'});
    }
  }
  await page.goto('/discover?q=unlikely-m14-no-match');
  await expect(page.getByRole('heading',{name:'No capabilities match yet'})).toBeVisible();
  await page.screenshot({path:'test-results/m14-empty-search-mobile.png',fullPage:true,
    animations:'disabled'});
  await page.goto('/discover');
  const detailHref=await page.locator('.market-card').first().getAttribute('href');
  expect(detailHref).toBeTruthy();
  await page.goto(detailHref!);
  await expect(page.getByRole('heading',{name:'Privacy & access'})).toBeVisible();
  const mobilePrice=page.locator('.detail-mobile-purchase');
  await expect(mobilePrice).toBeVisible();
  await expect(mobilePrice).toContainText('$');
  expect((await mobilePrice.boundingBox())!.y).toBeLessThan(
    (await page.getByRole('heading',{name:'What this does'}).boundingBox())!.y);
  await expect(page.getByText(/declared access categories/)).toBeVisible();
  const disclosure=page.getByText('View every permission for this version');
  await disclosure.click();
  await expect(page.locator('.permission-grid')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)).toBe(false);
  await page.screenshot({path:'test-results/m14-detail-mobile.png',fullPage:true,
    animations:'disabled'});
  await page.emulateMedia({reducedMotion:'reduce'});
  const duration=await page.locator('.primary-button').first().evaluate((element)=>
    getComputedStyle(element).transitionDuration);
  expect(parseFloat(duration)).toBeLessThanOrEqual(.001);
});
