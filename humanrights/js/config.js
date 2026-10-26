/*
 * 조정값과 공통 팩 연결
 *   COMMON_BASE  공통 에셋 팩 경로(index.html 기준). 팀 저장소에서도 같은 상대 경로
 *   CAST         역할 → 공통 팩 캐릭터 ID. 팩에 맞는 인물이 없으면 null(아이콘으로 대체)
 *   SCENES       화면 → 공통 팩 배경 ID
 *   VERSION      저장 형식 버전. 진행 데이터 구조를 바꾸면 올린다(옛 저장은 버림)
 */
(function (root) {
  'use strict';

  var config = {
    GAME_ID: 'humanrights',
    TITLE: 'AI 안면인식 심의위원회',
    VERSION: 1,
    COMMON_BASE: '../shared/ethicity-elementary-common-v1',

    // 임시 배정(팀 확인 필요): 공통 팩 인물은 학생·교사·사서·로봇뿐이라 어른 역할 일부를 가깝게 맞췄다
    CAST: {
      guide: 'robot',          // 위원회 심의 도우미(브리핑·데이터 안내)
      libStudent: 'daon',      // 도서관 이용 학생
      libManager: 'librarian', // 도서관 운영 담당자
      recruiter: 'teacher',    // 채용 담당자
      applicant: 'haneul',     // 채용 지원자
      expert: 'onyu',          // 인권 전문가
      family: 'saebom',        // 실종자 가족
      activist: 'jiho'         // 인권단체 활동가
    },

    SCENES: {
      intro: 'ai_lab',
      library: 'library',
      hiring: 'classroom',
      policing: 'courtyard',
      wrapup: 'ai_lab'
    },

    // 교사가 ?rebuttal=safety|cost|majority 로 바꿀 수 있는 반론
    REBUTTAL_DEFAULT: 'base',

    // 서술형 답의 최소 글자 수(내용은 채점하지 않음)
    MIN_TEXT: 5
  };

  root.HR = root.HR || {};
  root.HR.Config = config;
  if (typeof module !== 'undefined' && module.exports) module.exports = config;
})(typeof window !== 'undefined' ? window : globalThis);
