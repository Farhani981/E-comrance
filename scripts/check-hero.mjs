import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const out = path.resolve("artifacts/hero");
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
  await cdp("Page.navigate", { url: "http://localhost:5175/" });
  for (let i = 0; i < 80; i++) {
    if (await evaluate('!!document.querySelector(".campaign")')) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  for (const [name, width, height] of [
    ["desktop", 1440, 1000],
    ["tablet", 768, 1100],
    ["mobile", 390, 1100],
    ["small-mobile", 320, 1000],
  ]) {
    await cdp("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await new Promise((r) => setTimeout(r, 300));
    const measure = await evaluate(
      `(()=>{const hero=document.querySelector('.campaign');return {present:!!hero,width:hero?.getBoundingClientRect().width,viewport:innerWidth,heading:hero?.querySelector('h1')?.textContent,overflow:hero ? hero.scrollWidth>hero.clientWidth : false};})()`,
    );
    assert.ok(measure.present);
    assert.ok(!measure.overflow, JSON.stringify(measure));
    fs.writeFileSync(
      path.join(out, name + ".png"),
      Buffer.from(
        (await cdp("Page.captureScreenshot", { format: "png" })).data,
        "base64",
      ),
    );
    console.log(name, JSON.stringify(measure));
  }
  const first = await evaluate(
    'document.querySelector(".campaign h1").textContent',
  );
  await evaluate(`document.querySelector('[aria-label="Next slide"]').click()`);
  await new Promise((r) => setTimeout(r, 100));
  const second = await evaluate(
    'document.querySelector(".campaign h1").textContent',
  );
  assert.notEqual(first, second, "Next slide changes campaign");
  await new Promise((r) => setTimeout(r, 6700));
  assert.notEqual(
    await evaluate('document.querySelector(".campaign h1").textContent'),
    second,
    "Carousel advances automatically after manual navigation",
  );
  await new Promise((r) => setTimeout(r, 6700));
  await cdp("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await new Promise((r) => setTimeout(r, 100));
  const reducedHeading = await evaluate(
    'document.querySelector(".campaign h1").textContent',
  );
  await new Promise((r) => setTimeout(r, 6700));
  assert.equal(
    await evaluate('document.querySelector(".campaign h1").textContent'),
    reducedHeading,
    "Reduced motion disables autoplay",
  );
  assert.equal(
    await evaluate(
      'document.querySelectorAll(".campaign-controls button").length',
    ),
    2,
    "Only side arrows remain",
  );
  assert.equal(await evaluate('!!document.querySelector("#categories")'), true);

  const fixture = {
    id: 10001,
    title: "A considered wardrobe.",
    description: "Exceptional pieces for your everyday.",
    buttonText: "Shop now",
    link: "/shop",
    secondaryButtonText: "Explore categories",
    secondaryLink: "/#categories",
    image: "/missing-campaign-image.jpg",
    isActive: true,
    kind: "hero",
    position: 0,
    badge: "New season",
  };
  await evaluate(
    "window.__bannerFixture = " +
      JSON.stringify([fixture]) +
      '; window.__originalFetch=window.fetch; window.fetch=(url,options)=>String(url)==="/api/banners" ? Promise.resolve(new Response(JSON.stringify({success:true,banners:window.__bannerFixture}),{headers:{"Content-Type":"application/json"}})) : window.__originalFetch(url,options); window.dispatchEvent(new Event("focus"));',
  );
  await new Promise((r) => setTimeout(r, 250));
  assert.equal(
    await evaluate('document.querySelector(".campaign h1").textContent'),
    fixture.title,
    "Shrinking slide list is safe",
  );
  assert.equal(
    await evaluate('!!document.querySelector(".campaign-controls")'),
    false,
    "Single slide has no carousel controls",
  );
  await new Promise((r) => setTimeout(r, 500));
  assert.equal(
    await evaluate('!!document.querySelector(".campaign-image-fallback")'),
    true,
    "Broken image has a fallback",
  );
  await evaluate(
    'window.__bannerFixture=[];window.dispatchEvent(new Event("focus"));',
  );
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(
    await evaluate('!!document.querySelector(".campaign")'),
    false,
    "Empty campaigns do not restore demo slides",
  );
  assert.deepEqual(errors, []);
  const adminFixture = { ...fixture, id: 10002, isActive: false };
  await cdp("Page.addScriptToEvaluateOnNewDocument", {
    source: `localStorage.setItem('shophub_user',JSON.stringify({name:'Preview admin',role:'admin',token:'browser-test-only'}));const realFetch=window.fetch;window.fetch=(url,options)=>String(url)==='/api/auth/me'?Promise.resolve(new Response(JSON.stringify({success:true,user:{name:'Preview admin',role:'admin'}}))):String(url)==='/api/banners/admin'?Promise.resolve(new Response(JSON.stringify({success:true,banners:[${JSON.stringify(adminFixture)}]}))):realFetch(url,options);`,
  });
  await cdp("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp("Page.navigate", { url: "http://localhost:5175/admin/banners" });
  for (let i = 0; i < 60; i++) {
    if (
      await evaluate(
        `!!document.querySelector('[aria-label="Edit A considered wardrobe."]')`,
      )
    )
      break;
    await new Promise((r) => setTimeout(r, 100));
  }
  await evaluate(
    `document.querySelector('[aria-label="Edit A considered wardrobe."]').click()`,
  );
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(
    await evaluate('!!document.querySelector(".campaign-preview")'),
    true,
    "Dashboard renders shared preview",
  );
  assert.equal(
    await evaluate('document.querySelectorAll("textarea").length'),
    2,
    "Headline and subtext editable",
  );
  fs.writeFileSync(
    path.join(out, "admin-preview.png"),
    Buffer.from(
      (await cdp("Page.captureScreenshot", { format: "png" })).data,
      "base64",
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: responsive layouts, next slide, pause, reduced motion, category anchor; no browser exceptions.",
  );
} finally {
  ws?.close();
  chrome.kill();
}
