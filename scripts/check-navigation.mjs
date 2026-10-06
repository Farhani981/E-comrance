import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const out = path.resolve("artifacts/navigation");
fs.mkdirSync(out, { recursive: true });
const chrome = spawn(
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  [
    "--headless=new",
    "--disable-gpu",
    "--remote-debugging-port=9224",
    "--no-first-run",
    "--no-default-browser-check",
    "--user-data-dir=" +
      fs.mkdtempSync(path.join(os.tmpdir(), "shophub-hero-")),
    "about:blank",
  ],
  { windowsHide: true, stdio: "ignore" },
);
let ws;
try {
  let targets;
  for (let i = 0; i < 40; i++) {
    try {
      targets = await (await fetch("http://127.0.0.1:9224/json")).json();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  ws = new WebSocket(
    targets.find((t) => t.type === "page").webSocketDebuggerUrl,
  );
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let seq = 0;
  const pending = new Map();
  const errors = [];
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p?.reject(m.error) : p?.resolve(m.result);
    }
    if (m.method === "Runtime.exceptionThrown")
      errors.push(m.params.exceptionDetails.text);
  });
  const cdp = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const result = await cdp("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails)
      throw new Error(
        result.exceptionDetails.exception?.description ||
          result.exceptionDetails.text,
      );
    return result.result.value;
  };
  await cdp("Runtime.enable");
  await cdp("Page.enable");

  const waitFor = async (expression) => {
    for (let i = 0; i < 80; i++) {
      if (await evaluate(expression)) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error("Timed out: " + expression);
  };
  await cdp("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp("Page.navigate", { url: "http://localhost:5175/" });
  await waitFor(`document.querySelectorAll('.men-tabs>button').length===4`);
  assert.deepEqual(
    await evaluate(
      `[...document.querySelectorAll('.men-tabs>button')].map(b=>b.textContent)`,
    ),
    ["Top Wear", "Bottom Wear", "Eastern Wear", "Accessories"],
  );
  for (const parent of [
    "Top Wear",
    "Bottom Wear",
    "Eastern Wear",
    "Accessories",
  ]) {
    await evaluate(
      `[...document.querySelectorAll('.men-tabs>button')].find(b=>b.textContent===${JSON.stringify(parent)}).click()`,
    );
    await waitFor(`!!document.querySelector('.men-mega')`);
    assert.ok(
      await evaluate(`document.querySelectorAll('.men-mega-grid a').length>8`),
    );
    assert.equal(
      await evaluate("document.documentElement.scrollWidth <= innerWidth"),
      true,
    );
  }
  await evaluate(
    `[...document.querySelectorAll('.men-tabs>button')].find(b=>b.textContent==='Eastern Wear').click()`,
  );
  await new Promise((r) => setTimeout(r, 350));
  assert.equal(
    await evaluate(
      `[...document.querySelectorAll('.men-mega a')].find(a=>a.textContent==='Kurta Suits').getAttribute('href')`,
    ),
    "/products?category=eastern-wear&subcategory=kurta-suits",
  );
  fs.writeFileSync(
    path.join(out, "desktop-mega.png"),
    Buffer.from(
      (await cdp("Page.captureScreenshot", { format: "png" })).data,
      "base64",
    ),
  );
  await evaluate(
    `[...document.querySelectorAll('.men-mega a')].find(a=>a.textContent==='Kurta Suits').click()`,
  );
  await waitFor(
    `location.pathname==='/products'&&document.querySelector('h1')?.textContent.trim()==='Kurta Suits'`,
  );
  assert.equal(
    await evaluate('document.querySelector("h1").textContent.trim()'),
    "Kurta Suits",
  );
  for (const width of [1024, 768, 390, 320]) {
    await cdp("Emulation.setDeviceMetricsOverride", {
      width,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(
      await evaluate("document.documentElement.scrollWidth <= innerWidth"),
      true,
      "No viewport overflow at " + width,
    );
  }
  await evaluate(
    `document.querySelector('[aria-label="Open navigation"]').click()`,
  );
  await waitFor(`document.querySelector('dialog').open`);
  await evaluate(
    `[...document.querySelectorAll('.men-accordion>summary')].find(s=>s.textContent==='Eastern Wear').click()`,
  );
  await new Promise((r) => setTimeout(r, 100));
  assert.ok(
    await evaluate(
      `[...document.querySelectorAll('.men-mobile-sub>a')].some(a=>a.textContent==='Kurta Suits'&&a.getBoundingClientRect().height>0)`,
    ),
  );
  fs.writeFileSync(
    path.join(out, "mobile-drawer.png"),
    Buffer.from(
      (await cdp("Page.captureScreenshot", { format: "png" })).data,
      "base64",
    ),
  );
  await cdp("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 27,
  });
  await cdp("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 27,
  });
  await waitFor(`!document.querySelector('dialog').open`);
  assert.equal(
    await evaluate(`document.activeElement.getAttribute('aria-label')`),
    "Open navigation",
  );
  await cdp("Page.addScriptToEvaluateOnNewDocument", {
    source: `localStorage.setItem('shophub_user',JSON.stringify({name:'Preview admin',role:'admin',token:'browser-test-only'}));const real=window.fetch;window.fetch=(url,options)=>String(url)==='/api/auth/me'?Promise.resolve(new Response(JSON.stringify({success:true,user:{name:'Preview admin',role:'admin'}}))):real(url,options);`,
  });
  await cdp("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1100,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp("Page.navigate", { url: "http://localhost:5175/admin/products" });
  await waitFor(
    `[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Add New Product'))`,
  );
  await evaluate(
    `[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Add New Product')).click()`,
  );
  await waitFor(
    `document.querySelectorAll('fieldset select').length===5 && document.querySelector('fieldset select').options.length===5`,
  );
  const select = async (index, value) => {
    await evaluate(
      `(()=>{const el=document.querySelectorAll('fieldset select')[${index}];el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`,
    );
    await new Promise((r) => setTimeout(r, 70));
  };
  assert.equal(
    await evaluate(`document.querySelector('fieldset select').value`),
    "",
  );
  await select(0, "Top Wear");
  await select(1, "Casual Shirts");
  await select(2, "Linen");
  await select(3, "Slim Fit");
  await select(4, "Formal");
  assert.equal(
    await evaluate(`document.querySelectorAll('fieldset select')[2].value`),
    "Linen",
  );
  await select(0, "Eastern Wear");
  assert.equal(
    await evaluate(`document.querySelectorAll('fieldset select')[1].value`),
    "",
  );
  assert.equal(
    await evaluate(`document.querySelectorAll('fieldset select')[2].value`),
    "",
  );
  assert.ok(
    !(
      await evaluate(
        `[...document.querySelectorAll('fieldset select')[1].options].map(o=>o.value)`,
      )
    ).includes("Casual Shirts"),
  );
  await select(1, "Kurta Suits");
  await select(2, "Kurta Pajama");
  await evaluate(
    `document.querySelector('fieldset').scrollIntoView({block:'center'})`,
  );
  fs.writeFileSync(
    path.join(out, "admin-categories.png"),
    Buffer.from(
      (await cdp("Page.captureScreenshot", { format: "png" })).data,
      "base64",
    ),
  );

  const fixture = {
    id: 900001,
    name: "Browser test kurta",
    price: 3000,
    original_price: 3000,
    stock: 3,
    status: "Active",
    category_name: "Eastern Wear",
    subcategory: "Kurta Suits",
    product_type: "Kurta Pajama",
    category_slug: "eastern-wear",
    subcategory_slug: "kurta-suits",
    product_type_slug: "kurta-pajama",
    fit: "Slim Fit",
    occasion: "Formal",
    image: "/missing-fixture.webp",
  };
  const fixtures = [
    fixture,
    { ...fixture, id: 900002, fit: "Regular Fit" },
    { ...fixture, id: 900003, occasion: "Casual" },
    { ...fixture, id: 900004, product_type_slug: "2-piece-kurta-shalwar" },
  ];
  await cdp("Page.addScriptToEvaluateOnNewDocument", {
    source: `const catalogFetch=window.fetch;window.fetch=(url,options)=>String(url)==='/api/products'?Promise.resolve(new Response(JSON.stringify({success:true,products:${JSON.stringify(fixtures)}}))):catalogFetch(url,options);`,
  });
  await cdp("Page.navigate", {
    url: "http://localhost:5175/products?category=eastern-wear&subcategory=kurta-suits&type=kurta-pajama&fit=Slim+Fit&occasion=Formal",
  });
  await waitFor(`!!document.querySelector('a[href="/product/900001"]')`);
  for (const id of [900002, 900003, 900004])
    assert.equal(
      await evaluate(`!!document.querySelector('a[href="/product/${id}"]')`),
      false,
      "Filters exclude " + id,
    );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: four database departments, mega-menu links, slug routing, 4 viewport widths, accordion drawer/Escape/focus return, dependent categories/types, fit and occasion.",
  );
} finally {
  ws?.close();
  chrome.kill();
}
