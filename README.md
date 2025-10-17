# TourRate

<img src="src/image/logo.png" width="200" height="200">

## 팀 정보

**팀명:** 디버깅 노예들 (Debugging Slaves)  
**팀장:** 전승우  

| | | | | |
|:--:|:--:|:--:|:--:|:--:|
| <img src="https://github.com/jihun4452.png" width="100" height="100"> | <img src="https://github.com/Glory0206.png" width="100" height="100"> | <img src="https://github.com/tmddn7475.png" width="100" height="100"> | <img src="https://github.com/ehdghksahd.png" width="100" height="100"> | <img src="https://github.com/yerincho94.png" width="100" height="100"> |
| **박지훈** | **서영광** | **전승우** | **서동환** | **조예린** |
| [jihun4452](https://github.com/jihun4452) | [Glory0206](https://github.com/Glory0206) | [tmddn7475](https://github.com/tmddn7475) | [ehdghksahd](https://github.com/ehdghksahd) | [yerincho94](https://github.com/yerincho94) |


## 개요
이 프로젝트는 사용자의 예산과 선호도를 기반으로 여행 국가를 추천해주는 웹 입니다.  
실시간 환율과 날씨 정보를 제공하고, 지도와 AI 추천 기능을 결합하여 사용자가 더 효율적으로 여행 계획을 세울 수 있도록 돕기 위해 개발되었습니다.  
단순한 정보 제공이 아닌, 데이터를 기반으로 한 맞춤형 여행 경험을 제공하는 것을 목표로 했습니다.

## 프로젝트 목적
여행 준비 과정에서 발생하는 정보 탐색의 복잡함을 줄이고,  
사용자가 자신의 조건(예산, 기후, 선호도 등)에 맞는 국가를 쉽게 찾을 수 있도록 지원하기 위해 제작했습니다.  
또한 실시간 API 데이터를 연동하고, 실제 서비스 배포까지 진행하며 웹 개발 전반의 흐름을 학습하는 것을 목표로 했습니다.

## 주요 기술 및 서비스
- **OpenWeatherMap API**: 실시간 날씨 데이터 제공  
- **한국주식은행 API**: 실시간 환율 정보 제공  
- **Gemini AI**: 사용자 맞춤형 여행지 추천  
- **Supabase**: 리뷰 데이터 저장 및 관리  

## 사용한 기술 스택
- **프론트엔드**: Chart.js, Leaflet, JSON  
- **개발 환경**: VS Code, Git, Prettier, ESLint  
- **배포 플랫폼**: Render (서버 및 웹 호스팅)

## 배포 방식
Render를 이용해 서버를 배포하고, API 키를 환경 변수로 관리하여  
안정적으로 외부 서비스와 연동되도록 구성했습니다.

## 개발 규칙
자세한 GitHub 컨벤션은 [docs/github-rules.md](./docs/github-rules.md) 에서 확인할 수 있습니다.