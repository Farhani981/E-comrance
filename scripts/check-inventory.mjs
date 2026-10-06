// UI fixtures are browser-only. Real authorization and totals are tested by operations.integration.test.js.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const out = path.resolve("artifacts/inventory");
fs.mkdirSync(out, { recursive: true });
const chrome = spawn(
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  [
    "--headless=new",
    "--disable-gpu",
    "--remote-debugging-port=9226",
    "--no-first-run",
    "--no-default-browser-check",
    "--user-data-dir=" +
      fs.mkdtempSync(path.join(os.tmpdir(), "inventory-ui-")),
    "about:blank",
  ],
  { windowsHide: true, stdio: "ignore" },
);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let ws;
try {
  let targets;
  for (let i = 0; i < 40; i++) {
    try {
      targets = await (await fetch("http://127.0.0.1:9226/json")).json();
      break;
    } catch {
      await pause(250);
    }
  }
  assert.ok(targets, "Chrome started");
  ws = new WebSocket(
    targets.find((t) => t.type === "page").webSocketDebuggerUrl,
  );
  await new Promise((resolve) =>
    ws.addEventListener("open", resolve, { once: true }),
  );
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
  const waitFor = async (expression) => {
    for (let i = 0; i < 100; i++) {
      if (await evaluate(expression)) return;
      await pause(100);
    }
    throw new Error("Timed out: " + expression);
  };
  const click = async (label) => {
    await evaluate(
      `Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`,
    );
    await pause(100);
  };
  const clickByLabel = async (ariaLabel) => {
    await evaluate(
      `document.querySelector('[aria-label=' + JSON.stringify(${JSON.stringify(ariaLabel)}) + ']').click()`,
    );
    await pause(100);
  };
  const clickMenuItem = async (text) => {
    await evaluate(
      `Array.from(document.querySelectorAll('[role="menu"] [role="menuitem"]')).find(el=>el.textContent.includes(${JSON.stringify(text)})).click()`,
    );
    await pause(150);
  };
  const products = [
    {
      id: 1,
      name: "Classic Oxford Shirt",
      sku: "SH-001",
      stock: 42,
      price: 3500,
      low_stock_threshold: 5,
      purchased_units: 80,
      purchase_cost: 120000,
      average_cost: 1500,
      sold_units: 30,
      committed_units: 8,
      returned_units: 2,
      sales_value: 105000,
      supplier_names: "Lahore Textile Co.",
      warehouse_id: 1,
      warehouse_name: "Main warehouse",
      last_purchase_date: "2026-09-08",
      last_sale_date: "2026-09-09",
    },
    {
      id: 2,
      name: "Slim Fit Chinos",
      sku: "CH-002",
      stock: 3,
      price: 4200,
      low_stock_threshold: 5,
      purchased_units: 50,
      purchase_cost: 90000,
      average_cost: 1800,
      sold_units: 40,
      committed_units: 7,
      returned_units: 0,
      sales_value: 168000,
      supplier_names: "Karachi Apparel",
      warehouse_id: 1,
      warehouse_name: "Main warehouse",
    },
    {
      id: 3,
      name: "Leather Weekend Bag",
      sku: "BG-003",
      stock: 0,
      price: 9000,
      low_stock_threshold: 3,
      purchased_units: 20,
      purchase_cost: 80000,
      average_cost: 4000,
      sold_units: 20,
      committed_units: 0,
      returned_units: 0,
      sales_value: 180000,
      supplier_names: "Heritage Leather",
      warehouse_id: null,
    },
  ];
  const adjustments = [
    {
      id: 1,
      product_id: 1,
      product_name: products[0].name,
      delta: 10,
      reason: "Purchase received #18",
      actor_name: "Store manager",
      created_at: "2026-09-08",
    },
  ];
  await cdp("Runtime.enable");
  await cdp("Page.enable");
  await cdp("Page.addScriptToEvaluateOnNewDocument", {
    source: `
    localStorage.setItem('shophub_user',JSON.stringify({name:'Inventory reviewer',role:'admin',token:'browser-test-only'}));
    const products=${JSON.stringify(products)}, adjustments=${JSON.stringify(adjustments)};window.__writes=[];
    const realFetch=window.fetch;
    window.fetch=(url,options={})=>{
      const route=String(url); let data;
      if(route==='/api/auth/me') data={success:true,user:{name:'Inventory reviewer',role:'admin'}};
      else if(route.startsWith('/api/operations')) {
        if(options.method && options.method!=='GET') {window.__writes.push({url:route,body:JSON.parse(options.body)});data={success:true};}
        else if(route.endsWith('/history')) data={success:true,purchases:[{id:1,invoice_no:'INV-018',supplier_name:'Lahore Textile Co.',purchase_date:'2026-09-08',quantity:80,cost_price:1500,total_cost:120000}],orders:[{id:1,order_id:'ORD-102',created_at:'2026-09-09',order_status:'Delivered',quantity:2,price:3500,restocked:0}],adjustments};
        else data={success:true,products,warehouses:[{id:1,name:'Main warehouse',address:'Lahore, Pakistan',product_count:2}],adjustments};
      }
      return data ? Promise.resolve(new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}})) : realFetch(url,options);
    };`,
  });
  await cdp("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1050,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp("Page.navigate", { url: "http://127.0.0.1:5175/admin/inventory" });
  await waitFor(`document.body.textContent.includes('Classic Oxford Shirt')`);
  await pause(500);
  for (const [name, width] of [
    ["desktop", 1440],
    ["mobile", 390],
    ["small-mobile", 320],
  ]) {
    await cdp("Emulation.setDeviceMetricsOverride", {
      width,
      height: 1050,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await pause(200);
    assert.ok(
      await evaluate("document.documentElement.scrollWidth <= innerWidth"),
      name + " has no page overflow",
    );
    fs.writeFileSync(
      path.join(out, name + ".png"),
      Buffer.from(
        (await cdp("Page.captureScreenshot", { format: "png" })).data,
        "base64",
      ),
    );
  }
  await cdp("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1050,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await evaluate(
    `var select=document.querySelector('[aria-label="Stock status"]');select.value='Out of stock';select.dispatchEvent(new Event('change',{bubbles:true}));`,
  );
  await pause(100);
  assert.equal(
    await evaluate('document.querySelectorAll("tbody tr").length'),
    1,
  );
  await evaluate(
    `var select=document.querySelector('[aria-label="Stock status"]');select.value='';select.dispatchEvent(new Event('change',{bubbles:true}));`,
  );
  await pause(100);
  // Ledger dropdown -> Supplier Purchases opens the full-page history dialog
  await clickByLabel("Open ledger for Classic Oxford Shirt");
  await clickMenuItem("Supplier Purchases");
  await waitFor(`document.querySelector('[role="dialog"]')`);
  await waitFor(`document.body.textContent.includes('INV-018')`);

  // Ledger dropdown -> Sales & Orders tab inside the dialog
  await click("Sales & orders");
  await waitFor(`document.body.textContent.includes('ORD-102')`);
  assert.ok(await evaluate(`document.body.textContent.includes('ORD-102')`));
  await clickByLabel("Close history");
  await waitFor(`!document.querySelector('[role="dialog"]')`);

  // Actions dropdown -> Adjust stock
  await clickByLabel("Open actions for Classic Oxford Shirt");
  await clickMenuItem("Adjust stock");
  await pause(150);
  await evaluate(
    `const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;const form=document.querySelector('form');setter.call(form.querySelector('input[type=number]'),'2');form.querySelector('input[type=number]').dispatchEvent(new Event('input',{bubbles:true}));setter.call(form.querySelector('input:not([type=number])'),'Stock count correction');form.querySelector('input:not([type=number])').dispatchEvent(new Event('input',{bubbles:true}));`,
  );
  await pause(100);
  await click("Confirm adjustment");
  await waitFor("window.__writes.length===1");
  assert.deepEqual(await evaluate("window.__writes[0]"), {
    url: "/api/operations/inventory/1/adjust",
    body: { delta: "2", reason: "Stock count correction" },
  });
  await click("Stock movements");
  assert.ok(
    await evaluate(
      `document.body.textContent.includes('Purchase received #18')`,
    ),
  );
  await click("Warehouses");
  assert.ok(
    await evaluate(`document.body.textContent.includes('Lahore, Pakistan')`),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: desktop/mobile layouts, status filter, ledger dropdown (purchase and order history in full-page dialog), actions dropdown adjustment submission, movements and warehouses.",
  );
} finally {
  ws?.close();
  chrome.kill();
}
