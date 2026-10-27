# GenTech mobile app

Expo SDK 58 React Native app written in JavaScript.

## Run on a phone

1. Start MongoDB and the backend from `../backend`:

   ```powershell
   .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

   The backend's internal chat MCP client uses
   `CHAT_MCP_SERVER_URL=http://127.0.0.1:8000/mcp/` by default. If the backend
   listens on a different host or port, set `CHAT_MCP_SERVER_URL` in
   `backend/.env` to that server's `/mcp/` URL.

2. In `frontend`, start Expo on the local network:

   ```powershell
   npm start -- --lan
   ```

3. Install Expo Go on the phone, connect the phone to the same Wi-Fi as the
   computer, and scan the QR code shown by Expo.

The Expo Go app installed on the phone must support SDK 58. Expo's SDK 58
release notes state that the SDK 58 Expo Go builds for the app stores are
coming soon; until they are available, use an SDK 58 development build to run
the app on a device.

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
notifications are not configured. Chat product recommendations include an
interactive product card that can add the suggestion to the shopping bag.
Chat is available only while signed in; each customer's conversations are
stored separately on the device and can be deleted individually from chat
history. Chat API requests require authentication, and order-status lookups only
return orders owned by the signed-in customer. Catalog and order database tools
are discovered and invoked over the backend's authenticated Streamable HTTP MCP
endpoint (`/mcp/`); order access is scoped to the verified customer JWT.
Responses stream into the chat
with compact progress feedback, and the composer remains available above the
keyboard. The assistant uses recent chat context (up to twenty messages) and
can combine policy search with authorized order or catalog tools in a single
turn.
All visitors can open the three policy PDFs from Account → Policies and
manuals; source links in RAG answers open the relevant manual page. Available
coupon codes appear in Offers and can be carried to the cart to apply.
Checkout reserves item quantities from inventory immediately; canceling a
reserved order returns those quantities to stock.
