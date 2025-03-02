# X.com 이미지 원본 뷰어 (포크 및 수정 버전)

이 프로젝트는 원본 [twOpenOriginalImage](https://github.com/Coxxs/twOpenOriginalImage)를 포크하여 수정한 버전입니다. 본 저장소에서는 사용자 인터페이스 개선, 코드 정리 및 버전 관리를 목적으로 수정되었으며, 현재 릴리스 버전은 **1.0.0**입니다.

## 설치 방법

1. [Violentmonkey](https://violentmonkey.github.io/) 또는 [Tampermonkey](https://www.tampermonkey.net/)와 같은 사용자 스크립트 관리 확장 프로그램을 설치합니다.
2. 아래 링크를 통해 사용자 스크립트를 설치합니다.
   - [twOpenOriginalImage.user.js](https://github.com/PiesP/twOpenOriginalImage/raw/main/twOpenOriginalImage.user.js)

## 기능 소개

- **이미지 원본 보기**: X.com(구 Twitter)에서 이미지를 클릭하면 원본 해상도로 로드합니다.
- **세로 배열 및 슬라이드쇼 모드**: 상황에 따라 여러 이미지를 세로 스크롤 또는 슬라이드쇼 방식으로 감상할 수 있습니다.
- **내비게이션 및 다운로드**: 이전/다음 이미지 탐색, 선택 이미지 또는 전체 이미지 다운로드 기능 제공.

## 변경 내역

- **1.0.0 (초기 포크 후 코드 정리 버전)**
  - 원본 프로젝트를 포크한 후 코드 정리 및 일부 UI 개선 작업을 수행함.

- **1.0.1 (마우스 오른쪽 버튼 클릭 이벤트 무시 기능 추가)**
  - 마우스 오른쪽 버튼 클릭 시 아무런 동작도 하지 않도록 수정하여, 좌클릭만 처리하도록 기능 추가.

- **1.0.1 (옵션바 및 썸네일바 자동 숨김 동작 수정)**
  - 마우스 커서가 메뉴 위에 있을 때 메뉴가 유지되도록 개선함.

## 원본 저장소

본 프로젝트는 [Coxxs/twOpenOriginalImage](https://github.com/Coxxs/twOpenOriginalImage)를 기반으로 하고 있으며, 원본 코드 및 라이선스는 해당 저장소를 참조해 주시기 바랍니다.

## 라이선스

이 프로젝트는 [MIT 라이선스](https://opensource.org/licenses/MIT)를 따릅니다.
