<div align="center">
<img src="frontend/src/connect_duo/assets/connectDuo_logo.png" width="600" alt="ConnectDuo Logo"/>

### 소상공인을 위한 공공데이터 기반 **AI 세무 상담 및 전문가 매칭 플랫폼**

> 복잡한 세무 업무로 고민하는 소상공인과,  
> 신뢰받는 세무사를 **똑똑하게 연결**하는 "연결해듀오"입니다.

**개발 기간:** 2025.02.05 ~ 2025.03.09 &nbsp;|&nbsp; **팀:** SMU 엔지니어 9기

[![배포](https://img.shields.io/badge/배포-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://connect-fu5mq9m4k-kevin12579s-projects.vercel.app/)

</div>

---

## 목차

1. [프로젝트 소개](#프로젝트-소개)
2. [시작 가이드](#시작-가이드)
3. [기술 스택](#기술-스택)
4. [주요 기능](#주요-기능)
5. [디렉토리 구조](#디렉토리-구조)
6. [팀원 및 역할](#팀원-및-역할)
7. [프로젝트 일정](#프로젝트-일정)

---

## 프로젝트 소개

세무 업무는 소상공인에게 가장 복잡하고 부담스러운 영역 중 하나입니다.  
**연결해듀오(Connect Duo)** 는 국가법령정보 API와 AI를 결합해 24시간 세무 질문에 답변하고,  
검증된 지표 기반 랭킹으로 신뢰할 수 있는 세무사를 빠르게 연결해주는 플랫폼입니다.

---

## 시작 가이드

### 요구 사항

- Node.js 18+
- MySQL 8.0+

### 설치 및 실행

```bash
# 1. 레포지토리 클론
git clone https://github.com/kevin12579/connect-duo.git
cd connect-duo

# 2. 백엔드 실행
cd backend
npm install
node server.js

# 3. 프론트엔드 실행 (새 터미널)
cd frontend
npm install
npm start
```

---

## 기술 스택

**Front-End**

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![React Router](https://img.shields.io/badge/React_Router-CA4245?style=for-the-badge&logo=react-router&logoColor=white)
![Zustand](https://img.shields.io/badge/Zustand-443E38?style=for-the-badge&logo=zustand&logoColor=white)
![Bootstrap](https://img.shields.io/badge/Bootstrap-563D7C?style=for-the-badge&logo=bootstrap&logoColor=white)
![Axios](https://img.shields.io/badge/Axios-5A29E4?style=for-the-badge&logo=axios&logoColor=white)

**Back-End**

![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=JSON%20web%20tokens&logoColor=white)

**AI & Data**

![LangChain](https://img.shields.io/badge/LangChain-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white)
![GPT-4o mini](https://img.shields.io/badge/GPT--4o_mini-412991?style=for-the-badge&logo=openai&logoColor=white)

**Tools**

![VS Code](https://img.shields.io/badge/VS_Code-007ACC?style=for-the-badge&logo=visual-studio-code&logoColor=white)
![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **AI 세무 상담** | 국가법령정보 API + GPT-4o mini 기반 RAG, 24시간 신속·정확한 세무 답변 제공 |
| **세무사 랭킹** | 만족도·재상담률·응답속도 등 지표 기반 신뢰 랭킹으로 세무사 검색·비교 |
| **실시간 1:1 채팅** | Socket.io 기반 전문가와의 비대면 실시간 상담 및 이력 관리 |

---

## 디렉토리 구조

```
connect-duo/
├── backend/
│   ├── src/
│   │   ├── config/         # DB, 환경변수 설정
│   │   ├── controllers/    # 요청 처리 로직
│   │   ├── middlewares/    # 인증 등 미들웨어
│   │   ├── models/         # DB 모델
│   │   ├── routes/         # API 라우터
│   │   └── services/       # 비즈니스 로직 (AI, 랭킹 등)
│   └── server.js
└── frontend/
    └── src/
        └── connect_duo/
            ├── api/        # Axios API 호출
            ├── assets/     # 이미지, 폰트 등 정적 자원
            ├── hooks/      # 커스텀 훅
            ├── pages/      # 페이지 컴포넌트
            ├── stores/     # Zustand 전역 상태
            ├── styles/     # CSS 모듈
            └── utils/      # 공통 유틸 함수
```

---

## 팀원 및 역할

| 이름 | 역할 |
|------|------|
| 박성훈 (팀장) | 시스템 설계, AI/LLM 챗봇 메인 개발, 채팅 서버 · 전체 백엔드 · DB 설계 및 개발 |
| 김수형 | 시장 분석, 데이터 조사, 요구분석·기획, 랭킹 프론트 개발, AI/LLM 챗봇 |
| 방세정 | 전체 UI/UX 디자인, 전체 프론트 개발, 발표자료(PPT) |
| 신창희 | 채팅 프론트 개발, 기능 점검, 발표자료, 대본 작성 |

---

## 프로젝트 일정

| 기간 | 내용 |
|------|------|
| 2025.02.05 ~ 02.10 | 요구사항 분석, 기술스택 선정, 기획 |
| 2025.02.11 ~ 02.13 | 백엔드·DB 구축, 로그인/회원가입 완성 |
| 2025.02.13 ~ 02.24 | UI/UX, 프로필, 랭킹 개발 |
| 2025.02.24 ~ 02.25 | RAG 기반 AI 세무비서 구현 |
| 2025.02.26 ~ 02.27 | 채팅/상담 서버 개발 |
| 2025.03.03 ~ 03.04 | 수익구조 개발 완성, 테스트·디버깅·최적화·마무리 |
| 2025.03.04 ~ 03.09 | 최종 발표 자료 준비 |

---

<div align="center">
<sub>SMU 엔지니어 9기 팀 프로젝트</sub>
</div>
