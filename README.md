# طريقي - تطبيق الكابتن

تطبيق Expo مستقل للكباتن، يشترك مع تطبيق الراكب في نفس قاعدة بيانات Supabase.

---

## 🚀 تشغيل محلياً

```bash
cd captain-app
npm install
npx expo start
```

---

## 📱 بناء APK للأندرويد

### المتطلبات
- حساب على [expo.dev](https://expo.dev) (مجاني)
- Node.js 18+
- حساب EAS مفعّل

### الخطوات

```bash
# 1. تثبيت EAS CLI
npm install -g eas-cli

# 2. تسجيل الدخول
eas login

# 3. ربط المشروع (من داخل captain-app)
cd captain-app
eas init

# 4. بناء APK للاختبار
eas build --platform android --profile preview
```

البناء يستغرق ~10-15 دقيقة → ستحصل على رابط تحميل APK مباشر.

**تثبيت APK:**
- افتح الرابط من متصفح الهاتف وحمّل الملف
- فعّل "تثبيت من مصادر غير معروفة" في إعدادات Android
- أو عبر ADB: `adb install tariq-captain.apk`

---

## 🏪 نشر تطبيق الراكب على Google Play

### المتطلبات
1. حساب **Google Play Developer** ($25 رسوم لمرة واحدة)
   - سجّل على: [play.google.com/console](https://play.google.com/console)
2. تثبيت EAS CLI وتسجيل الدخول (كما أعلاه)
3. ملف `google-service-account.json` (للنشر التلقائي)

---

### الخطوة 1 — بناء AAB للنشر

من مجلد **الراكب** (المشروع الرئيسي):

```bash
# من مجلد المشروع الرئيسي (ليس captain-app)
eas build --platform android --profile production
```

البناء ينتج ملف `.aab` (Android App Bundle) مناسب للنشر على Play Store.

---

### الخطوة 2 — إعداد Play Console

1. افتح [play.google.com/console](https://play.google.com/console)
2. اضغط **"Create app"**
3. أدخل:
   - **App name:** طريقي - Tariq
   - **Default language:** Arabic
   - **App or game:** App
   - **Free or paid:** Free
4. اضغط **"Create app"**

---

### الخطوة 3 — رفع النسخة الأولى

1. من القائمة الجانبية: **Testing → Internal testing**
2. اضغط **"Create new release"**
3. اضغط **"Upload"** واختر ملف `.aab` الذي بنيته في الخطوة 1
4. أضف ملاحظات الإصدار (Release notes):
   ```
   العربية: الإصدار الأول من طريقي - تطبيق ركوب فاخر في الأردن
   English: First release of Tariq - Premium ride-hailing app in Jordan
   ```
5. اضغط **"Save"** ثم **"Review release"**

---

### الخطوة 4 — إكمال متطلبات Play Store

اذهب لكل قسم في القائمة الجانبية وأكمل المطلوب:

| القسم | المطلوب |
|-------|---------|
| **App content > Privacy Policy** | رابط لسياسة الخصوصية (يمكن إنشاؤها مجاناً على privacypolicygenerator.info) |
| **App content > App access** | اختر "All or most functionality is accessible" |
| **App content > Content rating** | أكمل الاستبيان (اختر PEGI 3 / Everyone) |
| **App content > Target audience** | 18+ (لأن التطبيق لقيادة السيارات) |
| **App content > News apps** | اختر "No" |
| **Store listing** | وصف التطبيق + لقطات شاشة + أيقونة |

**لقطات الشاشة المطلوبة:**
- Phone: 2-8 صور (1080×1920 أو نسبة 9:16)
- يمكن التقاطها من OnSpace App Preview

---

### الخطوة 5 — Store Listing (صفحة المتجر)

اذهب إلى **Store listing** وأدخل:

**Short description (80 حرفاً):**
```
تطبيق ركوب فاخر في الأردن - خدمة عادية ونسائية وإكسبرس
```

**Full description (4000 حرفاً):**
```
طريقي - تطبيق توصيل فاخر في الأردن

🚗 ثلاث خدمات في تطبيق واحد:
• طريق عادي - توصيل سريع وموثوق
• طريق نسائي - كابتنات متخصصات للسيدات
• طريق إكسبرس - توصيل الطرود والبضائع

✨ مميزات التطبيق:
• تتبع الكابتن مباشرة على الخريطة
• محفظة رقمية بالدينار الأردني
• دردشة مباشرة مع الكابتن
• تقييم الكباتن بعد كل رحلة
• نظام الإحالة والمكافآت
• دخول سريع ببصمة الإصبع
• دفع سهل عبر المحفظة أو النقد

📞 الدفع بالدينار الأردني (JOD)
🔒 آمن ومشفر
```

---

### الخطوة 6 — نشر للاختبار الداخلي

1. عد إلى **Testing → Internal testing**
2. اضغط على الإصدار → **"Promote to internal testing"**
3. أضف بريدك الإلكتروني كمختبر داخلي
4. ستصلك رسالة بريدية لتثبيت التطبيق من Play Store مباشرة

---

### الخطوة 7 — النشر العام (Production)

بعد الاختبار الناجح:

1. **Testing → Production → Create new release**
2. رفع نفس ملف AAB
3. Play Store يراجع التطبيق خلال **3-7 أيام عمل**
4. عند القبول يُنشر للعموم تلقائياً

---

### النشر التلقائي عبر EAS Submit

```bash
# أنشئ service account من Google Cloud Console أولاً
# ثم:
eas submit --platform android --latest
```

يتطلب وضع ملف `google-service-account.json` في مجلد المشروع الرئيسي.

---

## 🗺️ إضافة Google Maps Key

1. افتح `app.json` (للراكب) أو `captain-app/app.json` (للكابتن)
2. استبدل `YOUR_GOOGLE_MAPS_API_KEY` بمفتاحك:

```json
"googleMaps": {
  "apiKey": "AIzaSy..."
}
```

3. أعد البناء (APK/AAB)

---

## 🔑 متغيرات البيئة

مُضمّنة تلقائياً في `eas.json` — لا حاجة لإعداد إضافي.

---

## 🧪 الكباتن التجريبيون

| الرقم | الحالة |
|-------|--------|
| +962799000001 | معتمد ✅ |
| +9627882203694 | معتمد ✅ |

سجّل الدخول عبر OTP واتساب.

---

## 📦 هيكل المشروع

```
captain-app/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx         # لوحة الطلبات + خريطة GPS
│   │   ├── trips.tsx         # سجل الرحلات
│   │   ├── earnings.tsx      # الأرباح + رسم بياني أسبوعي
│   │   └── profile.tsx       # الملف الشخصي
│   ├── login.tsx             # تسجيل الدخول OTP/WhatsApp
│   ├── register.tsx          # تسجيل كابتن جديد (3 خطوات)
│   ├── chat.tsx              # دردشة مع الراكب
│   └── rate-ride.tsx         # تقييم الراكب بعد الرحلة
├── contexts/
│   ├── CaptainAuthContext.tsx
│   └── RideContext.tsx
├── services/
│   ├── locationService.ts    # تتبع GPS المستمر
│   └── notificationService.ts # إشعارات الطلبات
└── components/
    ├── CaptainMap.native.tsx  # خريطة موبايل
    └── CaptainMap.tsx         # خريطة ويب
```
