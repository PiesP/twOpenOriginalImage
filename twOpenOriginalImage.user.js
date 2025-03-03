// ==UserScript==
// @name         X.com 이미지 원본 뷰어
// @namespace    https://github.com/PiesP/twOpenOriginalImage
// @version      1.0.4
// @description  X.com에서 이미지를 클릭하면 원본 크기로 로드하여 세로 배열 및 슬라이드쇼 모드, 메뉴바/썸네일 내비게이션 등 다양한 기능을 제공하는 스크립트
// @match        https://x.com/*
// @match        https://twitter.com/*
// @grant        none
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.3.0/js/all.min.js
// ==/UserScript==

(function () {
    'use strict';

    let currentIndex = 0;
    let imageUrls = [];
    let tweetUser = '';
    let tweetId = '';
    let hideOptionsBarTimer;
    let displayMode = localStorage.getItem('displayMode') || "vertical";
    let currentAdjustMode = localStorage.getItem('adjustMode') || "window";

    const STYLE = {
        viewer: `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            overflow-y: auto;
            z-index: 10000;
        `,
        optionsBar: (bg, text) => `
            width: 100%;
            padding: 10px;
            background: ${bg};
            color: ${text};
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            position: fixed;
            top: 0;
            left: 0;
            z-index: 10004;
            transition: transform 0.3s ease;
            transform: translateY(0);
        `,
        thumbnailBar: (bg) => `
            position: fixed;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 80px;
            background: ${bg};
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            transition: transform 0.3s ease;
            transform: translateY(0);
            z-index: 10004;
        `,
        navButton: `
            position: absolute;
            top: 50%;
            width: 100px;
            height: 100%;
            background: rgba(0, 0, 0, 0.2);
            color: white;
            border: none;
            cursor: pointer;
            z-index: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.3s;
            transform: translateY(-50%);
        `,
        iconButton: (bg, text) => `
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 6px 10px;
            background: ${bg};
            color: ${text};
            border: none;
            cursor: pointer;
            font-size: 16px;
        `,
        image: `
            display: block;
            width: auto;
            height: auto;
            max-width: 100%;
            object-fit: contain;
            transition: all 0.3s ease;
            transform-origin: top center;
            margin: 0;
        `
    };

    function getUserUIColor() {
        const computedStyle = getComputedStyle(document.body);
        const bgColor = computedStyle.backgroundColor || 'black';
        const textColor = computedStyle.color || 'white';
        return { bgColor, textColor };
    }

    function addAlpha(color, alpha) {
        if (color.startsWith("rgb(")) {
            return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
        }
        return color;
    }

    function parseRGB(colorStr) {
        const result = colorStr.match(/\d+/g);
        return result ? result.slice(0, 3).map(Number) : [0, 0, 0];
    }

    function getAdaptiveBorderColor() {
        const { bgColor } = getUserUIColor();
        const [r, g, b] = parseRGB(bgColor);
        const brightness = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        return brightness < 128 ? "#1da1f2" : "#0d8ecf";
    }

    function getFileExtension(url) {
        const urlParams = new URL(url).searchParams;
        const format = urlParams.get('format');
        return format ? format : 'jpg';
    }

    // 1.0.5: 트윗 요소 선택자를 다시 article로 복원
    function getTweetInfo(tweetElement) {
        const userMatch = tweetElement.querySelector('a[href^="/"]');
        tweetUser = userMatch ? userMatch.getAttribute('href').split('/')[1] : 'UnknownUser';
        tweetId = (window.location.href.match(/status\/(\d+)/) || [])[1] || 'UnknownID';
    }

    function getAllImagesFromTweet(tweetElement) {
        return [...tweetElement.querySelectorAll('img[src*="pbs.twimg.com/media/"]')]
            .map(img => img.src.replace(/&name=\w+/, '&name=orig'));
    }

    function preventXViewer(event) {
        if (event.button !== 0) return;
        const viewer = document.getElementById('xcom-image-viewer');
        if (viewer && viewer.contains(event.target)) return;
        if (event.target.closest('img[src*="pbs.twimg.com/media/"]')) {
            event.stopPropagation();
            event.preventDefault();
        }
    }

    // 1.0.5: 트윗 요소 선택자를 article로 복원하여 정상 동작하도록 함
    function onImageClick(event) {
        if (event.button !== 0) return;
        const imgElement = event.target.closest('img[src*="pbs.twimg.com/media/"]');
        if (!imgElement) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        const tweet = imgElement.closest('article');
        if (!tweet) return;
        getTweetInfo(tweet);
        imageUrls = getAllImagesFromTweet(tweet);
        currentIndex = imageUrls.indexOf(imgElement.src.replace(/&name=\w+/, '&name=orig'));
        if (imageUrls.length === 0) return;
        setTimeout(showImageViewer, 100);
    }

    function createViewer() {
        const existingViewer = document.getElementById('xcom-image-viewer');
        if (existingViewer) existingViewer.remove();
        document.body.style.overflow = 'hidden';
        const viewer = document.createElement('div');
        viewer.id = 'xcom-image-viewer';
        viewer.style.cssText = STYLE.viewer;
        return viewer;
    }

    function createOptionsBar() {
        const { bgColor, textColor } = getUserUIColor();
        const optionsBar = document.createElement('div');
        optionsBar.id = 'optionsBar';
        optionsBar.style.cssText = STYLE.optionsBar(addAlpha(bgColor, 0.8), textColor);
        hideOptionsBarTimer = setTimeout(() => {
            optionsBar.style.transform = 'translateY(-100%)';
        }, 1000);
        optionsBar.addEventListener('mouseenter', () => {
            clearTimeout(hideOptionsBarTimer);
            optionsBar.style.transform = 'translateY(0)';
        });
        optionsBar.addEventListener('mouseleave', () => {
            hideOptionsBarTimer = setTimeout(() => {
                optionsBar.style.transform = 'translateY(-100%)';
            }, 1000);
        });
        return optionsBar;
    }

    function createThumbnailBar() {
        const { bgColor } = getUserUIColor();
        const thumbnailBar = document.createElement('div');
        thumbnailBar.id = 'thumbnailBar';
        thumbnailBar.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 80px;
            background: ${addAlpha(bgColor, 0.8)};
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            transition: transform 0.3s ease;
            transform: translateY(0);
            z-index: 10004;
        `;
        thumbnailBar.hideTimer = setTimeout(() => {
            thumbnailBar.style.transform = 'translateY(100%)';
        }, 1000);
        thumbnailBar.addEventListener('mouseenter', () => {
            clearTimeout(thumbnailBar.hideTimer);
            thumbnailBar.style.transform = 'translateY(0)';
        });
        thumbnailBar.addEventListener('mouseleave', () => {
            thumbnailBar.hideTimer = setTimeout(() => {
                thumbnailBar.style.transform = 'translateY(100%)';
            }, 1000);
        });
        return thumbnailBar;
    }

    function createImageContainer() {
        const container = document.createElement('div');
        container.style.cssText = `
            position: relative;
            display: ${displayMode === "vertical" ? "flex" : "block"};
            flex-direction: ${displayMode === "vertical" ? "column" : "none"};
            align-items: center;
            width: 100%;
            padding: 0;
        `;
        imageUrls.forEach((url, index) => {
            const img = document.createElement('img');
            img.src = url;
            img.dataset.index = index;
            img.style.cssText = STYLE.image;
            img.addEventListener('click', (event) => {
                event.stopPropagation();
                currentIndex = (index + 1) % imageUrls.length;
                if (displayMode === "vertical") {
                    focusCurrentImage();
                } else {
                    updateDisplayMode();
                    if (currentAdjustMode) adjustImages(currentAdjustMode);
                }
            });
            container.appendChild(img);
        });
        return container;
    }

    function createIconButton(iconClass, onClick, tooltipText) {
        const { bgColor, textColor } = getUserUIColor();
        const button = document.createElement('button');
        button.innerHTML = `<i class="${iconClass}"></i>`;
        button.style.cssText = STYLE.iconButton(bgColor, textColor);
        if (tooltipText) button.title = tooltipText;
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            onClick();
        });
        return button;
    }

    function downloadCurrentImage() {
        if (!imageUrls.length) return;
        const url = imageUrls[currentIndex];
        const ext = getFileExtension(url);
        const filename = `${tweetUser}_${tweetId}_${currentIndex + 1}.${ext}`;
        saveAs(url, filename);
    }

    function downloadAllImages() {
        if (!imageUrls.length) return;
        const zip = new JSZip();
        const folder = zip.folder(`${tweetUser}_${tweetId}`);
        const promises = imageUrls.map((url, index) => {
            const ext = getFileExtension(url);
            const filename = `${tweetUser}_${tweetId}_${index + 1}.${ext}`;
            return fetch(url)
                .then(res => res.blob())
                .then(blob => folder.file(filename, blob));
        });
        Promise.all(promises).then(() => {
            zip.generateAsync({ type: 'blob' }).then(content => {
                saveAs(content, `${tweetUser}_${tweetId}.zip`);
            });
        });
    }

    function adjustImages(mode) {
        currentAdjustMode = mode;
        localStorage.setItem('adjustMode', mode);
        const container = document.querySelector('#xcom-image-viewer > div:not(#optionsBar):not(#thumbnailBar)');
        if (!container) return;
        const images = container.querySelectorAll('img');
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;
        
        images.forEach(img => {
            const recalc = () => {
                img.style.maxWidth = 'none';
                img.style.maxHeight = 'none';
                const imgWidth = img.naturalWidth;
                const imgHeight = img.naturalHeight;
                if (mode === 'width') {
                    const newWidth = Math.min(winWidth, imgWidth);
                    img.style.width = `${newWidth}px`;
                    img.style.height = 'auto';
                } else if (mode === 'height') {
                    const newHeight = Math.min(winHeight, imgHeight);
                    img.style.height = `${newHeight}px`;
                    img.style.width = 'auto';
                } else if (mode === 'window') {
                    const scale = Math.min(1, Math.min(winWidth / imgWidth, winHeight / imgHeight));
                    img.style.width = `${imgWidth * scale}px`;
                    img.style.height = `${imgHeight * scale}px`;
                }
            };
    
            if (!img.complete) {
                img.addEventListener('load', recalc);
            } else {
                recalc();
            }
        });
    }

    function navigateImage(direction) {
        const newIndex = currentIndex + direction;
        if (newIndex < 0 || newIndex >= imageUrls.length) return;
        currentIndex = newIndex;
        if (displayMode === "vertical") {
            focusCurrentImage();
        } else if (displayMode === "slideshow") {
            updateDisplayMode();
            if (currentAdjustMode) adjustImages(currentAdjustMode);
        }
    }

    function focusCurrentImage(initialLoad = false) {
        const viewer = document.getElementById('xcom-image-viewer');
        const images = viewer.querySelectorAll('img');
        const target = images[currentIndex];
        if (target) {
            viewer.scrollTo({ top: target.offsetTop, behavior: initialLoad ? 'auto' : 'smooth' });
            updateFocusedImageStyle();
            const imageSelect = document.getElementById('image-select');
            if (imageSelect) imageSelect.value = currentIndex;
        }
    }

    function updateFocusedImageStyle() {
        const images = document.querySelectorAll('#xcom-image-viewer img');
        images.forEach((img, index) => {
            img.style.border = index === currentIndex ? `3px solid ${getAdaptiveBorderColor()}` : 'none';
        });
        const thumbnailBar = document.getElementById('thumbnailBar');
        if (thumbnailBar) {
            thumbnailBar.querySelectorAll('img').forEach((thumb, index) => {
                thumb.style.border = index === currentIndex ? `3px solid ${getAdaptiveBorderColor()}` : 'none';
            });
        }
    }

    function toggleDisplayMode() {
        displayMode = displayMode === "vertical" ? "slideshow" : "vertical";
        localStorage.setItem('displayMode', displayMode);
        const toggleBtn = document.querySelector('#optionsBar button[title^="모드 전환"]');
        if (toggleBtn) {
            if (displayMode === "vertical") {
                toggleBtn.innerHTML = `<i class="fa-solid fa-columns"></i>`;
                toggleBtn.title = "모드 전환 (현재: 세로 스크롤)";
            } else {
                toggleBtn.innerHTML = `<i class="fa-solid fa-sliders-h"></i>`;
                toggleBtn.title = "모드 전환 (현재: 슬라이드쇼)";
            }
        }
        updateDisplayMode();
        if (displayMode === "slideshow") {
            currentAdjustMode = localStorage.getItem('adjustMode') || currentAdjustMode;
            if (currentAdjustMode) adjustImages(currentAdjustMode);
            addOverlayNavButtons(document.getElementById('xcom-image-viewer'));
        } else {
            removeOverlayNavButtons();
        }
    }

    function updateDisplayMode() {
        const viewer = document.getElementById('xcom-image-viewer');
        if (!viewer) return;
        const container = viewer.querySelector('div:not(#optionsBar):not(#thumbnailBar)');
        if (!container) return;
        const images = container.querySelectorAll('img');

        if (displayMode === "vertical") {
            container.style.display = "flex";
            container.style.flexDirection = "column";
            images.forEach(img => {
                img.style.display = "block";
                img.style.position = "static";
                img.style.top = "";
                img.style.left = "";
                img.style.transform = "";
            });
            focusCurrentImage(true);
            removeOverlayNavButtons();
        } else if (displayMode === "slideshow") {
            container.style.display = "block";
            images.forEach((img, index) => {
                img.style.display = (index === currentIndex) ? "block" : "none";
                img.style.position = "absolute";
                img.style.top = "0";
                img.style.left = "50%";
                img.style.transform = "translateX(-50%)";
                img.style.maxWidth = "90vw";
                img.style.maxHeight = "90vh";
            });
            addOverlayNavButtons(viewer);
        }
        updateFocusedImageStyle();
    }

    function addOverlayNavButtons(viewer) {
        if (!viewer.querySelector("#overlay-nav-left")) {
            const leftBtn = document.createElement('button');
            leftBtn.id = "overlay-nav-left";
            leftBtn.innerHTML = `<i class="fa-solid fa-arrow-left" style="font-size:24px;"></i>`;
            leftBtn.style.cssText = STYLE.navButton + "left: 0;";
            leftBtn.addEventListener('mouseenter', () => leftBtn.style.opacity = "1");
            leftBtn.addEventListener('mouseleave', () => leftBtn.style.opacity = "0");
            leftBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                navigateImage(-1);
            });
            viewer.insertBefore(leftBtn, viewer.firstChild);
        }
        if (!viewer.querySelector("#overlay-nav-right")) {
            const rightBtn = document.createElement('button');
            rightBtn.id = "overlay-nav-right";
            rightBtn.innerHTML = `<i class="fa-solid fa-arrow-right" style="font-size:24px;"></i>`;
            rightBtn.style.cssText = STYLE.navButton + "right: 0;";
            rightBtn.addEventListener('mouseenter', () => rightBtn.style.opacity = "1");
            rightBtn.addEventListener('mouseleave', () => rightBtn.style.opacity = "0");
            rightBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                navigateImage(1);
            });
            viewer.insertBefore(rightBtn, viewer.children[1]);
        }
    }

    function removeOverlayNavButtons() {
        const leftBtn = document.getElementById("overlay-nav-left");
        if (leftBtn) leftBtn.remove();
        const rightBtn = document.getElementById("overlay-nav-right");
        if (rightBtn) rightBtn.remove();
    }

    function showImageViewer() {
        const savedScrollPos = window.pageYOffset || document.documentElement.scrollTop;
        const existingViewer = document.getElementById('xcom-image-viewer');
        if (existingViewer) existingViewer.remove();
        document.body.style.overflow = 'hidden';
    
        const viewer = createViewer();
        const { bgColor, textColor } = getUserUIColor();
    
        const optionsBar = createOptionsBar();
        const prevBtn = createIconButton('fa-solid fa-arrow-left', () => navigateImage(-1), '이전 이미지');
        const nextBtn = createIconButton('fa-solid fa-arrow-right', () => navigateImage(1), '다음 이미지');
        const fitWidthBtn = createIconButton('fa-solid fa-arrows-left-right', () => adjustImages('width'), '너비 맞춤');
        const fitHeightBtn = createIconButton('fa-solid fa-arrows-up-down', () => adjustImages('height'), '높이 맞춤');
        const fitWindowBtn = createIconButton('fa-solid fa-expand', () => adjustImages('window'), '창 맞춤');
        const downloadCurrentBtn = createIconButton('fa-solid fa-download', downloadCurrentImage, '현재 이미지 저장');
        const downloadAllBtn = createIconButton('fa-solid fa-file-zipper', downloadAllImages, '모든 이미지 저장');
    
        const imageSelect = document.createElement('select');
        imageSelect.id = 'image-select';
        imageUrls.forEach((url, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = (index + 1).toString();
            imageSelect.appendChild(option);
        });
        imageSelect.addEventListener('change', () => {
            currentIndex = parseInt(imageSelect.value);
            if (displayMode === "vertical") {
                focusCurrentImage();
            } else {
                updateDisplayMode();
                if (currentAdjustMode) adjustImages(currentAdjustMode);
            }
        });
    
        const toggleModeBtn = createIconButton(
            displayMode === "vertical" ? 'fa-solid fa-columns' : 'fa-solid fa-sliders-h',
            toggleDisplayMode,
            displayMode === "vertical" ? "모드 전환 (현재: 세로 스크롤)" : "모드 전환 (현재: 슬라이드쇼)"
        );
    
        const closeBtn = createIconButton('fa-solid fa-xmark', () => {
            viewer.remove();
            document.body.style.overflow = '';
            removeOverlayNavButtons();
            window.scrollTo(0, savedScrollPos);
        }, '닫기 (Esc키로도 닫힘)');
        closeBtn.style.marginLeft = 'auto';
        closeBtn.style.marginRight = '30px';
    
        optionsBar.append(prevBtn, imageSelect, nextBtn, fitWidthBtn, fitHeightBtn, fitWindowBtn, downloadCurrentBtn, downloadAllBtn, toggleModeBtn, closeBtn);
    
        const imageContainer = createImageContainer();
        const thumbnailBar = createThumbnailBar();
        imageUrls.forEach((url, index) => {
            const thumb = document.createElement('img');
            thumb.src = url;
            thumb.dataset.index = index;
            thumb.style.cssText = `
                height: 60px;
                max-height: 60px;
                cursor: pointer;
                transition: border 0.3s ease;
                border: ${index === currentIndex ? `3px solid ${getAdaptiveBorderColor()}` : 'none'};
            `;
            thumb.addEventListener('click', (event) => {
                event.stopPropagation();
                currentIndex = index;
                if (displayMode === "vertical") {
                    focusCurrentImage();
                } else {
                    updateDisplayMode();
                    if (currentAdjustMode) adjustImages(currentAdjustMode);
                }
            });
            thumbnailBar.appendChild(thumb);
        });
        thumbnailBar.addEventListener('mouseenter', () => {
            clearTimeout(thumbnailBar.hideTimer);
            thumbnailBar.style.transform = 'translateY(0)';
        });
        thumbnailBar.addEventListener('mouseleave', () => {
            thumbnailBar.hideTimer = setTimeout(() => {
                thumbnailBar.style.transform = 'translateY(100%)';
            }, 1000);
        });
    
        viewer.addEventListener('click', (event) => {
            const optBar = document.getElementById('optionsBar');
            const thumbBar = document.getElementById('thumbnailBar');
            if (!optBar.contains(event.target) && !thumbBar.contains(event.target)) {
                viewer.remove();
                document.body.style.overflow = '';
                removeOverlayNavButtons();
                window.scrollTo(0, savedScrollPos);
            }
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                viewer.remove();
                document.body.style.overflow = '';
                removeOverlayNavButtons();
                window.scrollTo(0, savedScrollPos);
            }
        });
    
        viewer.addEventListener('mousemove', function(e) {
            if (e.clientY < 50 && optionsBar && !optionsBar.contains(e.target)) {
                clearTimeout(hideOptionsBarTimer);
                optionsBar.style.transform = 'translateY(0)';
                hideOptionsBarTimer = setTimeout(() => {
                    optionsBar.style.transform = 'translateY(-100%)';
                }, 1000);
            }
            if (e.clientY > window.innerHeight - 50 && thumbnailBar && !thumbnailBar.contains(e.target)) {
                clearTimeout(thumbnailBar.hideTimer);
                thumbnailBar.style.transform = 'translateY(0)';
                thumbnailBar.hideTimer = setTimeout(() => {
                    thumbnailBar.style.transform = 'translateY(100%)';
                }, 1000);
            }
        });
    
        addOverlayNavButtons(viewer);
        viewer.append(optionsBar, imageContainer, thumbnailBar);
        document.body.appendChild(viewer);
    
        if (displayMode === "vertical") {
            focusCurrentImage(true);
            removeOverlayNavButtons();
        } else {
            updateDisplayMode();
            if (currentAdjustMode) adjustImages(currentAdjustMode);
            addOverlayNavButtons(viewer);
        }
        setupIntersectionObserver();
        setupThemeObserver();
    }
    
    function setupIntersectionObserver() {
        const viewer = document.getElementById('xcom-image-viewer');
        const images = viewer.querySelectorAll('img');
        const options = { root: viewer, threshold: 0.5 };
        const observer = new IntersectionObserver((entries) => {
            let maxRatio = 0;
            let newFocusIndex = currentIndex;
            entries.forEach(entry => {
                if (entry.intersectionRatio > maxRatio) {
                    maxRatio = entry.intersectionRatio;
                    newFocusIndex = parseInt(entry.target.dataset.index);
                }
            });
            if (newFocusIndex !== currentIndex) {
                currentIndex = newFocusIndex;
                updateFocusedImageStyle();
                const imageSelect = document.getElementById('image-select');
                if (imageSelect) imageSelect.value = currentIndex;
            }
        }, options);
        images.forEach(img => observer.observe(img));
    }
    
    function setupThemeObserver() {
        const observer = new MutationObserver(updateUIColors);
        observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
    }
    
    function updateUIColors() {
        const { bgColor, textColor } = getUserUIColor();
        const optionsBar = document.getElementById('optionsBar');
        if (optionsBar) {
            optionsBar.style.background = addAlpha(bgColor, 0.8);
            optionsBar.style.color = textColor;
        }
        const thumbnailBar = document.getElementById('thumbnailBar');
        if (thumbnailBar) {
            thumbnailBar.style.background = addAlpha(bgColor, 0.8);
        }
        document.querySelectorAll('#xcom-image-viewer button').forEach(button => {
            button.style.background = bgColor;
            button.style.color = textColor;
        });
        updateFocusedImageStyle();
    }
    
    document.addEventListener('keydown', (event) => {
        const viewer = document.getElementById('xcom-image-viewer');
        if (!viewer) return;
        if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
            navigateImage(-1);
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
            navigateImage(1);
        } else if (event.key === 'Escape') {
            viewer.remove();
            document.body.style.overflow = '';
            removeOverlayNavButtons();
        }
    });
    document.addEventListener('pointerdown', preventXViewer, true);
    document.addEventListener('click', preventXViewer, true);
    document.addEventListener('pointerdown', onImageClick, true);
    
})();
