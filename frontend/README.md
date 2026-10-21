# GenTech mobile app

Expo React Native app written in JavaScript.

## Run on a phone

1. Start MongoDB and the backend from `../backend`:

   ```powershell
   .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. In `frontend`, start Expo on the local network:

   ```powershell
   npm start -- --lan
   ```

3. Install Expo Go on the phone, connect the phone to the same Wi-Fi as the
   computer, and scan the QR code shown by Expo.

The app uses the Expo development host address to reach the backend at port
`8000`. If the backend is on another machine or port, copy `.env.example` to
`.env` and set `EXPO_PUBLIC_API_URL`, for example:

```env
EXPO_PUBLIC_API_URL=http://192.168.0.10:8000/api
```

The computer's firewall must allow inbound connections to ports `8000` and
`8081`. The backend image paths are requested from the API host; when an image
is missing or unavailable, product cards use a category icon fallback.
Product image files referenced by the database must be placed under
`../backend/data/images/<category>/<filename>`; the backend serves that folder
at `/images`.

## App structure

```text
src/
  components/   Reusable product cards, image fallbacks, headings, load states
  context/      Local shopping-bag state for the preview
  navigation/   Home, Account and Chat tabs plus product/category stack screens
  screens/      Home, product, brand, bag, account and chat views
  services/     API client and endpoint-specific requests
  theme/        Shared palette and spacing
  utils/        Product formatting and category icon helpers
```

Home content, live search suggestions, category brands, product details,
category filters and offers use the backend APIs. Customers can register and
sign in, shop with a locally persisted guest cart, apply coupons, and place
guest or authenticated orders. Mobile banking is an explicit bKash simulation
and does not transfer money. The support chat remains presentation-only.
