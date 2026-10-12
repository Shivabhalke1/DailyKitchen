# DailyKitchen — Feature Checklist & Customer Journey Matrix

This checklist tracks feature completion criteria across development phases.

---

## 1. Customer Journey Flow Matrix

| Journey Step | Mobile App Status | Web App Status | Backend API Status | DB Entity Status |
| :--- | :--- | :--- | :--- | :--- |
| **1. Authentication** (Login, Register, 4-digit OTP) | Pending Phase 4 | Pending Phase 4 | Pending Phase 3 | Pending Phase 2 |
| **2. Location Selection** (Pincode, Saved Address) | Pending Phase 5 | Pending Phase 5 | Pending Phase 2 | Pending Phase 2 |
| **3. Home & Category Discovery** (Greens, Veg, Fruits) | Pending Phase 5 | Pending Phase 5 | Pending Phase 2 | Pending Phase 2 |
| **4. Search & Filtering** | Pending Phase 5 | Pending Phase 5 | Pending Phase 2 | Pending Phase 2 |
| **5. Product Listing & Details** (Weight variants) | Pending Phase 6 | Pending Phase 6 | Pending Phase 2 | Pending Phase 2 |
| **6. Cart Operations** (Add, qty update, subtotal) | Pending Phase 7 | Pending Phase 7 | Pending Phase 2 | Pending Phase 2 |
| **7. Delivery Slot Selection** (Express vs Scheduled) | Pending Phase 7 | Pending Phase 7 | Pending Phase 2 | Pending Phase 2 |
| **8. Address Selection & Checkout Summary** | Pending Phase 8 | Pending Phase 8 | Pending Phase 2 | Pending Phase 2 |
| **9. Payment Method Selection** (UPI, Cards, COD) | Pending Phase 9 | Pending Phase 9 | Pending Phase 2 | Pending Phase 2 |
| **10. Order Confirmation & Tracking** | Pending Phase 9 | Pending Phase 9 | Pending Phase 2 | Pending Phase 2 |

---

## 2. Shared Brand & UI Theme Specifications

- **Primary Brand Color:** Fresh Forest Green (`#1E7E34` / `#16A34A`)
- **Secondary Accent:** Vibrant Lime / Mint (`#4ADE80` / `#DCFCE7`)
- **Neutral Dark:** Charcoal Black (`#111827`)
- **Neutral Light:** Off-white / Cream (`#F9FAFB` / `#FFFFFF`)
- **Alert / Warning:** Amber (`#F59E0B`)
- **Error / Danger:** Coral Red (`#EF4444`)
- **Typography:** Inter / Outfit font family for modern legibility.
- **Iconography:** Lucide Icons (`lucide-react` on Web, `lucide-react-native` on Mobile).
- **Default Currency Format:** Indian Rupee (`₹`).
- **Default Country Code:** `+91` with 10-digit mobile number validation.
- **OTP Input Format:** 4-digit discrete PIN input with auto-focus and 60-second resend countdown.
