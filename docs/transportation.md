# Transportation booking

The homepage transportation CTA opens an internal four-step surface: ride details, vehicle choice, contact details, and booking summary. `useTransportBooking` owns transient wizard state and delegates every HTTP request to `src/api/transportApi.js`. Contact details, signed route tokens, quote tokens, and payment references are never written to browser storage.

Google Maps JavaScript, Places, and Geometry are shared with the admin coordinate picker (see [architecture.md](architecture.md)); `VITE_TRANSPORT_COUNTRY_CODE` defaults to `CR` and restricts this surface's autocomplete and viewport to Costa Rica. The backend remains authoritative for place country, route, eligibility, and fare.

The current payment capability is explicitly `pay_on_arrival`. The subscription billing integration does not expose or charge reusable payment methods for ride bookings, so the UI does not invent saved-card data. A hosted one-time payment flow requires a separate provider contract and webhook lifecycle before it can be offered.

Vehicle `imagePath` values are canonical S3 object keys such as `vehicles/jacsunray.jpg`. They are resolved with the shared media adapter: `VITE_CLOUDFRONT_BASE_URL` produces the CDN URL directly; when it is unset, the UI calls `GET /files/vehicles/:filename` and renders the returned CloudFront URL. Failed resolution or image loading displays an accessible local vehicle placeholder.

See the API repository's `docs/transportation.md` for endpoint and pricing contracts.

## Google Maps setup

The admin coordinate picker (node maintenance) shares this same browser key and
script loader (`src/config/googleMaps.js`); no separate setup is required for it.

1. Create or select a [Google Cloud project](https://console.cloud.google.com/projectselector2/home/dashboard) and attach an active billing account.
2. Enable **Maps JavaScript API**, **Places API (New)**, and **Routes API** in the project's API Library. The browser map uses Maps JavaScript and Places; the API uses Places and Routes to validate locations and produce authoritative route data.
3. Create a browser API key. Under **Application restrictions**, choose **Websites** and add every allowed HTTP referrer, including local development (for example `http://localhost:5173/*`) and each deployed UI origin. Under **API restrictions**, allow only Maps JavaScript API and Places API (New).
4. Add the browser settings to the UI environment, then restart the Vite server or rebuild the deployment:

   ```dotenv
   VITE_GOOGLE_MAPS_BROWSER_API_KEY=your_browser_key
   VITE_TRANSPORT_COUNTRY_CODE=CR
   ```

   `VITE_` values are public browser configuration. Never put the server key or signing secret in the UI repository.

5. Create a separate server API key. Restrict it to Places API (New) and Routes API. Add an IP restriction when the API deployment has stable outbound IP addresses.
6. Configure the API deployment with:

   ```dotenv
   GOOGLE_MAPS_SERVER_API_KEY=your_server_key
   TRANSPORT_COUNTRY_CODE=CR
   TRANSPORT_TIME_ZONE=America/Costa_Rica
   TRANSPORT_ROUTE_TOKEN_SECRET=a_unique_high_entropy_secret
   TRANSPORT_ROUTE_TOKEN_TTL_SECONDS=900
   TRANSPORT_QUOTE_TOKEN_TTL_SECONDS=600
   ```

7. Redeploy both services. Verify that autocomplete returns Costa Rica locations, marker dragging updates an address, a route draws in the site brand color, distance and duration appear, and an eligible vehicle quote can be loaded.

Google may take a few minutes to apply new key restrictions. A blank map or `RefererNotAllowedMapError` usually means the deployed origin is absent from the browser key's referrer list. Route or place errors from the backend should be checked against the server key's API restrictions and the enabled APIs.

## Visual integration

The booking surface uses the same Inter/system typography, semantic color variables, eight-pixel controls, card borders, shadows, content widths, and responsive conventions as the homepage. `src/styles/transport.css` owns only transportation-specific layout. Light and dark appearances derive from the shared tokens in `src/styles/base.css`; avoid adding page-specific brand colors or serif fonts.
