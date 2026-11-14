# 글꼴 (2026-11-14부터 게임 폴더에 실음)

전에는 `cdn.jsdelivr.net`에서 받았습니다. CDN이 막힌 학교 PC에서는 맑은 고딕으로 떨어져 글자 폭이 달라질 수 있어, 파일을 그대로 실었습니다(외부 연결 없음).
파일은 **고치지 않은 원본 woff2**입니다 — 서브셋·이름 바꾸기 등 가공을 하지 않습니다(OFL의 예약 글꼴 이름 조건).

| 파일 | 글꼴 | 받은 곳 | 라이선스 |
|---|---|---|---|
| `NanumSquareR.woff2` · `NanumSquareB.woff2` · `NanumSquareEB.woff2` | 나눔스퀘어(NAVER) — 본문 | `github.com/moonspam/NanumSquare` 2.0 (jsDelivr 사본) | SIL Open Font License 1.1 — 네이버 나눔글꼴 라이선스 안내: https://hangeul.naver.com/font |
| `Galmuri11.woff2` · `Galmuri11-Bold.woff2` | 갈무리11(Lee Minseo) — 로고·HUD·이름 탭의 픽셀 글꼴 | npm `galmuri@2.40.3` `dist/` | SIL Open Font License 1.1 — 전문 `OFL-Galmuri.md`(패키지의 `ofl.md` 그대로) |

- 연결: `css/style.css` 맨 끝 `@font-face`(`font-display: swap`).
- 나눔스퀘어 저장소에는 라이선스 파일이 따로 들어 있지 않아, 저작권 문구 원문은 위 네이버 안내 페이지를 따릅니다(SIL OFL 1.1 본문은 `OFL-Galmuri.md`에 실린 것과 같은 표준 문서).
- 합계 약 1.15MB(갈무리11 Regular가 0.5MB).
