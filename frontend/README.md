# Gym Management frontend

React + TypeScript + Vite administrative UI connected to the Laravel API.

## Run locally

Start Laravel:

```bash
cd backend
php artisan serve
```

Start React in another terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend is available at `http://localhost:5173`; Laravel defaults to `http://127.0.0.1:8000`.
Copy `.env.example` to `.env.local` to override `VITE_API_URL`.

Sign in with an administrative account created in the Laravel database. The access-reader screen is public at `/access`; administrative pages use the API's Sanctum Bearer token.

## Checks

```bash
npm test
npm run lint
npm run build
```

Backend API tests:

```bash
cd backend
php artisan test
```

## Connected API

Members, membership plans and histories, payments, barcode check-in, products, inventory movements, sales/cancellation, and sales/payments/attendance/inventory reports use the Laravel API. Report filters use `from` and `to` dates. Financial totals, membership decisions, prices and inventory changes remain backend-owned.
