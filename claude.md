너는 프론트엔드 구조 설계 전문가야.  
지금 내가 맡은 파트는 “AI 여행 경로 추천 기능”이고, 바닐라 HTML/CSS/JS로 구현할 거야.  

이 기능만을 위한 최소 폴더 구조를 만들어줘.  
페이지 이름은 `recommend.html` 이고, 이 페이지 하나에 필요한 js/css 파일만 포함시켜줘.  

---

### 구성 조건
- recommend.html — 추천 페이지 메인 파일  
- css/recommend.css — 추천 페이지 스타일  
- js/recommend.js — 입력 처리, 결과 렌더링  
- js/api/ai.js — 생성형 AI 호출 로직  
- js/components/loading.js — 로딩 애니메이션 표시  
- js/utils/format.js — 금액, 날짜 등 포맷 함수  
- assets/images/ 와 assets/icons/ 폴더 포함 (이미지는 나중에 추가 예정)

---

### 출력 포맷
폴더 트리 형태로 보여주고,  
각 파일 오른쪽에 한 줄 설명 주석을 붙여줘.  

예시:
AIBE4_PROJECT1_TEAM3/
│
├── recommend.html              # 여행 경로 추천 페이지
├── css/
│   └── recommend.css           # 추천 페이지 스타일
├── js/
│   ├── api/
│   │   └── ai.js               # 생성형 AI 호출 (Gemini or Groq)
│   ├── components/
│   │   └── loading.js          # 로딩 애니메이션
│   ├── utils/
│   │   └── format.js           # 금액, 날짜 포맷 함수
│   └── recommend.js            # 입력→AI 호출→결과 표시 메인 로직
└── assets/
    ├── images/                 # 이미지 리소스
    └── icons/                  # 아이콘 리소스
