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
  components/   Shared product, form, selection and loading components
  context/      Authentication, persistent cart and order notifications
  navigation/   Home, Offers, Notifications, Account and Chat tabs
  screens/      Storefront, checkout, profile and admin management screens
  services/     API clients for catalog, commerce and protected admin endpoints
  styles/       Screen- and component-specific React Native StyleSheet modules
  theme/        Shared palette and spacing
  utils/        Product formatting and category icon helpers
```

Home content, live search suggestions, category brands, product details,
category filters and offers use the backend APIs. Customers can register and
sign in, shop with a locally persisted guest cart, apply coupons, and place
guest or authenticated orders. Mobile banking is an explicit bKash simulation
and does not transfer money. Signed-in customers can edit their profile and see
order-status updates in the in-app Notifications tab. Admin accounts can manage
categories, products, coupons and order status from the Account tab's Admin
console. Order notifications are refreshed while the app is active; remote push
notifications are not configured. The support chat remains presentation-only.
