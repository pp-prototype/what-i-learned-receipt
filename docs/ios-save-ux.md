# iOS 이미지 저장 UX 이슈 및 처리 기록

## 개요

`what-i-learned-receipt`는 사용자가 사진과 학습 기록을 입력한 뒤 `영수증 발행하기` 버튼을 눌러 PNG 이미지를 저장하는 단일 페이지 웹 앱이다.

배포 당시에는 iOS Safari에서 생성된 이미지를 미리보기로 확인한 뒤 이미지로 저장하는 흐름이 자연스럽게 동작했다. 이후 iOS 브라우저의 다운로드 UX가 바뀌면서, 같은 버튼을 눌러도 사진 앱에 바로 저장하기 어려운 파일 저장 흐름으로 이어지는 문제가 확인되었다.

## 발생 이슈

- `영수증 발행하기` 버튼을 누르면 PNG 이미지는 생성되지만, iOS에서 이미지 미리보기 흐름이 제공되지 않는다.
- 생성 결과가 사진 앱에 바로 저장되는 대신 파일 다운로드로 처리되어 사용자가 사진 앱에서 확인하기 어렵다.
- 모바일 사용자는 앱의 핵심 결과물인 학습 영수증 이미지를 저장하거나 공유하는 과정에서 혼란을 겪을 수 있다.

## 원인

기존 구현은 Canvas로 이미지를 그린 뒤 아래 방식으로 다운로드를 트리거했다.

```js
const link = document.createElement("a");
link.download = `learning-receipt-${todayDate.value}.png`;
link.href = canvas.toDataURL("image/png");
link.click();
```

이 방식은 데스크톱 브라우저에서는 단순하고 안정적이지만, iOS Safari에서는 `download` 속성 및 `data:` URL 다운로드가 사용자가 기대하는 사진 저장 UX로 이어지지 않을 수 있다. 특히 iOS의 브라우저 다운로드 정책과 파일 앱 중심의 저장 흐름이 바뀌면, 앱 코드가 변경되지 않아도 사용자 경험이 달라질 수 있다.

## 처리 방법

iOS 기기에서는 Canvas 결과물을 PNG `Blob`으로 만든 뒤 `File` 객체로 변환하고, Web Share API를 통해 iOS 공유 시트를 먼저 열도록 변경했다.

핵심 흐름은 다음과 같다.

1. Canvas 이미지를 `canvas.toBlob()`으로 PNG `Blob` 생성
2. `Blob`을 `File` 객체로 변환
3. iOS에서 `navigator.canShare({ files })`가 가능하면 `navigator.share({ files })` 호출
4. 공유 API를 사용할 수 없는 환경에서는 기존 다운로드 방식으로 fallback

```js
const blob = await canvasToBlob(canvas);
const file = new File([blob], fileName, { type: "image/png" });

if (navigator.canShare?.({ files: [file] })) {
  await navigator.share({
    files: [file],
  });
  return;
}

downloadImage(canvas, fileName);
```

## 기대 동작

- iPhone 또는 iPad에서는 `영수증 발행하기` 버튼을 누르면 iOS 공유 시트가 열린다.
- 사용자는 공유 시트에서 이미지 저장, 메시지 공유, 다른 앱으로 보내기 등을 선택할 수 있다.
- Web Share API를 지원하지 않는 브라우저에서는 기존처럼 PNG 다운로드가 실행된다.

## 검증 포인트

- iOS Safari에서 `영수증 발행하기` 버튼 클릭 시 공유 시트가 열리는지 확인한다.
- 공유 시트에서 이미지 저장 후 사진 앱에서 생성된 영수증 PNG를 확인한다.
- 데스크톱 브라우저에서 기존 PNG 다운로드가 계속 동작하는지 확인한다.
- 사진을 첨부한 경우와 첨부하지 않은 경우 모두 이미지가 정상 생성되는지 확인한다.

## 관련 변경 파일

- `index.html`
  - `canvasToBlob()` 추가
  - `isIOSDevice()` 추가
  - `downloadImage()` fallback 함수 분리
  - iOS에서 Web Share API를 우선 사용하도록 저장 로직 변경
