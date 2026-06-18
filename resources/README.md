# App Icon & Splash Screen Assets

이 폴더에는 Capacitor 앱의 아이콘과 스플래시 이미지가 들어갑니다.

## 파일 목록

| 파일 | 크기 | 용도 |
|------|------|------|
| `icon.png` | 512×512px | 앱 아이콘 (현재: placeholder) |
| `icon-foreground.png` | 512×512px | Adaptive Icon 전경 레이어 (Android 8+) |
| `splash.png` | 2732×2732px | 스플래시 화면 (현재: placeholder) |
| `splash-dark.png` | 2732×2732px | 다크모드 스플래시 (현재: placeholder) |

## 아이콘 교체 방법

1. 512×512px PNG 파일을 `icon.png`로 교체하세요 (투명 배경 없이, 정사각형)
2. 2732×2732px PNG 파일을 `splash.png`로 교체하세요
3. 다음 명령어를 실행하면 모든 해상도 아이콘이 자동 생성됩니다:

```bash
npx @capacitor/assets generate
```

이 명령어가 Android의 `mipmap-*` 폴더와 iOS의 `AppIcon.appiconset` 폴더를 모두 채워줍니다.

## 권장 디자인 가이드

- **아이콘**: 배경이 있는 PNG, 안전 영역(safe zone)은 66% 내에 로고 배치
- **스플래시**: 중앙에 로고, 나머지는 브랜드 배경색으로 채우기
- **색상**: DinoInvest 브랜드색 `#0f172a` (slate-900) 배경 권장
