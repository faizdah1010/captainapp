# دليل بناء تطبيق الكابتن - خطوات بسيطة

## الطريقة الأسهل: GitHub Actions (بدون أوامر)

### الخطوة 1 — أنشئ حساباً مجانياً
- **GitHub**: [github.com](https://github.com) — مجاني
- **Expo**: [expo.dev](https://expo.dev) — مجاني

---

### الخطوة 2 — احصل على Expo Token
1. سجّل دخول على [expo.dev](https://expo.dev)
2. اضغط على صورتك (أعلى يمين) → **Access Tokens**
3. اضغط **Create Token** → اكتب اسماً مثل `github-actions`
4. انسخ الـ Token واحفظه

---

### الخطوة 3 — ارفع الكود على GitHub
1. نزّل الكود من زر **Download** في OnSpace
2. افتح مجلد `captain-app` فقط
3. ارفعه كـ Repository جديد على GitHub (اضغط "+" → New Repository)

---

### الخطوة 4 — أضف Expo Token كـ Secret
1. في مشروع GitHub اضغط **Settings**
2. **Secrets and variables** → **Actions**
3. اضغط **New repository secret**
4. الاسم: `EXPO_TOKEN` والقيمة: الـ Token من الخطوة 2

---

### الخطوة 5 — شغّل البناء
1. اضغط تبويب **Actions** في GitHub
2. اضغط **Build Captain App APK**
3. اضغط **Run workflow** → **Run workflow**
4. انتظر 10-15 دقيقة → ستجد رابط APK في expo.dev/accounts تحت **Builds**

---

## ملاحظة
رابط الـ APK سيظهر في [expo.dev](https://expo.dev) → حساباتك → Builds
