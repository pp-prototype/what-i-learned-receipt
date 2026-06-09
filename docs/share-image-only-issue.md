# 공유 시 이미지 외 텍스트가 함께 전송되는 이슈

## 개요

학습 영수증 PNG를 카카오톡 등으로 공유할 때 이미지 파일만 전송되어야 하지만, `Learning Receipt` 같은 텍스트가 함께 들어가는 문제가 있었다.

## 발생 증상

- iOS 공유 시트에서 카카오톡으로 전송하면 이미지와 함께 불필요한 문자가 포함될 수 있다.
- 사용자는 사진만 보내고 싶지만, 공유 대상 앱이 Web Share API의 제목 값을 메시지 텍스트처럼 처리할 수 있다.

## 원인

`index.html`의 iOS 공유 로직에서 `navigator.share()`에 이미지 파일과 함께 `title` 값을 넘기고 있었다.

```js
await navigator.share({
  files: [file],
  title: "Learning Receipt",
});
```

일부 공유 대상 앱은 `title` 필드를 파일 설명이 아니라 전송 메시지 본문처럼 취급한다. 카카오톡에서 `Learning Receipt`가 같이 붙는 현상은 이 동작과 관련된 것으로 판단된다.

## 처리

이미지만 공유되도록 `navigator.share()` 호출에서 `title` 필드를 제거했다.

```js
await navigator.share({
  files: [file],
});
```

문서 예시인 `docs/ios-save-ux.md`에도 동일하게 반영했다.

## 확인 포인트

- 카카오톡 공유 시 이미지 외 텍스트가 붙지 않는지 확인한다.
- iOS 공유 시트에서 이미지 파일이 정상적으로 전달되는지 확인한다.
- `navigator.share()` payload에 `title` 또는 `text` 필드가 다시 추가되지 않도록 주의한다.

## 관련 파일

- `index.html`
- `docs/ios-save-ux.md`
