# payu_sub_v2: PayU V2 test console

A small Node + EJS + Bootstrap page for testing the `PAYU_V2` gateway of `jojo_subscription_backend_2_0`:

- `POST /user/initiate-factory-payment`
- `POST /user/verify-payment`

The backend encrypts every request and response body (AES-256-CBC). This app does that on its **server**, so `SECRET_KEY` and `IV` never reach the browser: the page posts plain JSON to this app, which encrypts it, calls the backend, decrypts the answer and shows it.

## Run

```bash
npm install
npm start            # http://localhost:3000   (npm run dev restarts on file changes)
```

Start the backend first (its `PORT` is in its `.env.dev`; `BACKEND_BASE_URL` below points at it).

## `.env`

| Key | What it is |
|---|---|
| `PORT` | Port of this test app (default 3000) |
| `BACKEND_BASE_URL` | The backend under test, e.g. `http://localhost:8000` |
| `SECRET_KEY`, `IV` | **Must equal the backend's** `SECRET_KEY` (base64, 32 bytes) and `IV` (hex, 16 bytes) |
| `PAYU_PAYMENT_URL` | PayU page the browser posts to for `UPI_VPA`. Must match the backend's `PAYU_ENVIRONMENT` (`https://secure.payu.in/_payment` for PRODUCTION, `https://test.payu.in/_payment` for TEST) |
| `PROJECT`, `DEVICE_TYPE`, `DEVICE_VERSION`, `DEVICE_ID` | The `project`, `devicetype`, `deviceversion` and `deviceid` headers. `H0t30u` is the Android device type |
| `DEFAULT_*` | Pre-filled form values (all editable in the page, and remembered in the browser) |

`.env` is git-ignored; `.env.example` shows the shape.

## What you need in the backend DB

1. A **PAYU_V2 provider SKU** (paste its `sUniqueSkuId` into "Provider SKU id"). The SKU's product type decides the flow: a subscription SKU starts a UPI Autopay mandate, a one-time SKU is a normal payment. The price always comes from the DB, not from this page.
2. An active `PAYU_V2` row in the payment gateways collection.
3. An existing user id (`sUserId`, min 4 characters).

## Using it

1. **Initiate.** Pick a method and press *Initiate payment*.
   - **UPI_QR** works end to end in a browser: the QR is drawn from `oPayu.sQrString` and the page polls verify every 3 s for up to 300 s. Scan it with any UPI app. Fill **user-ip** with your public IP: PayU needs it for the QR flow, and an empty value tests the backend's "user-ip header is required" error.
   - **UPI_VPA** works end to end in a browser (set `PAYU_V2_UPI_VPA_ENABLED=true` in the backend's `.env.dev` and restart it). After the backend answers, *Pay via PayU* form-posts the backend's `oSdkParams` to `PAYU_PAYMENT_URL`, adding `pg=UPI`, `bankcode=UPI` and `surl`/`furl` = `<this app>/payu/return`. None of those four are in the hash, so the backend's hash stays valid. PayU sends a collect request to the UPI ID; approve it in the UPI app. PayU then POSTs the result to `/payu/return`, which shows it and sends you back to the console, which confirms with `/user/verify-payment`.
   - **UPI_INTENT** returns `oPayu.oSdkParams` for the Android PayU UPI SDK. PayU doesn't support UPI intent through a browser form post, so this page only shows the params (server hash, no salt) and lets you call verify.
2. **Verify.** *Verify now* calls `/user/verify-payment` once. *Start auto-poll* repeats it until `SUCCESS` or `FAILED` (the same loop the Android app runs).
3. The tabs at the bottom show the exact request and the decrypted response of both calls.

## Layout

```
src/
  server.js                    entry (validates .env, starts Express)
  app.js                       Express app: views, static files, routes
  config/index.js              reads .env, checks the key/IV format
  routes/                      pages.routes.js (/, /payu/return) · api.routes.js (/api/*)
  controllers/payment.controller.js   builds the backend request + headers
  controllers/pages.controller.js     home page + PayU's surl/furl return page
  services/crypto.service.js   AES-256-CBC (same scheme as the backend)
  services/backend.client.js   encrypted POST + decrypt, never throws
views/                         index.ejs · payu-return.ejs · partials/ (Bootstrap via CDN)
public/js/app.js               form, QR rendering, polling
public/css/style.css
```

## Safety

The backend runs against the **live** PayU merchant account when `PAYU_ENVIRONMENT=PRODUCTION`. Use a ₹1–₹2 test SKU and a whitelisted test user, and refund test payments from the PayU dashboard.
