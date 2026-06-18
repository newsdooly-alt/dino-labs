# DinoInvest 모바일 앱 설정 가이드

DinoInvest 웹앱을 Android/iOS 앱으로 빌드하는 방법을 안내합니다.

---

## ✅ 이미 완료된 것들

- Capacitor 설정 (`capacitor.config.ts`)
- GitHub Actions 자동 APK 빌드 워크플로우 (`.github/workflows/build-android.yml`)
- 빌드 스크립트 (`npm run build:mobile`)

---

## 📋 남은 단계

### 1단계: GitHub에 코드 연결

1. [GitHub.com](https://github.com)에서 새 저장소(Repository)를 만드세요.
2. 이 프로젝트를 GitHub에 업로드하세요:
   ```bash
   git init
   git remote add origin https://github.com/YOUR_USERNAME/dinoinvest.git
   git add .
   git commit -m "Initial commit with Capacitor setup"
   git push -u origin main
   ```

### 2단계: GitHub Actions로 APK 자동 빌드

1. GitHub 저장소에 코드를 push하면 자동으로 APK 빌드가 시작됩니다.
2. 빌드 완료 후 **Actions** 탭 → 최근 워크플로우 → **Artifacts** 섹션에서 APK를 다운로드할 수 있습니다.
3. 빌드 시간: 약 10~15분

### 3단계: APK 설치 (테스트용)

다운로드한 `app-debug.apk` 파일을 Android 기기에 설치할 수 있습니다:

1. Android 기기 → **설정** → **보안** → **출처를 알 수 없는 앱 허용**
2. APK 파일을 기기로 전송 후 설치

---

## 🏪 Play Store 출시 (선택사항)

Play Store에 앱을 올리려면 추가 단계가 필요합니다:

1. **Google Play 개발자 계정** 등록 (1회 $25 비용)
   - [play.google.com/console](https://play.google.com/console)
2. **릴리즈 서명 키** 생성 (Java keytool 사용)
3. GitHub Secrets에 서명 키 정보 추가:
   - `KEYSTORE_FILE` — Base64 인코딩된 keystore 파일
   - `KEY_ALIAS` — 키 별칭
   - `KEY_PASSWORD` — 키 비밀번호
   - `STORE_PASSWORD` — keystore 비밀번호
4. 서명된 APK/AAB로 Play Store 등록

---

## 🍎 iOS 앱 (선택사항)

iOS 앱 빌드는 **Mac + Xcode** 환경이 필요합니다:

1. Mac에서 이 프로젝트를 열고 `npm run build:mobile` 실행
2. `npx cap open ios` 로 Xcode 열기
3. **Apple 개발자 계정** 필요 (연 $99)
4. App Store Connect에서 앱 등록

---

## 🎨 앱 아이콘 교체

`resources/` 폴더에 아이콘 파일을 넣고 아래 명령어를 실행하면 모든 해상도의 아이콘이 자동 생성됩니다:

1. `resources/icon.png` — 512×512px 정사각형 PNG (투명 배경 없이)
2. `resources/splash.png` — 2732×2732px 스플래시 이미지
3. 아이콘 생성 실행:
   ```bash
   npx @capacitor/assets generate
   ```

현재 `resources/icon.png`는 placeholder 이미지입니다. 실제 DinoInvest 로고로 교체해주세요.

---

## 🔧 로컬에서 직접 빌드하기 (고급)

Node.js와 Android SDK가 설치된 환경에서:

```bash
# 1. 패키지 설치
npm install

# 2. 웹앱 빌드 + Capacitor 동기화
npm run build:mobile

# 3. Android 스튜디오 열기 (선택)
npx cap open android

# 4. 또는 직접 Gradle로 APK 빌드
cd android
./gradlew assembleDebug
# APK 위치: android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 📞 문의

문제가 있으면 [Capacitor 공식 문서](https://capacitorjs.com/docs)를 참고하거나 개발자에게 문의하세요.
