<img src="frontend/src/connect_duo/assets/connectDuo_logo.png" width="600" alt="ConnectDuo Logo"/>

### 소상공인을 위한 공공데이터 기반 **AI 세무 상담 및 전문가 매칭 플랫폼**

---

> 복잡한 세무 업무로 고민하는 소상공인과,  
> 신뢰받는 세무사를 \**똑똑하게 연결*하는 "연결해듀오"입니다.

---

## 데모 배포

- (작업 중)

---

## 빠른 시작

```bash
# 1. 레포지토리 클론
git clone https://github.com/kevin12579/connect-duo.git

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

## 사용 STACK

**Front-End**

- React 18, react-router-dom
- Zustand, React Query (상태 관리)
- Bootstrap
- Axios (API 통신)

**Back-End**

- Node.js, Express v5
- MySQL (데이터 저장)
- Socket.io (실시간 채팅)
- JWT, Bcrypt (인증/보안)
- Multer(파일 업로드), Cors, Morgan(로그)

**AI & Data Intelligence**

- LangChain, @langchain/openai
- Gemini API, 국가법령정보 API
- Cheerio(웹스크래핑)

**Tools**

- VS Code

---

## 주요 기능

- **AI 세무 상담:**  
  국가법령정보 API + Gemini AI로, 24시간 신속·정확한 세무 답변
- **세무사 랭킹:**  
  만족도·재상담률·응답속도 등 **지표 기반 신뢰랭킹**
- **실시간 1:1 채팅:**  
  전문가와의 비대면 실시간 상담 및 관리

---

## 팀원 및 역할

| 이름         | 역할                                                                          |
| ------------ | ----------------------------------------------------------------------------- |
| 박성훈(팀장) | 시스템 설계, AI/LLM 챗봇 메인 개발, 채팅 서버 · 전체 백엔드 · DB 설계 및 개발 |
| 김수형       | 시장 분석, 데이터 조사, 요구분석·기획, 랭킹 프론트 개발, AI/LLM 챗봇          |
| 방세정       | 전체 UI/UX 디자인, 전체 프론트 개발, 발표자료(PPT)                            |
| 신창희       | 채팅 프론트 개발, 기능 점검, 발표자료, 대본 작성                              |

---

## 프로젝트 일정

- **2/5~2/10** : 요구사항 분석, 기술스택 선정, 기획
- **2/11~2/13** : 백엔드·DB 구축, 로그인/회원가입 완성
- **2/13~2/24** : UI/UX, 프로필, 랭킹 개발
- **2/24~2/25** : RAG 기반 AI 세무비서 구현
- **2/26~2/27** : 채팅/상담 서버 개발
- **3/3~3/4** : 수익구조 개발 완성, 테스트·디버깅·최적화·마무리
- **3/4~3/9** : 최종 발표 자료 준비

---

## 정보

- **SMU 엔지니어 9기 팀 프로젝트**

---
