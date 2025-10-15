function initSwiper() {
    new Swiper('.swiper', {
        // 필수 옵션
        direction: 'horizontal',
        loop: true, // 무한 반복

        // 페이지네이션 (점 dot)
        pagination: {
            el: '.swiper-pagination',
            clickable: true, // 점을 클릭해서 이동 가능
        },

        // 자동 재생 설정
        autoplay: {
            delay: 4000, // 4초마다 슬라이드 전환
            disableOnInteraction: false, // 사용자가 드래그해도 자동 재생 멈추지 않음
        },
        
        // 슬라이드 효과 (선택 사항: 'fade' 등)
        effect: 'slide',
        speed: 1000, // 전환 속도 1초
    });
}

document.addEventListener("DOMContentLoaded", initSwiper);